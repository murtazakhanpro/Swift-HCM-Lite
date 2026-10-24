from datetime import datetime, timezone, date
import calendar
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, desc, delete

from app.core.database import get_db
from app.core.deps import get_current_user, require_role, record_audit_log
from app.models.user import User
from app.models.employee import Employee
from app.models.attendance import Attendance
from app.models.leave import LeaveRequest
from app.models.organization import CompanySettings, LeaveTypeQuota
from app.models.payroll import PayrollRun, Payslip
from app.models.comms import Notification
from app.schemas.payroll import (
    PayrollRunCreate,
    PayrollRunResponse,
    PayrollRunDetailResponse,
    PayslipResponse,
    PayrollFinalizeRequest,
    PayrollSummaryResponse,
)

router = APIRouter(prefix="/payroll", tags=["Payroll Lite (Module 6)"])


def calculate_income_tax(monthly_gross: float) -> float:
    """
    Computes the brief's illustrative monthly withholding from annualized gross.
    Annualized:
      <= 600k: 0%
      600k - 1.2M: 5% of excess over 600k
      1.2M - 2.4M: 30k + 15% of excess over 1.2M
      2.4M - 3.6M: 210k + 25% of excess over 2.4M
      > 3.6M: 510k + 35% of excess over 3.6M
    """
    annual = Decimal(str(monthly_gross)) * Decimal("12")
    if annual <= Decimal("600000"):
        tax = Decimal("0")
    elif annual <= Decimal("1200000"):
        tax = (annual - Decimal("600000")) * Decimal("0.05")
    elif annual <= Decimal("2400000"):
        tax = Decimal("30000") + (annual - Decimal("1200000")) * Decimal("0.15")
    elif annual <= Decimal("3600000"):
        tax = Decimal("210000") + (annual - Decimal("2400000")) * Decimal("0.25")
    else:
        tax = Decimal("510000") + (annual - Decimal("3600000")) * Decimal("0.35")
    monthly_tax = (tax / Decimal("12")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return float(monthly_tax)


def _format_payslip(p: Payslip, month_year: str) -> PayslipResponse:
    emp = p.employee
    name = f"{emp.first_name} {emp.last_name}" if emp else "Unknown"
    code = emp.employee_code if emp else "EMP-000"
    return PayslipResponse(
        id=p.id,
        payroll_run_id=p.payroll_run_id,
        month_year=month_year,
        employee_id=p.employee_id,
        employee_name=name,
        employee_code=code,
        basic_salary=p.basic_salary,
        hra=p.hra,
        medical_allowance=p.medical_allowance,
        gross_salary=p.gross_salary,
        working_days=p.working_days,
        absent_days=p.absent_days,
        half_days=p.half_days,
        late_count=p.late_count,
        unpaid_leave_days=p.unpaid_leave_days,
        absence_deduction=p.absence_deduction,
        late_penalty_deduction=p.late_penalty_deduction,
        income_tax=p.income_tax,
        net_salary=p.net_salary,
        created_at=p.created_at,
    )


# ── Create / Recalculate Payroll Run ───────────────────────────────────────────
@router.post("/runs", response_model=PayrollRunDetailResponse)
async def create_or_update_payroll_run(
    payload: PayrollRunCreate,
    request: Request,
    current_user: User = Depends(require_role(["Admin", "HR"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Initiate or recalculate a monthly payroll run for all active employees.
    HR can prepare draft; Admin can also prepare/recalculate.
    """
    month_year = payload.month_year.strip()
    if len(month_year) != 7 or month_year[4] != "-":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid month_year format. Use YYYY-MM (e.g. '2026-10').",
        )
    if payload.working_days <= 0 or payload.working_days > 31:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="working_days must be between 1 and 31.",
        )

    # Check existing run
    run_q = await db.execute(
        select(PayrollRun)
        .options(selectinload(PayrollRun.payslips).joinedload(Payslip.employee))
        .where(PayrollRun.month_year == month_year)
    )
    existing_run = run_q.scalar_one_or_none()

    if existing_run and existing_run.status == "finalized":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payroll for {month_year} is already finalized and locked.",
        )

    # Check Company Settings for late penalty rule
    sett_q = await db.execute(select(CompanySettings))
    company_setting = sett_q.scalar_one_or_none()
    late_penalty_rule = company_setting.late_penalty_rule if company_setting else True

    # Active employees
    emp_q = await db.execute(select(Employee).where(Employee.status == "active"))
    active_employees = emp_q.scalars().all()

    if not active_employees:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active employees found to run payroll.",
        )

    # If existing draft, clear old payslips
    if existing_run:
        await db.execute(delete(Payslip).where(Payslip.payroll_run_id == existing_run.id))
        run = existing_run
        run.working_days = payload.working_days
        run.prepared_by = current_user.id
    else:
        run = PayrollRun(
            month_year=month_year,
            working_days=payload.working_days,
            status="draft",
            prepared_by=current_user.id,
        )
        db.add(run)
        await db.flush()

    total_gross = 0.0
    total_deductions = 0.0
    total_net = 0.0
    created_payslips = []

    year, month = map(int, month_year.split("-"))
    num_days = calendar.monthrange(year, month)[1]
    m_start = date(year, month, 1)
    m_end = date(year, month, num_days)

    for emp in active_employees:
        basic = float(emp.basic_salary or 0.0)
        hra = round(basic * 0.40, 2)
        medical = round(basic * 0.10, 2)
        gross = round(basic * 1.50, 2)

        # 1. Attendance queries for month
        att_q = await db.execute(
            select(Attendance).where(
                Attendance.employee_id == emp.id,
                Attendance.date >= m_start,
                Attendance.date <= m_end,
            )
        )
        att_records = att_q.scalars().all()

        absent_days = sum(1 for a in att_records if a.status == "absent")
        half_days = sum(1 for a in att_records if a.status == "half_day")
        late_count = sum(1 for a in att_records if a.status == "late")

        # 2. Approved leave check for unpaid leaves
        unpaid_quotas_q = await db.execute(
            select(LeaveTypeQuota.id).where(LeaveTypeQuota.is_unpaid == True)
        )
        unpaid_quota_ids = set(unpaid_quotas_q.scalars().all())

        unpaid_leave_days = 0
        if unpaid_quota_ids:
            leaves_q = await db.execute(
                select(LeaveRequest).where(
                    LeaveRequest.employee_id == emp.id,
                    LeaveRequest.status == "approved",
                    LeaveRequest.leave_type_id.in_(unpaid_quota_ids),
                )
            )
            for lr in leaves_q.scalars().all():
                if lr.start_date <= m_end and lr.end_date >= m_start:
                    overlap_start = max(lr.start_date, m_start)
                    overlap_end = min(lr.end_date, m_end)
                    unpaid_leave_days += max(0, (overlap_end - overlap_start).days + 1)

        # Deductions calculation
        daily_rate = (gross / payload.working_days) if payload.working_days > 0 else 0.0

        # Absence deduction: absent_days + half_days * 0.5 + unpaid_leave_days
        effective_absent = absent_days + (half_days * 0.5) + unpaid_leave_days
        absence_deduction = round(effective_absent * daily_rate, 2)

        # Late penalty: 3 lates = 0.5 day deduction
        late_penalty_deduction = 0.0
        if late_penalty_rule and late_count >= 3:
            late_penalty_days = (late_count // 3) * 0.5
            late_penalty_deduction = round(late_penalty_days * daily_rate, 2)

        # Tax
        income_tax = calculate_income_tax(gross)

        # Total deductions
        emp_deductions = round(absence_deduction + late_penalty_deduction + income_tax, 2)
        net_salary = max(0.0, round(gross - emp_deductions, 2))

        payslip = Payslip(
            payroll_run_id=run.id,
            employee_id=emp.id,
            basic_salary=basic,
            hra=hra,
            medical_allowance=medical,
            gross_salary=gross,
            working_days=payload.working_days,
            absent_days=absent_days,
            half_days=half_days,
            late_count=late_count,
            unpaid_leave_days=unpaid_leave_days,
            absence_deduction=absence_deduction,
            late_penalty_deduction=late_penalty_deduction,
            income_tax=income_tax,
            net_salary=net_salary,
        )
        db.add(payslip)
        created_payslips.append(payslip)

        total_gross += gross
        total_deductions += emp_deductions
        total_net += net_salary

    run.total_gross = round(total_gross, 2)
    run.total_deductions = round(total_deductions, 2)
    run.total_net = round(total_net, 2)

    await db.commit()
    await db.refresh(run)

    # Reload payslips with employee relationship
    payslips_q = await db.execute(
        select(Payslip)
        .options(selectinload(Payslip.employee))
        .where(Payslip.payroll_run_id == run.id)
    )
    all_payslips = payslips_q.scalars().all()

    # Record audit log
    await record_audit_log(
        db=db,
        actor=current_user,
        action="PAYROLL_RUN_DRAFTED",
        entity="PayrollRun",
        entity_id=str(run.id),
        after_state={
            "month_year": run.month_year,
            "total_gross": run.total_gross,
            "total_net": run.total_net,
            "employees_count": len(all_payslips),
        },
        request=request,
    )

    formatted_slips = [_format_payslip(p, run.month_year) for p in all_payslips]

    return PayrollRunDetailResponse(
        id=run.id,
        month_year=run.month_year,
        working_days=run.working_days,
        total_gross=run.total_gross,
        total_deductions=run.total_deductions,
        total_net=run.total_net,
        status=run.status,
        prepared_by=run.prepared_by,
        finalized_by=run.finalized_by,
        created_at=run.created_at,
        finalized_at=run.finalized_at,
        payslip_count=len(formatted_slips),
        payslips=formatted_slips,
    )


# ── List All Payroll Runs ──────────────────────────────────────────────────────
@router.get("/runs", response_model=List[PayrollRunResponse])
async def list_payroll_runs(
    current_user: User = Depends(require_role(["Admin", "HR"])),
    db: AsyncSession = Depends(get_db),
):
    runs_q = await db.execute(
        select(PayrollRun)
        .options(selectinload(PayrollRun.payslips))
        .order_by(desc(PayrollRun.month_year))
    )
    runs = runs_q.scalars().all()
    out = []
    for r in runs:
        out.append(
            PayrollRunResponse(
                id=r.id,
                month_year=r.month_year,
                working_days=r.working_days,
                total_gross=r.total_gross,
                total_deductions=r.total_deductions,
                total_net=r.total_net,
                status=r.status,
                prepared_by=r.prepared_by,
                finalized_by=r.finalized_by,
                created_at=r.created_at,
                finalized_at=r.finalized_at,
                payslip_count=len(r.payslips),
            )
        )
    return out


# ── Get Run Detail with Payslips ───────────────────────────────────────────────
@router.get("/runs/{run_id}", response_model=PayrollRunDetailResponse)
async def get_payroll_run_detail(
    run_id: int,
    current_user: User = Depends(require_role(["Admin", "HR"])),
    db: AsyncSession = Depends(get_db),
):
    run_q = await db.execute(
        select(PayrollRun)
        .options(selectinload(PayrollRun.payslips).selectinload(Payslip.employee))
        .where(PayrollRun.id == run_id)
    )
    run = run_q.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll run not found.",
        )

    formatted_slips = [_format_payslip(p, run.month_year) for p in run.payslips]
    return PayrollRunDetailResponse(
        id=run.id,
        month_year=run.month_year,
        working_days=run.working_days,
        total_gross=run.total_gross,
        total_deductions=run.total_deductions,
        total_net=run.total_net,
        status=run.status,
        prepared_by=run.prepared_by,
        finalized_by=run.finalized_by,
        created_at=run.created_at,
        finalized_at=run.finalized_at,
        payslip_count=len(formatted_slips),
        payslips=formatted_slips,
    )


# ── Finalize Payroll Run (Admin Only) ───────────────────────────────────────────
@router.post("/runs/{run_id}/finalize", response_model=PayrollRunDetailResponse)
async def finalize_payroll_run(
    run_id: int,
    payload: PayrollFinalizeRequest,
    request: Request,
    current_user: User = Depends(require_role(["Admin"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin locks a draft payroll run into finalized status.
    Notifies active employees that their payslips are ready.
    """
    run_q = await db.execute(
        select(PayrollRun)
        .options(selectinload(PayrollRun.payslips).selectinload(Payslip.employee))
        .where(PayrollRun.id == run_id)
    )
    run = run_q.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll run not found.",
        )

    if run.status == "finalized":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payroll run is already finalized.",
        )

    run.status = "finalized"
    run.finalized_by = current_user.id
    run.finalized_at = datetime.now(timezone.utc)

    # Create notifications for all employees in this run
    users_q = await db.execute(select(User).where(User.employee_id.isnot(None)))
    user_by_emp_id = {u.employee_id: u for u in users_q.scalars().all()}

    for p in run.payslips:
        usr = user_by_emp_id.get(p.employee_id)
        if usr:
            notif = Notification(
                recipient_id=usr.id,
                title="Payslip Published",
                message=f"Your payslip for {run.month_year} is now finalized and available. Net payout: PKR {p.net_salary:,.2f}.",
                type="payslip_ready",
            )
            db.add(notif)

    await db.commit()
    await db.refresh(run)

    # Reload payslips with employee relationship
    payslips_q = await db.execute(
        select(Payslip)
        .options(selectinload(Payslip.employee))
        .where(Payslip.payroll_run_id == run.id)
    )
    all_payslips = payslips_q.scalars().all()

    # Record audit log
    await record_audit_log(
        db=db,
        actor=current_user,
        action="PAYROLL_RUN_FINALIZED",
        entity="PayrollRun",
        entity_id=str(run.id),
        after_state={
            "month_year": run.month_year,
            "status": "finalized",
            "total_net": run.total_net,
            "finalized_by": current_user.email,
        },
        request=request,
    )

    formatted_slips = [_format_payslip(p, run.month_year) for p in all_payslips]
    return PayrollRunDetailResponse(
        id=run.id,
        month_year=run.month_year,
        working_days=run.working_days,
        total_gross=run.total_gross,
        total_deductions=run.total_deductions,
        total_net=run.total_net,
        status=run.status,
        prepared_by=run.prepared_by,
        finalized_by=run.finalized_by,
        created_at=run.created_at,
        finalized_at=run.finalized_at,
        payslip_count=len(formatted_slips),
        payslips=formatted_slips,
    )


# ── Delete Draft Payroll Run ──────────────────────────────────────────────────
@router.delete("/runs/{run_id}")
async def delete_payroll_run(
    run_id: int,
    request: Request,
    current_user: User = Depends(require_role(["Admin"])),
    db: AsyncSession = Depends(get_db),
):
    run_q = await db.execute(select(PayrollRun).where(PayrollRun.id == run_id))
    run = run_q.scalar_one_or_none()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payroll run not found.",
        )
    if run.status == "finalized":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a finalized payroll run. Finalized runs are locked for financial integrity.",
        )

    month = run.month_year
    await db.delete(run)
    await db.commit()

    await record_audit_log(
        db=db,
        actor=current_user,
        action="PAYROLL_RUN_DELETED",
        entity="PayrollRun",
        entity_id=str(run_id),
        before_state={"month_year": month},
        request=request,
    )

    return {"message": f"Draft payroll run for {month} successfully deleted."}


# ── Summary KPI ───────────────────────────────────────────────────────────────
@router.get("/summary", response_model=PayrollSummaryResponse)
async def get_payroll_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    runs_q = await db.execute(
        select(PayrollRun)
        .options(selectinload(PayrollRun.payslips))
        .order_by(desc(PayrollRun.month_year))
    )
    runs = runs_q.scalars().all()

    total_runs = len(runs)
    draft_runs = sum(1 for r in runs if r.status == "draft")
    finalized_runs = sum(1 for r in runs if r.status == "finalized")

    latest_run = runs[0] if runs else None
    latest_month = latest_run.month_year if latest_run else None
    latest_net = latest_run.total_net if latest_run else 0.0
    latest_count = len(latest_run.payslips) if latest_run else 0

    return PayrollSummaryResponse(
        total_runs=total_runs,
        draft_runs=draft_runs,
        finalized_runs=finalized_runs,
        latest_month=latest_month,
        latest_net_payout=latest_net,
        latest_employee_count=latest_count,
    )


# ── Employee's Own Payslips ───────────────────────────────────────────────────
@router.get("/payslips/my", response_model=List[PayslipResponse])
async def get_my_payslips(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.employee_id:
        # If user is admin without employee profile, return empty list
        return []

    # Only show payslips from finalized runs or all runs?
    # Best practice: Employees see finalized payslips, or both if published
    q = await db.execute(
        select(Payslip)
        .join(PayrollRun, Payslip.payroll_run_id == PayrollRun.id)
        .options(selectinload(Payslip.employee), selectinload(Payslip.payroll_run))
        .where(
            Payslip.employee_id == current_user.employee_id,
            PayrollRun.status == "finalized",
        )
        .order_by(desc(PayrollRun.month_year))
    )
    slips = q.scalars().all()
    return [_format_payslip(s, s.payroll_run.month_year if s.payroll_run else "") for s in slips]


# ── Individual Payslip Detail (Role Scoped) ───────────────────────────────────
@router.get("/payslips/{slip_id}", response_model=PayslipResponse)
async def get_payslip_detail(
    slip_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = await db.execute(
        select(Payslip)
        .options(selectinload(Payslip.employee), selectinload(Payslip.payroll_run))
        .where(Payslip.id == slip_id)
    )
    slip = q.scalar_one_or_none()
    if not slip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payslip not found.",
        )

    # Scoped: Employees can only view their own
    if current_user.role.lower() == "employee":
        if slip.employee_id != current_user.employee_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only view your own payslips.",
            )

    month = slip.payroll_run.month_year if slip.payroll_run else ""
    return _format_payslip(slip, month)
