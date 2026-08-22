"""Candidate profile: the picture upload and its read URL.

Separate from /auth because this is candidate data rather than session
management, and separate from /applications because a picture belongs to the
person, not to any one intake — re-applying should not mean re-uploading.
"""

from fastapi import APIRouter, File, UploadFile

from app.api.deps import CandidateUser, DbSession
from app.integrations import supabase_storage
from app.schemas.user import PictureOut
from app.services import profile_service

router = APIRouter(prefix="/profile", tags=["profile"])


@router.post("/picture", response_model=PictureOut)
async def upload_picture(
    user: CandidateUser, db: DbSession, file: UploadFile = File(...)
) -> PictureOut:
    """Store the candidate's photo and record its path.

    Uploaded before the registration is submitted rather than with it: a
    failed upload should cost the candidate one retry, not the whole form.
    """
    data = await file.read()
    path = profile_service.store_picture(
        db, user, data=data, content_type=file.content_type or ""
    )
    return PictureOut(picture_path=path, url=supabase_storage.picture_signed_url(path))


@router.get("/picture", response_model=PictureOut)
def get_picture(user: CandidateUser, db: DbSession) -> PictureOut:
    """A fresh signed URL for the caller's own picture."""
    path = profile_service.picture_path(db, user)
    if path is None:
        return PictureOut(picture_path=None, url=None)
    return PictureOut(picture_path=path, url=supabase_storage.picture_signed_url(path))
