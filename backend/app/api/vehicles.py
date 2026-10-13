from datetime import datetime, timezone
from typing import List

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pymongo.errors import PyMongoError

from app.api.deps import get_current_user, require_role
from app.core.vehicle_types import FUEL_TYPES
from app.db.mongo import get_db
from app.schemas.vehicle import VehicleIn, VehicleMetaOut, VehicleOut, VehicleTypeOut

router = APIRouter(tags=["vehicles"])

DB_DOWN = "Database is not reachable. Please try again."
MAX_VEHICLES = 20


def parse_oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Vehicle not found.")


def to_out(doc: dict) -> VehicleOut:
    return VehicleOut(
        id=str(doc["_id"]),
        vehicle_type=doc["vehicle_type"],
        make=doc["make"],
        model=doc["model"],
        year=doc["year"],
        registration_number=doc.get("registration_number"),
        fuel_type=doc["fuel_type"],
        mileage_km=doc["mileage_km"],
        last_service_date=doc.get("last_service_date"),
        created_at=doc["created_at"],
    )


def to_doc(data: VehicleIn) -> dict:
    doc = data.model_dump()
    doc["last_service_date"] = (
        data.last_service_date.isoformat() if data.last_service_date else None
    )
    return doc


def check_type(db, key: str) -> None:
    if not db.vehicle_types.find_one({"key": key}):
        raise HTTPException(status_code=422, detail="Unsupported vehicle type.")


@router.get("/vehicle-types", response_model=VehicleMetaOut)
def vehicle_types(_user: dict = Depends(get_current_user)):
    try:
        rows = list(get_db().vehicle_types.find({}, {"_id": 0}))
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return VehicleMetaOut(
        types=[VehicleTypeOut(**r) for r in rows],
        fuel_types=FUEL_TYPES,
    )


@router.get("/vehicles", response_model=List[VehicleOut])
def list_vehicles(user: dict = Depends(require_role("user"))):
    try:
        rows = get_db().vehicles.find({"owner_id": user["_id"]}).sort("created_at", -1)
        return [to_out(r) for r in rows]
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)


@router.post("/vehicles", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(data: VehicleIn, user: dict = Depends(require_role("user"))):
    db = get_db()
    try:
        check_type(db, data.vehicle_type)
        if db.vehicles.count_documents({"owner_id": user["_id"]}) >= MAX_VEHICLES:
            raise HTTPException(
                status_code=400, detail=f"You can add up to {MAX_VEHICLES} vehicles."
            )
        now = datetime.now(timezone.utc)
        doc = to_doc(data)
        doc["owner_id"] = user["_id"]
        doc["created_at"] = now
        doc["updated_at"] = now
        db.vehicles.insert_one(doc)
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return to_out(doc)


@router.get("/vehicles/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(vehicle_id: str, user: dict = Depends(require_role("user"))):
    oid = parse_oid(vehicle_id)
    try:
        doc = get_db().vehicles.find_one({"_id": oid, "owner_id": user["_id"]})
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    if not doc:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    return to_out(doc)


@router.put("/vehicles/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(vehicle_id: str, data: VehicleIn, user: dict = Depends(require_role("user"))):
    oid = parse_oid(vehicle_id)
    db = get_db()
    try:
        check_type(db, data.vehicle_type)
        changes = to_doc(data)
        changes["updated_at"] = datetime.now(timezone.utc)
        result = db.vehicles.update_one(
            {"_id": oid, "owner_id": user["_id"]}, {"$set": changes}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Vehicle not found.")
        doc = db.vehicles.find_one({"_id": oid})
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return to_out(doc)


@router.delete("/vehicles/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(vehicle_id: str, user: dict = Depends(require_role("user"))):
    oid = parse_oid(vehicle_id)
    try:
        result = get_db().vehicles.delete_one({"_id": oid, "owner_id": user["_id"]})
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
