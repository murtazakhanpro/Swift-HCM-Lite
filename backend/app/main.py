from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import engine, Base
import app.models  # Ensures all ORM models are registered
from app.api.v1.auth import router as auth_router
from app.api.v1.org import router as org_router
from app.api.v1.employees import router as employees_router
from app.api.v1.attendance import router as attendance_router
from app.api.v1.leave import router as leave_router
from app.api.v1.payroll import router as payroll_router
from app.api.v1.ai import router as ai_router
from app.api.v1.comms import router as comms_router
from sqlalchemy import text

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize all tables cleanly without dummy data
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Swift-HCM Lite API - Saylani Hackathon 2026. Built by Lyntica.",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled request error for %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred"}
    )

# Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(org_router, prefix="/api/v1")
app.include_router(employees_router, prefix="/api/v1")
app.include_router(attendance_router, prefix="/api/v1")
app.include_router(leave_router, prefix="/api/v1")
app.include_router(payroll_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(comms_router, prefix="/api/v1")

@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
    return {
        "status": "online",
        "product": "Swift-HCM Lite",
        "company": "Lyntica",
        "environment": settings.ENVIRONMENT,
        "ai_model": settings.AI_MODEL,
        "database": "connected"
    }

@app.get("/api/v1/ready", tags=["Health"])
async def readiness_check():
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Readiness database check failed")
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"status": "not_ready"})
    return {"status": "ready", "database": "connected"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
