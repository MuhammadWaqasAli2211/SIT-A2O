"""Thin client over Supabase Storage for candidate document uploads.

The bucket is **private**. Nothing in the browser ever holds a storage
credential or a permanent object URL: the API uploads with the service-role
key, and hands out short-lived signed URLs for reads. That keeps the same
boundary the rest of the project already draws — the frontend never talks to
Supabase directly.

Plain `httpx` rather than the `supabase` SDK, consistent with how
`supabase_auth.py` and `gmail_api.py` talk to their services.
"""

import httpx

from app.core.config import settings
from app.core.exceptions import NotFoundError, UpstreamError

_TIMEOUT = httpx.Timeout(30.0, connect=5.0)


def _headers() -> dict[str, str]:
    return {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
    }


def _object_url(path: str) -> str:
    return f"{settings.storage_url}/object/{settings.DOCUMENTS_BUCKET}/{path}"


def ensure_bucket() -> None:
    """Create the private bucket if it is not there yet.

    Idempotent, and safe to call at boot: an existing bucket returns a
    duplicate error, which is success as far as this function is concerned.
    """
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.post(
                f"{settings.storage_url}/bucket",
                headers={**_headers(), "Content-Type": "application/json"},
                json={
                    "id": settings.DOCUMENTS_BUCKET,
                    "name": settings.DOCUMENTS_BUCKET,
                    "public": False,
                    "file_size_limit": settings.DOCUMENT_MAX_BYTES,
                },
            )
    except httpx.RequestError as exc:
        raise UpstreamError("Could not reach Supabase Storage.") from exc

    if response.is_success:
        return
    # Already exists is the normal path on every boot after the first.
    if response.status_code == 409 or "already exists" in response.text.lower():
        return
    raise UpstreamError("Could not create the documents bucket.", details=response.text[:300])


def upload(path: str, content: bytes, content_type: str) -> None:
    """Write an object, replacing any existing one at the same path.

    `x-upsert` matters: a candidate re-uploading their CNIC reuses the row and
    therefore the path, and a plain POST would fail with a duplicate.
    """
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.post(
                _object_url(path),
                headers={
                    **_headers(),
                    "Content-Type": content_type,
                    "x-upsert": "true",
                },
                content=content,
            )
    except httpx.RequestError as exc:
        raise UpstreamError("Could not reach Supabase Storage.") from exc

    if not response.is_success:
        raise UpstreamError("Upload failed.", details=response.text[:300])


def signed_url(path: str, *, expires_in: int | None = None) -> str:
    """Mint a temporary read URL for one object.

    Returned instead of proxying the bytes back through FastAPI: the file goes
    browser-to-Supabase, so a 5 MB scan does not occupy an API worker.
    """
    ttl = expires_in or settings.DOCUMENT_SIGNED_URL_TTL
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.post(
                f"{settings.storage_url}/object/sign/{settings.DOCUMENTS_BUCKET}/{path}",
                headers={**_headers(), "Content-Type": "application/json"},
                json={"expiresIn": ttl},
            )
    except httpx.RequestError as exc:
        raise UpstreamError("Could not reach Supabase Storage.") from exc

    if response.status_code == 404:
        raise NotFoundError("That file is no longer in storage.")
    if not response.is_success:
        raise UpstreamError("Could not sign the file URL.", details=response.text[:300])

    # Supabase returns a path relative to the storage root.
    return f"{settings.storage_url}{response.json()['signedURL'].replace('/storage/v1', '')}"


def delete(path: str) -> None:
    """Remove an object. A missing object is not an error.

    Called after the database row is already gone, so failing here would leave
    the caller with nothing useful to do about it.
    """
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            response = client.delete(_object_url(path), headers=_headers())
    except httpx.RequestError:
        return

    if not response.is_success and response.status_code != 404:
        raise UpstreamError("Could not delete the file.", details=response.text[:300])
