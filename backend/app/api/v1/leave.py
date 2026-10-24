from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, extract
from app.core.database import get_db
from app.core.deps import get_current_user, require_role, record_audit_log
from app.models.user import User
from app.models.employee import Employee
from app.models.leave import LeaveRequest
from app.models.organization import LeaveTypeQuota
from app.models.comms import Notification
from app.schemas.leave import (
    LeaveRequestCreate,
    LeaveRequestReview,
    LeaveRequestResponse,
    LeaveBalanceResponse,
    LeaveBalanceItem,
    LeaveTypeSimple,
)

router = APIRouter(prefix="/leave", tags=["Leave Management (Module 5)"])


def _calendar_days(start: date, end: date) -> int:
    if end < start:
        return 0
    return (end - start).days + 1


async def _format_leave(lr: LeaveRequest) -> LeaveRequestResponse:
    emp = lr.employee
    lt = lr.leave_type
    return LeaveRequestResponse(
        id=lr.id,
        employee_id=lr.employee_id,
        employee_name=f"{emp.first_name} {emp.last_name}" if emp else "Unknown",
        employee_code=emp.employee_code if emp else "EMP-000",
        leave_type_id=lr.leave_type_id,
        leave_type=LeaveTypeSimple.model_validate(lt),
        start_date=lr.start_date,
        end_date=lr.end_date,
        total_days=lr.total_days,
        reason=lr.reason,
        status=lr.status,
        reviewed_by=lr.reviewed_by,
        reviewer_comment=lr.reviewer_comment,
        created_at=lr.created_at,
        reviewed_at=lr.reviewed_at,
    )


# ── Apply for leave ───────────────────────────────────────────────────────────
@router.post("", response_model=LeaveRequestResponse)
async def apply_leave(
    payload: LeaveRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.employee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only employees with an active employee profile can apply for leave.",
        )
    if payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="End date cannot be before start date.",
        )

    lt_res = await db.execute(select(LeaveTypeQuota).where(LeaveTypeQuota.id == payload.leave_type_id))
    leave_type = lt_res.scalar_one_or_none()
    if not leave_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave type not found.")

    year = payload.start_date.year
    taken_res = await db.execute(
        select(func.sum(LeaveRequest.total_days)).where(
            LeaveRequest.employee_id == current_user.employee_id,
            LeaveRequest.leave_type_id == payload.leave_type_id,
            LeaveRequest.status == "approved",
            extract("year", LeaveRequest.start_date) == year,
        )
    )
    days_taken = taken_res.scalar_one() or 0
    days_requested = _calendar_days(payload.start_date, payload.end_date)

    if not leave_type.is_unpaid and (days_taken + days_requested) > leave_type.annual_quota:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance. You have {max(leave_type.annual_quota - days_taken, 0)} day(s) remaining for '{leave_type.name}'.",
        )

    # Overlap check (pending or approved)
    overlap = await db.execute(
        select(LeaveRequest).where(
            LeaveRequest.employee_id == current_user.employee_id,
            LeaveRequest.status.in_(["pending", "approved"]),
            LeaveRequest.start_date <= payload.end_date,
            LeaveRequest.end_date >= payload.start_date,
        )
    )
    if overlap.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pending or approved leave request overlaps with these dates.",
        )

    lr = LeaveRequest(
        employee_id=current_user.employee_id,
        leave_type_id=payload.leave_type_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        total_days=days_requested,
        reason=payload.reason,
        status="pending",
    )
    db.add(lr)
    await db.commit()
    await db.refresh(lr)
    return await _format_leave(lr)


# ── List leave requests (scoped) ──────────────────────────────────────────────
@router.get("", response_model=List[LeaveRequestResponse])
async def list_leave_requests(
    employee_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    year: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(LeaveRequest)
    if current_user.role == "Employee":
        query = query.where(LeaveRequest.employee_id == current_user.employee_id)
    elif employee_id:
        query = query.where(LeaveRequest.employee_id == employee_id)

    if status_filter:
        query = query.where(LeaveRequest.status == status_filter)
    if year:
        query = query.where(extract("year", LeaveRequest.start_date) == year)

    query = query.order_by(LeaveRequest.id.desc()).limit(300)
    result = await db.execute(query)
    requests = result.scalars().all()
    return [await _format_leave(lr) for lr in requests]


# ── Leave balance per employee ────────────────────────────────────────────────
@router.get("/balance/{employee_id}", response_model=LeaveBalanceResponse)
async def get_leave_balance(
    employee_id: int,
    year: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == "Employee" and current_user.employee_id != employee_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    target_year = year or date.today().year
    emp_res = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = emp_res.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found.")

    lt_res = await db.execute(select(LeaveTypeQuota))
    leave_types = lt_res.scalars().all()

    balances: List[LeaveBalanceItem] = []
    for lt in leave_types:
        taken_res = await db.execute(
            select(func.sum(LeaveRequest.total_days)).where(
                LeaveRequest.employee_id == employee_id,
                LeaveRequest.leave_type_id == lt.id,
                LeaveRequest.status == "approved",
                extract("year", LeaveRequest.start_date) == target_year,
            )
        )
        days_taken = taken_res.scalar_one() or 0
        balances.append(
            LeaveBalanceItem(
                leave_type_id=lt.id,
                leave_type_name=lt.name,
                leave_type_code=lt.code,
                annual_quota=lt.annual_quota,
                days_taken=days_taken,
                days_remaining=max(lt.annual_quota - days_taken, 0),
                is_unpaid=lt.is_unpaid,
            )
        )

    return LeaveBalanceResponse(
        employee_id=emp.id,
        employee_name=f"{emp.first_name} {emp.last_name}",
        year=target_year,
        balances=balances,
    )


# ── HR reviews a leave request ────────────────────────────────────────────────
@router.patch("/{leave_id}", response_model=LeaveRequestResponse)
async def review_leave_request(
    leave_id: int,
    payload: LeaveRequestReview,
    request: Request,
    current_user: User = Depends(require_role(["HR"])),
    db: AsyncSession = Depends(get_db),
):
    if payload.status not in ["approved", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Status must be 'approved' or 'rejected'.",
        )

    res = await db.execute(select(LeaveRequest).where(LeaveRequest.id == leave_id))
    lr = res.scalar_one_or_none()
    if not lr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")
    if lr.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot review: leave request is already '{lr.status}'.",
        )

    # Re-validate quota on approval
    if payload.status == "approved":
        lt_res = await db.execute(select(LeaveTypeQuota).where(LeaveTypeQuota.id == lr.leave_type_id))
        lt = lt_res.scalar_one_or_none()
        if lt and not lt.is_unpaid:
            year = lr.start_date.year
            taken_res = await db.execute(
                select(func.sum(LeaveRequest.total_days)).where(
                    LeaveRequest.employee_id == lr.employee_id,
                    LeaveRequest.leave_type_id == lr.leave_type_id,
                    LeaveRequest.status == "approved",
                    extract("year", LeaveRequest.start_date) == year,
                    LeaveRequest.id != leave_id,
                )
            )
            already_taken = taken_res.scalar_one() or 0
            if (already_taken + lr.total_days) > lt.annual_quota:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot approve: employee only has {max(lt.annual_quota - already_taken, 0)} days remaining.",
                )

    lr.status = payload.status
    lr.reviewed_by = current_user.id
    lr.reviewer_comment = payload.reviewer_comment
    lr.reviewed_at = datetime.now()
    await db.commit()
    await db.refresh(lr)

    # In-app notification
    try:
        user_res = await db.execute(select(User).where(User.employee_id == lr.employee_id))
        emp_user = user_res.scalar_one_or_none()
        if emp_user:
            msg = (
                f"Your {lr.leave_type.name} leave request ({lr.start_date} – {lr.end_date}, "
                f"{lr.total_days} day(s)) has been {payload.status}."
            )
            if payload.reviewer_comment:
                msg += f" Note: {payload.reviewer_comment}"
            db.add(Notification(
                recipient_id=emp_user.id,
                title=f"Leave Request {payload.status.title()}",
                message=msg,
                type=f"leave_{payload.status}",
                is_read=False,
            ))
            await db.commit()
    except Exception:
        pass  # Non-blocking

    await record_audit_log(
        db=db,
        actor=current_user,
        action=f"LEAVE_{payload.status.upper()}",
        entity="LeaveRequest",
        entity_id=str(lr.id),
        after_state={"status": lr.status, "employee_id": lr.employee_id, "days": lr.total_days},
        request=request,
    )
    return await _format_leave(lr)


# ── Employee cancels own pending leave ────────────────────────────────────────
@router.delete("/{leave_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_leave_request(
    leave_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(LeaveRequest).where(LeaveRequest.id == leave_id))
    lr = res.scalar_one_or_none()
    if not lr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found.")
    if current_user.role == "Employee" and lr.employee_id != current_user.employee_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    if lr.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending leave requests can be cancelled.",
        )
    lr.status = "cancelled"
    await db.commit()
