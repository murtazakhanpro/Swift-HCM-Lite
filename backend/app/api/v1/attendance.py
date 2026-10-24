from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, or_
from starlette.concurrency import run_in_threadpool
from app.core.database import get_db
from app.core.deps import get_current_user, require_role, record_audit_log
from app.models.user import User
from app.models.employee import Employee
from app.models.organization import CompanySettings
from app.models.attendance import Attendance, AttendanceCorrection
from app.models.face_template import FaceTemplate
from app.services.face_verification import get_embedding, encrypt_embedding, decrypt_embedding, compare_embeddings, face_verification_enabled
from app.core.config import settings
from app.services.attendance_engine import (
    calculate_haversine_distance,
    evaluate_check_in_status,
    evaluate_checkout_status
)
from app.schemas.attendance import (
    CheckInRequest,
    FaceImageRequest,
    FaceEnrollmentStatus,
    CheckOutRequest,
    AttendanceRecordResponse,
    TodayStatusResponse,
    DailyBoardSummary,
    AttendanceCorrectionCreate,
    AttendanceCorrectionReview,
    AttendanceCorrectionResponse
)

router = APIRouter(prefix="/attendance", tags=["Attendance (Module 4)"])


@router.get("/face-enrollment", response_model=FaceEnrollmentStatus)
async def get_face_enrollment_status(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if not current_user.employee_id:
        return FaceEnrollmentStatus(enrolled=False, enabled=face_verification_enabled())
    result = await db.execute(select(FaceTemplate).where(FaceTemplate.employee_id == current_user.employee_id))
    return FaceEnrollmentStatus(enrolled=result.scalar_one_or_none() is not None, enabled=face_verification_enabled())


@router.post("/face-enrollment", response_model=FaceEnrollmentStatus)
async def enroll_face(
    payload: FaceImageRequest,
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if not current_user.employee_id:
        raise HTTPException(status_code=400, detail="An employee profile is required for face enrollment.")
    if not payload.consent:
        raise HTTPException(status_code=400, detail="Explicit consent is required to store a face template.")
    vector = await run_in_threadpool(get_embedding, payload.image)
    encrypted = encrypt_embedding(vector)
    result = await db.execute(select(FaceTemplate).where(FaceTemplate.employee_id == current_user.employee_id))
    template = result.scalar_one_or_none()
    if template:
        template.encrypted_embedding = encrypted
        template.consented_at = datetime.now()
    else:
        db.add(FaceTemplate(employee_id=current_user.employee_id, encrypted_embedding=encrypted))
    await db.commit()
    return FaceEnrollmentStatus(enrolled=True, enabled=True)


@router.delete("/face-enrollment", response_model=FaceEnrollmentStatus)
async def delete_face_enrollment(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if not current_user.employee_id:
        raise HTTPException(status_code=400, detail="An employee profile is required.")
    result = await db.execute(select(FaceTemplate).where(FaceTemplate.employee_id == current_user.employee_id))
    template = result.scalar_one_or_none()
    if template:
        await db.delete(template)
        await db.commit()
    return FaceEnrollmentStatus(enrolled=False, enabled=face_verification_enabled())

def format_attendance_response(att: Attendance, emp: Optional[Employee] = None) -> AttendanceRecordResponse:
    employee_obj = emp or att.employee
    emp_name = f"{employee_obj.first_name} {employee_obj.last_name}" if employee_obj else "Unknown"
    emp_code = employee_obj.employee_code if employee_obj else "EMP-000"
    dept_name = employee_obj.department.name if employee_obj and employee_obj.department else None

    return AttendanceRecordResponse(
        id=att.id,
        employee_id=att.employee_id,
        employee_code=emp_code,
        employee_name=emp_name,
        department_name=dept_name,
        date=att.date,
        check_in_time=att.check_in_time,
        check_out_time=att.check_out_time,
        total_hours=att.total_hours,
        status=att.status,
        check_in_source=att.check_in_source,
        check_in_lat=att.check_in_lat,
        check_in_lng=att.check_in_lng,
        face_verified=att.face_verified
    )

@router.get("/today-status", response_model=TodayStatusResponse)
async def get_today_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    company_res = await db.execute(select(CompanySettings))
    company = company_res.scalars().first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company settings not found")

    today = date.today()
    record = None
    has_checked_in = False
    has_checked_out = False

    if current_user.employee_id:
        result = await db.execute(
            select(Attendance).where(
                Attendance.employee_id == current_user.employee_id,
                Attendance.date == today
            )
        )
        att = result.scalar_one_or_none()
        if att:
            has_checked_in = True
            has_checked_out = att.check_out_time is not None
            record = format_attendance_response(att)

    return TodayStatusResponse(
        has_checked_in=has_checked_in,
        has_checked_out=has_checked_out,
        record=record,
        office_lat=company.office_lat,
        office_lng=company.office_lng,
        office_radius_meters=company.office_radius_meters
    )

@router.post("/check-in", response_model=AttendanceRecordResponse)
async def check_in(
    payload: CheckInRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Only users with an assigned employee_id can mark attendance
    if not current_user.employee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin master account cannot mark attendance. Only HR operators and Employees registered in the directory can check in."
        )

    today = date.today()

    # 1. Check duplicate check-in today (Rule: One record per employee per day; second check-in = 409)
    existing = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == current_user.employee_id,
            Attendance.date == today
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already checked in for today."
        )

    # 2. Fetch company schedule & geofence rules
    company_res = await db.execute(select(CompanySettings))
    company = company_res.scalars().first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company settings not configured")

    face_verified = False

    # 3. Camera & Geofence Verification (Section 5)
    if payload.source == "camera":
        if not payload.face_image:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Camera check-in requires a captured face image."
            )

        template_res = await db.execute(select(FaceTemplate).where(FaceTemplate.employee_id == current_user.employee_id))
        face_template = template_res.scalar_one_or_none()
        if not face_template:
            raise HTTPException(status_code=409, detail="Enroll your face with consent before camera check-in.")

        current_vector = await run_in_threadpool(get_embedding, payload.face_image)
        similarity = compare_embeddings(current_vector, decrypt_embedding(face_template.encrypted_embedding))
        if similarity < settings.FACE_MATCH_THRESHOLD:
            raise HTTPException(status_code=403, detail="Face did not match your enrolled template. Try again or use web check-in.")

        # GPS accuracy check: must be <= 100 meters
        if payload.gps_accuracy is None or payload.gps_accuracy > 100.0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Camera check-in rejected: GPS accuracy ({payload.gps_accuracy or 'unknown'}m) is worse than 100m."
            )

        # Geofence location check via Haversine formula
        if payload.latitude is None or payload.longitude is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Camera check-in rejected: GPS coordinates are required."
            )

        distance = calculate_haversine_distance(
            lat1=payload.latitude,
            lon1=payload.longitude,
            lat2=company.office_lat,
            lon2=company.office_lng
        )

        if distance > company.office_radius_meters:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Camera check-in rejected: You are {int(distance)}m from the office, which exceeds the permitted radius of {int(company.office_radius_meters)}m."
            )

        face_verified = True

    # 4. Determine Status (present vs late based on office_start + grace_minutes)
    now = datetime.now()
    initial_status = evaluate_check_in_status(
        check_in_dt=now,
        office_start_str=company.office_start,
        grace_minutes=company.grace_minutes
    )

    # 5. Create Attendance record
    new_attendance = Attendance(
        employee_id=current_user.employee_id,
        date=today,
        check_in_time=now,
        check_out_time=None,
        total_hours=0.0,
        status=initial_status,
        check_in_source=payload.source,
        check_in_lat=payload.latitude,
        check_in_lng=payload.longitude,
        gps_accuracy=payload.gps_accuracy,
        face_verified=face_verified
    )
    db.add(new_attendance)
    await db.commit()
    await db.refresh(new_attendance)

    # Fetch employee relation for response
    emp_res = await db.execute(select(Employee).where(Employee.id == current_user.employee_id))
    emp = emp_res.scalar_one()

    return format_attendance_response(new_attendance, emp)

@router.post("/check-out", response_model=AttendanceRecordResponse)
async def check_out(
    payload: CheckOutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.employee_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No employee profile associated with this account")

    today = date.today()
    result = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == current_user.employee_id,
            Attendance.date == today
        )
    )
    att = result.scalar_one_or_none()
    if not att:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No check-in record found for today. You must check in before checking out."
        )

    if att.check_out_time is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already checked out for today."
        )

    company_res = await db.execute(select(CompanySettings))
    company = company_res.scalars().first()
    half_day_hours = company.half_day_hours if company else 5.0

    now = datetime.now()
    total_hours, updated_status = evaluate_checkout_status(
        check_in_dt=att.check_in_time,
        check_out_dt=now,
        half_day_hours=half_day_hours,
        current_status=att.status
    )

    att.check_out_time = now
    att.total_hours = total_hours
    att.status = updated_status

    await db.commit()
    await db.refresh(att)

    emp_res = await db.execute(select(Employee).where(Employee.id == current_user.employee_id))
    emp = emp_res.scalar_one()

    return format_attendance_response(att, emp)

@router.get("/daily-board", response_model=DailyBoardSummary)
async def get_daily_attendance_board(
    target_date: Optional[date] = Query(None, description="Date for attendance board, defaults to today"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query_date = target_date or date.today()

    query = select(Attendance).where(Attendance.date == query_date)

    if current_user.role == "Employee":
        if not current_user.employee_id:
            return DailyBoardSummary(
                date=query_date,
                total_active_employees=0,
                present_today=0,
                late_today=0,
                half_day_today=0,
                missing_checkout_today=0,
                records=[]
            )
        query = query.where(Attendance.employee_id == current_user.employee_id)

    result = await db.execute(query.order_by(Attendance.id.desc()))
    records = result.scalars().all()

    # Get active employee count
    total_active = (await db.execute(select(func.count(Employee.id)).where(Employee.status == "active"))).scalar_one()

    # Metric counts for today
    present_count = 0
    late_count = 0
    half_day_count = 0
    missing_checkout_count = 0

    for r in records:
        if r.status == "present":
            present_count += 1
        elif r.status == "late":
            late_count += 1
        elif r.status == "half_day":
            half_day_count += 1
        
        if r.check_in_time and not r.check_out_time and query_date < date.today():
            missing_checkout_count += 1

    formatted_records = [format_attendance_response(r) for r in records]

    return DailyBoardSummary(
        date=query_date,
        total_active_employees=total_active,
        present_today=present_count,
        late_today=late_count,
        half_day_today=half_day_count,
        missing_checkout_today=missing_checkout_count,
        records=formatted_records
    )

@router.get("/history", response_model=List[AttendanceRecordResponse])
async def get_attendance_history(
    employee_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Attendance)

    # Scoped guard: Employee can only see own history
    if current_user.role == "Employee":
        query = query.where(Attendance.employee_id == current_user.employee_id)
    elif employee_id:
        query = query.where(Attendance.employee_id == employee_id)

    if start_date:
        query = query.where(Attendance.date >= start_date)
    if end_date:
        query = query.where(Attendance.date <= end_date)

    query = query.order_by(Attendance.date.desc())
    result = await db.execute(query.limit(100))
    records = result.scalars().all()

    return [format_attendance_response(r) for r in records]

# --- ATTENDANCE CORRECTIONS (M4) ---
@router.post("/corrections", response_model=AttendanceCorrectionResponse)
async def request_attendance_correction(
    payload: AttendanceCorrectionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.employee_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only employees can submit correction requests")

    emp_res = await db.execute(select(Employee).where(Employee.id == current_user.employee_id))
    emp = emp_res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # Find existing attendance record if any
    att_res = await db.execute(
        select(Attendance).where(
            Attendance.employee_id == current_user.employee_id,
            Attendance.date == payload.requested_date
        )
    )
    existing_att = att_res.scalar_one_or_none()

    correction = AttendanceCorrection(
        attendance_id=existing_att.id if existing_att else None,
        employee_id=current_user.employee_id,
        requested_date=payload.requested_date,
        requested_check_in=payload.requested_check_in,
        requested_check_out=payload.requested_check_out,
        reason=payload.reason,
        status="pending"
    )
    db.add(correction)
    await db.commit()
    await db.refresh(correction)

    return AttendanceCorrectionResponse(
        id=correction.id,
        employee_id=emp.id,
        employee_name=f"{emp.first_name} {emp.last_name}",
        employee_code=emp.employee_code,
        requested_date=correction.requested_date,
        requested_check_in=correction.requested_check_in,
        requested_check_out=correction.requested_check_out,
        reason=correction.reason,
        status=correction.status,
        created_at=correction.created_at
    )

@router.get("/corrections", response_model=List[AttendanceCorrectionResponse])
async def list_attendance_corrections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(AttendanceCorrection)

    if current_user.role == "Employee":
        query = query.where(AttendanceCorrection.employee_id == current_user.employee_id)

    query = query.order_by(AttendanceCorrection.id.desc())
    result = await db.execute(query)
    corrections = result.scalars().all()

    response_items = []
    for c in corrections:
        emp = c.employee
        response_items.append(
            AttendanceCorrectionResponse(
                id=c.id,
                employee_id=c.employee_id,
                employee_name=f"{emp.first_name} {emp.last_name}" if emp else "Unknown",
                employee_code=emp.employee_code if emp else "EMP-000",
                requested_date=c.requested_date,
                requested_check_in=c.requested_check_in,
                requested_check_out=c.requested_check_out,
                reason=c.reason,
                status=c.status,
                reviewed_by=c.reviewed_by,
                review_comment=c.review_comment,
                created_at=c.created_at,
                reviewed_at=c.reviewed_at
            )
        )
    return response_items

@router.patch("/corrections/{correction_id}", response_model=AttendanceCorrectionResponse)
async def review_attendance_correction(
    correction_id: int,
    payload: AttendanceCorrectionReview,
    request: Request,
    current_user: User = Depends(require_role(["HR"])),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(AttendanceCorrection).where(AttendanceCorrection.id == correction_id))
    correction = res.scalar_one_or_none()
    if not correction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance correction request not found")

    if correction.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Correction request has already been {correction.status}")

    correction.status = payload.status
    correction.review_comment = payload.review_comment
    correction.reviewed_by = current_user.id
    correction.reviewed_at = datetime.now()

    # If approved, update or insert into Attendance table
    if payload.status == "approved":
        company_res = await db.execute(select(CompanySettings))
        company = company_res.scalars().first()
        office_start = company.office_start if company else "09:00"
        grace_min = company.grace_minutes if company else 15
        half_day_hrs = company.half_day_hours if company else 5.0

        att_res = await db.execute(
            select(Attendance).where(
                Attendance.employee_id == correction.employee_id,
                Attendance.date == correction.requested_date
            )
        )
        att = att_res.scalar_one_or_none()

        # Recalculate status
        init_status = evaluate_check_in_status(correction.requested_check_in, office_start, grace_min)
        total_hrs = 0.0
        final_status = init_status

        if correction.requested_check_out:
            total_hrs, final_status = evaluate_checkout_status(
                correction.requested_check_in,
                correction.requested_check_out,
                half_day_hrs,
                init_status
            )

        if att:
            att.check_in_time = correction.requested_check_in
            att.check_out_time = correction.requested_check_out
            att.total_hours = total_hrs
            att.status = final_status
        else:
            att = Attendance(
                employee_id=correction.employee_id,
                date=correction.requested_date,
                check_in_time=correction.requested_check_in,
                check_out_time=correction.requested_check_out,
                total_hours=total_hrs,
                status=final_status,
                check_in_source="correction",
                face_verified=False
            )
            db.add(att)

    await db.commit()
    await db.refresh(correction)

    emp = correction.employee
    emp_name = f"{emp.first_name} {emp.last_name}" if emp else "Unknown"
    emp_code = emp.employee_code if emp else "EMP-000"

    await record_audit_log(
        db=db,
        actor=current_user,
        action=f"ATTENDANCE_CORRECTION_{payload.status.upper()}",
        entity="AttendanceCorrection",
        entity_id=str(correction.id),
        after_state={"status": correction.status, "employee_id": correction.employee_id},
        request=request
    )

    return AttendanceCorrectionResponse(
        id=correction.id,
        employee_id=correction.employee_id,
        employee_name=emp_name,
        employee_code=emp_code,
        requested_date=correction.requested_date,
        requested_check_in=correction.requested_check_in,
        requested_check_out=correction.requested_check_out,
        reason=correction.reason,
        status=correction.status,
        reviewed_by=correction.reviewed_by,
        review_comment=correction.review_comment,
        created_at=correction.created_at,
        reviewed_at=correction.reviewed_at
    )
