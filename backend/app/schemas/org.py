from datetime import date
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class CompanySettingsSchema(BaseModel):
    id: int
    company_name: str
    office_start: str
    grace_minutes: int
    half_day_hours: float
    weekend_days: str
    office_lat: float
    office_lng: float
    office_radius_meters: float
    late_penalty_rule: bool

    model_config = ConfigDict(from_attributes=True)

class UpdateCompanySettingsRequest(BaseModel):
    company_name: Optional[str] = None
    office_start: Optional[str] = None
    grace_minutes: Optional[int] = None
    half_day_hours: Optional[float] = None
    weekend_days: Optional[str] = None
    office_lat: Optional[float] = None
    office_lng: Optional[float] = None
    office_radius_meters: Optional[float] = None
    late_penalty_rule: Optional[bool] = None

class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=20)
    description: Optional[str] = None

class DepartmentResponse(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class DesignationCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    department_id: int

class DesignationResponse(BaseModel):
    id: int
    title: str
    department_id: int

    model_config = ConfigDict(from_attributes=True)

class HolidayCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    date: date
    description: Optional[str] = None

class HolidayResponse(BaseModel):
    id: int
    name: str
    date: date
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class LeaveTypeQuotaCreate(BaseModel):
    name: str
    code: str
    annual_quota: int
    is_unpaid: bool = False

class LeaveTypeQuotaResponse(BaseModel):
    id: int
    name: str
    code: str
    annual_quota: int
    is_unpaid: bool

    model_config = ConfigDict(from_attributes=True)
