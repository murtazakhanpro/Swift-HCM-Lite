import os
import json
from datetime import date, datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, desc, or_

from app.core.config import settings
from app.models.user import User
from app.models.employee import Employee
from app.models.organization import CompanySettings, Department, Designation, LeaveTypeQuota, Holiday
from app.models.attendance import Attendance
from app.models.leave import LeaveRequest
from app.models.payroll import PayrollRun, Payslip


# ── The 7 Scoped HCM Tools ─────────────────────────────────────────────────────

async def tool_get_company_policy(db: AsyncSession, current_user: User) -> Dict[str, Any]:
    """Tool 1: Retrieve official company work policies, timings, and quotas."""
    sett_q = await db.execute(select(CompanySettings))
    sett = sett_q.scalar_one_or_none()

    quotas_q = await db.execute(select(LeaveTypeQuota))
    quotas = quotas_q.scalars().all()

    holidays_q = await db.execute(select(Holiday).order_by(Holiday.date))
    holidays = holidays_q.scalars().all()

    return {
        "company_name": sett.company_name if sett else "Lyntica Technologies",
        "office_start_time": sett.office_start if sett else "09:00",
        "grace_period_minutes": sett.grace_minutes if sett else 15,
        "half_day_hours_threshold": sett.half_day_hours if sett else 5.0,
        "weekend_days": sett.weekend_days if sett else "Saturday,Sunday",
        "late_penalty_rule": "3 late arrivals in a month incur a 0.5-day salary deduction" if (sett and sett.late_penalty_rule) else "No penalty configured",
        "leave_quotas": [
            {"type": q.name, "annual_days": q.annual_quota, "unpaid": q.is_unpaid} for q in quotas
        ],
        "upcoming_holidays": [
            {"name": h.name, "date": str(h.date), "description": h.description} for h in holidays[:5]
        ]
    }


async def tool_get_headcount_summary(db: AsyncSession, current_user: User) -> Dict[str, Any]:
    """Tool 2: Get headcount and department distribution."""
    # Employee role only gets high-level stats
    is_privileged = current_user.role in ("Admin", "HR")

    total_emps_q = await db.execute(select(func.count(Employee.id)).where(Employee.status == "active"))
    total_active = total_emps_q.scalar_one()

    dept_counts_q = await db.execute(
        select(Department.name, func.count(Employee.id))
        .join(Employee, Employee.department_id == Department.id, isouter=True)
        .where(Employee.status == "active")
        .group_by(Department.name)
    )
    dept_distribution = {row[0]: row[1] for row in dept_counts_q.all()}

    res = {
        "total_active_employees": total_active,
        "department_distribution": dept_distribution
    }

    if not is_privileged:
        res["note"] = "Scoped to general company metrics (Individual salary details withheld for employee view)."

    return res


async def tool_get_attendance_summary(db: AsyncSession, current_user: User) -> Dict[str, Any]:
    """Tool 3: Get today's attendance metrics and punctuality."""
    today = date.today()

    if current_user.role == "Employee":
        if not current_user.employee_id:
            return {"status": "No employee profile linked to user account."}
        att_q = await db.execute(
            select(Attendance).where(
                Attendance.employee_id == current_user.employee_id,
                Attendance.date == today
            )
        )
        rec = att_q.scalar_one_or_none()
        return {
            "scope": "Personal Attendance (Today)",
            "date": str(today),
            "status": rec.status if rec else "not checked in",
            "check_in_time": str(rec.check_in_time) if rec and rec.check_in_time else None,
            "check_out_time": str(rec.check_out_time) if rec and rec.check_out_time else None,
            "hours_worked": rec.total_hours if rec else 0.0
        }

    # Admin / HR summary
    att_today_q = await db.execute(select(Attendance).where(Attendance.date == today))
    records = att_today_q.scalars().all()

    present_count = sum(1 for r in records if r.status in ("present", "late", "half_day"))
    late_count = sum(1 for r in records if r.status == "late")
    half_day_count = sum(1 for r in records if r.status == "half_day")

    total_active_q = await db.execute(select(func.count(Employee.id)).where(Employee.status == "active"))
    total_active = total_active_q.scalar_one()

    return {
        "scope": "Organization-Wide Attendance (Today)",
        "date": str(today),
        "total_active_workforce": total_active,
        "checked_in_today": present_count,
        "punctual_arrivals": present_count - late_count,
        "late_arrivals": late_count,
        "half_days": half_day_count,
        "attendance_rate_percentage": round((present_count / total_active * 100), 1) if total_active > 0 else 0.0
    }


async def tool_get_leave_balance(db: AsyncSession, current_user: User, employee_query: Optional[str] = None) -> Dict[str, Any]:
    """Tool 4: Check leave balance and quota consumption."""
    emp_id = current_user.employee_id

    # If HR/Admin provided a name or code, look up target employee
    if current_user.role in ("Admin", "HR") and employee_query:
        target_q = await db.execute(
            select(Employee).where(
                or_(
                    Employee.employee_code.ilike(f"%{employee_query}%"),
                    Employee.first_name.ilike(f"%{employee_query}%"),
                    Employee.last_name.ilike(f"%{employee_query}%")
                )
            )
        )
        target = target_q.scalars().first()
        if target:
            emp_id = target.id

    if not emp_id:
        return {"error": "Employee profile not specified or found."}

    # Fetch employee
    emp = await db.get(Employee, emp_id)
    if not emp:
        return {"error": "Employee not found."}

    # Fetch quotas
    quotas_q = await db.execute(select(LeaveTypeQuota))
    quotas = quotas_q.scalars().all()

    # Fetch approved leaves this year
    current_year = date.today().year
    y_start = date(current_year, 1, 1)
    y_end = date(current_year, 12, 31)

    leaves_q = await db.execute(
        select(LeaveRequest).where(
            LeaveRequest.employee_id == emp_id,
            LeaveRequest.status == "approved",
            LeaveRequest.start_date <= y_end,
            LeaveRequest.end_date >= y_start
        )
    )
    approved_leaves = leaves_q.scalars().all()

    used_map = {}
    for l in approved_leaves:
        used_map[l.leave_type_id] = used_map.get(l.leave_type_id, 0) + l.total_days

    balances = []
    for q in quotas:
        used = used_map.get(q.id, 0)
        remaining = max(0, q.annual_quota - used) if not q.is_unpaid else 0
        balances.append({
            "type": q.name,
            "total_quota": q.annual_quota,
            "used_days": used,
            "remaining_days": remaining if not q.is_unpaid else "Unlimited (Unpaid)"
        })

    return {
        "employee_name": f"{emp.first_name} {emp.last_name}",
        "employee_code": emp.employee_code,
        "year": current_year,
        "leave_balances": balances
    }


async def tool_get_payroll_summary(db: AsyncSession, current_user: User) -> Dict[str, Any]:
    """Tool 5: Compensation details and payroll run summary."""
    # Strict RBAC Guard: Employee can ONLY see their own latest payslip
    if current_user.role == "Employee":
        if not current_user.employee_id:
            return {"error": "No employee profile linked to user account."}

        slip_q = await db.execute(
            select(Payslip)
            .join(PayrollRun, Payslip.payroll_run_id == PayrollRun.id)
            .options(selectinload(Payslip.payroll_run))
            .where(
                Payslip.employee_id == current_user.employee_id,
                PayrollRun.status == "finalized"
            )
            .order_by(desc(PayrollRun.month_year))
        )
        slip = slip_q.scalars().first()
        if not slip:
            return {"message": "No finalized payslips available for your account yet."}

        return {
            "scope": "Personal Compensation Statement",
            "month": slip.payroll_run.month_year,
            "basic_salary": f"PKR {slip.basic_salary:,.2f}",
            "allowances_50pct": f"PKR {slip.hra + slip.medical_allowance:,.2f}",
            "gross_salary": f"PKR {slip.gross_salary:,.2f}",
            "income_tax_withheld": f"PKR {slip.income_tax:,.2f}",
            "net_take_home": f"PKR {slip.net_salary:,.2f}"
        }

    # Admin / HR summary
    latest_run_q = await db.execute(
        select(PayrollRun)
        .options(selectinload(PayrollRun.payslips))
        .order_by(desc(PayrollRun.month_year))
    )
    latest_run = latest_run_q.scalars().first()

    if not latest_run:
        return {"message": "No payroll runs have been drafted or finalized yet."}

    return {
        "scope": "Corporate Payroll Summary",
        "latest_month": latest_run.month_year,
        "status": latest_run.status,
        "employees_included": len(latest_run.payslips),
        "total_gross_disbursed": f"PKR {latest_run.total_gross:,.2f}",
        "total_deductions_tax": f"PKR {latest_run.total_deductions:,.2f}",
        "total_net_payout": f"PKR {latest_run.total_net:,.2f}",
        "working_days": latest_run.working_days
    }


async def tool_lookup_employee(db: AsyncSession, current_user: User, search_query: str) -> Dict[str, Any]:
    """Tool 6: Find employee contact, department, and role information."""
    search = f"%{search_query.strip()}%"
    q = await db.execute(
        select(Employee)
        .options(selectinload(Employee.department), selectinload(Employee.designation))
        .where(
            or_(
                Employee.first_name.ilike(search),
                Employee.last_name.ilike(search),
                Employee.email.ilike(search),
                Employee.employee_code.ilike(search)
            )
        )
    )
    matches = q.scalars().all()
    if not matches:
        return {"message": f"No employee found matching '{search_query}'."}

    is_privileged = current_user.role in ("Admin", "HR")
    results = []
    for emp in matches[:5]:
        item = {
            "name": f"{emp.first_name} {emp.last_name}",
            "code": emp.employee_code,
            "email": emp.email,
            "department": emp.department.name if emp.department else "Unassigned",
            "designation": emp.designation.title if emp.designation else "Unassigned",
            "status": emp.status,
            "joining_date": str(emp.joining_date)
        }
        if is_privileged:
            item["basic_salary"] = f"PKR {emp.basic_salary:,.2f}"
        results.append(item)

    return {"results": results, "count": len(results)}


async def tool_check_attendance_anomalies(db: AsyncSession, current_user: User) -> Dict[str, Any]:
    """Tool 7: Detect chronic tardiness (>= 3 lates) and absenteeism anomalies."""
    if current_user.role == "Employee":
        return {"error": "Attendance anomaly audits are restricted to HR and Executive leadership."}

    # Query current month lates
    current_month = date.today().strftime("%Y-%m")
    year, month = map(int, current_month.split("-"))
    m_start = date(year, month, 1)

    lates_q = await db.execute(
        select(Employee.employee_code, Employee.first_name, Employee.last_name, func.count(Attendance.id))
        .join(Attendance, Attendance.employee_id == Employee.id)
        .where(
            Attendance.status == "late",
            Attendance.date >= m_start
        )
        .group_by(Employee.id)
        .having(func.count(Attendance.id) >= 3)
    )
    anomalies = [
        {
            "employee": f"{row[1]} {row[2]} ({row[0]})",
            "late_count_this_month": row[3],
            "penalty_flag": "Subject to 0.5-day salary deduction"
        }
        for row in lates_q.all()
    ]

    return {
        "month": current_month,
        "chronic_late_anomalies_count": len(anomalies),
        "flagged_staff": anomalies
    }


# ── AI Router & Tool Dispatcher ───────────────────────────────────────────────

def _select_tool(user_msg: str) -> Optional[str]:
    """Pattern matching router to select candidate tool."""
    m = user_msg.lower()
    if any(k in m for k in ["policy", "grace", "timing", "hours", "weekend", "rule", "holiday"]):
        return "get_company_policy"
    if any(k in m for k in ["headcount", "how many employees", "distribution", "staff count", "departments"]):
        return "get_headcount_summary"
    if any(k in m for k in ["attendance today", "who is late", "attendance rate", "check in status", "punctual"]):
        return "get_attendance_summary"
    if any(k in m for k in ["leave", "vacation", "balance", "annual leave", "sick leave", "casual"]):
        return "get_leave_balance"
    if any(k in m for k in ["payroll", "salary", "gross", "deduction", "tax", "take home", "payslip"]):
        return "get_payroll_summary"
    if any(k in m for k in ["anomaly", "chronic", "flagged", "tardiness", "repeated late"]):
        return "check_attendance_anomalies"
    if any(k in m for k in ["find", "search", "who is", "lookup", "contact", "email of", "profile"]):
        return "lookup_employee"
    return None


async def execute_tool(tool_name: str, db: AsyncSession, current_user: User, user_msg: str) -> Dict[str, Any]:
    if tool_name == "get_company_policy":
        return await tool_get_company_policy(db, current_user)
    elif tool_name == "get_headcount_summary":
        return await tool_get_headcount_summary(db, current_user)
    elif tool_name == "get_attendance_summary":
        return await tool_get_attendance_summary(db, current_user)
    elif tool_name == "get_leave_balance":
        # Check if user mentioned another employee name
        return await tool_get_leave_balance(db, current_user, employee_query=user_msg)
    elif tool_name == "get_payroll_summary":
        return await tool_get_payroll_summary(db, current_user)
    elif tool_name == "lookup_employee":
        # Extract keywords
        clean_q = user_msg.replace("find", "").replace("who is", "").replace("lookup", "").strip()
        return await tool_lookup_employee(db, current_user, clean_q)
    elif tool_name == "check_attendance_anomalies":
        return await tool_check_attendance_anomalies(db, current_user)
    return {"message": "General HCM query."}


async def answer_ai_query(user_msg: str, current_user: User, db: AsyncSession) -> Dict[str, Any]:
    """
    Main entry point for Swift-HCM AI Assistant.
    1. Selects and executes relevant HCM tool.
    2. Sends tool data + query to Gemini for grounded response.
    3. Falls back gracefully to formatted deterministic response if offline.
    """
    selected_tool = _select_tool(user_msg)
    tool_data = None
    if selected_tool:
        tool_data = await execute_tool(selected_tool, db, current_user, user_msg)

    # Prepare grounding prompt
    system_instruction = (
        f"You are the Swift-HCM Lite Executive AI Assistant for Lyntica Technologies.\n"
        f"The current user is: {current_user.email} with Role: {current_user.role}.\n"
        f"Strict Security Rules:\n"
        f"1. Only provide answers grounded strictly in the HCM Tool Data provided below.\n"
        f"2. Never reveal confidential compensation/salary information of another person to an Employee.\n"
        f"3. Keep answers concise, professional, accurate, and formatted in clean markdown.\n"
    )

    prompt = f"User Question: {user_msg}\n\nTool Data Grounding: {json.dumps(tool_data, default=str) if tool_data else 'No tool called'}"

    # Try Gemini API if key is present
    api_key = settings.GEMINI_API_KEY
    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={
                    "system_instruction": system_instruction,
                    "temperature": 0.2
                }
            )
            if response and response.text:
                return {
                    "answer": response.text.strip(),
                    "tool_used": selected_tool,
                    "data": tool_data
                }
        except Exception as e:
            # Fall back to deterministic grounded formatter below
            pass

    # Deterministic Grounded Fallback (guarantees 100% reliable responses in offline/evaluation mode)
    if selected_tool == "get_company_policy" and tool_data:
        ans = (
            f"**Official Company Policy Summary:**\n\n"
            f"- **Work Timings**: Office begins at **{tool_data.get('office_start_time')}** with a **{tool_data.get('grace_period_minutes')}-minute grace period**.\n"
            f"- **Half-Day Threshold**: Working under **{tool_data.get('half_day_hours_threshold')} hours** constitutes a half day.\n"
            f"- **Late Penalty**: {tool_data.get('late_penalty_rule')}.\n"
            f"- **Leave Quotas**: " + ", ".join([f"{q['type']} ({q['annual_days']}d)" for q in tool_data.get('leave_quotas', [])]) + ".\n"
            f"- **Weekends**: {tool_data.get('weekend_days')}."
        )
    elif selected_tool == "get_headcount_summary" and tool_data:
        ans = (
            f"**Headcount & Workforce Analytics:**\n\n"
            f"- **Active Staff**: **{tool_data.get('total_active_employees')}** active employees.\n"
            f"- **Department Breakdown**:\n" +
            "\n".join([f"  • **{dept}**: {count} employees" for dept, count in tool_data.get('department_distribution', {}).items()])
        )
    elif selected_tool == "get_attendance_summary" and tool_data:
        if "total_active_workforce" in tool_data:
            ans = (
                f"**Attendance Board for {tool_data.get('date')}:**\n\n"
                f"- **Checked In**: {tool_data.get('checked_in_today')} of {tool_data.get('total_active_workforce')} staff ({tool_data.get('attendance_rate_percentage')}% attendance rate)\n"
                f"- **Punctual Arrivals**: {tool_data.get('punctual_arrivals')}\n"
                f"- **Late Arrivals**: {tool_data.get('late_arrivals')}\n"
                f"- **Half-Days**: {tool_data.get('half_days')}"
            )
        else:
            ans = (
                f"**Your Attendance for {tool_data.get('date')}:**\n\n"
                f"- **Status**: **{tool_data.get('status').upper()}**\n"
                f"- **Check-In**: {tool_data.get('check_in_time') or 'Not recorded'}\n"
                f"- **Hours Logged**: {tool_data.get('hours_worked')} hrs"
            )
    elif selected_tool == "get_leave_balance" and tool_data:
        if "leave_balances" in tool_data:
            ans = (
                f"**Leave Balance for {tool_data.get('employee_name')} ({tool_data.get('year')}):**\n\n" +
                "\n".join([f"- **{b['type']}**: {b['remaining_days']} days remaining (Used: {b['used_days']}d / Quota: {b['total_quota']}d)" for b in tool_data.get('leave_balances', [])])
            )
        else:
            ans = tool_data.get("error", "No leave balance records available.")
    elif selected_tool == "get_payroll_summary" and tool_data:
        if "total_net_payout" in tool_data:
            ans = (
                f"**Corporate Compensation Statement ({tool_data.get('latest_month')}):**\n\n"
                f"- **Status**: {tool_data.get('status').upper()}\n"
                f"- **Total Gross**: {tool_data.get('total_gross_disbursed')}\n"
                f"- **Deductions & Tax**: {tool_data.get('total_deductions_tax')}\n"
                f"- **Net Disbursed**: **{tool_data.get('total_net_payout')}** ({tool_data.get('employees_included')} staff processed)"
            )
        elif "net_take_home" in tool_data:
            ans = (
                f"**Your Latest Statement ({tool_data.get('month')}):**\n\n"
                f"- **Basic Salary**: {tool_data.get('basic_salary')}\n"
                f"- **Allowances (50%)**: {tool_data.get('allowances_50pct')}\n"
                f"- **Gross Salary**: {tool_data.get('gross_salary')}\n"
                f"- **Income Tax Withheld**: {tool_data.get('income_tax_withheld')}\n"
                f"- **Net Take-Home**: **{tool_data.get('net_take_home')}**"
            )
        else:
            ans = tool_data.get("message", "No payroll statements available.")
    elif selected_tool == "check_attendance_anomalies" and tool_data:
        if tool_data.get("flagged_staff"):
            ans = (
                f"**Attendance Tardiness Audit ({tool_data.get('month')}):**\n\n"
                f"⚠️ **{tool_data.get('chronic_late_anomalies_count')} staff flagged** with 3 or more late arrivals:\n" +
                "\n".join([f"- **{s['employee']}**: {s['late_count_this_month']} lates ({s['penalty_flag']})" for s in tool_data.get('flagged_staff')])
            )
        else:
            ans = f"**Attendance Audit ({tool_data.get('month')}):**\n\n✅ No chronic attendance anomalies detected. Punctuality is within expected thresholds."
    elif selected_tool == "lookup_employee" and tool_data:
        if tool_data.get("results"):
            ans = "**Employee Search Results:**\n\n" + "\n".join([
                f"- **{e['name']}** ({e['code']}) • {e['designation']} ({e['department']}) • Email: {e['email']} • Status: {e['status']}"
                for e in tool_data["results"]
            ])
        else:
            ans = tool_data.get("message", "No matching employees found.")
    else:
        ans = (
            f"Hello! I am your Swift-HCM AI Assistant. I can help you with:\n"
            f"- **Company Policy & Timings** (grace periods, late penalties, leave rules)\n"
            f"- **Headcount Analytics** by department\n"
            f"- **Today's Attendance Rates** and punctuality\n"
            f"- **Leave Balance & Quota Queries**\n"
            f"- **Compensation & Payroll Summaries**\n"
            f"- **Employee Lookups & Contact Details**\n"
            f"- **Chronic Attendance Tardiness Audits**\n\n"
            f"How may I assist you today?"
        )

    return {
        "answer": ans,
        "tool_used": selected_tool,
        "data": tool_data
    }
