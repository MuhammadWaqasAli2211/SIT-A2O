"""Shared FastAPI dependencies: database sessions, current user, role gates."""

import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import Profile
from app.services import auth_service

_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_access_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> str:
    if credentials is None or not credentials.credentials:
        raise AuthenticationError()
    return credentials.credentials


AccessToken = Annotated[str, Depends(get_access_token)]


def get_token_claims(token: AccessToken) -> dict:
    """Verify the token signature before any database work is attempted.

    Kept separate from get_current_user, and declared ahead of the session
    dependency, so a bad token fails with 401 even when the database is down.
    """
    return decode_access_token(token)


TokenClaims = Annotated[dict, Depends(get_token_claims)]


def get_current_user(claims: TokenClaims, db: DbSession) -> Profile:
    """Resolve the caller's profile, and with it their role.

    Role is read from `profiles` rather than a JWT claim so that a demotion or
    deactivation takes effect immediately instead of at next token refresh.
    """
    return auth_service.get_profile(db, uuid.UUID(claims["sub"]))


CurrentUser = Annotated[Profile, Depends(get_current_user)]


def require_roles(*allowed: UserRole) -> Callable[[Profile], Profile]:
    """Build a dependency that admits only the given roles."""

    def _guard(user: CurrentUser) -> Profile:
        if user.role not in allowed:
            raise PermissionDeniedError()
        return user

    return _guard


require_admin = require_roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
require_super_admin = require_roles(UserRole.SUPER_ADMIN)
require_candidate = require_roles(UserRole.CANDIDATE)

# Annotated aliases so routes can declare the caller as a normal parameter.
# Using `Depends(...)` inline would make it a defaulted argument, forcing every
# parameter after it to carry a placeholder default too.
AdminUser = Annotated[Profile, Depends(require_admin)]
SuperAdminUser = Annotated[Profile, Depends(require_super_admin)]
CandidateUser = Annotated[Profile, Depends(require_candidate)]
