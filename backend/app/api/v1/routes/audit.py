"""The platform-wide audit trail and cross-intake statistics.

Super admin only. A bootcamp admin sees their own intake's slice through
`/bootcamps/{id}/audit`, which is scoped; this one is not.
"""

import uuid

from fastapi import APIRouter, Query

from app.api.deps import DbSession, SuperAdminUser
from app.schemas.dashboard import PlatformStats
from app.schemas.ops import AuditEntry, Page
from app.services import audit_service, dashboard_service

router = APIRouter(tags=["admin"])


@router.get("/audit", response_model=Page[AuditEntry])
def list_audit(
    user: SuperAdminUser,
    db: DbSession,
    entity_type: str | None = Query(default=None, max_length=40),
    entity_id: uuid.UUID | None = None,
    actor_id: uuid.UUID | None = None,
    action: str | None = Query(
        default=None, max_length=40, description="Prefix match, e.g. 'bootcamp.'"
    ),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> Page[AuditEntry]:
    items, total = audit_service.list_entries(
        db,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=actor_id,
        action=action,
        limit=limit,
        offset=offset,
    )
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/stats", response_model=PlatformStats)
def platform_stats(user: SuperAdminUser, db: DbSession) -> PlatformStats:
    return dashboard_service.platform_stats(db)
