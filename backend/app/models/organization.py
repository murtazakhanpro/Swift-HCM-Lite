from datetime import date
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class CompanySettings(Base):
    __tablename__ = "company_settings"

    id = Column(Integer, primary_key=True)
    company_name = Column(String(255), nullable=False)
    office_start = Column(String(10), default="09:00", nullable=False)
    grace_minutes = Column(Integer, default=15, nullable=False)
    half_day_hours = Column(Float, default=5.0, nullable=False)
    weekend_days = Column(String(50), default="Saturday,Sunday", nullable=False)
    office_lat = Column(Float, default=24.8607, nullable=False)  # Karachi default
    office_lng = Column(Float, default=67.0011, nullable=False)
    office_radius_meters = Column(Float, default=150.0, nullable=False)
    late_penalty_rule = Column(Boolean, default=True, nullable=False)  # 3 lates = 0.5 day deduction

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    description = Column(String(255), nullable=True)

    designations = relationship("Designation", back_populates="department", cascade="all, delete-orphan")

class Designation(Base):
    __tablename__ = "designations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)

    department = relationship("Department", back_populates="designations")

class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    date = Column(Date, unique=True, nullable=False)
    description = Column(String(255), nullable=True)

class LeaveTypeQuota(Base):
    __tablename__ = "leave_type_quotas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)  # annual, sick, casual, unpaid
    annual_quota = Column(Integer, default=0, nullable=False)  # 14, 8, 10, or 0 for unpaid
    is_unpaid = Column(Boolean, default=False, nullable=False)
