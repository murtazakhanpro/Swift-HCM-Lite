from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class LeaveRequestCreate(BaseModel):
    leave_type_id: int
    start_date: date
    end_date: date
    reason: str = Field(..., min_length=5, max_length=500)


class LeaveRequestReview(BaseModel):
    status: str  # approved | rejected
    reviewer_comment: Optional[str] = None


class LeaveTypeSimple(BaseModel):
    id: int
    name: str
    code: str
    annual_quota: int
    is_unpaid: bool
    model_config = ConfigDict(from_attributes=True)


class LeaveRequestResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    employee_code: str
    leave_type_id: int
    leave_type: LeaveTypeSimple
    start_date: date
    end_date: date
    total_days: int
    reason: str
    status: str
    reviewed_by: Optional[int] = None
    reviewer_comment: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None


class LeaveBalanceItem(BaseModel):
    leave_type_id: int
    leave_type_name: str
    leave_type_code: str
    annual_quota: int
    days_taken: int
    days_remaining: int
    is_unpaid: bool


class LeaveBalanceResponse(BaseModel):
    employee_id: int
    employee_name: str
    year: int
    balances: List[LeaveBalanceItem]
