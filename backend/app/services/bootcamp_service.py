"""Bootcamp lifecycle: creation, admin assignment, and phase gating.

Deadline enforcement lives here rather than in the routes, so every caller —
including a future AI-interviewer callback — passes through the same checks.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.models.application import Application
from app.models.bootcamp import (
    Bootcamp,
    BootcampAdmin,
    BootcampPhase,
    BootcampProgram,
    Program,
)
from app.models.enums import BootcampStatus, PhaseType, UserRole
from app.models.user import Profile
from app.schemas.bootcamp import BootcampCreate, BootcampUpdate

# Every bootcamp gets all four phases at creation, closed, so an admin only
# ever opens and dates them rather than creating them ad hoc.
_ALL_PHASES = (PhaseType.REGISTRATION, PhaseType.INTERVIEW, PhaseType.FORM, PhaseType.ONBOARDING)


class PhaseClosedError(PermissionDeniedError):
    code = "phase_closed"
    message = "This stage is closed."


def list_programs(db: Session) -> list[Program]:
    return list(
        db.scalars(
            select(Program).where(Program.is_active.is_(True)).order_by(Program.sort_order)
        )
    )


def get_bootcamp(db: Session, bootcamp_id: uuid.UUID) -> Bootcamp:
    bootcamp = db.scalar(
        select(Bootcamp)
        .where(Bootcamp.id == bootcamp_id)
        .options(
            selectinload(Bootcamp.phases),
            selectinload(Bootcamp.programs).selectinload(BootcampProgram.program),
        )
    )
    if bootcamp is None:
        raise NotFoundError("Bootcamp not found.")
    return bootcamp


def assert_can_manage(db: Session, user: Profile, bootcamp_id: uuid.UUID) -> None:
    """Role plus scope: an ADMIN may only touch bootcamps assigned to them.

    A valid token is not sufficient — without this an admin could operate on
    another intake's candidates simply by changing the id in the URL.
    """
    if user.role == UserRole.SUPER_ADMIN:
        return

    assigned = db.scalar(
        select(BootcampAdmin).where(
            BootcampAdmin.bootcamp_id == bootcamp_id,
            BootcampAdmin.profile_id == user.id,
        )
    )
    if assigned is None:
        raise PermissionDeniedError("You are not assigned to this bootcamp.")


def visible_bootcamps(db: Session, user: Profile) -> list[Bootcamp]:
    """Super admins see every intake; admins see only their own."""
    stmt = select(Bootcamp).order_by(Bootcamp.bootcamp_number.desc())
    if user.role != UserRole.SUPER_ADMIN:
        stmt = stmt.join(BootcampAdmin, BootcampAdmin.bootcamp_id == Bootcamp.id).where(
            BootcampAdmin.profile_id == user.id
        )
    return list(db.scalars(stmt))


def create_bootcamp(db: Session, actor: Profile, payload: BootcampCreate) -> Bootcamp:
    existing = db.scalar(
        select(Bootcamp).where(Bootcamp.bootcamp_number == payload.bootcamp_number)
    )
    if existing is not None:
        raise ConflictError(f"Bootcamp number {payload.bootcamp_number} already exists.")

    bootcamp = Bootcamp(
        bootcamp_number=payload.bootcamp_number,
        name=payload.name,
        description=payload.description,
        starts_at=payload.starts_at,
        status=BootcampStatus.DRAFT,
        created_by=actor.id,
    )
    db.add(bootcamp)
    db.flush()

    for program_id in payload.program_ids:
        db.add(BootcampProgram(bootcamp_id=bootcamp.id, program_id=program_id))

    for phase in _ALL_PHASES:
        db.add(BootcampPhase(bootcamp_id=bootcamp.id, phase=phase, is_open=False))

    db.flush()
    return get_bootcamp(db, bootcamp.id)


def update_bootcamp(
    db: Session, bootcamp_id: uuid.UUID, payload: BootcampUpdate
) -> Bootcamp:
    bootcamp = get_bootcamp(db, bootcamp_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(bootcamp, field, value)
    db.flush()
    return bootcamp


def assign_admin(
    db: Session, bootcamp_id: uuid.UUID, profile_id: uuid.UUID, actor: Profile
) -> None:
    get_bootcamp(db, bootcamp_id)

    target = db.get(Profile, profile_id)
    if target is None:
        raise NotFoundError("User not found.")
    if target.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise ConflictError("That user is not an administrator.")

    already = db.get(BootcampAdmin, {"bootcamp_id": bootcamp_id, "profile_id": profile_id})
    if already is not None:
        raise ConflictError("That administrator is already assigned.")

    db.add(
        BootcampAdmin(bootcamp_id=bootcamp_id, profile_id=profile_id, assigned_by=actor.id)
    )
    db.flush()


# ------------------------------------------------------------------ phases --


def get_phase(db: Session, bootcamp_id: uuid.UUID, phase: PhaseType) -> BootcampPhase:
    row = db.scalar(
        select(BootcampPhase).where(
            BootcampPhase.bootcamp_id == bootcamp_id, BootcampPhase.phase == phase
        )
    )
    if row is None:
        raise NotFoundError(f"{phase} phase not configured for this bootcamp.")
    return row


def is_phase_open(phase: BootcampPhase, *, now: datetime | None = None) -> bool:
    """A phase is open only if the flag is set *and* the clock agrees.

    The flag alone is not enough: a deadline that has passed must close the
    phase even if nobody has clicked anything.
    """
    if not phase.is_open:
        return False

    moment = now or datetime.now(UTC)
    if phase.opens_at and moment < phase.opens_at:
        return False
    if phase.deadline_at and moment > phase.deadline_at:
        return False
    return True


def assert_phase_open(db: Session, bootcamp_id: uuid.UUID, phase: PhaseType) -> BootcampPhase:
    row = get_phase(db, bootcamp_id, phase)
    if not is_phase_open(row):
        raise PhaseClosedError(f"The {phase.value.lower()} stage is not open.")
    return row


def set_phase_open(
    db: Session, bootcamp_id: uuid.UUID, phase: PhaseType, *, is_open: bool, actor: Profile
) -> BootcampPhase:
    row = get_phase(db, bootcamp_id, phase)
    row.is_open = is_open
    if is_open:
        row.closed_by = None
        row.closed_at = None
    else:
        row.closed_by = actor.id
        row.closed_at = datetime.now(UTC)

    # Keep the bootcamp's headline status in step with the registration gate,
    # so a list view does not have to join phases to know what is happening.
    if phase == PhaseType.REGISTRATION:
        row.bootcamp.status = BootcampStatus.REG_OPEN if is_open else BootcampStatus.REG_CLOSED

    db.flush()
    return row


def update_phase_window(
    db: Session, bootcamp_id: uuid.UUID, phase: PhaseType, opens_at, deadline_at
) -> BootcampPhase:
    row = get_phase(db, bootcamp_id, phase)
    row.opens_at = opens_at
    row.deadline_at = deadline_at
    db.flush()
    return row


def application_count(db: Session, bootcamp_id: uuid.UUID) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Application)
            .where(Application.bootcamp_id == bootcamp_id)
        )
        or 0
    )


def open_for_registration(db: Session) -> list[Bootcamp]:
    """Intakes a candidate may currently apply to.

    Filtered in Python rather than SQL because `is_phase_open` also weighs the
    clock against opens_at/deadline_at, not just the boolean flag.
    """
    rows = db.scalars(
        select(Bootcamp)
        .join(BootcampPhase, BootcampPhase.bootcamp_id == Bootcamp.id)
        .where(
            BootcampPhase.phase == PhaseType.REGISTRATION,
            BootcampPhase.is_open.is_(True),
            Bootcamp.status == BootcampStatus.REG_OPEN,
        )
        .options(
            selectinload(Bootcamp.phases),
            selectinload(Bootcamp.programs).selectinload(BootcampProgram.program),
        )
        .order_by(Bootcamp.bootcamp_number.desc())
    )
    return [b for b in rows if is_phase_open(get_phase(db, b.id, PhaseType.REGISTRATION))]
