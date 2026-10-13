import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.mechanics import router as mechanics_router
from app.api.vehicles import router as vehicles_router
from app.core.config import settings
from app.core.vehicle_types import DEFAULT_VEHICLE_TYPES
from app.db.mongo import get_client, get_db

logger = logging.getLogger("vehora")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        db = get_db()
        db.users.create_index("email", unique=True)
        db.vehicles.create_index("owner_id")
        db.mechanics.create_index("user_id", unique=True)
        db.vehicle_types.create_index("key", unique=True)
        if db.vehicle_types.count_documents({}) == 0:
            db.vehicle_types.insert_many([dict(t) for t in DEFAULT_VEHICLE_TYPES])
    except Exception as exc:
        logger.warning("Database setup at startup failed: %s", exc)
    yield


app = FastAPI(title="VEHORA API", version="0.4.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(vehicles_router, prefix="/api")
app.include_router(mechanics_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "vehora-api"}


@app.get("/api/health/db")
def health_db():
    try:
        get_client().admin.command("ping")
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Database is not reachable. Check MONGODB_URI and that MongoDB is running.",
        )
    return {"status": "ok", "database": "connected"}
