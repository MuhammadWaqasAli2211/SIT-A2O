"""SQLAlchemy engine and session management.

The engine is created lazily so the app can boot (and serve /health, /docs)
before DATABASE_URL is configured.
"""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.exceptions import AppError


class DatabaseNotConfiguredError(AppError):
    status_code = 503
    code = "database_not_configured"
    message = "DATABASE_URL is not set; database features are unavailable."


def _normalize(url: str) -> str:
    """Point SQLAlchemy at the psycopg 3 driver regardless of the pasted scheme."""
    if url.startswith("postgresql+"):
        return url
    if url.startswith(("postgresql://", "postgres://")):
        return "postgresql+psycopg://" + url.split("://", 1)[1]
    return url


@lru_cache
def get_engine() -> Engine:
    if not settings.DATABASE_URL:
        raise DatabaseNotConfiguredError()
    return create_engine(
        _normalize(settings.DATABASE_URL),
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        echo=settings.DEBUG and not settings.is_production,
    )


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a request-scoped session."""
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
