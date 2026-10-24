import pytest
import pytest_asyncio
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
async def test_ai_assistant_and_comms_full_flow():
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

        # 3. Test AI Assistant - Company Policy Tool
        ai_policy = await ac.post("/api/v1/ai/query", json={
            "message": "What is our company office timing and late penalty policy?"
        }, headers=headers)
        assert ai_policy.status_code == 200
        pol_data = ai_policy.json()
        assert pol_data["tool_used"] == "get_company_policy"
        assert "09:00" in pol_data["answer"]
        assert pol_data["data"] is not None
        assert pol_data["data"]["office_start_time"] == "09:00"

        # 4. Test AI Assistant - Headcount Tool
        ai_hc = await ac.post("/api/v1/ai/query", json={
            "message": "Summarize total workforce headcount and distribution across departments"
        }, headers=headers)
        assert ai_hc.status_code == 200
        hc_data = ai_hc.json()
        assert hc_data["tool_used"] == "get_headcount_summary"
        assert hc_data["data"]["total_active_employees"] >= 0

        # 5. Test AI Assistant - Attendance Summary Tool
        ai_att = await ac.post("/api/v1/ai/query", json={
            "message": "Show today's attendance summary and punctuality rate"
        }, headers=headers)
        assert ai_att.status_code == 200
        att_data = ai_att.json()
        assert att_data["tool_used"] == "get_attendance_summary"

        # 6. Test AI Assistant - Chronic Tardiness Anomalies Tool
        ai_anom = await ac.post("/api/v1/ai/query", json={
            "message": "Check chronic attendance tardiness and flagged employees"
        }, headers=headers)
        assert ai_anom.status_code == 200
        anom_data = ai_anom.json()
        assert anom_data["tool_used"] == "check_attendance_anomalies"

        # 7. Test Comms - Create Announcement (Admin)
        ann_res = await ac.post("/api/v1/comms/announcements", json={
            "title": "Townhall 2026 Scheduled",
            "content": "All staff please gather for the annual company roadmap and awards presentation."
        }, headers=headers)
        assert ann_res.status_code == 201
        ann_data = ann_res.json()
        assert ann_data["title"] == "Townhall 2026 Scheduled"
        ann_id = ann_data["id"]

        # 8. Test Comms - List Announcements
        list_ann = await ac.get("/api/v1/comms/announcements", headers=headers)
        assert list_ann.status_code == 200
        anns = list_ann.json()
        assert len(anns) == 1
        assert anns[0]["id"] == ann_id

        # 9. Test Comms - Notifications
        notif_res = await ac.get("/api/v1/comms/notifications", headers=headers)
        assert notif_res.status_code == 200
        assert isinstance(notif_res.json(), list)

        # 10. Test Comms - Audit Trail
        audit_res = await ac.get("/api/v1/comms/audit-logs", headers=headers)
        assert audit_res.status_code == 200
        logs = audit_res.json()
        assert len(logs) >= 1
        # Check that ANNOUNCEMENT_CREATED was recorded
        actions = [l["action"] for l in logs]
        assert "ANNOUNCEMENT_CREATED" in actions
