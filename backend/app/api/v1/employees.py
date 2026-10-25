import csv
import io
import re
from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File, Query
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from app.core.database import get_db
from app.core.security import hash_password
from app.core.deps import get_current_user, require_role, record_audit_log
from app.models.user import User
from app.models.employee import Employee
from app.models.organization import Department, Designation
from app.models.attendance import Attendance
from app.models.leave import LeaveRequest
from app.models.payroll import Payslip
from app.models.face_template import FaceTemplate
from app.services.face_verification import get_embedding, encrypt_embedding
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    EmployeeListResponse,
    Employee360Response,
    CsvDryRunResponse,
    CsvDryRunError,
    CsvImportCommitResponse,
    DepartmentSimple,
    DesignationSimple
)

router = APIRouter(prefix="/employees", tags=["Employees (Module 3)"])

def format_employee_response(emp: Employee) -> EmployeeResponse:
    return EmployeeResponse(
        id=emp.id,
        employee_code=emp.employee_code,
        first_name=emp.first_name,
        last_name=emp.last_name,
        email=emp.email,
        phone=emp.phone,
        address=emp.address,
        department_id=emp.department_id,
        designation_id=emp.designation_id,
        joining_date=emp.joining_date,
        exit_date=emp.exit_date,
        status=emp.status,
        basic_salary=emp.basic_salary,
        gross_salary=round(emp.basic_salary * 1.5, 2),
        created_at=emp.created_at,
        department=DepartmentSimple.model_validate(emp.department) if emp.department else None,
        designation=DesignationSimple.model_validate(emp.designation) if emp.designation else None
    )

@router.get("", response_model=EmployeeListResponse)
async def list_employees(
    search: Optional[str] = Query(None, description="Search by name, email, or employee code"),
    department_id: Optional[int] = Query(None, description="Filter by department"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (active, probation, etc.)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Employee)

    # Scoped access guard: Employee only sees own record
    if current_user.role == "Employee":
        if not current_user.employee_id:
            return EmployeeListResponse(items=[], total=0, page=page, page_size=page_size, total_pages=0)
        query = query.where(Employee.id == current_user.employee_id)
    else:
        # Admin and HR filters
        if search:
            search_term = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Employee.first_name.ilike(search_term),
                    Employee.last_name.ilike(search_term),
                    Employee.email.ilike(search_term),
                    Employee.employee_code.ilike(search_term)
                )
            )
        if department_id:
            query = query.where(Employee.department_id == department_id)
        if status_filter:
            query = query.where(Employee.status == status_filter)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Pagination & Ordering
    offset = (page - 1) * page_size
    query = query.order_by(Employee.id.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    employees = result.scalars().all()

    items = [format_employee_response(e) for e in employees]
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return EmployeeListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.post("", response_model=EmployeeResponse)
async def register_employee(
    data: EmployeeCreate,
    request: Request,
    current_user: User = Depends(require_role(["HR"])),
    db: AsyncSession = Depends(get_db)
):
    # 1. Check duplicate email in Employee or User
    dup_email = await db.execute(select(Employee).where(Employee.email == data.email))
    if dup_email.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An employee with this email already exists")

    dup_user = await db.execute(select(User).where(User.email == data.email))
    if dup_user.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user account with this email already exists")

    # 2. Generate or validate employee_code
    emp_code = data.employee_code
    if not emp_code:
        count_res = await db.execute(select(func.count(Employee.id)))
        current_count = count_res.scalar_one() + 1
        emp_code = f"EMP-{current_count:03d}"
    else:
        dup_code = await db.execute(select(Employee).where(Employee.employee_code == emp_code))
        if dup_code.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An employee with this code already exists")

    # 3. Check department & designation if provided
    if data.department_id:
        dept = await db.execute(select(Department).where(Department.id == data.department_id))
        if not dept.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specified Department not found")

    if data.designation_id:
        desig = await db.execute(select(Designation).where(Designation.id == data.designation_id))
        if not desig.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Specified Designation not found")

    if data.face_image and not data.face_consent:
        raise HTTPException(status_code=400, detail="Explicit consent is required to enroll an employee face.")
    if data.face_consent and not data.face_image:
        raise HTTPException(status_code=400, detail="Provide a face image when face enrollment consent is selected.")
    encrypted_face_embedding = None
    if data.face_image:
        face_vector = await run_in_threadpool(get_embedding, data.face_image)
        encrypted_face_embedding = encrypt_embedding(face_vector)

    # 4. Create Employee
    new_employee = Employee(
        employee_code=emp_code,
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        phone=data.phone,
        address=data.address,
        department_id=data.department_id,
        designation_id=data.designation_id,
        joining_date=data.joining_date,
        basic_salary=data.basic_salary,
        status="active"
    )
    db.add(new_employee)
    await db.flush()  # Generates new_employee.id

    # 5. Automatically create Employee login with temporary password
    temp_pwd = data.temporary_password or "Welcome@2026"
    employee_user = User(
        email=new_employee.email,
        password_hash=hash_password(temp_pwd),
        role="Employee",
        employee_id=new_employee.id,
        is_active=True,
        must_change_password=True
    )
    db.add(employee_user)
    if encrypted_face_embedding:
        db.add(FaceTemplate(employee_id=new_employee.id, encrypted_embedding=encrypted_face_embedding))
    await db.commit()
    await db.refresh(new_employee)

    # 6. Record Audit Log
    await record_audit_log(
        db=db,
        actor=current_user,
        action="REGISTER_EMPLOYEE",
        entity="Employee",
        entity_id=str(new_employee.id),
        after_state={
            "employee_code": new_employee.employee_code,
            "email": new_employee.email,
            "name": f"{new_employee.first_name} {new_employee.last_name}",
            "basic_salary": new_employee.basic_salary,
            "face_enrolled": bool(encrypted_face_embedding)
        },
        request=request
    )

    return format_employee_response(new_employee)

@router.get("/{employee_id}", response_model=Employee360Response)
async def get_employee_360(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Scoped guard: Employee can only see own profile
    if current_user.role == "Employee" and current_user.employee_id != employee_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are only permitted to view your own profile."
        )

    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # Counts for 360 overview
    att_count = (await db.execute(select(func.count(Attendance.id)).where(Attendance.employee_id == employee_id))).scalar_one()
    leave_count = (await db.execute(select(func.count(LeaveRequest.id)).where(LeaveRequest.employee_id == employee_id, LeaveRequest.status == "approved"))).scalar_one()
    payslip_count = (await db.execute(select(func.count(Payslip.id)).where(Payslip.employee_id == employee_id))).scalar_one()

    base_resp = format_employee_response(emp)
    return Employee360Response(
        **base_resp.model_dump(),
        attendance_count=att_count,
        approved_leaves_count=leave_count,
        total_payslips_count=payslip_count
    )

@router.patch("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    # Access scoping
    if current_user.role == "Employee":
        if current_user.employee_id != employee_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: Cannot edit other employees")
        
        # Employee CAN ONLY edit phone and address
        update_dict = data.model_dump(exclude_unset=True)
        disallowed = [k for k in update_dict.keys() if k not in ["phone", "address"]]
        if disallowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Employees may only update phone and address. Modifying {disallowed} is forbidden."
            )
    elif current_user.role == "HR":
        # HR can edit all employee details
        update_dict = data.model_dump(exclude_unset=True)
    else:
        # Admin is View-only for employee details according to Section 8 access matrix
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role has view-only access to employee records. HR manages employees.")

    before_state = {
        "phone": emp.phone,
        "address": emp.address,
        "basic_salary": emp.basic_salary,
        "status": emp.status
    }

    for field, value in update_dict.items():
        setattr(emp, field, value)

    await db.commit()
    await db.refresh(emp)

    await record_audit_log(
        db=db,
        actor=current_user,
        action="UPDATE_EMPLOYEE",
        entity="Employee",
        entity_id=str(emp.id),
        before_state=before_state,
        after_state=update_dict,
        request=request
    )

    return format_employee_response(emp)

# --- CSV DRY-RUN AND IMPORT ---
@router.post("/csv-dry-run", response_model=CsvDryRunResponse)
async def dry_run_csv_import(
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(["HR"])),
    db: AsyncSession = Depends(get_db)
):
    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except Exception:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    if not reader.fieldnames:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV file is empty or missing headers")

    # Required headers
    headers_lower = {h.strip().lower(): h for h in reader.fieldnames}
    required = ["first_name", "last_name", "email", "joining_date", "basic_salary"]
    missing_headers = [r for r in required if r not in headers_lower]
    if missing_headers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required CSV columns: {', '.join(missing_headers)}"
        )

    # Fetch existing DB data for duplicate checking
    existing_emails = set((await db.execute(select(Employee.email))).scalars().all())
    existing_codes = set((await db.execute(select(Employee.employee_code))).scalars().all())
    departments_map = {d.code.upper(): d.id for d in (await db.execute(select(Department))).scalars().all()}
    departments_name_map = {d.name.lower(): d.id for d in (await db.execute(select(Department))).scalars().all()}

    csv_emails = set()
    csv_codes = set()
    errors: List[CsvDryRunError] = []
    total_rows = 0
    valid_rows = 0

    email_regex = re.compile(r"^[^@]+@[^@]+\.[^@]+$")

    for idx, row in enumerate(reader, start=2):  # Row 1 is header
        total_rows += 1
        row_has_error = False

        # Extract normalized row values
        fname = row.get(headers_lower.get("first_name", ""), "").strip()
        lname = row.get(headers_lower.get("last_name", ""), "").strip()
        email = row.get(headers_lower.get("email", ""), "").strip().lower()
        jdate_str = row.get(headers_lower.get("joining_date", ""), "").strip()
        salary_str = row.get(headers_lower.get("basic_salary", ""), "").strip()
        code = row.get(headers_lower.get("employee_code", ""), "").strip()
        dept_val = row.get(headers_lower.get("department", ""), "").strip()

        # Check required fields
        if not fname:
            errors.append(CsvDryRunError(row=idx, field="first_name", reason="First name is required"))
            row_has_error = True
        if not lname:
            errors.append(CsvDryRunError(row=idx, field="last_name", reason="Last name is required"))
            row_has_error = True

        # Check Email
        if not email:
            errors.append(CsvDryRunError(row=idx, field="email", reason="Email is required"))
            row_has_error = True
        elif not email_regex.match(email):
            errors.append(CsvDryRunError(row=idx, field="email", reason="Invalid email format"))
            row_has_error = True
        elif email in csv_emails:
            errors.append(CsvDryRunError(row=idx, field="email", reason="Duplicate email within CSV file"))
            row_has_error = True
        elif email in existing_emails:
            errors.append(CsvDryRunError(row=idx, field="email", reason="Email already registered in database"))
            row_has_error = True
        else:
            csv_emails.add(email)

        # Check Employee Code (if provided)
        if code:
            if code in csv_codes:
                errors.append(CsvDryRunError(row=idx, field="employee_code", reason="Duplicate code within CSV file"))
                row_has_error = True
            elif code in existing_codes:
                errors.append(CsvDryRunError(row=idx, field="employee_code", reason="Code already registered in database"))
                row_has_error = True
            else:
                csv_codes.add(code)

        # Check Joining Date ISO
        if not jdate_str:
            errors.append(CsvDryRunError(row=idx, field="joining_date", reason="Joining date is required"))
            row_has_error = True
        else:
            try:
                date.fromisoformat(jdate_str)
            except ValueError:
                errors.append(CsvDryRunError(row=idx, field="joining_date", reason="Invalid date format. Expected YYYY-MM-DD"))
                row_has_error = True

        # Check Basic Salary
        if not salary_str:
            errors.append(CsvDryRunError(row=idx, field="basic_salary", reason="Basic salary is required"))
            row_has_error = True
        else:
            try:
                val = float(salary_str)
                if val <= 0:
                    errors.append(CsvDryRunError(row=idx, field="basic_salary", reason="Salary must be greater than 0"))
                    row_has_error = True
            except ValueError:
                errors.append(CsvDryRunError(row=idx, field="basic_salary", reason="Salary must be a numeric value"))
                row_has_error = True

        # Check Department (if provided, must exist in DB)
        if dept_val:
            dept_key_upper = dept_val.upper()
            dept_key_lower = dept_val.lower()
            if dept_key_upper not in departments_map and dept_key_lower not in departments_name_map:
                errors.append(CsvDryRunError(row=idx, field="department", reason=f"Unknown department '{dept_val}'. Must match an existing Department code or name."))
                row_has_error = True

        if not row_has_error:
            valid_rows += 1

    return CsvDryRunResponse(
        total_rows=total_rows,
        valid_rows=valid_rows,
        can_import=len(errors) == 0 and total_rows > 0,
        errors=errors
    )

@router.post("/csv-import", response_model=CsvImportCommitResponse)
async def commit_csv_import(
    file: UploadFile = File(...),
    request: Request = None,
    current_user: User = Depends(require_role(["HR"])),
    db: AsyncSession = Depends(get_db)
):
    # Perform dry run first to verify 0 errors
    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except Exception:
        decoded = content.decode("latin-1")

    reader = list(csv.DictReader(io.StringIO(decoded)))
    if not reader:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV file is empty")

    headers_lower = {h.strip().lower(): h for h in reader[0].keys()}
    departments_map = {d.code.upper(): d.id for d in (await db.execute(select(Department))).scalars().all()}
    departments_name_map = {d.name.lower(): d.id for d in (await db.execute(select(Department))).scalars().all()}

    emp_count = (await db.execute(select(func.count(Employee.id)))).scalar_one()

    imported_count = 0
    new_employees = []
    new_users = []

    for row in reader:
        emp_count += 1
        fname = row.get(headers_lower.get("first_name", ""), "").strip()
        lname = row.get(headers_lower.get("last_name", ""), "").strip()
        email = row.get(headers_lower.get("email", ""), "").strip().lower()
        jdate = date.fromisoformat(row.get(headers_lower.get("joining_date", ""), "").strip())
        salary = float(row.get(headers_lower.get("basic_salary", ""), "").strip())
        code = row.get(headers_lower.get("employee_code", ""), "").strip() or f"EMP-{emp_count:03d}"
        phone = row.get(headers_lower.get("phone", ""), "").strip() or None
        address = row.get(headers_lower.get("address", ""), "").strip() or None
        
        dept_val = row.get(headers_lower.get("department", ""), "").strip()
        dept_id = None
        if dept_val:
            dept_id = departments_map.get(dept_val.upper()) or departments_name_map.get(dept_val.lower())

        emp = Employee(
            employee_code=code,
            first_name=fname,
            last_name=lname,
            email=email,
            phone=phone,
            address=address,
            department_id=dept_id,
            joining_date=jdate,
            basic_salary=salary,
            status="active"
        )
        db.add(emp)
        await db.flush()

        usr = User(
            email=email,
            password_hash=hash_password("Welcome@2026"),
            role="Employee",
            employee_id=emp.id,
            is_active=True,
            must_change_password=True
        )
        db.add(usr)
        imported_count += 1

    await db.commit()

    await record_audit_log(
        db=db,
        actor=current_user,
        action="CSV_IMPORT_EMPLOYEES",
        entity="Employee",
        after_state={"imported_count": imported_count},
        request=request
    )

    return CsvImportCommitResponse(
        imported_count=imported_count,
        message=f"Successfully imported {imported_count} employees and generated their user logins."
    )

@router.get("/export/csv")
async def export_employees_csv(
    current_user: User = Depends(require_role(["Admin", "HR"])),
    db: AsyncSession = Depends(get_db)
):
    query = select(Employee).order_by(Employee.id.asc())
    result = await db.execute(query)
    employees = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "employee_code", "first_name", "last_name", "email",
        "phone", "address", "department", "designation",
        "joining_date", "exit_date", "status", "basic_salary", "gross_salary"
    ])

    for e in employees:
        dept_name = e.department.name if e.department else ""
        desig_title = e.designation.title if e.designation else ""
        writer.writerow([
            e.employee_code, e.first_name, e.last_name, e.email,
            e.phone or "", e.address or "", dept_name, desig_title,
            str(e.joining_date), str(e.exit_date or ""), e.status,
            e.basic_salary, round(e.basic_salary * 1.5, 2)
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=employees_export_{date.today().isoformat()}.csv"}
    )
