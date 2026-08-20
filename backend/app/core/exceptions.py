"""Application error hierarchy. Routes raise these; a handler maps them to HTTP."""

from typing import Any


class AppError(Exception):
    """Base for all expected, user-facing failures."""

    status_code: int = 400
    code: str = "app_error"
    message: str = "Something went wrong."

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        details: Any = None,
    ) -> None:
        self.message = message or self.message
        self.code = code or self.code
        self.details = details
        super().__init__(self.message)


class AuthenticationError(AppError):
    status_code = 401
    code = "unauthenticated"
    message = "Authentication required."


class InvalidCredentialsError(AuthenticationError):
    code = "invalid_credentials"
    message = "Incorrect email or password."


class EmailNotVerifiedError(AuthenticationError):
    code = "email_not_verified"
    message = "Please verify your email before signing in."


class PermissionDeniedError(AppError):
    status_code = 403
    code = "permission_denied"
    message = "You do not have access to this resource."


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    message = "Resource not found."


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
    message = "Resource already exists."


class UpstreamError(AppError):
    """A dependency (Supabase, email provider) failed or is unreachable."""

    status_code = 502
    code = "upstream_error"
    message = "An upstream service is unavailable. Please try again."


class InvalidEmailError(AppError):
    status_code = 400
    code = "email_address_invalid"
    message = "That email address was rejected. Please use a different one."


class WeakPasswordError(AppError):
    status_code = 400
    code = "weak_password"
    message = "That password is too weak. Please choose a stronger one."


class SignupDisabledError(AppError):
    status_code = 403
    code = "signup_disabled"
    message = "Registration is currently closed."


class RateLimitedError(AppError):
    status_code = 429
    code = "rate_limited"
    message = "Too many attempts. Please wait a few minutes and try again."


class EmailNotConfiguredError(AppError):
    status_code = 503
    code = "email_not_configured"
    message = "Email sending is not configured."
