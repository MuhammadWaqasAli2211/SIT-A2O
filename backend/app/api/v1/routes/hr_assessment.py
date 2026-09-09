"""HR Assessment — the combined screening-plus-paperwork roster.

Read-only. Every action an admin can take on a candidate on this screen
(reopening a form, approving a document, deciding a reinterview) already has
its own audited route elsewhere and is reached from there; nothing here
writes, so there is no second write path to keep consistent with the first.
"""

import uuid

from fastapi import APIRouter

from app.api.deps import AdminUser, DbSession
from app.schemas.hr_assessment import HrAssessmentPage
from app.services import hr_assessment_service

router = APIRouter(tags=["hr-assessment"])


@router.get("/hr-assessment", response_model=HrAssessmentPage)
def list_hr_assessment(
    user: AdminUser, db: DbSession, bootcamp_id: uuid.UUID | None = None
) -> HrAssessmentPage:
    """Onboarding candidates with their AI screening result.

    An ADMIN must supply `bootcamp_id` and is checked against it; a
    SUPER_ADMIN may omit it for the platform-wide view. The same contract as
    `/ai-interviews/completed`, and enforced in the service rather than here
    so both routes cannot drift apart.
    """
    return hr_assessment_service.list_rows(db, user, bootcamp_id)
