import pytest
import pytest_asyncio
import asyncio
import io
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
async def test_phase2_employee_management_and_csv():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Initialize first-run setup
        setup_res = await client.post("/api/v1/auth/setup", json={
            "company_name": "Lyntica Technologies",
            "admin_email": "admin@lyntica.com",
            "admin_password": "AdminPassword123!"
        })
        assert setup_res.status_code == 200
        admin_token = setup_res.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 2. Admin creates a Department
        dept_res = await client.post("/api/v1/org/departments", headers=admin_headers, json={
            "name": "Artificial Intelligence",
            "code": "AI",
            "description": "AI/ML Core"
        })
        assert dept_res.status_code == 200
        dept_id = dept_res.json()["id"]

        # 3. Admin creates an HR User
        hr_create = await client.post("/api/v1/auth/users", headers=admin_headers, json={
            "email": "hr@lyntica.com",
            "password": "HrPassword123!",
            "role": "HR"
        })
        assert hr_create.status_code == 200

        # HR logs in
        hr_login = await client.post("/api/v1/auth/login", json={
            "email": "hr@lyntica.com",
            "password": "HrPassword123!"
        })
        assert hr_login.status_code == 200
        hr_token = hr_login.json()["access_token"]
        hr_headers = {"Authorization": f"Bearer {hr_token}"}

        # 4. HR registers first employee
        emp_res = await client.post("/api/v1/employees", headers=hr_headers, json={
            "first_name": "Murtaza",
            "last_name": "Khan",
            "email": "murtaza@lyntica.com",
            "phone": "+923001234567",
            "address": "Karachi, Pakistan",
            "department_id": dept_id,
            "joining_date": "2026-01-15",
            "basic_salary": 200000.0,
            "temporary_password": "TempEmpPassword123!"
        })
        assert emp_res.status_code == 200, emp_res.text
        emp_data = emp_res.json()
        assert emp_data["employee_code"] == "EMP-001"
        assert emp_data["basic_salary"] == 200000.0
        assert emp_data["gross_salary"] == 300000.0  # 1.5 * basic
        murtaza_id = emp_data["id"]

        # 5. Verify Employee user login was automatically created
        emp_login = await client.post("/api/v1/auth/login", json={
            "email": "murtaza@lyntica.com",
            "password": "TempEmpPassword123!"
        })
        assert emp_login.status_code == 200
        assert emp_login.json()["user"]["role"] == "Employee"
        assert emp_login.json()["user"]["must_change_password"] is True
        emp_token = emp_login.json()["access_token"]
        emp_headers = {"Authorization": f"Bearer {emp_token}"}

        # 6. HR registers second employee
        emp2_res = await client.post("/api/v1/employees", headers=hr_headers, json={
            "first_name": "Fiza",
            "last_name": "Khan",
            "email": "fiza@lyntica.com",
            "department_id": dept_id,
            "joining_date": "2026-02-01",
            "basic_salary": 220000.0
        })
        assert emp2_res.status_code == 200
        fiza_id = emp2_res.json()["id"]
        assert emp2_res.json()["employee_code"] == "EMP-002"

        # 7. Scoped Access Tests:
        # Employee 1 (Murtaza) views own 360 profile
        my_profile = await client.get(f"/api/v1/employees/{murtaza_id}", headers=emp_headers)
        assert my_profile.status_code == 200
        assert my_profile.json()["email"] == "murtaza@lyntica.com"

        # Employee 1 attempts to view Employee 2 (Fiza) profile -> 403 Forbidden
        other_profile = await client.get(f"/api/v1/employees/{fiza_id}", headers=emp_headers)
        assert other_profile.status_code == 403

        # Employee 1 edits own phone and address -> 200 OK
        update_phone = await client.patch(f"/api/v1/employees/{murtaza_id}", headers=emp_headers, json={
            "phone": "+923009999999",
            "address": "Clifton, Karachi"
        })
        assert update_phone.status_code == 200
        assert update_phone.json()["phone"] == "+923009999999"

        # Employee 1 attempts to increase own salary -> 403 Forbidden
        illegal_salary = await client.patch(f"/api/v1/employees/{murtaza_id}", headers=emp_headers, json={
            "basic_salary": 500000.0
        })
        assert illegal_salary.status_code == 403

        # 8. Server-side Directory Search & Scope:
        # Employee list endpoint for Employee only returns their own record
        emp_list_for_emp = await client.get("/api/v1/employees", headers=emp_headers)
        assert emp_list_for_emp.status_code == 200
        assert emp_list_for_emp.json()["total"] == 1
        assert emp_list_for_emp.json()["items"][0]["id"] == murtaza_id

        # HR list endpoint returns both employees
        hr_list = await client.get("/api/v1/employees", headers=hr_headers)
        assert hr_list.status_code == 200
        assert hr_list.json()["total"] == 2

        # Filter by search "Fiza"
        search_res = await client.get("/api/v1/employees?search=Fiza", headers=hr_headers)
        assert search_res.status_code == 200
        assert search_res.json()["total"] == 1
        assert search_res.json()["items"][0]["first_name"] == "Fiza"

        # 9. CSV Dry-Run Error Reporting:
        invalid_csv = """first_name,last_name,email,joining_date,basic_salary,department
John,Doe,invalid-email,2026/05/10,50000,AI
Jane,,jane@lyntica.com,2026-06-01,-1000,AI
Bob,Smith,bob@lyntica.com,2026-06-01,75000,NON_EXISTENT_DEPT
Murtaza,Duplicate,murtaza@lyntica.com,2026-07-01,80000,AI
"""
        dry_run_res = await client.post(
            "/api/v1/employees/csv-dry-run",
            headers=hr_headers,
            files={"file": ("invalid_employees.csv", invalid_csv.encode("utf-8"), "text/csv")}
        )
        assert dry_run_res.status_code == 200
        dry_data = dry_run_res.json()
        assert dry_data["can_import"] is False
        assert len(dry_data["errors"]) >= 4
        # Verify specific reasons reported
        reasons = [e["reason"] for e in dry_data["errors"]]
        assert any("Invalid email format" in r for r in reasons)
        assert any("Last name is required" in r for r in reasons)
        assert any("Salary must be greater than 0" in r for r in reasons)
        assert any("Unknown department" in r for r in reasons)
        assert any("Email already registered" in r for r in reasons)

        # 10. Valid CSV Import Commit:
        valid_csv = """first_name,last_name,email,joining_date,basic_salary,department
Alice,Wonder,alice@lyntica.com,2026-03-01,150000,AI
Charlie,Brown,charlie@lyntica.com,2026-03-15,160000,AI
"""
        commit_res = await client.post(
            "/api/v1/employees/csv-import",
            headers=hr_headers,
            files={"file": ("valid_employees.csv", valid_csv.encode("utf-8"), "text/csv")}
        )
        assert commit_res.status_code == 200
        assert commit_res.json()["imported_count"] == 2

        # 11. Verify total employees now = 4
        hr_list_after = await client.get("/api/v1/employees", headers=hr_headers)
        assert hr_list_after.json()["total"] == 4

        # 12. CSV Export Test:
        export_res = await client.get("/api/v1/employees/export/csv", headers=hr_headers)
        assert export_res.status_code == 200
        assert "text/csv" in export_res.headers["content-type"]
        csv_text = export_res.text
        assert "employee_code" in csv_text
        assert "murtaza@lyntica.com" in csv_text
        assert "fiza@lyntica.com" in csv_text
        assert "alice@lyntica.com" in csv_text
