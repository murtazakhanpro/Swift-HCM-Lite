from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    content: str = Field(..., min_length=10)


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    content: str
    author_id: int
    author_name: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class NotificationResponse(BaseModel):
    id: int
    recipient_id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AuditLogResponse(BaseModel):
    id: int
    actor_id: int
    actor_name: str
    actor_role: str
    action: str
    entity: str
    entity_id: Optional[str] = None
    before_state: Optional[str] = None
    after_state: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)


class AIQueryRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    context: Optional[str] = None


class AIQueryResponse(BaseModel):
    answer: str
    tool_used: Optional[str] = None
    data: Optional[dict] = None
