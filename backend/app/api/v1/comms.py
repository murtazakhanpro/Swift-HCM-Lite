from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, update, delete

from app.core.database import get_db
from app.core.deps import get_current_user, require_role, record_audit_log
from app.models.user import User
from app.models.comms import Announcement, Notification
from app.models.audit import AuditLog
from app.schemas.comms import (
    AnnouncementCreate,
    AnnouncementResponse,
    NotificationResponse,
    AuditLogResponse
)

router = APIRouter(prefix="/comms", tags=["Communications & Audit (Module 8)"])


# ── Announcements ─────────────────────────────────────────────────────────────

@router.get("/announcements", response_model=List[AnnouncementResponse])
async def list_announcements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all company announcements, newest first."""
    q = await db.execute(select(Announcement).order_by(desc(Announcement.created_at)))
    return q.scalars().all()


@router.post("/announcements", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    payload: AnnouncementCreate,
    request: Request,
    current_user: User = Depends(require_role(["Admin", "HR"])),
    db: AsyncSession = Depends(get_db)
):
    """Publish a new company-wide announcement and notify all active users."""
    author_name = current_user.email
    if current_user.employee_id:
        from app.models.employee import Employee
        emp = await db.get(Employee, current_user.employee_id)
        if emp:
            author_name = f"{emp.first_name} {emp.last_name}"

    ann = Announcement(
        title=payload.title,
        content=payload.content,
        author_id=current_user.id,
        author_name=author_name
    )
    db.add(ann)
    await db.flush()

    # Notify all active users
    users_q = await db.execute(select(User).where(User.is_active == True))
    all_users = users_q.scalars().all()
    for u in all_users:
        if u.id != current_user.id:
            notif = Notification(
                recipient_id=u.id,
                title=f"📢 {payload.title}",
                message=payload.content[:150] + ("..." if len(payload.content) > 150 else ""),
                type="announcement"
            )
            db.add(notif)

    await db.commit()
    await db.refresh(ann)

    await record_audit_log(
        db=db,
        actor=current_user,
        action="ANNOUNCEMENT_CREATED",
        entity="Announcement",
        entity_id=str(ann.id),
        after_state={"title": ann.title},
        request=request
    )

    return ann


@router.delete("/announcements/{ann_id}")
async def delete_announcement(
    ann_id: int,
    request: Request,
    current_user: User = Depends(require_role(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    ann = await db.get(Announcement, ann_id)
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")

    title = ann.title
    await db.delete(ann)
    await db.commit()

    await record_audit_log(
        db=db,
        actor=current_user,
        action="ANNOUNCEMENT_DELETED",
        entity="Announcement",
        entity_id=str(ann_id),
        before_state={"title": title},
        request=request
    )

    return {"message": "Announcement deleted successfully"}


# ── Notifications ─────────────────────────────────────────────────────────────

@router.get("/notifications", response_model=List[NotificationResponse])
async def list_my_notifications(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve notifications for the current user (newest first)."""
    q = await db.execute(
        select(Notification)
        .where(Notification.recipient_id == current_user.id)
        .order_by(Notification.is_read.asc(), desc(Notification.created_at))
        .limit(limit)
    )
    return q.scalars().all()


@router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(
    notif_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    notif = await db.get(Notification, notif_id)
    if not notif or notif.recipient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notif.is_read = True
    await db.commit()
    return {"message": "Notification marked as read"}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await db.execute(
        update(Notification)
        .where(Notification.recipient_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "All notifications marked as read"}


# ── Audit Trail (Admin Only) ─────────────────────────────────────────────────

@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def list_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action name"),
    entity: Optional[str] = Query(None, description="Filter by entity type"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_role(["Admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Immutable cryptographic system audit trail for Admin oversight.
    Inspect before and after states for security and compliance.
    """
    stmt = select(AuditLog).order_by(desc(AuditLog.timestamp))
    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"%{action.strip()}%"))
    if entity:
        stmt = stmt.where(AuditLog.entity.ilike(f"%{entity.strip()}%"))

    stmt = stmt.limit(limit)
    q = await db.execute(stmt)
    return q.scalars().all()
