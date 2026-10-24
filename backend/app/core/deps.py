import json
from typing import Optional, List, Any
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.models.audit import AuditLog

security = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated"
        )
        
    return user

def require_role(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        # Standardize casing check (e.g. 'Admin', 'HR', 'Employee')
        normalized_allowed = [r.lower() for r in allowed_roles]
        if current_user.role.lower() not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Requires role '{', '.join(allowed_roles)}'"
            )
        return current_user
    return role_checker

async def record_audit_log(
    db: AsyncSession,
    actor: User,
    action: str,
    entity: str,
    entity_id: Optional[str] = None,
    before_state: Optional[Any] = None,
    after_state: Optional[Any] = None,
    request: Optional[Request] = None
):
    ip_addr = request.client.host if request and request.client else None
    log_entry = AuditLog(
        actor_id=actor.id,
        actor_name=actor.email,
        actor_role=actor.role,
        action=action,
        entity=entity,
        entity_id=str(entity_id) if entity_id is not None else None,
        before_state=json.dumps(before_state, default=str) if before_state is not None else None,
        after_state=json.dumps(after_state, default=str) if after_state is not None else None,
        ip_address=ip_addr
    )
    db.add(log_entry)
    await db.commit()
