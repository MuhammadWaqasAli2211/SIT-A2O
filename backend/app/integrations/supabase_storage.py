"""Thin client over Supabase Storage for candidate document and picture uploads.

The bucket is **private**. Nothing in the browser ever holds a storage
credential or a permanent object URL: the API uploads with the service-role
key, and hands out short-lived signed URLs for reads. That keeps the same
boundary the rest of the project already draws — the frontend never talks to
Supabase directly.

Plain `httpx` rather than the `supabase` SDK, consistent with how
`supabase_auth.py` and `gmail_api.py` talk to their services.

Two buckets, two independent groups of functions below: documents (CNIC,
qualification, bank letter — admin-reviewed) and candidate pictures (uploaded
during registration, never reviewed). They share nothing but the transport, so
they are not collapsed into one parameterised set of functions.
"""

import logging
import uuid
from pathlib import PurePosixPath

import httpx

from app.core.config import settings
from app.core.exceptions import NotFoundError, UpstreamError

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(30.0, connect=5.0)


def _headers() -> dict[str, str]:
    return {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
    }


def _object_url(path: str) -> str:
    return f"{settings.storage_url}/object/{settings.DOCUMENTS_BUCKET}/{path}"


def ensure_bucket() -> None:
    """Create the private document bucket if it is not there yet.

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
    """Write a document object, replacing any existing one at the same path.

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
    """Mint a temporary read URL for one document object.

    Returned instead of proxying the bytes back through FastAPI: the file goes
    browser-to-Supabase, so a 5 MB scan does not occupy an API worker.

    Raises on failure — a document that fails to sign is a real error the
    caller must surface, unlike a picture (see `picture_signed_url` below).
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
    """Remove a document object. A missing object is not an error.

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


# ------------------------------------------------------- candidate pictures --

PICTURE_BUCKET = "candidate-pictures"

PICTURE_MAX_BYTES = 1024 * 1024
PICTURE_ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png"}
_PICTURE_EXTENSIONS = {"image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png"}

# Long enough to load a page, short enough that a leaked URL expires quickly.
PICTURE_SIGNED_URL_TTL_SECONDS = 60 * 60


def object_path(profile_id: uuid.UUID, content_type: str) -> str:
    """`{profile_id}/{random}.jpg`.

    The owner is the first path segment. Nothing enforces that here — the
    service role can write anywhere — but keeping the convention means the
    RLS policies stay a one-line change if direct client access is ever wanted,
    and it makes an object's owner obvious when reading the bucket by hand.

    The filename is random rather than the uploaded name: user-supplied
    filenames carry path separators, unicode tricks, and the occasional
    surprise extension.
    """
    suffix = _PICTURE_EXTENSIONS.get(content_type, ".jpg")
    return f"{profile_id}/{uuid.uuid4().hex}{suffix}"


def upload_picture(*, path: str, data: bytes, content_type: str) -> str:
    """Store one candidate picture and return its object path.

    `x-upsert` is on so re-registering replaces rather than accumulating —
    the path is random per upload, so this only matters on a retry of the
    same request.
    """
    url = f"{settings.SUPABASE_URL}/storage/v1/object/{PICTURE_BUCKET}/{path}"
    try:
        response = httpx.post(
            url,
            headers={**_headers(), "Content-Type": content_type, "x-upsert": "true"},
            content=data,
            timeout=30,
        )
    except httpx.HTTPError as exc:
        raise UpstreamError("Could not reach the storage service.") from exc

    if response.status_code >= 400:
        logger.error("Storage upload failed: %s %s", response.status_code, response.text[:300])
        raise UpstreamError("Could not store the picture.")
    return path


def picture_signed_url(
    path: str, *, expires_in: int = PICTURE_SIGNED_URL_TTL_SECONDS
) -> str | None:
    """A time-limited read URL for a candidate picture, or None if one cannot
    be produced.

    Returns None rather than raising: a profile page that cannot render an
    avatar is a cosmetic problem, and should not fail the whole request.
    """
    url = f"{settings.SUPABASE_URL}/storage/v1/object/sign/{PICTURE_BUCKET}/{path}"
    try:
        response = httpx.post(
            url, headers=_headers(), json={"expiresIn": expires_in}, timeout=15
        )
        if response.status_code >= 400:
            logger.warning("Signing failed for %s: %s", path, response.status_code)
            return None
        signed = response.json().get("signedURL")
    except (httpx.HTTPError, ValueError):
        logger.warning("Signing errored for %s", path, exc_info=True)
        return None

    if not signed:
        return None
    # The API returns a path relative to /storage/v1.
    return f"{settings.SUPABASE_URL}/storage/v1{signed}" if signed.startswith("/") else signed


def is_owned_by(path: str, profile_id: uuid.UUID) -> bool:
    """Whether a picture object path belongs to this profile.

    Checked before signing so one candidate cannot obtain a URL for another's
    photo by passing someone else's path.
    """
    parts = PurePosixPath(path).parts
    return bool(parts) and parts[0] == str(profile_id)
