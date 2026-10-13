from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import PyMongoError

from app.api.deps import get_current_user, require_role
from app.core.service_types import SERVICE_KEYS, SERVICE_TYPES
from app.db.mongo import get_db
from app.schemas.mechanic import MechanicProfileIn, MechanicProfileOut

router = APIRouter(prefix="/mechanics", tags=["mechanics"])

DB_DOWN = "Database is not reachable. Please try again."


def to_out(doc: dict) -> MechanicProfileOut:
    return MechanicProfileOut(
        shop_name=doc["shop_name"],
        phone=doc["phone"],
        city=doc["city"],
        address=doc.get("address"),
        vehicle_types=doc["vehicle_types"],
        service_types=doc["service_types"],
        working_hours=doc.get("working_hours"),
        is_available=doc.get("is_available", True),
        verified=doc.get("verified", False),
        updated_at=doc["updated_at"],
    )


@router.get("/meta")
def meta(_user: dict = Depends(get_current_user)):
    try:
        types = list(get_db().vehicle_types.find({}, {"_id": 0}))
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return {"vehicle_types": types, "service_types": SERVICE_TYPES}


@router.get("/me", response_model=MechanicProfileOut)
def my_profile(user: dict = Depends(require_role("mechanic"))):
    try:
        doc = get_db().mechanics.find_one({"user_id": user["_id"]})
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    if not doc:
        raise HTTPException(status_code=404, detail="Profile is not set up yet.")
    return to_out(doc)


@router.put("/me", response_model=MechanicProfileOut)
def save_profile(data: MechanicProfileIn, user: dict = Depends(require_role("mechanic"))):
    db = get_db()
    try:
        valid_types = {t["key"] for t in db.vehicle_types.find({}, {"key": 1})}
        if any(t not in valid_types for t in data.vehicle_types):
            raise HTTPException(status_code=422, detail="Unsupported vehicle type selected.")
        if any(s not in SERVICE_KEYS for s in data.service_types):
            raise HTTPException(status_code=422, detail="Unsupported service type selected.")

        now = datetime.now(timezone.utc)
        db.mechanics.update_one(
            {"user_id": user["_id"]},
            {
                "$set": {**data.model_dump(), "updated_at": now},
                "$setOnInsert": {"user_id": user["_id"], "verified": False, "created_at": now},
            },
            upsert=True,
        )
        doc = db.mechanics.find_one({"user_id": user["_id"]})
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return to_out(doc)
