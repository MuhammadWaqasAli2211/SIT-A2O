from fastapi import APIRouter

from app.api.v1.routes import applications, auth, bootcamps, health, profile, programs

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(programs.router)
api_router.include_router(bootcamps.router)
api_router.include_router(applications.router)
api_router.include_router(profile.router)
