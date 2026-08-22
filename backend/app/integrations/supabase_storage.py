"""Supabase Storage, reached with the service role.

The browser never talks to Storage directly — it posts the file here and this
module forwards it. That keeps the project's rule that all traffic goes through
FastAPI, and means the bucket needs no client-facing RLS policies at all: it is
private, and nothing outside this process holds a key to it.

Reads are handed out as short-lived signed URLs rather than public links, so a
candidate's photo is not guessable from their id.
"""

import logging
import uuid
from pathlib import PurePosixPath

import httpx

from app.core.config import settings
from app.core.exceptions import UpstreamError

logger = logging.getLogger(__name__)

BUCKET = "candidate-pictures"

MAX_BYTES = 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png"}
_EXTENSIONS = {"image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png"}

# Long enough to load a page, short enough that a leaked URL expires quickly.
SIGNED_URL_TTL_SECONDS = 60 * 60


def _headers() -> dict[str, str]:
    key = settings.SUPABASE_SERVICE_ROLE_KEY
    return {"Authorization": f"Bearer {key}", "apikey": key}


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
    suffix = _EXTENSIONS.get(content_type, ".jpg")
    return f"{profile_id}/{uuid.uuid4().hex}{suffix}"


def upload_picture(*, path: str, data: bytes, content_type: str) -> str:
    """Store one image and return its object path.

    `x-upsert` is on so re-registering replaces rather than accumulating —
    the path is random per upload, so this only matters on a retry of the
    same request.
    """
    url = f"{settings.SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
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


def signed_url(path: str, *, expires_in: int = SIGNED_URL_TTL_SECONDS) -> str | None:
    """A time-limited read URL, or None if one cannot be produced.

    Returns None rather than raising: a profile page that cannot render an
    avatar is a cosmetic problem, and should not fail the whole request.
    """
    url = f"{settings.SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{path}"
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
    """Whether an object path belongs to this profile.

    Checked before signing so one candidate cannot obtain a URL for another's
    photo by passing someone else's path.
    """
    parts = PurePosixPath(path).parts
    return bool(parts) and parts[0] == str(profile_id)
