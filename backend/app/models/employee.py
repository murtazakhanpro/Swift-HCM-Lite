from datetime import date, datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_code = Column(String(50), unique=True, index=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(30), nullable=True)
    address = Column(Text, nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    designation_id = Column(Integer, ForeignKey("designations.id", ondelete="SET NULL"), nullable=True)
    joining_date = Column(Date, nullable=False)
    exit_date = Column(Date, nullable=True)
    status = Column(String(30), default="active", nullable=False)  # active, probation, resigned, terminated
    basic_salary = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    department = relationship("Department", lazy="joined")
    designation = relationship("Designation", lazy="joined")
