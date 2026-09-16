from fastapi import APIRouter

from app.api.v1.routes import (
    agilytics,
    document_export,
    id_cards,
    ai_interviews,
    applications,
    audit,
    auth,
    bootcamps,
    emails,
    health,
    hr_assessment,
    interview_invites,
    interviews,
    notifications,
    onboarding,
    permissions,
    physical_interviews,
    profile,
    programs,
    users,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(programs.router)
api_router.include_router(bootcamps.router)
api_router.include_router(applications.router)
api_router.include_router(interviews.router)
api_router.include_router(interview_invites.router)
api_router.include_router(emails.router)
api_router.include_router(users.router)
api_router.include_router(onboarding.router)
api_router.include_router(audit.router)
api_router.include_router(profile.router)
api_router.include_router(notifications.router)
api_router.include_router(ai_interviews.router)
api_router.include_router(permissions.router)
api_router.include_router(physical_interviews.router)
api_router.include_router(hr_assessment.router)
api_router.include_router(agilytics.router)
api_router.include_router(document_export.router)
api_router.include_router(id_cards.router)
