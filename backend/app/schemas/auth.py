from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class SetupRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=255)
    admin_email: EmailStr
    admin_password: str = Field(..., min_length=6, max_length=128)
    office_start: Optional[str] = "09:00"
    grace_minutes: Optional[int] = 15
    office_lat: Optional[float] = 24.8607
    office_lng: Optional[float] = 67.0011
    office_radius_meters: Optional[float] = 150.0

class SetupStatusResponse(BaseModel):
    is_setup_completed: bool
    company_name: Optional[str] = None
    admin_exists: bool

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    must_change_password: bool
    employee_id: Optional[int] = None
    company_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=128)

class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field(..., pattern="^(HR|Employee)$")

class UpdateUserStatusRequest(BaseModel):
    is_active: bool
