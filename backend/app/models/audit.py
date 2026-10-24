from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime
from app.core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, nullable=False, index=True)
    actor_name = Column(String(100), nullable=False)
    actor_role = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False)  # CREATE, UPDATE, APPROVE, REJECT, FINALIZE
    entity = Column(String(100), nullable=False)  # CompanySettings, Employee, LeaveRequest, PayrollRun
    entity_id = Column(String(50), nullable=True)
    before_state = Column(Text, nullable=True)  # JSON string
    after_state = Column(Text, nullable=True)   # JSON string
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
