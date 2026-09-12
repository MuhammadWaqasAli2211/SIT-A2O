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
from app.schemas.bootcamp import (
    BootcampCreate,
    BootcampUpdate,
    PhaseUpdate,
    ProgramCreate,
    ProgramUpdate,
)
from app.services import audit_service

# Every bootcamp gets all four phases at creation, closed, so an admin only
# ever opens and dates them rather than creating them ad hoc.
_ALL_PHASES = (PhaseType.REGISTRATION, PhaseType.INTERVIEW, PhaseType.FORM, PhaseType.ONBOARDING)


class PhaseClosedError(PermissionDeniedError):
    code = "phase_closed"
    message = "This stage is closed."


def list_programs(db: Session, *, include_inactive: bool = False) -> list[Program]:
    stmt = select(Program).order_by(Program.sort_order)
    if not include_inactive:
        stmt = stmt.where(Program.is_active.is_(True))
    return list(db.scalars(stmt))


def get_program(db: Session, program_id: uuid.UUID) -> Program:
    program = db.get(Program, program_id)
    if program is None:
        raise NotFoundError("Program not found.")
    return program


def create_program(db: Session, payload: ProgramCreate, actor: Profile) -> Program:
    if db.scalar(select(Program).where(Program.slug == payload.slug)) is not None:
        raise ConflictError(f"A program with the slug '{payload.slug}' already exists.")

    program = Program(**payload.model_dump())
    db.add(program)
    db.flush()

    audit_service.record(
        db,
        actor=actor,
        action="program.create",
        entity_type="program",
        entity_id=program.id,
        summary=f"Created the {program.title} track",
        metadata={"slug": program.slug},
    )
    return program


def update_program(
    db: Session, program_id: uuid.UUID, payload: ProgramUpdate, actor: Profile
) -> Program:
    program = get_program(db, program_id)
    changes = payload.model_dump(exclude_unset=True)
    before = {field: getattr(program, field) for field in changes}

    for field, value in changes.items():
        setattr(program, field, value)

    audit_service.record(
        db,
        actor=actor,
        action="program.update",
        entity_type="program",
        entity_id=program.id,
        summary=f"Updated the {program.title} track",
        metadata={"changes": audit_service.diff(before, changes)},
    )
    db.flush()
    return program


def delete_program(db: Session, program_id: uuid.UUID, actor: Profile) -> None:
    """Refused while anything references it.

    The FKs are RESTRICT, so the database would reject this anyway — checking
    here turns an opaque IntegrityError into an answer that says which
    bootcamps still offer the track.
    """
    program = get_program(db, program_id)

    offered_by = db.scalar(
        select(func.count()).select_from(BootcampProgram).where(
            BootcampProgram.program_id == program_id
        )
    )
    if offered_by:
        raise ConflictError(
            f"{offered_by} bootcamp(s) still offer this track. "
            "Deactivate it instead, or remove it from those intakes first."
        )

    audit_service.record(
        db,
        actor=actor,
        action="program.delete",
        entity_type="program",
        entity_id=program.id,
        summary=f"Deleted the {program.title} track",
        metadata={"slug": program.slug, "title": program.title},
    )
    db.delete(program)
    db.flush()


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

    audit_service.record(
        db,
        actor=actor,
        action="bootcamp.create",
        entity_type="bootcamp",
        entity_id=bootcamp.id,
        summary=f"Created bootcamp {bootcamp.name}",
        metadata={"bootcamp_number": bootcamp.bootcamp_number},
    )
    db.flush()
    return get_bootcamp(db, bootcamp.id)


def update_bootcamp(
    db: Session, bootcamp_id: uuid.UUID, payload: BootcampUpdate, actor: Profile
) -> Bootcamp:
    bootcamp = get_bootcamp(db, bootcamp_id)
    changes = payload.model_dump(exclude_unset=True)

    # Not a column — the offered tracks live in a join table, so they are
    # replaced as a set rather than assigned.
    program_ids = changes.pop("program_ids", None)
    before = {field: getattr(bootcamp, field) for field in changes}

    for field, value in changes.items():
        setattr(bootcamp, field, value)

    if program_ids is not None:
        _replace_programs(db, bootcamp, program_ids)
        changes["program_ids"] = [str(pid) for pid in program_ids]

    audit_service.record(
        db,
        actor=actor,
        action="bootcamp.update",
        entity_type="bootcamp",
        entity_id=bootcamp.id,
        summary=f"Updated {bootcamp.name}",
        metadata={"changes": audit_service.diff(before, changes)},
    )
    db.flush()
    return get_bootcamp(db, bootcamp_id)


def _replace_programs(db: Session, bootcamp: Bootcamp, program_ids: list[uuid.UUID]) -> None:
    """Set the offered tracks to exactly `program_ids`.

    Removing a track an application already points at is refused rather than
    cascaded: the application's program_id is RESTRICT for the same reason, and
    silently orphaning a candidate's chosen track would be worse than an error.
    """
    wanted = set(program_ids)
    current = {bp.program_id for bp in bootcamp.programs}

    for program_id in wanted - current:
        if db.get(Program, program_id) is None:
            raise NotFoundError(f"Program {program_id} not found.")
        db.add(BootcampProgram(bootcamp_id=bootcamp.id, program_id=program_id))

    for program_id in current - wanted:
        in_use = db.scalar(
            select(func.count())
            .select_from(Application)
            .where(
                Application.bootcamp_id == bootcamp.id,
                Application.program_id == program_id,
            )
        )
        if in_use:
            raise ConflictError(
                f"{in_use} application(s) already chose that track; it cannot be removed."
            )
        db.delete(db.get(BootcampProgram, {"bootcamp_id": bootcamp.id, "program_id": program_id}))

    db.flush()
    db.refresh(bootcamp)


def delete_bootcamp(db: Session, bootcamp_id: uuid.UUID, actor: Profile) -> None:
    """Remove an intake outright.

    Refused once anybody has applied: applications cascade from bootcamps, so
    deleting one would take real candidate history with it. Archive instead.
    """
    bootcamp = get_bootcamp(db, bootcamp_id)
    count = application_count(db, bootcamp_id)
    if count:
        raise ConflictError(
            f"{count} application(s) belong to this bootcamp. "
            "Set its status to ARCHIVED instead of deleting it."
        )

    audit_service.record(
        db,
        actor=actor,
        action="bootcamp.delete",
        entity_type="bootcamp",
        entity_id=bootcamp.id,
        summary=f"Deleted bootcamp {bootcamp.name}",
        metadata={"bootcamp_number": bootcamp.bootcamp_number, "name": bootcamp.name},
    )
    db.delete(bootcamp)
    db.flush()


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
    audit_service.record(
        db,
        actor=actor,
        action="bootcamp.assign_admin",
        entity_type="bootcamp",
        entity_id=bootcamp_id,
        summary=f"Assigned {target.email} as an administrator",
        metadata={"profile_id": str(profile_id), "email": target.email},
    )
    db.flush()


def unassign_admin(
    db: Session, bootcamp_id: uuid.UUID, profile_id: uuid.UUID, actor: Profile
) -> None:
    row = db.get(BootcampAdmin, {"bootcamp_id": bootcamp_id, "profile_id": profile_id})
    if row is None:
        raise NotFoundError("That administrator is not assigned to this bootcamp.")

    target = db.get(Profile, profile_id)
    db.delete(row)
    audit_service.record(
        db,
        actor=actor,
        action="bootcamp.unassign_admin",
        entity_type="bootcamp",
        entity_id=bootcamp_id,
        summary=f"Removed {target.email if target else profile_id} as an administrator",
        metadata={"profile_id": str(profile_id)},
    )
    db.flush()


def admins_for(db: Session, bootcamp_id: uuid.UUID) -> list[Profile]:
    return list(
        db.scalars(
            select(Profile)
            .join(BootcampAdmin, BootcampAdmin.profile_id == Profile.id)
            .where(BootcampAdmin.bootcamp_id == bootcamp_id)
            .order_by(Profile.full_name)
        )
    )


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


def phase_closure(phase: BootcampPhase, *, now: datetime | None = None) -> str | None:
    """Why this phase is refusing activity right now, or None if it is not.

    Deliberately *not* `is_phase_open()` inverted. That one answers "is this
    phase running", and treats an untouched phase — flag false, no dates,
    which is exactly how `create` writes all four — as not running. Gating
    candidate activity on that would retroactively shut the Student's Folder
    for every candidate already inside it, because nothing in the product has
    ever opened the FORM or ONBOARDING phase.

    This answers the narrower question a gate actually needs: has anybody
    *decided* this phase is shut? Two things count, and they are precisely the
    two the phases screen offers:

      - an explicit close an admin has not since undone (`closed_at`, which
        `set_phase_open` clears on reopen), which wins outright so that a
        manual close beats a deadline that has not arrived yet; and
      - a deadline that has since passed, for when nobody clicked anything.

    A phase nobody has configured is neither, and so gates nothing.
    """
    if phase.closed_at is not None and not phase.is_open:
        return "closed"

    moment = now or datetime.now(UTC)
    if phase.deadline_at and moment > phase.deadline_at:
        return "expired"
    return None


def assert_phase_accepts(db: Session, bootcamp_id: uuid.UUID, phase: PhaseType) -> BootcampPhase:
    """Refuse candidate activity in a phase an admin has closed or let lapse.

    The counterpart to `assert_phase_open` for the back half of the journey.
    Registration and the interview round are gated by that stricter rule —
    they are opt-in windows an admin deliberately opens — whereas the Student's
    Folder is opt-out: it runs by default for anyone who has cleared the
    Physical Interview, until somebody closes it.
    """
    row = get_phase(db, bootcamp_id, phase)
    reason = phase_closure(row)
    if reason == "closed":
        raise PhaseClosedError(f"The {phase.value.lower()} stage has been closed.")
    if reason == "expired":
        raise PhaseClosedError(f"The deadline for the {phase.value.lower()} stage has passed.")
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

    audit_service.record(
        db,
        actor=actor,
        action=f"phase.{'open' if is_open else 'close'}",
        entity_type="bootcamp_phase",
        entity_id=row.id,
        summary=f"{'Opened' if is_open else 'Closed'} the {phase.value.lower()} stage",
        metadata={"bootcamp_id": str(bootcamp_id), "phase": phase.value},
    )
    db.flush()
    return row


def update_phase_window(
    db: Session, bootcamp_id: uuid.UUID, phase: PhaseType, payload: PhaseUpdate, actor: Profile
) -> BootcampPhase:
    """Apply only the fields the caller actually sent.

    `exclude_unset` is load-bearing: an admin editing just the open date must
    not have the deadline silently cleared, which is what assigning both
    unconditionally used to do — quietly removing the gate that closes
    registration.
    """
    row = get_phase(db, bootcamp_id, phase)
    changes = payload.model_dump(exclude_unset=True)
    before = {field: getattr(row, field) for field in changes}

    for field, value in changes.items():
        setattr(row, field, value)

    # The DB CHECK only fires on the final pair, so catch the ordering here
    # where the message can name the actual problem.
    if row.opens_at and row.deadline_at and row.deadline_at <= row.opens_at:
        raise ConflictError("The deadline must fall after the opening time.")

    audit_service.record(
        db,
        actor=actor,
        action="phase.update_window",
        entity_type="bootcamp_phase",
        entity_id=row.id,
        summary=f"Updated the {phase.value.lower()} window",
        metadata={"bootcamp_id": str(bootcamp_id), "changes": audit_service.diff(before, changes)},
    )
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
