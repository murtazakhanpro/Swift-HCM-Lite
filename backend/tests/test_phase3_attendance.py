import pytest
import pytest_asyncio
import asyncio
from datetime import date, datetime, timedelta
from httpx import AsyncClient, ASGITransport
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import engine, Base
from app.services.attendance_engine import (
    calculate_haversine_distance,
    evaluate_check_in_status,
    evaluate_checkout_status
)

@pytest_asyncio.fixture(autouse=True)
async def setup_clean_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

def test_haversine_calculation():
    # Karachi office coordinates: (24.8607, 67.0011)
    office_lat = 24.8607
    office_lng = 67.0011

    # Exact same point should be 0 meters
    assert calculate_haversine_distance(office_lat, office_lng, office_lat, office_lng) == 0.0

    # Approx 100m away (0.0009 degree delta latitude)
    dist = calculate_haversine_distance(office_lat, office_lng, office_lat + 0.0009, office_lng)
    assert 90.0 < dist < 110.0

    # Point 2km away
    dist_far = calculate_haversine_distance(office_lat, office_lng, office_lat + 0.02, office_lng)
    assert dist_far > 2000.0

def test_attendance_status_rules():
    # 09:00 start with 15-minute grace => cutoff is 09:15
    on_time_dt = datetime(2026, 10, 25, 9, 10, 0)
    assert evaluate_check_in_status(on_time_dt, "09:00", 15) == "present"

    grace_limit_dt = datetime(2026, 10, 25, 9, 15, 0)
    assert evaluate_check_in_status(grace_limit_dt, "09:00", 15) == "present"

    late_dt = datetime(2026, 10, 25, 9, 16, 0)
    assert evaluate_check_in_status(late_dt, "09:00", 15) == "late"

    # Half day under 5 hours
    check_in = datetime(2026, 10, 25, 9, 0, 0)
    early_checkout = datetime(2026, 10, 25, 13, 0, 0) # 4 hours
    hrs, status = evaluate_checkout_status(check_in, early_checkout, half_day_hours=5.0, current_status="present")
    assert hrs == 4.0
    assert status == "half_day"

    full_day_checkout = datetime(2026, 10, 25, 17, 30, 0) # 8.5 hours
    hrs_full, status_full = evaluate_checkout_status(check_in, full_day_checkout, half_day_hours=5.0, current_status="present")
    assert hrs_full == 8.5
    assert status_full == "present"

@pytest.mark.asyncio
async def test_phase3_attendance_api_end_to_end():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Setup First-Run Organization with known GPS coordinates
        office_lat = 24.8607
        office_lng = 67.0011
        setup_res = await client.post("/api/v1/auth/setup", json={
            "company_name": "Lyntica Technologies",
            "admin_email": "admin@lyntica.com",
            "admin_password": "AdminPassword123!",
            "office_lat": office_lat,
            "office_lng": office_lng,
            "office_radius_meters": 150.0
        })
        assert setup_res.status_code == 200
        admin_token = setup_res.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 2. Admin creates HR user
        hr_create = await client.post("/api/v1/auth/users", headers=admin_headers, json={
            "email": "hr@lyntica.com",
            "password": "HrPassword123!",
            "role": "HR"
        })
        assert hr_create.status_code == 200
        hr_login = await client.post("/api/v1/auth/login", json={
            "email": "hr@lyntica.com",
            "password": "HrPassword123!"
        })
        hr_token = hr_login.json()["access_token"]
        hr_headers = {"Authorization": f"Bearer {hr_token}"}

        # 3. HR registers an Employee (Murtaza)
        emp_res = await client.post("/api/v1/employees", headers=hr_headers, json={
            "first_name": "Murtaza",
            "last_name": "Khan",
            "email": "murtaza@lyntica.com",
            "joining_date": "2026-01-15",
            "basic_salary": 200000.0,
            "temporary_password": "TempEmpPassword123!"
        })
        assert emp_res.status_code == 200
        emp_id = emp_res.json()["id"]

        # Employee logs in
        emp_login = await client.post("/api/v1/auth/login", json={
            "email": "murtaza@lyntica.com",
            "password": "TempEmpPassword123!"
        })
        emp_token = emp_login.json()["access_token"]
        emp_headers = {"Authorization": f"Bearer {emp_token}"}

        # 4. Web Check-In
        checkin_res = await client.post("/api/v1/attendance/check-in", headers=emp_headers, json={
            "source": "web"
        })
        assert checkin_res.status_code == 200, checkin_res.text
        att_record = checkin_res.json()
        assert att_record["employee_id"] == emp_id
        assert att_record["check_in_time"] is not None
        assert att_record["status"] in ["present", "late"]

        # 5. Duplicate Check-In on same date -> 409 Conflict
        dup_checkin = await client.post("/api/v1/attendance/check-in", headers=emp_headers, json={
            "source": "web"
        })
        assert dup_checkin.status_code == 409

        # 6. Check-Out
        checkout_res = await client.post("/api/v1/attendance/check-out", headers=emp_headers, json={})
        assert checkout_res.status_code == 200
        assert checkout_res.json()["check_out_time"] is not None

        # 7. Duplicate Check-Out -> 409 Conflict
        dup_checkout = await client.post("/api/v1/attendance/check-out", headers=emp_headers, json={})
        assert dup_checkout.status_code == 409

        # 8. Today Status endpoint check
        status_res = await client.get("/api/v1/attendance/today-status", headers=emp_headers)
        assert status_res.status_code == 200
        assert status_res.json()["has_checked_in"] is True
        assert status_res.json()["has_checked_out"] is True

        # 9. Register second employee (Fiza) to test Camera & Geofencing Check-In
        emp2_res = await client.post("/api/v1/employees", headers=hr_headers, json={
            "first_name": "Fiza",
            "last_name": "Khan",
            "email": "fiza@lyntica.com",
            "joining_date": "2026-02-01",
            "basic_salary": 220000.0,
            "temporary_password": "TempEmpPassword123!"
        })
        assert emp2_res.status_code == 200
        emp2_login = await client.post("/api/v1/auth/login", json={
            "email": "fiza@lyntica.com",
            "password": "TempEmpPassword123!"
        })
        emp2_headers = {"Authorization": f"Bearer {emp2_login.json()['access_token']}"}

        # 10. Camera Check-In Rejections:
        # Rejection: No face detected
        no_face_res = await client.post("/api/v1/attendance/check-in", headers=emp2_headers, json={
            "source": "camera",
            "face_detected": False,
            "faces_count": 0,
            "latitude": office_lat,
            "longitude": office_lng,
            "gps_accuracy": 15.0
        })
        assert no_face_res.status_code == 422
        assert "exactly one face" in no_face_res.text

        # Rejection: Multiple faces (2 faces)
        multi_face_res = await client.post("/api/v1/attendance/check-in", headers=emp2_headers, json={
            "source": "camera",
            "face_detected": True,
            "faces_count": 2,
            "latitude": office_lat,
            "longitude": office_lng,
            "gps_accuracy": 15.0
        })
        assert multi_face_res.status_code == 422

        # Rejection: Bad GPS accuracy (> 100m)
        bad_gps_res = await client.post("/api/v1/attendance/check-in", headers=emp2_headers, json={
            "source": "camera",
            "face_detected": True,
            "faces_count": 1,
            "latitude": office_lat,
            "longitude": office_lng,
            "gps_accuracy": 150.0  # > 100m
        })
        assert bad_gps_res.status_code == 422
        assert "GPS accuracy" in bad_gps_res.text

        # Rejection: Outside office radius (e.g. 500m away)
        outside_radius_res = await client.post("/api/v1/attendance/check-in", headers=emp2_headers, json={
            "source": "camera",
            "face_detected": True,
            "faces_count": 1,
            "latitude": office_lat + 0.005,  # ~550 meters away
            "longitude": office_lng,
            "gps_accuracy": 20.0
        })
        assert outside_radius_res.status_code == 422
        assert "exceeds the permitted radius" in outside_radius_res.text

        # Success: Camera check-in with 1 face, inside 150m, accuracy <= 100m
        camera_ok = await client.post("/api/v1/attendance/check-in", headers=emp2_headers, json={
            "source": "camera",
            "face_detected": True,
            "faces_count": 1,
            "latitude": office_lat + 0.0004,  # ~45 meters away (well within 150m)
            "longitude": office_lng,
            "gps_accuracy": 15.0
        })
        assert camera_ok.status_code == 200
        assert camera_ok.json()["face_verified"] is True
        assert camera_ok.json()["check_in_source"] == "camera"

        # 11. Daily Attendance Board
        board_res = await client.get("/api/v1/attendance/daily-board", headers=hr_headers)
        assert board_res.status_code == 200
        board_data = board_res.json()
        assert board_data["total_active_employees"] == 2
        assert len(board_data["records"]) == 2

        # 12. Attendance Correction Workflow
        yesterday = date.today() - timedelta(days=1)
        req_in = datetime.combine(yesterday, datetime.min.time()).replace(hour=9, minute=0)
        req_out = datetime.combine(yesterday, datetime.min.time()).replace(hour=17, minute=30)

        correction_create = await client.post("/api/v1/attendance/corrections", headers=emp_headers, json={
            "requested_date": yesterday.isoformat(),
            "requested_check_in": req_in.isoformat(),
            "requested_check_out": req_out.isoformat(),
            "reason": "Forgot to check in on yesterday due to emergency client deployment."
        })
        assert correction_create.status_code == 200
        corr_id = correction_create.json()["id"]

        # HR reviews and approves the correction
        corr_approve = await client.patch(f"/api/v1/attendance/corrections/{corr_id}", headers=hr_headers, json={
            "status": "approved",
            "review_comment": "Approved upon managerial confirmation."
        })
        assert corr_approve.status_code == 200
        assert corr_approve.json()["status"] == "approved"

        # Verify the Attendance table now contains the updated record for yesterday
        history_res = await client.get(f"/api/v1/attendance/history?start_date={yesterday.isoformat()}", headers=emp_headers)
        assert history_res.status_code == 200
        records = history_res.json()
        yesterday_record = next((r for r in records if r["date"] == yesterday.isoformat()), None)
        assert yesterday_record is not None
        assert yesterday_record["status"] == "present"
        assert yesterday_record["total_hours"] == 8.5
