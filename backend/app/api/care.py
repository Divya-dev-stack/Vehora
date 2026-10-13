from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import PyMongoError

from app.api.deps import require_role
from app.core.helpers import parse_oid, utc
from app.core.service_types import SERVICE_TYPES
from app.db.mongo import get_db
from app.schemas.care import ReminderIn, ReminderOut, ServiceRecordIn, ServiceRecordOut

router = APIRouter(tags=["care"])

DB_DOWN = "Database is not reachable. Please try again."
LABELS = {s["key"]: s["label"] for s in SERVICE_TYPES}
MAX_RECORDS = 500
MAX_REMINDERS = 100
STATUS_ORDER = {"overdue": 0, "due_soon": 1, "upcoming": 2, "done": 3}


def vlabel(v):
    return (v["make"] + " " + v["model"]) if v else "Removed vehicle"


def own_vehicle(db, vehicle_id, owner_id):
    v = db.vehicles.find_one({"_id": parse_oid(vehicle_id, "Vehicle"), "owner_id": owner_id})
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    return v


def owner_vehicles(db, owner_id):
    return {v["_id"]: v for v in db.vehicles.find({"owner_id": owner_id})}


def record_out(doc, vehicles):
    v = vehicles.get(doc["vehicle_id"])
    return ServiceRecordOut(
        id=str(doc["_id"]),
        vehicle_id=str(doc["vehicle_id"]),
        vehicle_label=vlabel(v),
        service_date=doc["service_date"],
        service_type=doc["service_type"],
        service_label=LABELS.get(doc["service_type"], doc["service_type"]),
        odometer_km=doc["odometer_km"],
        cost=doc.get("cost"),
        workshop=doc.get("workshop"),
        notes=doc.get("notes"),
        created_at=utc(doc["created_at"]),
    )


def reminder_status(doc, mileage):
    if doc.get("done"):
        return "done"
    today = date.today()
    due_date = date.fromisoformat(doc["due_date"]) if doc.get("due_date") else None
    due_km = doc.get("due_km")
    if (due_date and due_date < today) or (
        due_km is not None and mileage is not None and mileage >= due_km
    ):
        return "overdue"
    if (due_date and (due_date - today).days <= 14) or (
        due_km is not None and mileage is not None and due_km - mileage <= 300
    ):
        return "due_soon"
    return "upcoming"


def reminder_out(doc, vehicles):
    v = vehicles.get(doc["vehicle_id"])
    mileage = v.get("mileage_km") if v else None
    return ReminderOut(
        id=str(doc["_id"]),
        vehicle_id=str(doc["vehicle_id"]),
        vehicle_label=vlabel(v),
        title=doc["title"],
        due_date=doc.get("due_date"),
        due_km=doc.get("due_km"),
        current_km=mileage,
        status=reminder_status(doc, mileage),
        done=bool(doc.get("done")),
    )


# ---------------- service records ----------------


@router.get("/service-records", response_model=List[ServiceRecordOut])
def list_records(vehicle_id: Optional[str] = None, user: dict = Depends(require_role("user"))):
    db = get_db()
    query = {"owner_id": user["_id"]}
    if vehicle_id:
        query["vehicle_id"] = parse_oid(vehicle_id, "Vehicle")
    try:
        vehicles = owner_vehicles(db, user["_id"])
        rows = list(
            db.service_records.find(query)
            .sort([("service_date", -1), ("created_at", -1)])
            .limit(200)
        )
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return [record_out(r, vehicles) for r in rows]


@router.post("/service-records", response_model=ServiceRecordOut, status_code=201)
def create_record(data: ServiceRecordIn, user: dict = Depends(require_role("user"))):
    db = get_db()
    try:
        vehicle = own_vehicle(db, data.vehicle_id, user["_id"])
        if db.service_records.count_documents({"owner_id": user["_id"]}) >= MAX_RECORDS:
            raise HTTPException(status_code=400, detail="Service record limit reached.")
        now = datetime.now(timezone.utc)
        iso = data.service_date.isoformat()
        doc = {
            "owner_id": user["_id"],
            "vehicle_id": vehicle["_id"],
            "service_date": iso,
            "service_type": data.service_type,
            "odometer_km": data.odometer_km,
            "cost": data.cost,
            "workshop": data.workshop,
            "notes": data.notes,
            "created_at": now,
        }
        db.service_records.insert_one(doc)

        changes = {}
        if data.odometer_km > vehicle.get("mileage_km", 0):
            changes["mileage_km"] = data.odometer_km
        last = vehicle.get("last_service_date")
        if not last or iso > last:
            changes["last_service_date"] = iso
        if changes:
            changes["updated_at"] = now
            db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": changes})

        if data.next_due_date or data.next_due_km is not None:
            db.reminders.insert_one(
                {
                    "owner_id": user["_id"],
                    "vehicle_id": vehicle["_id"],
                    "title": LABELS.get(data.service_type, "Service") + " due",
                    "due_date": data.next_due_date.isoformat() if data.next_due_date else None,
                    "due_km": data.next_due_km,
                    "done": False,
                    "created_at": now,
                }
            )
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return record_out(doc, {vehicle["_id"]: vehicle})


@router.delete("/service-records/{record_id}")
def delete_record(record_id: str, user: dict = Depends(require_role("user"))):
    rid = parse_oid(record_id, "Service record")
    try:
        result = get_db().service_records.delete_one({"_id": rid, "owner_id": user["_id"]})
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service record not found.")
    return {"ok": True}


# ---------------- reminders ----------------


@router.get("/reminders", response_model=List[ReminderOut])
def list_reminders(include_done: bool = False, user: dict = Depends(require_role("user"))):
    db = get_db()
    query = {"owner_id": user["_id"]}
    if not include_done:
        query["done"] = {"$ne": True}
    try:
        vehicles = owner_vehicles(db, user["_id"])
        rows = list(db.reminders.find(query).sort("created_at", -1).limit(MAX_REMINDERS))
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    out = [reminder_out(r, vehicles) for r in rows]
    out.sort(key=lambda r: (STATUS_ORDER.get(r.status, 9), r.due_date or date.max))
    return out


@router.post("/reminders", response_model=ReminderOut, status_code=201)
def create_reminder(data: ReminderIn, user: dict = Depends(require_role("user"))):
    db = get_db()
    try:
        vehicle = own_vehicle(db, data.vehicle_id, user["_id"])
        if db.reminders.count_documents({"owner_id": user["_id"]}) >= MAX_REMINDERS:
            raise HTTPException(status_code=400, detail="Reminder limit reached. Delete old reminders first.")
        doc = {
            "owner_id": user["_id"],
            "vehicle_id": vehicle["_id"],
            "title": data.title,
            "due_date": data.due_date.isoformat() if data.due_date else None,
            "due_km": data.due_km,
            "done": False,
            "created_at": datetime.now(timezone.utc),
        }
        db.reminders.insert_one(doc)
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return reminder_out(doc, {vehicle["_id"]: vehicle})


@router.post("/reminders/{reminder_id}/done")
def complete_reminder(reminder_id: str, user: dict = Depends(require_role("user"))):
    rid = parse_oid(reminder_id, "Reminder")
    try:
        result = get_db().reminders.update_one(
            {"_id": rid, "owner_id": user["_id"]},
            {"$set": {"done": True, "done_at": datetime.now(timezone.utc)}},
        )
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found.")
    return {"ok": True}


@router.delete("/reminders/{reminder_id}")
def delete_reminder(reminder_id: str, user: dict = Depends(require_role("user"))):
    rid = parse_oid(reminder_id, "Reminder")
    try:
        result = get_db().reminders.delete_one({"_id": rid, "owner_id": user["_id"]})
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found.")
    return {"ok": True}