import pytest
import pytest_asyncio
from datetime import date, datetime
from httpx import AsyncClient, ASGITransport
from sqlalchemy.future import select
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import engine, Base, AsyncSessionLocal
from app.models.attendance import Attendance
from app.api.v1.payroll import calculate_income_tax

@pytest_asyncio.fixture(autouse=True)
async def setup_clean_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


def test_tax_slab_calculation():
    # <= 50,000 / month (<= 600,000 / year) => 0 tax
    assert calculate_income_tax(40000) == 0.0
    assert calculate_income_tax(50000) == 0.0

    # 80,000 / month (960,000 / year) => 5% on (960k - 600k) = 360,000 * 0.05 = 18,000 / 12 = 1,500
    assert calculate_income_tax(80000) == 1500.0

    # Higher slabs
    tax_150k = calculate_income_tax(150000)
    assert tax_150k > 0.0


def test_tax_slab_boundaries_follow_hackathon_brief():
    assert calculate_income_tax(100000) == 2500.0
    assert calculate_income_tax(200000) == 17500.0
    assert calculate_income_tax(300000) == 42500.0
    assert calculate_income_tax(400000) == 77500.0


@pytest.mark.asyncio
async def test_payroll_full_lifecycle():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Setup Company & Admin
        setup_payload = {
            "company_name": "Lyntica Technologies",
            "admin_email": "admin@lyntica.com",
            "admin_password": "AdminPassword123!",
            "office_start": "09:00",
            "grace_minutes": 15,
            "office_lat": 24.8607,
            "office_lng": 67.0011,
            "office_radius_meters": 150.0
        }
        setup_res = await ac.post("/api/v1/auth/setup", json=setup_payload)
        assert setup_res.status_code == 200

        # 2. Login as Admin
        login_res = await ac.post("/api/v1/auth/login", json={
            "email": "admin@lyntica.com",
            "password": "AdminPassword123!"
        })
        assert login_res.status_code == 200
        admin_token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 3. Create Department
        dept_res = await ac.post("/api/v1/org/departments", json={
            "name": "Engineering",
            "code": "ENG"
        }, headers=headers)
        assert dept_res.status_code == 200
        dept_id = dept_res.json()["id"]

        # 4. Admin creates HR user
        hr_create = await ac.post("/api/v1/auth/users", headers=headers, json={
            "email": "hr@lyntica.com",
            "password": "HrPassword123!",
            "role": "HR"
        })
        assert hr_create.status_code == 200

        hr_login = await ac.post("/api/v1/auth/login", json={
            "email": "hr@lyntica.com",
            "password": "HrPassword123!"
        })
        assert hr_login.status_code == 200
        hr_token = hr_login.json()["access_token"]
        hr_headers = {"Authorization": f"Bearer {hr_token}"}

        # 5. HR creates an Employee with basic_salary = 100,000
        emp_res = await ac.post("/api/v1/employees", json={
            "first_name": "Tariq",
            "last_name": "Mehmood",
            "email": "tariq@lyntica.com",
            "phone": "+923001234567",
            "joining_date": "2026-01-01",
            "department_id": dept_id,
            "basic_salary": 100000.0,
            "temporary_password": "TempEmpPassword123!"
        }, headers=hr_headers)
        assert emp_res.status_code == 200
        emp_data = emp_res.json()
        emp_id = emp_data["id"]

        # 6. Insert 3 late attendance records for October 2026 directly
        # to test the rule: 3 lates = 0.5 day deduction
        async with AsyncSessionLocal() as session:
            for day in [1, 2, 5]:
                att = Attendance(
                    employee_id=emp_id,
                    date=date(2026, 10, day),
                    status="late",
                    check_in_source="web",
                    total_hours=8.0
                )
                session.add(att)
            await session.commit()

        # 7. HR or Admin drafts Payroll Run for 2026-10 (working_days = 20)
        # Gross = 1.5 * 100k = 150,000 (Basic = 100k, HRA = 40k, Medical = 10k)
        # Daily rate = 150,000 / 20 = 7,500
        # Late penalty: 3 lates => 0.5 day deduction = 3,750
        run_res = await ac.post("/api/v1/payroll/runs", json={
            "month_year": "2026-10",
            "working_days": 20
        }, headers=headers)
        assert run_res.status_code == 200
        run_data = run_res.json()
        assert run_data["status"] == "draft"
        assert run_data["working_days"] == 20
        assert run_data["total_gross"] == 150000.0
        assert len(run_data["payslips"]) == 1

        slip = run_data["payslips"][0]
        assert slip["basic_salary"] == 100000.0
        assert slip["hra"] == 40000.0
        assert slip["medical_allowance"] == 10000.0
        assert slip["gross_salary"] == 150000.0
        assert slip["late_count"] == 3
        assert slip["late_penalty_deduction"] == 3750.0
        assert slip["income_tax"] > 0.0

        # Net = Gross - Late penalty - Income tax
        expected_deductions = round(slip["absence_deduction"] + slip["late_penalty_deduction"] + slip["income_tax"], 2)
        assert slip["net_salary"] == round(150000.0 - expected_deductions, 2)

        # 8. Check Summary Endpoint
        summary_res = await ac.get("/api/v1/payroll/summary", headers=headers)
        assert summary_res.status_code == 200
        s_data = summary_res.json()
        assert s_data["total_runs"] == 1
        assert s_data["draft_runs"] == 1

        # 9. Admin Finalizes Payroll Run
        run_id = run_data["id"]
        finalize_res = await ac.post(f"/api/v1/payroll/runs/{run_id}/finalize", json={"confirm": True}, headers=headers)
        assert finalize_res.status_code == 200
        final_data = finalize_res.json()
        assert final_data["status"] == "finalized"
        assert final_data["finalized_at"] is not None

        # 10. Verify Finalized Run cannot be deleted
        del_res = await ac.delete(f"/api/v1/payroll/runs/{run_id}", headers=headers)
        assert del_res.status_code == 400
        assert "Cannot delete a finalized payroll run" in del_res.json()["detail"]

        # 11. Verify Employee can view finalized payslip via /payroll/payslips/my
        emp_login_res = await ac.post("/api/v1/auth/login", json={
            "email": "tariq@lyntica.com",
            "password": "TempEmpPassword123!"
        })
        assert emp_login_res.status_code == 200
        emp_token = emp_login_res.json()["access_token"]
        emp_headers = {"Authorization": f"Bearer {emp_token}"}

        my_slips_res = await ac.get("/api/v1/payroll/payslips/my", headers=emp_headers)
        assert my_slips_res.status_code == 200
        my_slips = my_slips_res.json()
        assert len(my_slips) == 1
        assert my_slips[0]["employee_name"] == "Tariq Mehmood"
        assert my_slips[0]["gross_salary"] == 150000.0
