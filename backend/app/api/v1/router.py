from fastapi import APIRouter

from app.api.v1.routes import (
    applications,
    audit,
    auth,
    bootcamps,
    documents,
    emails,
    health,
    interviews,
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
api_router.include_router(emails.router)
api_router.include_router(users.router)
api_router.include_router(documents.router)
api_router.include_router(audit.router)
