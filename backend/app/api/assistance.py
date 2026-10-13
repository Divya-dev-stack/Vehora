from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError

from app.api.deps import require_role
from app.core.helpers import haversine_km, parse_oid, utc
from app.core.service_types import SERVICE_TYPES
from app.db.mongo import get_db
from app.schemas.assistance import AssistanceIn, AssistanceOut, MechanicRequestOut

router = APIRouter(prefix="/assistance", tags=["assistance"])

DB_DOWN = "Database is not reachable. Please try again."
ACTIVE = ["open", "accepted"]
MAX_ACTIVE_JOBS = 3
LABELS = {s["key"]: s["label"] for s in SERVICE_TYPES}
LABELS["emergency"] = "Emergency (SOS)"


def owner_out(doc):
    return AssistanceOut(
        id=str(doc["_id"]),
        vehicle_label=doc.get("vehicle_label"),
        service_type=doc["service_type"],
        service_label=LABELS.get(doc["service_type"], doc["service_type"]),
        description=doc.get("description"),
        is_sos=bool(doc.get("is_sos")),
        status=doc["status"],
        location_text=doc.get("location_text"),
        has_coordinates=doc.get("latitude") is not None,
        created_at=utc(doc["created_at"]),
        mechanic_shop=doc.get("mechanic_shop"),
        mechanic_phone=doc.get("mechanic_phone"),
    )


def mechanic_out(doc, distance=None, reveal=False):
    return MechanicRequestOut(
        id=str(doc["_id"]),
        vehicle_label=doc.get("vehicle_label"),
        service_type=doc["service_type"],
        service_label=LABELS.get(doc["service_type"], doc["service_type"]),
        description=doc.get("description"),
        is_sos=bool(doc.get("is_sos")),
        status=doc["status"],
        distance_km=distance,
        created_at=utc(doc["created_at"]),
        contact_phone=doc.get("contact_phone") if reveal else None,
        location_text=doc.get("location_text") if reveal else None,
        latitude=doc.get("latitude") if reveal else None,
        longitude=doc.get("longitude") if reveal else None,
    )


def mech_profile(db, user):
    doc = db.mechanics.find_one({"user_id": user["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Set up your shop profile first.")
    return doc


# ---------------- vehicle owner ----------------


@router.post("", response_model=AssistanceOut, status_code=201)
def create_request(data: AssistanceIn, user: dict = Depends(require_role("user"))):
    db = get_db()
    try:
        if db.assistance_requests.count_documents(
            {"owner_id": user["_id"], "status": {"$in": ACTIVE}}
        ) >= 1:
            raise HTTPException(
                status_code=400,
                detail="You already have an active request. Cancel it or wait until it is completed.",
            )
        vehicle = None
        if data.vehicle_id:
            vehicle = db.vehicles.find_one(
                {"_id": parse_oid(data.vehicle_id, "Vehicle"), "owner_id": user["_id"]}
            )
            if not vehicle:
                raise HTTPException(status_code=404, detail="Vehicle not found.")
        now = datetime.now(timezone.utc)
        doc = {
            "owner_id": user["_id"],
            "vehicle_id": vehicle["_id"] if vehicle else None,
            "vehicle_label": (vehicle["make"] + " " + vehicle["model"]) if vehicle else None,
            "vehicle_type": vehicle["vehicle_type"] if vehicle else None,
            "service_type": data.service_type,
            "description": data.description,
            "contact_phone": data.contact_phone,
            "latitude": data.latitude,
            "longitude": data.longitude,
            "location_text": data.location_text,
            "is_sos": data.is_sos,
            "status": "open",
            "created_at": now,
            "updated_at": now,
        }
        db.assistance_requests.insert_one(doc)
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return owner_out(doc)


@router.get("/mine", response_model=List[AssistanceOut])
def my_requests(user: dict = Depends(require_role("user"))):
    try:
        rows = list(
            get_db().assistance_requests.find({"owner_id": user["_id"]})
            .sort("created_at", -1)
            .limit(20)
        )
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return [owner_out(r) for r in rows]


@router.post("/{request_id}/cancel")
def cancel_request(request_id: str, user: dict = Depends(require_role("user"))):
    rid = parse_oid(request_id, "Request")
    try:
        result = get_db().assistance_requests.update_one(
            {"_id": rid, "owner_id": user["_id"], "status": {"$in": ACTIVE}},
            {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}},
        )
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="This request can no longer be cancelled.")
    return {"ok": True}


# ---------------- mechanic ----------------


@router.get("/open", response_model=List[MechanicRequestOut])
def open_requests(user: dict = Depends(require_role("mechanic"))):
    db = get_db()
    try:
        mech = mech_profile(db, user)
        if not mech.get("is_available", True):
            return []
        services = mech.get("service_types", [])
        vtypes = mech.get("vehicle_types", [])
        query = {
            "status": "open",
            "$or": [
                {"is_sos": True},
                {
                    "service_type": {"$in": services},
                    "$or": [{"vehicle_type": None}, {"vehicle_type": {"$in": vtypes}}],
                },
            ],
        }
        rows = list(db.assistance_requests.find(query).sort("created_at", -1).limit(50))
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)

    loc = mech.get("location")
    out = []
    for r in rows:
        dist = None
        if loc and r.get("latitude") is not None:
            dist = round(haversine_km(loc["lat"], loc["lng"], r["latitude"], r["longitude"]), 1)
        out.append(mechanic_out(r, dist, reveal=False))
    out.sort(key=lambda r: (not r.is_sos, r.distance_km if r.distance_km is not None else 1e9))
    return out


@router.get("/jobs", response_model=List[MechanicRequestOut])
def my_jobs(user: dict = Depends(require_role("mechanic"))):
    try:
        rows = list(
            get_db().assistance_requests.find(
                {
                    "mechanic_user_id": user["_id"],
                    "status": {"$in": ["accepted", "completed", "cancelled"]},
                }
            )
            .sort("updated_at", -1)
            .limit(30)
        )
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return [mechanic_out(r, None, reveal=True) for r in rows]


@router.post("/{request_id}/accept")
def accept_request(request_id: str, user: dict = Depends(require_role("mechanic"))):
    rid = parse_oid(request_id, "Request")
    db = get_db()
    try:
        mech = mech_profile(db, user)
        if not mech.get("is_available", True):
            raise HTTPException(status_code=400, detail="Set yourself as available to accept requests.")
        active = db.assistance_requests.count_documents(
            {"mechanic_user_id": user["_id"], "status": "accepted"}
        )
        if active >= MAX_ACTIVE_JOBS:
            raise HTTPException(
                status_code=400,
                detail="You already have " + str(MAX_ACTIVE_JOBS) + " active jobs. Complete one first.",
            )
        now = datetime.now(timezone.utc)
        doc = db.assistance_requests.find_one_and_update(
            {"_id": rid, "status": "open"},
            {
                "$set": {
                    "status": "accepted",
                    "mechanic_user_id": user["_id"],
                    "mechanic_shop": mech["shop_name"],
                    "mechanic_phone": mech["phone"],
                    "accepted_at": now,
                    "updated_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    if not doc:
        raise HTTPException(status_code=409, detail="This request was already taken or cancelled.")
    return {"ok": True}


@router.post("/{request_id}/complete")
def complete_request(request_id: str, user: dict = Depends(require_role("mechanic"))):
    rid = parse_oid(request_id, "Request")
    now = datetime.now(timezone.utc)
    try:
        result = get_db().assistance_requests.update_one(
            {"_id": rid, "mechanic_user_id": user["_id"], "status": "accepted"},
            {"$set": {"status": "completed", "completed_at": now, "updated_at": now}},
        )
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Active job not found.")
    return {"ok": True}


@router.post("/{request_id}/release")
def release_request(request_id: str, user: dict = Depends(require_role("mechanic"))):
    rid = parse_oid(request_id, "Request")
    try:
        result = get_db().assistance_requests.update_one(
            {"_id": rid, "mechanic_user_id": user["_id"], "status": "accepted"},
            {
                "$set": {"status": "open", "updated_at": datetime.now(timezone.utc)},
                "$unset": {
                    "mechanic_user_id": "",
                    "mechanic_shop": "",
                    "mechanic_phone": "",
                    "accepted_at": "",
                },
            },
        )
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Active job not found.")
    return {"ok": True}