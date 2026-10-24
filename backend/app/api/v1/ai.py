from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.comms import AIQueryRequest, AIQueryResponse
from app.services.ai_engine import answer_ai_query

router = APIRouter(prefix="/ai", tags=["AI Executive Assistant (Module 7)"])

@router.post("/query", response_model=AIQueryResponse)
async def query_ai_assistant(
    payload: AIQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Query the Swift-HCM Grounded AI Assistant with 7 scoped HCM tools.
    Responses are grounded in actual database metrics & restricted by user role.
    """
    res = await answer_ai_query(payload.message, current_user, db)
    return AIQueryResponse(
        answer=res["answer"],
        tool_used=res.get("tool_used"),
        data=res.get("data")
    )
