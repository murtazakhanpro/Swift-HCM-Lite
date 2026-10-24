from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class CheckInRequest(BaseModel):
    source: str = Field(default="web", pattern="^(web|camera)$")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    gps_accuracy: Optional[float] = None
    face_image: Optional[str] = Field(None, max_length=2_800_000)

class FaceImageRequest(BaseModel):
    image: str = Field(..., min_length=100, max_length=2_800_000)
    consent: bool = False

class FaceEnrollmentStatus(BaseModel):
    enrolled: bool
    enabled: bool

class CheckOutRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class AttendanceRecordResponse(BaseModel):
    id: int
    employee_id: int
    employee_code: str
    employee_name: str
    department_name: Optional[str] = None
    date: date
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    total_hours: float
    status: str  # present, late, half_day, absent, missing_checkout
    check_in_source: str
    check_in_lat: Optional[float] = None
    check_in_lng: Optional[float] = None
    face_verified: bool

    model_config = ConfigDict(from_attributes=True)

class TodayStatusResponse(BaseModel):
    has_checked_in: bool
    has_checked_out: bool
    record: Optional[AttendanceRecordResponse] = None
    office_lat: float
    office_lng: float
    office_radius_meters: float

class DailyBoardSummary(BaseModel):
    date: date
    total_active_employees: int
    present_today: int
    late_today: int
    half_day_today: int
    missing_checkout_today: int
    records: List[AttendanceRecordResponse]

class AttendanceCorrectionCreate(BaseModel):
    requested_date: date
    requested_check_in: datetime
    requested_check_out: Optional[datetime] = None
    reason: str = Field(..., min_length=5, max_length=500)

class AttendanceCorrectionReview(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    review_comment: Optional[str] = Field(None, max_length=500)

class AttendanceCorrectionResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    employee_code: str
    requested_date: date
    requested_check_in: datetime
    requested_check_out: Optional[datetime] = None
    reason: str
    status: str  # pending, approved, rejected
    reviewed_by: Optional[int] = None
    review_comment: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
