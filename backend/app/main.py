import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.canvas_sessions import router as canvas_sessions_router
from app.routes.health import router as health_router
from app.routes.messages import router as messages_router
from app.routes.sessions import router as sessions_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler.

    Placeholder for startup/shutdown logic such as database connection pools.
    Later slices (e.g. Slice 03) will add PostgresSaver setup here.
    """
    # Startup
    yield
    # Shutdown


def create_app() -> FastAPI:
    """Application factory for the FastAPI server."""
    application = FastAPI(
        title="AI Factory Prompt Assistant",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS middleware - restrict to frontend origin
    frontend_origin = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routers
    application.include_router(health_router, prefix="/api/assistant")
    application.include_router(messages_router, prefix="/api/assistant")
    application.include_router(sessions_router, prefix="/api/assistant")
    application.include_router(canvas_sessions_router, prefix="/api/assistant")

    return application


app = create_app()
