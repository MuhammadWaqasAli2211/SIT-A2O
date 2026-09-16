"""Candidate ID cards: the admin's per-intake switch, and the download.

The switch is deliberately thin — it writes one timestamp and nothing else.
Nothing is generated, sent or advanced when it goes on; the card is drawn on
demand when a candidate asks for it, so turning the switch off is a real undo
rather than the partial one the AI interview announcement can offer.
"""

import uuid

from fastapi import APIRouter, Response

from app.api.deps import AdminUser, CandidateUser, DbSession
from app.schemas.id_card import IdCardIssueRequest, IdCardIssueState
from app.services import application_service, audit_service, bootcamp_service, id_card_service

router = APIRouter(tags=["id-cards"])


def _state(db: DbSession, bootcamp_id: uuid.UUID) -> IdCardIssueState:
    from app.models.bootcamp import Bootcamp

    bootcamp = db.get(Bootcamp, bootcamp_id)
    return IdCardIssueState(
        issued=bool(bootcamp and bootcamp.id_cards_issued_at),
        issued_at=bootcamp.id_cards_issued_at if bootcamp else None,
        issued_by=bootcamp.id_cards_issued_by if bootcamp else None,
        valid_from=bootcamp.id_cards_valid_from if bootcamp else None,
        valid_to=bootcamp.id_cards_valid_to if bootcamp else None,
        eligible_count=id_card_service.eligible_count(db, bootcamp_id),
    )


@router.get("/admin/bootcamps/{bootcamp_id}/id-cards", response_model=IdCardIssueState)
def read_state(bootcamp_id: uuid.UUID, user: AdminUser, db: DbSession) -> IdCardIssueState:
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)
    return _state(db, bootcamp_id)


@router.put("/admin/bootcamps/{bootcamp_id}/id-cards", response_model=IdCardIssueState)
def set_state(
    bootcamp_id: uuid.UUID,
    payload: IdCardIssueRequest,
    user: AdminUser,
    db: DbSession,
) -> IdCardIssueState:
    """Issue ID cards for this intake, or withdraw them again.

    Reversible in the full sense: off hides the download for every candidate
    in the intake and leaves nothing behind. Cards already downloaded are of
    course still in the candidate's hands — this controls the offer, not the
    paper.
    """
    bootcamp_service.assert_can_manage(db, user, bootcamp_id)
    id_card_service.set_issued(
        db,
        bootcamp_id,
        issued=payload.issued,
        actor=user,
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
    )

    audit_service.record(
        db,
        actor=user,
        action="id_card.issue" if payload.issued else "id_card.withdraw",
        entity_type="bootcamp",
        entity_id=bootcamp_id,
        summary=(
            f"ID cards issued, valid {payload.valid_from} to {payload.valid_to}"
            if payload.issued
            else "ID cards withdrawn"
        ),
    )
    db.commit()
    return _state(db, bootcamp_id)


@router.get("/applications/{application_id}/id-card", tags=["candidate"])
def download(application_id: uuid.UUID, user: CandidateUser, db: DbSession) -> Response:
    """The candidate's own two-page card, drawn on request.

    Nothing is stored: the card is built from live data every time, so a name
    corrected today is right on tomorrow's download. `get_own` is what keeps
    one candidate from fetching another's.
    """
    application = application_service.get_own(db, user, application_id)
    id_card_service.assert_can_download(db, application)

    pdf = id_card_service.render(db, application)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{id_card_service.file_name(application)}"'
            )
        },
    )
