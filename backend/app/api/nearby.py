from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import PyMongoError

from app.api.deps import require_role
from app.core.helpers import haversine_km, utc
from app.core.service_types import SERVICE_KEYS
from app.db.mongo import get_db
from app.schemas.assistance import LocationIn, NearbyMechanicOut

router = APIRouter(prefix="/mechanics", tags=["mechanic-location"])

DB_DOWN = "Database is not reachable. Please try again."
NO_PROFILE = "Set up your shop profile first."


def location_state(doc):
    loc = doc.get("location")
    if not loc:
        return {"shared": False, "latitude": None, "longitude": None, "updated_at": None}
    return {
        "shared": True,
        "latitude": loc["lat"],
        "longitude": loc["lng"],
        "updated_at": utc(doc.get("location_updated_at")),
    }


@router.get("/me/location")
def my_location(user: dict = Depends(require_role("mechanic"))):
    try:
        doc = get_db().mechanics.find_one({"user_id": user["_id"]})
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    if not doc:
        raise HTTPException(status_code=404, detail=NO_PROFILE)
    return location_state(doc)


@router.put("/me/location")
def set_location(data: LocationIn, user: dict = Depends(require_role("mechanic"))):
    if not data.consent:
        raise HTTPException(
            status_code=400,
            detail="Please confirm that you agree to show your shop location to vehicle owners.",
        )
    now = datetime.now(timezone.utc)
    try:
        db = get_db()
        result = db.mechanics.update_one(
            {"user_id": user["_id"]},
            {
                "$set": {
                    "location": {"lat": data.latitude, "lng": data.longitude},
                    "location_updated_at": now,
                }
            },
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail=NO_PROFILE)
        doc = db.mechanics.find_one({"user_id": user["_id"]})
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return location_state(doc)


@router.delete("/me/location")
def remove_location(user: dict = Depends(require_role("mechanic"))):
    try:
        result = get_db().mechanics.update_one(
            {"user_id": user["_id"]},
            {"$unset": {"location": "", "location_updated_at": ""}},
        )
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=NO_PROFILE)
    return {"ok": True}


@router.get("/nearby", response_model=List[NearbyMechanicOut])
def nearby(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    service: Optional[str] = None,
    vehicle_type: Optional[str] = None,
    radius_km: float = Query(default=25, gt=0, le=200),
    _user: dict = Depends(require_role("user")),
):
    query = {"is_available": True, "location": {"$exists": True}}
    if service:
        service = service.strip().lower()
        if service not in SERVICE_KEYS:
            raise HTTPException(status_code=422, detail="Unsupported service type.")
        query["service_types"] = service
    if vehicle_type:
        query["vehicle_types"] = vehicle_type.strip().lower()
    try:
        rows = list(get_db().mechanics.find(query).limit(500))
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)

    found = []
    for r in rows:
        loc = r["location"]
        dist = haversine_km(lat, lng, loc["lat"], loc["lng"])
        if dist <= radius_km:
            found.append((dist, r))
    found.sort(key=lambda item: item[0])

    return [
        NearbyMechanicOut(
            id=str(r["_id"]),
            shop_name=r["shop_name"],
            phone=r["phone"],
            city=r["city"],
            address=r.get("address"),
            working_hours=r.get("working_hours"),
            vehicle_types=r["vehicle_types"],
            service_types=r["service_types"],
            verified=bool(r.get("verified", False)),
            distance_km=round(dist, 1),
            latitude=r["location"]["lat"],
            longitude=r["location"]["lng"],
        )
        for dist, r in found[:30]
    ]