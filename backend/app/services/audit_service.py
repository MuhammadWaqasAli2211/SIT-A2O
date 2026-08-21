"""Audit trail writes and reads.

`record()` is deliberately fire-and-add rather than fire-and-commit: it joins
the caller's transaction, so an action that later fails leaves no audit row
claiming it succeeded.
"""

import uuid
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, aliased

from app.models.ops import AuditLog
from app.models.user import Profile
from app.schemas.ops import AuditEntry


def record(
    db: Session,
    *,
    actor: Profile | None,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID | None = None,
    summary: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    entry = AuditLog(
        actor_id=actor.id if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=summary,
        metadata_=metadata or {},
    )
    db.add(entry)
    return entry


def diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    """Only the fields that actually changed, as {field: {from, to}}.

    Values are stringified because the column is jsonb and the inputs may hold
    dates, UUIDs, and enums that json cannot serialise directly.
    """
    return {
        key: {"from": _plain(before.get(key)), "to": _plain(value)}
        for key, value in after.items()
        if before.get(key) != value
    }


def _plain(value: Any) -> Any:
    if value is None or isinstance(value, bool | int | float | str):
        return value
    return str(value)


def _base_query() -> Select:
    actor = aliased(Profile)
    return (
        select(AuditLog, actor.full_name, actor.email)
        .outerjoin(actor, actor.id == AuditLog.actor_id)
        .order_by(AuditLog.created_at.desc())
    )


def list_entries(
    db: Session,
    *,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
    action: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[AuditEntry], int]:
    stmt = _base_query()
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    if actor_id:
        stmt = stmt.where(AuditLog.actor_id == actor_id)
    if action:
        stmt = stmt.where(AuditLog.action.startswith(action))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(stmt.limit(limit).offset(offset)).all()

    return [
        AuditEntry(
            id=entry.id,
            action=entry.action,
            entity_type=entry.entity_type,
            entity_id=entry.entity_id,
            summary=entry.summary,
            metadata=entry.metadata_,
            actor_name=name,
            actor_email=email,
            created_at=entry.created_at,
        )
        for entry, name, email in rows
    ], total
