from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.core.deps import get_current_user, require_role, record_audit_log
from app.models.user import User
from app.models.organization import CompanySettings, Department, Designation, Holiday, LeaveTypeQuota
from app.schemas.org import (
    CompanySettingsSchema,
    UpdateCompanySettingsRequest,
    DepartmentCreate,
    DepartmentResponse,
    DesignationCreate,
    DesignationResponse,
    HolidayCreate,
    HolidayResponse,
    LeaveTypeQuotaCreate,
    LeaveTypeQuotaResponse
)

router = APIRouter(prefix="/org", tags=["Organization Setup (M2)"])

# --- COMPANY SETTINGS ---
@router.get("/settings", response_model=CompanySettingsSchema)
async def get_company_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CompanySettings))
    settings = result.scalars().first()
    if not settings:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company settings not found. Please complete setup.")
    return settings

@router.put("/settings", response_model=CompanySettingsSchema)
async def update_company_settings(
    update_data: UpdateCompanySettingsRequest,
    request: Request,
    current_user: User = Depends(require_role(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(CompanySettings))
    settings = result.scalars().first()
    if not settings:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company settings not initialized.")

    before = {
        "company_name": settings.company_name,
        "office_start": settings.office_start,
        "grace_minutes": settings.grace_minutes,
        "office_lat": settings.office_lat,
        "office_lng": settings.office_lng,
        "office_radius_meters": settings.office_radius_meters
    }

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)

    await db.commit()
    await db.refresh(settings)

    await record_audit_log(
        db=db,
        actor=current_user,
        action="UPDATE_COMPANY_SETTINGS",
        entity="CompanySettings",
        entity_id=str(settings.id),
        before_state=before,
        after_state=update_data.model_dump(exclude_unset=True),
        request=request
    )
    return settings

# --- DEPARTMENTS ---
@router.get("/departments", response_model=List[DepartmentResponse])
async def list_departments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Department).order_by(Department.name.asc()))
    return result.scalars().all()

@router.post("/departments", response_model=DepartmentResponse)
async def create_department(
    data: DepartmentCreate,
    request: Request,
    current_user: User = Depends(require_role(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    existing = await db.execute(select(Department).where((Department.name == data.name) | (Department.code == data.code)))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department with this name or code already exists")

    dept = Department(name=data.name, code=data.code.upper(), description=data.description)
    db.add(dept)
    await db.commit()
    await db.refresh(dept)

    await record_audit_log(
        db=db,
        actor=current_user,
        action="CREATE_DEPARTMENT",
        entity="Department",
        entity_id=str(dept.id),
        after_state={"name": dept.name, "code": dept.code},
        request=request
    )
    return dept

@router.delete("/departments/{dept_id}")
async def delete_department(
    dept_id: int,
    request: Request,
    current_user: User = Depends(require_role(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Department).where(Department.id == dept_id))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    await db.delete(dept)
    await db.commit()

    await record_audit_log(
        db=db,
        actor=current_user,
        action="DELETE_DEPARTMENT",
        entity="Department",
        entity_id=str(dept_id),
        before_state={"name": dept.name, "code": dept.code},
        request=request
    )
    return {"message": "Department deleted"}

# --- DESIGNATIONS ---
@router.get("/designations", response_model=List[DesignationResponse])
async def list_designations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Designation).order_by(Designation.title.asc()))
    return result.scalars().all()

@router.post("/designations", response_model=DesignationResponse)
async def create_designation(
    data: DesignationCreate,
    request: Request,
    current_user: User = Depends(require_role(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    dept_check = await db.execute(select(Department).where(Department.id == data.department_id))
    if not dept_check.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specified Department does not exist")

    desig = Designation(title=data.title, department_id=data.department_id)
    db.add(desig)
    await db.commit()
    await db.refresh(desig)

    await record_audit_log(
        db=db,
        actor=current_user,
        action="CREATE_DESIGNATION",
        entity="Designation",
        entity_id=str(desig.id),
        after_state={"title": desig.title, "department_id": desig.department_id},
        request=request
    )
    return desig

# --- HOLIDAYS ---
@router.get("/holidays", response_model=List[HolidayResponse])
async def list_holidays(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Holiday).order_by(Holiday.date.asc()))
    return result.scalars().all()

@router.post("/holidays", response_model=HolidayResponse)
async def create_holiday(
    data: HolidayCreate,
    request: Request,
    current_user: User = Depends(require_role(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    existing = await db.execute(select(Holiday).where(Holiday.date == data.date))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A holiday is already registered for this date")

    holiday = Holiday(name=data.name, date=data.date, description=data.description)
    db.add(holiday)
    await db.commit()
    await db.refresh(holiday)

    await record_audit_log(
        db=db,
        actor=current_user,
        action="CREATE_HOLIDAY",
        entity="Holiday",
        entity_id=str(holiday.id),
        after_state={"name": holiday.name, "date": str(holiday.date)},
        request=request
    )
    return holiday

# --- LEAVE TYPES ---
@router.get("/leave-types", response_model=List[LeaveTypeQuotaResponse])
async def list_leave_types(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(LeaveTypeQuota).order_by(LeaveTypeQuota.id.asc()))
    return result.scalars().all()
