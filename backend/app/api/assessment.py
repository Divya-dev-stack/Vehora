from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import PyMongoError

from app.api.care import reminder_status
from app.api.deps import require_role
from app.core.helpers import parse_oid
from app.db.mongo import get_db

router = APIRouter(prefix="/assessment", tags=["assessment"])

DB_DOWN = "Database is not reachable. Please try again."
TWO_WHEELER_WORDS = ("bike", "motor", "scooter", "moped", "two")

DISCLAIMER = (
    "Estimate only. It is calculated from the details you entered, not from live vehicle "
    "sensors, and it is not a confirmed diagnosis."
)
METHOD = (
    "The score starts at 100. Points are deducted for the service gap, kilometres since the last "
    "service, overdue reminders, vehicle age and total kilometres. Service intervals are generic estimates."
)


def to_date(v):
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        try:
            return date.fromisoformat(v[:10])
        except ValueError:
            return None
    return None


def service_interval_km(vehicle_type):
    t = (vehicle_type or "").lower()
    return 5000 if any(w in t for w in TWO_WHEELER_WORDS) else 10000


def factor(key, label, points, detail):
    return {"key": key, "label": label, "points": points, "detail": detail}


@router.get("/{vehicle_id}")
def assess(vehicle_id: str, user: dict = Depends(require_role("user"))):
    db = get_db()
    vid = parse_oid(vehicle_id, "Vehicle")
    try:
        vehicle = db.vehicles.find_one({"_id": vid, "owner_id": user["_id"]})
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found.")
        records = list(db.service_records.find({"owner_id": user["_id"], "vehicle_id": vid}))
        reminders = list(
            db.reminders.find({"owner_id": user["_id"], "vehicle_id": vid, "done": {"$ne": True}})
        )
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)

    today = date.today()
    mileage = vehicle.get("mileage_km") or 0
    factors = []
    recs = []

    dated = [(to_date(r.get("service_date")), r) for r in records]
    dated = [(d, r) for d, r in dated if d is not None]
    last_date = max([d for d, _ in dated], default=None)
    vehicle_last = to_date(vehicle.get("last_service_date"))
    if vehicle_last and (last_date is None or vehicle_last > last_date):
        last_date = vehicle_last
    latest_record = max(dated, key=lambda p: p[0])[1] if dated else None

    # 1. Service gap
    if last_date is None:
        factors.append(factor("service_gap", "Time since last service", -25, "No service date is recorded."))
        recs.append("Add your service records so the estimate is more reliable.")
    else:
        days = (today - last_date).days
        pts = -25 if days > 365 else -12 if days > 180 else 0
        factors.append(factor("service_gap", "Time since last service", pts, "Last service was " + str(days) + " days ago."))
        if pts < 0:
            recs.append("Book a general service. It has been a long time since the last one.")

    # 2. Kilometres since service
    interval = service_interval_km(vehicle.get("vehicle_type"))
    if latest_record is not None:
        km_since = max(0, mileage - (latest_record.get("odometer_km") or 0))
        pts = -20 if km_since > interval * 1.5 else -12 if km_since > interval else 0
        factors.append(
            factor(
                "km_since_service",
                "Kilometres since last service",
                pts,
                str(km_since) + " km since the last recorded service (generic interval used: " + str(interval) + " km).",
            )
        )
        if pts < 0 and "Book a general service." not in " ".join(recs):
            recs.append("Book a general service. You have driven more than the usual interval.")
    else:
        factors.append(
            factor("km_since_service", "Kilometres since last service", 0,
                   "No service record with an odometer reading, so this was not scored.")
        )

    # 3. Reminders
    overdue = soon = 0
    for r in reminders:
        st = reminder_status(r, mileage)
        if st == "overdue":
            overdue += 1
        elif st == "due_soon":
            soon += 1
    pts = -min(30, 12 * overdue) - min(8, 4 * soon)
    factors.append(factor("reminders", "Maintenance reminders", pts, str(overdue) + " overdue, " + str(soon) + " due soon."))
    if overdue:
        recs.append("Complete your overdue maintenance reminders.")

    # 4. Vehicle age
    age = max(0, today.year - int(vehicle.get("year") or today.year))
    pts = -15 if age > 15 else -10 if age > 10 else -5 if age > 5 else 0
    factors.append(factor("age", "Vehicle age", pts, str(age) + " years old."))
    if age > 10:
        recs.append("Older vehicles need more frequent checks of brakes, tyres and battery.")

    # 5. Total kilometres
    pts = -10 if mileage > 100000 else -5 if mileage > 60000 else 0
    factors.append(factor("odometer", "Total kilometres", pts, str(mileage) + " km on the odometer."))

    score = max(0, min(100, 100 + sum(f["points"] for f in factors)))
    if score >= 80:
        status, status_label = "good", "Good"
    elif score >= 60:
        status, status_label = "fair", "Needs attention"
    else:
        status, status_label = "poor", "Service recommended"
    if not recs:
        recs.append("Keep following your regular service schedule.")

    try:
        db.health_assessments.update_one(
            {"vehicle_id": vid},
            {"$set": {"owner_id": user["_id"], "score": score, "status": status,
                      "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
    except PyMongoError:
        pass

    return {
        "vehicle_label": vehicle["make"] + " " + vehicle["model"],
        "score": score,
        "status": status,
        "status_label": status_label,
        "factors": factors,
        "recommendations": recs,
        "data_quality": "limited" if last_date is None else "ok",
        "method": METHOD,
        "disclaimer": DISCLAIMER,
    }
