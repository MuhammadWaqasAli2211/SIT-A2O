from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.db.session import get_engine

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    """Liveness plus a database reachability probe."""
    database = "not_configured"
    if settings.DATABASE_URL:
        try:
            with get_engine().connect() as conn:
                conn.execute(text("select 1"))
            database = "ok"
        except Exception:
            database = "unreachable"

    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "database": database,
    }
