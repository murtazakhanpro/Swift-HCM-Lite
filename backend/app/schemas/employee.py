from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class EmployeeBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=30)
    address: Optional[str] = None
    department_id: Optional[int] = None
    designation_id: Optional[int] = None
    joining_date: date
    basic_salary: float = Field(..., gt=0)

class EmployeeCreate(EmployeeBase):
    employee_code: Optional[str] = None  # If not provided, server auto-generates
    temporary_password: Optional[str] = "Welcome@2026"
    face_image: Optional[str] = Field(None, min_length=100, max_length=2_800_000)
    face_consent: bool = False

class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    department_id: Optional[int] = None
    designation_id: Optional[int] = None
    basic_salary: Optional[float] = Field(None, gt=0)
    status: Optional[str] = Field(None, pattern="^(active|probation|resigned|terminated)$")
    exit_date: Optional[date] = None

class EmployeeSelfUpdate(BaseModel):
    phone: Optional[str] = None
    address: Optional[str] = None

class DepartmentSimple(BaseModel):
    id: int
    name: str
    code: str
    model_config = ConfigDict(from_attributes=True)

class DesignationSimple(BaseModel):
    id: int
    title: str
    model_config = ConfigDict(from_attributes=True)

class EmployeeResponse(BaseModel):
    id: int
    employee_code: str
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    department_id: Optional[int] = None
    designation_id: Optional[int] = None
    joining_date: date
    exit_date: Optional[date] = None
    status: str
    basic_salary: float
    gross_salary: float  # Computed: basic * 1.5
    created_at: datetime
    
    department: Optional[DepartmentSimple] = None
    designation: Optional[DesignationSimple] = None

    model_config = ConfigDict(from_attributes=True)

class EmployeeListResponse(BaseModel):
    items: List[EmployeeResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class Employee360Response(EmployeeResponse):
    attendance_count: int = 0
    approved_leaves_count: int = 0
    total_payslips_count: int = 0

class CsvDryRunError(BaseModel):
    row: int
    field: str
    reason: str

class CsvDryRunResponse(BaseModel):
    total_rows: int
    valid_rows: int
    can_import: bool
    errors: List[CsvDryRunError]

class CsvImportCommitResponse(BaseModel):
    imported_count: int
    message: str
