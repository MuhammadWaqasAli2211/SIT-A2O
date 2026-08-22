"""Candidate profile writes that are not part of submitting an application."""

import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
from app.integrations import supabase_storage
from app.models.user import CandidateProfile, Profile


def _ensure_row(db: Session, profile_id: uuid.UUID) -> CandidateProfile:
    """The row may not exist yet — a picture can be uploaded before submitting."""
    row = db.get(CandidateProfile, profile_id)
    if row is None:
        row = CandidateProfile(profile_id=profile_id)
        db.add(row)
        db.flush()
    return row


def store_picture(db: Session, user: Profile, *, data: bytes, content_type: str) -> str:
    """Validate, upload, and record the path.

    Size and type are checked here as well as on the bucket. The bucket is the
    real enforcement; this exists so a rejection comes back as a clear 409
    rather than an opaque upstream error.
    """
    if not data:
        raise ConflictError("The uploaded file is empty.")
    if len(data) > supabase_storage.MAX_BYTES:
        raise ConflictError("Picture must be under 1 MB.")
    if content_type not in supabase_storage.ALLOWED_TYPES:
        raise ConflictError("Picture must be a JPG, JPEG or PNG.")

    path = supabase_storage.object_path(user.id, content_type)
    supabase_storage.upload_picture(path=path, data=data, content_type=content_type)

    row = _ensure_row(db, user.id)
    row.picture_path = path
    db.flush()
    return path


def picture_path(db: Session, user: Profile) -> str | None:
    row = db.get(CandidateProfile, user.id)
    path = row.picture_path if row else None
    # Defensive: only ever sign an object the caller owns, even though the
    # path came from their own row.
    if path and not supabase_storage.is_owned_by(path, user.id):
        return None
    return path
