from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class PayrollRun(Base):
    __tablename__ = "payroll_runs"

    id = Column(Integer, primary_key=True, index=True)
    month_year = Column(String(7), unique=True, nullable=False, index=True)  # YYYY-MM e.g. "2026-10"
    working_days = Column(Integer, nullable=False)
    total_gross = Column(Float, default=0.0, nullable=False)
    total_deductions = Column(Float, default=0.0, nullable=False)
    total_net = Column(Float, default=0.0, nullable=False)
    status = Column(String(20), default="draft", nullable=False)  # draft, finalized (locked)
    prepared_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    finalized_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    finalized_at = Column(DateTime, nullable=True)

    payslips = relationship("Payslip", back_populates="payroll_run", cascade="all, delete-orphan")

class Payslip(Base):
    __tablename__ = "payslips"

    id = Column(Integer, primary_key=True, index=True)
    payroll_run_id = Column(Integer, ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    basic_salary = Column(Float, nullable=False)
    hra = Column(Float, nullable=False)                 # 40% of basic
    medical_allowance = Column(Float, nullable=False)   # 10% of basic
    gross_salary = Column(Float, nullable=False)        # 1.5 * basic
    
    # Days & Deductions
    working_days = Column(Integer, nullable=False)
    absent_days = Column(Integer, default=0, nullable=False)
    half_days = Column(Integer, default=0, nullable=False)
    late_count = Column(Integer, default=0, nullable=False)
    unpaid_leave_days = Column(Integer, default=0, nullable=False)
    
    absence_deduction = Column(Float, default=0.0, nullable=False)
    late_penalty_deduction = Column(Float, default=0.0, nullable=False)
    income_tax = Column(Float, default=0.0, nullable=False)
    net_salary = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint('payroll_run_id', 'employee_id', name='uq_payroll_employee_payslip'),
    )

    payroll_run = relationship("PayrollRun", back_populates="payslips")
    employee = relationship("Employee", lazy="joined")
