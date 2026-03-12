from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/health")
async def health_check() -> dict:
    """Health check endpoint.

    Returns the current application status and version.
    """
    return {"status": "ok", "version": settings.app_version}
