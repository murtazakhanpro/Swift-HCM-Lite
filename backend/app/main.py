from contextlib import asynccontextmanager
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
    allow_origins=["*"],  # Allow all for hackathon evaluation and development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred", "error": str(exc)}
    )

# Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(org_router, prefix="/api/v1")
app.include_router(employees_router, prefix="/api/v1")
app.include_router(attendance_router, prefix="/api/v1")

@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    return {
        "status": "online",
        "product": "Swift-HCM Lite",
        "company": "Lyntica",
        "environment": settings.ENVIRONMENT,
        "ai_model": settings.AI_MODEL,
        "database": "connected"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
