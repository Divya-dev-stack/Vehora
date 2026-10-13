from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import PyMongoError

from app.api.deps import require_role
from app.core.helpers import parse_oid, utc
from app.core.service_types import SERVICE_TYPES
from app.db.mongo import get_db

router = APIRouter(prefix="/admin", tags=["admin"])

DB_DOWN = "Database is not reachable. Please try again."
LABELS = {s["key"]: s["label"] for s in SERVICE_TYPES}
LABELS["emergency"] = "Emergency (SOS)"
LABELS["other"] = "Not a vehicle problem"
admin_only = require_role("admin")


@router.get("/stats")
def stats(_admin: dict = Depends(admin_only)):
    db = get_db()

    def requests_with(status):
        return db.assistance_requests.count_documents({"status": status})

    try:
        by_category = list(
            db.complaints.aggregate(
                [
                    {"$group": {"_id": "$category", "count": {"$sum": 1}}},
                    {"$sort": {"count": -1}},
                ]
            )
        )
        return {
            "users": {
                "owners": db.users.count_documents({"role": "user"}),
                "mechanics": db.users.count_documents({"role": "mechanic"}),
                "admins": db.users.count_documents({"role": "admin"}),
                "inactive": db.users.count_documents({"is_active": False}),
            },
            "mechanics": {
                "total": db.mechanics.count_documents({}),
                "verified": db.mechanics.count_documents({"verified": True}),
                "unverified": db.mechanics.count_documents({"verified": {"$ne": True}}),
                "available": db.mechanics.count_documents({"is_available": True}),
            },
            "vehicles": db.vehicles.count_documents({}),
            "service_records": db.service_records.count_documents({}),
            "reminders": db.reminders.count_documents({}),
            "assistance": {
                "total": db.assistance_requests.count_documents({}),
                "open": requests_with("open"),
                "accepted": requests_with("accepted"),
                "completed": requests_with("completed"),
                "cancelled": requests_with("cancelled"),
                "sos": db.assistance_requests.count_documents({"is_sos": True}),
            },
            "complaints": {
                "total": db.complaints.count_documents({}),
                "by_category": [
                    {
                        "category": str(c["_id"]),
                        "label": LABELS.get(str(c["_id"]), str(c["_id"])),
                        "count": c["count"],
                    }
                    for c in by_category
                ],
            },
        }
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)


@router.get("/mechanics")
def list_mechanics(_admin: dict = Depends(admin_only)):
    db = get_db()
    try:
        rows = list(db.mechanics.find({}).sort([("verified", 1), ("created_at", -1)]).limit(200))
        ids = [r["user_id"] for r in rows]
        users = {u["_id"]: u for u in db.users.find({"_id": {"$in": ids}}, {"email": 1})}
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return [
        {
            "id": str(r["_id"]),
            "shop_name": r["shop_name"],
            "city": r["city"],
            "phone": r["phone"],
            "email": users.get(r["user_id"], {}).get("email"),
            "verified": bool(r.get("verified")),
            "is_available": r.get("is_available", True),
            "has_location": r.get("location") is not None,
            "service_count": len(r.get("service_types", [])),
            "created_at": utc(r.get("created_at")),
        }
        for r in rows
    ]


def _set_verified(mechanic_id, value, admin):
    rid = parse_oid(mechanic_id, "Mechanic")
    now = datetime.now(timezone.utc)
    try:
        result = get_db().mechanics.update_one(
            {"_id": rid},
            {
                "$set": {
                    "verified": value,
                    "verified_at": now if value else None,
                    "verified_by": admin["_id"],
                    "updated_at": now,
                }
            },
        )
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mechanic not found.")
    return {"ok": True, "verified": value}


@router.post("/mechanics/{mechanic_id}/verify")
def verify_mechanic(mechanic_id: str, admin: dict = Depends(admin_only)):
    return _set_verified(mechanic_id, True, admin)


@router.post("/mechanics/{mechanic_id}/unverify")
def unverify_mechanic(mechanic_id: str, admin: dict = Depends(admin_only)):
    return _set_verified(mechanic_id, False, admin)


@router.get("/users")
def list_users(_admin: dict = Depends(admin_only)):
    try:
        rows = list(
            get_db().users.find({}, {"password_hash": 0}).sort("created_at", -1).limit(200)
        )
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return [
        {
            "id": str(r["_id"]),
            "full_name": r["full_name"],
            "email": r["email"],
            "role": r["role"],
            "is_active": r.get("is_active", True),
            "created_at": utc(r.get("created_at")),
        }
        for r in rows
    ]


def _set_active(user_id, value, admin):
    uid = parse_oid(user_id, "User")
    if uid == admin["_id"]:
        raise HTTPException(status_code=400, detail="You cannot change your own account.")
    db = get_db()
    try:
        target = db.users.find_one({"_id": uid})
        if not target:
            raise HTTPException(status_code=404, detail="User not found.")
        if target["role"] == "admin":
            raise HTTPException(status_code=400, detail="Administrator accounts cannot be changed here.")
        db.users.update_one({"_id": uid}, {"$set": {"is_active": value}})
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return {"ok": True, "is_active": value}


@router.post("/users/{user_id}/deactivate")
def deactivate_user(user_id: str, admin: dict = Depends(admin_only)):
    return _set_active(user_id, False, admin)


@router.post("/users/{user_id}/activate")
def activate_user(user_id: str, admin: dict = Depends(admin_only)):
    return _set_active(user_id, True, admin)


@router.get("/requests")
def list_requests(_admin: dict = Depends(admin_only)):
    try:
        rows = list(get_db().assistance_requests.find({}).sort("created_at", -1).limit(30))
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return [
        {
            "id": str(r["_id"]),
            "service_label": LABELS.get(r["service_type"], r["service_type"]),
            "is_sos": bool(r.get("is_sos")),
            "status": r["status"],
            "vehicle_label": r.get("vehicle_label"),
            "mechanic_shop": r.get("mechanic_shop"),
            "created_at": utc(r.get("created_at")),
        }
        for r in rows
    ]
