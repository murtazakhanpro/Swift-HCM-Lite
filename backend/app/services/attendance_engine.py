import math
from datetime import datetime, time, timedelta
from typing import Tuple

EARTH_RADIUS_METERS = 6371000.0

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance in meters between two points 
    on the earth (specified in decimal degrees) using Haversine formula.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return EARTH_RADIUS_METERS * c

def evaluate_check_in_status(
    check_in_dt: datetime,
    office_start_str: str = "09:00",
    grace_minutes: int = 15
) -> str:
    """
    Determines if a check-in is 'present' or 'late'.
    Example: office_start = 09:00, grace = 15 => Cutoff = 09:15:00.
    Check-in at or before 09:15:00 is 'present'; at 09:15:01+ is 'late'.
    """
    try:
        parts = office_start_str.strip().split(":")
        start_hour = int(parts[0])
        start_min = int(parts[1])
    except Exception:
        start_hour, start_min = 9, 0

    base_time = datetime(
        check_in_dt.year, check_in_dt.month, check_in_dt.day,
        start_hour, start_min, 0
    )
    cutoff = base_time + timedelta(minutes=grace_minutes)

    if check_in_dt <= cutoff:
        return "present"
    else:
        return "late"

def evaluate_checkout_status(
    check_in_dt: datetime,
    check_out_dt: datetime,
    half_day_hours: float = 5.0,
    current_status: str = "present"
) -> Tuple[float, str]:
    """
    Computes total hours worked and returns (total_hours, updated_status).
    If total_hours < half_day_hours (e.g. 5 hours), status is classified as 'half_day'.
    """
    total_seconds = max(0.0, (check_out_dt - check_in_dt).total_seconds())
    total_hours = round(total_seconds / 3600.0, 2)

    if total_hours < half_day_hours:
        return total_hours, "half_day"
    return total_hours, current_status
