import pytest
import pytest_asyncio
import asyncio
from httpx import AsyncClient, ASGITransport
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import engine, Base

@pytest_asyncio.fixture(autouse=True)
async def setup_clean_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.asyncio
async def test_phase1_end_to_end():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health check
        res = await client.get("/api/v1/health")
        assert res.status_code == 200
        assert res.json()["status"] == "online"

        # 2. Check setup status before setup
        res = await client.get("/api/v1/auth/setup-status")
        assert res.status_code == 200
        assert res.json()["is_setup_completed"] is False

        # 3. Perform First-Run Setup
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
        res = await client.post("/api/v1/auth/setup", json=setup_payload)
        assert res.status_code == 200, res.text
        data = res.json()
        assert "access_token" in data
        assert data["user"]["role"] == "Admin"
        assert data["user"]["company_name"] == "Lyntica Technologies"
        admin_token = data["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 4. Attempting setup again should be locked (403)
        res = await client.post("/api/v1/auth/setup", json=setup_payload)
        assert res.status_code == 403

        # 5. Check setup status now
        res = await client.get("/api/v1/auth/setup-status")
        assert res.status_code == 200
        assert res.json()["is_setup_completed"] is True
        assert res.json()["company_name"] == "Lyntica Technologies"

        # 6. Admin Login with correct password
        login_res = await client.post("/api/v1/auth/login", json={
            "email": "admin@lyntica.com",
            "password": "AdminPassword123!"
        })
        assert login_res.status_code == 200
        assert login_res.json()["user"]["email"] == "admin@lyntica.com"

        # 7. Login with bad password should fail (401)
        bad_login = await client.post("/api/v1/auth/login", json={
            "email": "admin@lyntica.com",
            "password": "WrongPassword!"
        })
        assert bad_login.status_code == 401

        # 8. Admin fetches Organization Settings
        settings_res = await client.get("/api/v1/org/settings", headers=admin_headers)
        assert settings_res.status_code == 200
        assert settings_res.json()["grace_minutes"] == 15
        assert settings_res.json()["office_radius_meters"] == 150.0

        # 9. Admin creates Department
        dept_res = await client.post("/api/v1/org/departments", headers=admin_headers, json={
            "name": "Engineering",
            "code": "ENG",
            "description": "Software & AI Engineering Team"
        })
        assert dept_res.status_code == 200
        dept_id = dept_res.json()["id"]

        # 10. Admin creates Designation
        desig_res = await client.post("/api/v1/org/designations", headers=admin_headers, json={
            "title": "Lead AI Architect",
            "department_id": dept_id
        })
        assert desig_res.status_code == 200

        # 11. Check pre-seeded leave quotas
        leave_res = await client.get("/api/v1/org/leave-types", headers=admin_headers)
        assert leave_res.status_code == 200
        leave_types = {lt["code"]: lt["annual_quota"] for lt in leave_res.json()}
        assert leave_types["annual"] == 14
        assert leave_types["sick"] == 8
        assert leave_types["casual"] == 10

        # 12. Admin registers HR User
        hr_create = await client.post("/api/v1/auth/users", headers=admin_headers, json={
            "email": "hr@lyntica.com",
            "password": "TempHrPassword123!",
            "role": "HR"
        })
        assert hr_create.status_code == 200
        assert hr_create.json()["role"] == "HR"
        assert hr_create.json()["must_change_password"] is True

        # 13. HR User logs in
        hr_login = await client.post("/api/v1/auth/login", json={
            "email": "hr@lyntica.com",
            "password": "TempHrPassword123!"
        })
        assert hr_login.status_code == 200
        hr_token = hr_login.json()["access_token"]
        hr_headers = {"Authorization": f"Bearer {hr_token}"}

        # 14. HR cannot create HR users (RBAC guard check)
        hr_illegal = await client.post("/api/v1/auth/users", headers=hr_headers, json={
            "email": "illegal@lyntica.com",
            "password": "Password123!",
            "role": "HR"
        })
        assert hr_illegal.status_code == 403

        # 15. HR changes password
        chg_pwd = await client.post("/api/v1/auth/change-password", headers=hr_headers, json={
            "current_password": "TempHrPassword123!",
            "new_password": "NewPermanentHrPassword456!"
        })
        assert chg_pwd.status_code == 200

        # 16. Verify new password works
        new_hr_login = await client.post("/api/v1/auth/login", json={
            "email": "hr@lyntica.com",
            "password": "NewPermanentHrPassword456!"
        })
        assert new_hr_login.status_code == 200
        assert new_hr_login.json()["user"]["must_change_password"] is False

        for name, email in [("Amina", "amina@example.com"), ("Bilal", "bilal@example.com")]:
            employee_res = await client.post("/api/v1/employees", headers=hr_headers, json={
                "first_name": name,
                "last_name": "Employee",
                "email": email,
                "joining_date": "2026-01-01",
                "basic_salary": 100000,
                "temporary_password": "TempEmployee123!",
            })
            assert employee_res.status_code == 200, employee_res.text

        admin_dashboard = await client.get("/api/v1/org/dashboard-summary", headers=admin_headers)
        assert admin_dashboard.status_code == 200
        assert admin_dashboard.json()["active_employees"] == 2

        employee_login = await client.post("/api/v1/auth/login", json={
            "email": "amina@example.com",
            "password": "TempEmployee123!",
        })
        assert employee_login.status_code == 200
        employee_headers = {"Authorization": f"Bearer {employee_login.json()['access_token']}"}
        employee_dashboard = await client.get("/api/v1/org/dashboard-summary", headers=employee_headers)
        assert employee_dashboard.status_code == 200
        summary = employee_dashboard.json()
        assert summary["active_employees"] == 1
        assert summary["total_departments"] == 0
        assert summary["payroll"]["latest_net_payout"] == 0
        assert "predicted_on_time_attendance" not in summary["ml_insights"]
        assert "retention_confidence" not in summary["ml_insights"]
