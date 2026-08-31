"""FastAPI application entrypoint."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.exceptions import AppError

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="0.1.0",
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": exc.code, "message": exc.message, "details": exc.details},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "code": "validation_error",
                "message": "Some fields are invalid.",
                "details": [
                    {"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]}
                    for e in exc.errors()
                ],
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        # Never leak internals to the client; the stack trace goes to the logs.
        logger.exception("Unhandled error", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={
                "code": "internal_error",
                "message": "An unexpected error occurred.",
                "details": None,
            },
        )

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)
    return app


app = create_app()


if __name__ == "__main__":
    # Supports `python -m app.main` from the backend/ directory, which is
    # convenient for IDE run configurations. The canonical command remains
    # `uvicorn app.main:app --reload` — see README.md.
    import os

    import uvicorn

    uvicorn.run(
        "app.main:app",
        # 0.0.0.0, not 127.0.0.1: a host's loopback interface only accepts
        # connections from inside that same container, which is exactly what
        # a platform's proxy (e.g. Railway) is not.
        host=os.getenv("HOST", "0.0.0.0"),
        # Overridable so a second instance can be started without editing code.
        port=int(os.getenv("PORT", "8000")),
        reload=settings.DEBUG and not settings.is_production,
    )
