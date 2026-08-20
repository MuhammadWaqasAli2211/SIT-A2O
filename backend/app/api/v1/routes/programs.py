from fastapi import APIRouter

from app.api.deps import DbSession
from app.schemas.bootcamp import ProgramOut
from app.services import bootcamp_service

router = APIRouter(prefix="/programs", tags=["public"])


@router.get("", response_model=list[ProgramOut])
def list_programs(db: DbSession) -> list[ProgramOut]:
    """Active tracks. Public: the marketing site renders these."""
    return [ProgramOut.model_validate(p) for p in bootcamp_service.list_programs(db)]
