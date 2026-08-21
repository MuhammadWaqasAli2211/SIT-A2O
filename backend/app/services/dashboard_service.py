"""Dashboard aggregates.

Every figure is a SQL aggregate rather than a Python loop over fetched rows:
the applications table is the one that grows into the thousands, and a
dashboard that loads every candidate to count them would degrade exactly when
the intake gets interesting.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.bootcamp import Bootcamp, BootcampAdmin, Program
from app.models.enums import (
    ApplicationStage,
    ApplicationStatus,
    BootcampStatus,
    EmailStatus,
    InterviewStatus,
    UserRole,
)
from app.models.interview import Interview
from app.models.ops import EmailLog
from app.models.user import CandidateProfile, Profile
from app.schemas.dashboard import (
    BootcampStats,
    BootcampSummary,
    CityCount,
    DailyCount,
    PlatformStats,
    ProgramCount,
    StageCount,
    UpcomingInterview,
)
from app.services import bootcamp_service

_TREND_DAYS = 30
_UPCOMING_LIMIT = 8
_CITY_LIMIT = 8

# Closed intakes still count as "running" from an operations point of view —
# interviews and onboarding continue long after registration shuts.
_ACTIVE_STATUSES = (
    BootcampStatus.REG_OPEN,
    BootcampStatus.REG_CLOSED,
    BootcampStatus.INTERVIEWING,
    BootcampStatus.ASSESSING,
    BootcampStatus.ONBOARDING,
)


def _count(db: Session, model, *where) -> int:
    return db.scalar(select(func.count()).select_from(model).where(*where)) or 0


def _stage_breakdown(db: Session, *where) -> list[StageCount]:
    rows = db.execute(
        select(Application.stage, func.count())
        .where(*where)
        .group_by(Application.stage)
    ).all()
    counts = {stage: count for stage, count in rows}
    # Every stage present, including the empty ones, so the chart keeps a
    # stable set of categories as candidates move through.
    return [StageCount(stage=stage, count=counts.get(stage, 0)) for stage in ApplicationStage]


def _program_breakdown(db: Session, *where) -> list[ProgramCount]:
    rows = db.execute(
        select(Program.id, Program.title, func.count(Application.id))
        .join(Application, Application.program_id == Program.id)
        .where(*where)
        .group_by(Program.id, Program.title)
        .order_by(func.count(Application.id).desc())
    ).all()
    return [ProgramCount(program_id=pid, title=title, count=count) for pid, title, count in rows]


def bootcamp_stats(db: Session, bootcamp_id: uuid.UUID, actor: Profile) -> BootcampStats:
    bootcamp_service.assert_can_manage(db, actor, bootcamp_id)
    bootcamp = bootcamp_service.get_bootcamp(db, bootcamp_id)

    scoped = Application.bootcamp_id == bootcamp_id
    now = datetime.now(UTC)

    # Interview figures need the join to applications to stay inside the intake.
    def interview_count(status: InterviewStatus) -> int:
        return (
            db.scalar(
                select(func.count())
                .select_from(Interview)
                .join(Application, Application.id == Interview.application_id)
                .where(scoped, Interview.status == status)
            )
            or 0
        )

    average = db.scalar(
        select(func.avg(Interview.score))
        .join(Application, Application.id == Interview.application_id)
        .where(scoped, Interview.score.isnot(None))
    )

    trend_rows = db.execute(
        select(func.date(Application.applied_at), func.count())
        .where(scoped, Application.applied_at >= now - timedelta(days=_TREND_DAYS))
        .group_by(func.date(Application.applied_at))
        .order_by(func.date(Application.applied_at))
    ).all()

    upcoming_rows = db.execute(
        select(Interview, Application, Profile.full_name)
        .join(Application, Application.id == Interview.application_id)
        .join(Profile, Profile.id == Application.profile_id)
        .where(scoped, Interview.status == InterviewStatus.SCHEDULED, Interview.scheduled_at >= now)
        .order_by(Interview.scheduled_at)
        .limit(_UPCOMING_LIMIT)
    ).all()

    return BootcampStats(
        bootcamp_id=bootcamp.id,
        bootcamp_name=bootcamp.name,
        bootcamp_number=bootcamp.bootcamp_number,
        status=bootcamp.status,
        total_applications=_count(db, Application, scoped),
        active_applications=_count(
            db, Application, scoped, Application.status == ApplicationStatus.ACTIVE
        ),
        rejected_applications=_count(
            db, Application, scoped, Application.status == ApplicationStatus.REJECTED
        ),
        onboarded=_count(
            db, Application, scoped, Application.stage == ApplicationStage.ONBOARDED
        ),
        interviews_scheduled=interview_count(InterviewStatus.SCHEDULED),
        interviews_completed=interview_count(InterviewStatus.COMPLETED),
        interviews_no_show=interview_count(InterviewStatus.NO_SHOW),
        average_score=round(float(average), 1) if average is not None else None,
        applications_last_7_days=_count(
            db, Application, scoped, Application.applied_at >= now - timedelta(days=7)
        ),
        emails_sent=_count(
            db,
            EmailLog,
            EmailLog.bootcamp_id == bootcamp_id,
            EmailLog.status == EmailStatus.SENT,
        ),
        by_stage=_stage_breakdown(db, scoped),
        by_program=_program_breakdown(db, scoped),
        applications_over_time=[DailyCount(day=day, count=count) for day, count in trend_rows],
        upcoming_interviews=[
            UpcomingInterview(
                id=interview.id,
                application_id=application.id,
                candidate_code=application.candidate_code,
                candidate_name=name,
                scheduled_at=interview.scheduled_at,
                status=interview.status,
                location=interview.location,
            )
            for interview, application, name in upcoming_rows
        ],
    )


def platform_stats(db: Session) -> PlatformStats:
    """Cross-intake totals. Super admin only — no scope filter is applied."""
    now = datetime.now(UTC)

    city_rows = db.execute(
        select(CandidateProfile.city, func.count(Application.id))
        .join(Application, Application.profile_id == CandidateProfile.profile_id)
        .where(CandidateProfile.city.isnot(None), CandidateProfile.city != "")
        .group_by(CandidateProfile.city)
        .order_by(func.count(Application.id).desc())
        .limit(_CITY_LIMIT)
    ).all()

    trend_rows = db.execute(
        select(func.date(Application.applied_at), func.count())
        .where(Application.applied_at >= now - timedelta(days=_TREND_DAYS))
        .group_by(func.date(Application.applied_at))
        .order_by(func.date(Application.applied_at))
    ).all()

    return PlatformStats(
        total_bootcamps=_count(db, Bootcamp),
        active_bootcamps=_count(db, Bootcamp, Bootcamp.status.in_(_ACTIVE_STATUSES)),
        total_candidates=_count(db, Profile, Profile.role == UserRole.CANDIDATE),
        total_admins=_count(
            db, Profile, Profile.role.in_((UserRole.ADMIN, UserRole.SUPER_ADMIN))
        ),
        total_applications=_count(db, Application),
        total_interviews=_count(db, Interview),
        emails_sent=_count(db, EmailLog, EmailLog.status == EmailStatus.SENT),
        by_stage=_stage_breakdown(db),
        by_program=_program_breakdown(db),
        by_city=[CityCount(city=city, count=count) for city, count in city_rows],
        applications_over_time=[DailyCount(day=day, count=count) for day, count in trend_rows],
        bootcamps=_bootcamp_summaries(db),
    )


def _bootcamp_summaries(db: Session) -> list[BootcampSummary]:
    """Every intake with its counts, for the super-admin overview.

    Counts come from correlated subqueries rather than joins: joining both
    applications and admins would multiply the two against each other.
    """
    applications = (
        select(func.count())
        .select_from(Application)
        .where(Application.bootcamp_id == Bootcamp.id)
        .scalar_subquery()
    )
    admins = (
        select(func.count())
        .select_from(BootcampAdmin)
        .where(BootcampAdmin.bootcamp_id == Bootcamp.id)
        .scalar_subquery()
    )

    rows = db.execute(
        select(Bootcamp, applications, admins).order_by(Bootcamp.bootcamp_number.desc())
    ).all()

    # One extra query for names across all intakes, rather than one per row.
    name_rows = db.execute(
        select(BootcampAdmin.bootcamp_id, Profile.full_name, Profile.email).join(
            Profile, Profile.id == BootcampAdmin.profile_id
        )
    ).all()
    names: dict[uuid.UUID, list[str]] = {}
    for bootcamp_id, full_name, email in name_rows:
        names.setdefault(bootcamp_id, []).append(full_name or email)

    return [
        BootcampSummary(
            id=bootcamp.id,
            bootcamp_number=bootcamp.bootcamp_number,
            name=bootcamp.name,
            status=bootcamp.status,
            starts_at=bootcamp.starts_at,
            application_count=application_count,
            admin_count=admin_count,
            admin_names=names.get(bootcamp.id, []),
        )
        for bootcamp, application_count, admin_count in rows
    ]
