from datetime import date, datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type_id = Column(Integer, ForeignKey("leave_type_quotas.id", ondelete="RESTRICT"), nullable=False)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    total_days = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(30), default="pending", nullable=False)  # pending, approved, rejected, cancelled
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewer_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    reviewed_at = Column(DateTime, nullable=True)

    employee = relationship("Employee", lazy="joined")
    leave_type = relationship("LeaveTypeQuota", lazy="joined")
