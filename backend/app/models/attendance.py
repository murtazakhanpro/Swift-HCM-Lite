from datetime import date, datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    check_in_time = Column(DateTime, nullable=True)
    check_out_time = Column(DateTime, nullable=True)
    total_hours = Column(Float, default=0.0, nullable=False)
    status = Column(String(30), nullable=False)  # present, late, half_day, absent, missing_checkout
    check_in_source = Column(String(30), default="web", nullable=False)  # web, camera
    check_in_lat = Column(Float, nullable=True)
    check_in_lng = Column(Float, nullable=True)
    gps_accuracy = Column(Float, nullable=True)
    face_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint('employee_id', 'date', name='uq_employee_date_attendance'),
    )

    employee = relationship("Employee", lazy="joined")

class AttendanceCorrection(Base):
    __tablename__ = "attendance_corrections"

    id = Column(Integer, primary_key=True, index=True)
    attendance_id = Column(Integer, ForeignKey("attendance.id", ondelete="CASCADE"), nullable=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    requested_date = Column(Date, nullable=False)
    requested_check_in = Column(DateTime, nullable=False)
    requested_check_out = Column(DateTime, nullable=True)
    reason = Column(Text, nullable=False)
    status = Column(String(30), default="pending", nullable=False)  # pending, approved, rejected
    reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    review_comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    reviewed_at = Column(DateTime, nullable=True)

    employee = relationship("Employee", lazy="joined")
