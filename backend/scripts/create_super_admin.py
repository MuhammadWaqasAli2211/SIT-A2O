"""Provision the first SUPER_ADMIN.

A bootstrap, not a general tool: `POST /api/v1/users` already creates staff
accounts, but it requires a super admin to authorise it — and on a fresh
database there isn't one. This script is how that cycle gets broken. Every
later account should go through the API so it lands in the audit trail with a
named actor.

Usage:
    SUPERADMIN_EMAIL=admin@example.com \
    SUPERADMIN_PASSWORD='...' \
    python scripts/create_super_admin.py

Re-running is safe: an existing account has its password reset and its role
corrected rather than being duplicated.
"""

import os
import sys
import uuid

from sqlalchemy import select

from app.db.session import get_session_factory
from app.integrations import supabase_auth
from app.models.enums import UserRole
from app.models.user import Profile
from app.services import audit_service

MIN_PASSWORD_LENGTH = 12


def main() -> int:
    email = os.environ.get("SUPERADMIN_EMAIL", "").strip().lower()
    password = os.environ.get("SUPERADMIN_PASSWORD", "")
    full_name = os.environ.get("SUPERADMIN_NAME", "Platform Administrator")

    if not email or not password:
        print("SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must both be set.", file=sys.stderr)
        return 2
    if len(password) < MIN_PASSWORD_LENGTH:
        print(f"Password must be at least {MIN_PASSWORD_LENGTH} characters.", file=sys.stderr)
        return 2

    session = get_session_factory()()
    try:
        existing = session.scalar(select(Profile).where(Profile.email == email))

        if existing is None:
            created = supabase_auth.admin_create_user(
                email=email,
                password=password,
                metadata={"full_name": full_name},
                email_confirm=True,
            )
            user_id = uuid.UUID(created["id"])
            print(f"Created auth user {user_id}")

            # handle_new_user() runs in GoTrue's transaction, which has already
            # committed; this session needs a fresh snapshot to see the row.
            session.commit()
            profile = session.scalar(select(Profile).where(Profile.id == user_id))
            if profile is None:
                print(
                    "Auth user created but no profile appeared — check the "
                    "handle_new_user trigger.",
                    file=sys.stderr,
                )
                return 1
            action = "bootstrap.create_super_admin"
        else:
            profile = existing
            supabase_auth.admin_update_user(str(profile.id), {"password": password})
            print(f"Account already existed ({profile.id}); password reset.")
            action = "bootstrap.reset_super_admin"

        was = profile.role
        profile.role = UserRole.SUPER_ADMIN
        profile.is_active = True
        if not profile.full_name:
            profile.full_name = full_name

        audit_service.record(
            session,
            actor=None,  # No authenticated actor exists yet, by definition.
            action=action,
            entity_type="profile",
            entity_id=profile.id,
            summary=f"Bootstrapped super admin {email}",
            # Never records the password, only that it was set.
            metadata={"previous_role": was.value, "via": "scripts/create_super_admin.py"},
        )
        session.commit()

        print(f"{email} is now {profile.role.value} (was {was.value}), active={profile.is_active}")
        return 0
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
