"""Program (track) reference data.

The list is public — the marketing site renders it. Writes are super-admin
only: programs are shared across every intake, so a bootcamp admin editing one
would change what other intakes advertise.
"""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select

from app.api.deps import AdminUser, DbSession, SuperAdminUser, require_super_admin
from app.models.application import Application
from app.models.bootcamp import BootcampProgram
from app.schemas.bootcamp import ProgramAdminOut, ProgramCreate, ProgramOut, ProgramUpdate
from app.services import bootcamp_service

router = APIRouter(prefix="/programs", tags=["programs"])


@router.get("", response_model=list[ProgramOut], tags=["public"])
def list_programs(db: DbSession) -> list[ProgramOut]:
    """Active tracks. Public: the marketing site renders these."""
    return [ProgramOut.model_validate(p) for p in bootcamp_service.list_programs(db)]


@router.get("/manage", response_model=list[ProgramAdminOut])
def list_programs_for_admin(user: AdminUser, db: DbSession) -> list[ProgramAdminOut]:
    """Every track including deactivated ones, with usage counts.

    The counts are what make deletion predictable: they say up front whether
    the service will refuse, instead of surfacing it as a 409 after the click.
    """
    offered = dict(
        db.execute(
            select(BootcampProgram.program_id, func.count()).group_by(BootcampProgram.program_id)
        ).all()
    )
    applied = dict(
        db.execute(
            select(Application.program_id, func.count()).group_by(Application.program_id)
        ).all()
    )

    return [
        ProgramAdminOut(
            **ProgramOut.model_validate(program).model_dump(),
            is_active=program.is_active,
            sort_order=program.sort_order,
            bootcamp_count=offered.get(program.id, 0),
            application_count=applied.get(program.id, 0),
        )
        for program in bootcamp_service.list_programs(db, include_inactive=True)
    ]


@router.post(
    "",
    response_model=ProgramOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_super_admin)],
)
def create_program(payload: ProgramCreate, user: SuperAdminUser, db: DbSession) -> ProgramOut:
    return ProgramOut.model_validate(bootcamp_service.create_program(db, payload, user))


@router.patch(
    "/{program_id}", response_model=ProgramOut, dependencies=[Depends(require_super_admin)]
)
def update_program(
    program_id: uuid.UUID, payload: ProgramUpdate, user: SuperAdminUser, db: DbSession
) -> ProgramOut:
    return ProgramOut.model_validate(bootcamp_service.update_program(db, program_id, payload, user))


@router.delete(
    "/{program_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_super_admin)],
)
def delete_program(program_id: uuid.UUID, user: SuperAdminUser, db: DbSession) -> None:
    """Refused while any intake still offers it — deactivate instead."""
    bootcamp_service.delete_program(db, program_id, user)
