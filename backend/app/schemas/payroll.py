from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class PayrollRunCreate(BaseModel):
    month_year: str   # YYYY-MM format
    working_days: int


class PayrollRunResponse(BaseModel):
    id: int
    month_year: str
    working_days: int
    total_gross: float
    total_deductions: float
    total_net: float
    status: str          # draft | finalized
    prepared_by: Optional[int] = None
    finalized_by: Optional[int] = None
    created_at: datetime
    finalized_at: Optional[datetime] = None
    payslip_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class PayslipResponse(BaseModel):
    id: int
    payroll_run_id: int
    month_year: str
    employee_id: int
    employee_name: str
    employee_code: str
    basic_salary: float
    hra: float
    medical_allowance: float
    gross_salary: float
    working_days: int
    absent_days: int
    half_days: int
    late_count: int
    unpaid_leave_days: int
    absence_deduction: float
    late_penalty_deduction: float
    income_tax: float
    net_salary: float
    created_at: datetime


class PayrollFinalizeRequest(BaseModel):
    confirm: bool = True


class PayrollRunDetailResponse(PayrollRunResponse):
    payslips: List[PayslipResponse] = []


class PayrollSummaryResponse(BaseModel):
    total_runs: int
    draft_runs: int
    finalized_runs: int
    latest_month: Optional[str] = None
    latest_net_payout: float = 0.0
    latest_employee_count: int = 0
