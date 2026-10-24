from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user, require_role, record_audit_log
from app.models.user import User
from app.models.organization import CompanySettings, LeaveTypeQuota
from app.schemas.auth import (
    SetupRequest,
    SetupStatusResponse,
    LoginRequest,
    TokenResponse,
    UserResponse,
    ChangePasswordRequest,
    CreateUserRequest,
    UpdateUserStatusRequest
)

router = APIRouter(prefix="/auth", tags=["Authentication & Access"])

@router.get("/setup-status", response_model=SetupStatusResponse)
async def get_setup_status(db: AsyncSession = Depends(get_db)):
    admin_result = await db.execute(select(User).where(User.role == "Admin"))
    admin_exists = admin_result.scalars().first() is not None

    company_result = await db.execute(select(CompanySettings))
    company = company_result.scalars().first()

    return SetupStatusResponse(
        is_setup_completed=admin_exists and (company is not None),
        company_name=company.company_name if company else None,
        admin_exists=admin_exists
    )

@router.post("/setup", response_model=TokenResponse)
async def setup_first_run(request_data: SetupRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # Check if an admin already exists. If yes, reject setup.
    admin_check = await db.execute(select(User).where(User.role == "Admin"))
    if admin_check.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System has already been initialized. First-run setup is locked."
        )

    # 1. Create or update Company Settings
    company_check = await db.execute(select(CompanySettings))
    company = company_check.scalars().first()
    if not company:
        company = CompanySettings(
            company_name=request_data.company_name,
            office_start=request_data.office_start or "09:00",
            grace_minutes=request_data.grace_minutes or 15,
            office_lat=request_data.office_lat or 24.8607,
            office_lng=request_data.office_lng or 67.0011,
            office_radius_meters=request_data.office_radius_meters or 150.0
        )
        db.add(company)
    else:
        company.company_name = request_data.company_name

    # 2. Seed standard leave quotas per hackathon brief if not yet present
    quotas_check = await db.execute(select(LeaveTypeQuota))
    if not quotas_check.scalars().first():
        standard_quotas = [
            LeaveTypeQuota(name="Annual Leave", code="annual", annual_quota=14, is_unpaid=False),
            LeaveTypeQuota(name="Sick Leave", code="sick", annual_quota=8, is_unpaid=False),
            LeaveTypeQuota(name="Casual Leave", code="casual", annual_quota=10, is_unpaid=False),
            LeaveTypeQuota(name="Unpaid Leave", code="unpaid", annual_quota=0, is_unpaid=True),
        ]
        db.add_all(standard_quotas)

    # 3. Create First Admin
    hashed_pwd = hash_password(request_data.admin_password)
    admin_user = User(
        email=request_data.admin_email,
        password_hash=hashed_pwd,
        role="Admin",
        is_active=True,
        must_change_password=False
    )
    db.add(admin_user)
    await db.commit()
    await db.refresh(admin_user)

    # 4. Record audit log
    await record_audit_log(
        db=db,
        actor=admin_user,
        action="FIRST_RUN_SETUP",
        entity="CompanySettings",
        entity_id=str(company.id),
        after_state={"company_name": company.company_name, "admin_email": admin_user.email},
        request=request
    )

    # 5. Issue JWT token
    token = create_access_token(data={
        "sub": str(admin_user.id),
        "role": admin_user.role,
        "email": admin_user.email
    })

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=admin_user.id,
            email=admin_user.email,
            role=admin_user.role,
            is_active=admin_user.is_active,
            must_change_password=admin_user.must_change_password,
            company_name=company.company_name
        )
    )

@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact your Administrator."
        )

    company_res = await db.execute(select(CompanySettings))
    company = company_res.scalars().first()
    company_name = company.company_name if company else None

    token = create_access_token(data={
        "sub": str(user.id),
        "role": user.role,
        "email": user.email,
        "employee_id": user.employee_id
    })

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            must_change_password=user.must_change_password,
            employee_id=user.employee_id,
            company_name=company_name
        )
    )

@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    company_res = await db.execute(select(CompanySettings))
    company = company_res.scalars().first()
    company_name = company.company_name if company else None

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        must_change_password=current_user.must_change_password,
        employee_id=current_user.employee_id,
        company_name=company_name
    )

@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    current_user.password_hash = hash_password(data.new_password)
    current_user.must_change_password = False
    await db.commit()
    return {"message": "Password updated successfully"}

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(require_role(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).order_by(User.id.desc()))
    users = result.scalars().all()
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            role=u.role,
            is_active=u.is_active,
            must_change_password=u.must_change_password,
            employee_id=u.employee_id
        ) for u in users
    ]

@router.post("/users", response_model=UserResponse)
async def create_hr_or_user(
    data: CreateUserRequest,
    request: Request,
    current_user: User = Depends(require_role(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")

    new_user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
        is_active=True,
        must_change_password=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    await record_audit_log(
        db=db,
        actor=current_user,
        action="CREATE_USER",
        entity="User",
        entity_id=str(new_user.id),
        after_state={"email": new_user.email, "role": new_user.role},
        request=request
    )

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        role=new_user.role,
        is_active=new_user.is_active,
        must_change_password=new_user.must_change_password,
        employee_id=new_user.employee_id
    )

@router.patch("/users/{user_id}/status")
async def toggle_user_status(
    user_id: int,
    data: UpdateUserStatusRequest,
    request: Request,
    current_user: User = Depends(require_role(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot deactivate your own account")

    before = {"is_active": target.is_active}
    target.is_active = data.is_active
    await db.commit()

    await record_audit_log(
        db=db,
        actor=current_user,
        action="UPDATE_USER_STATUS",
        entity="User",
        entity_id=str(target.id),
        before_state=before,
        after_state={"is_active": target.is_active},
        request=request
    )
    return {"message": f"User status updated to {'active' if target.is_active else 'deactivated'}"}
