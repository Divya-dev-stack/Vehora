from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError, PyMongoError

from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.mongo import get_db
from app.schemas.auth import LoginIn, RegisterIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

DB_DOWN = "Database is not reachable. Please try again."


def to_user_out(doc: dict) -> UserOut:
    return UserOut(
        id=str(doc["_id"]),
        full_name=doc["full_name"],
        email=doc["email"],
        phone=doc.get("phone"),
        role=doc["role"],
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn):
    if data.role not in ("user", "mechanic"):
        raise HTTPException(status_code=403, detail="This role cannot be registered.")
    users = get_db().users
    email = data.email.lower()
    doc = {
        "full_name": data.full_name,
        "email": email,
        "phone": data.phone,
        "password_hash": hash_password(data.password),
        "role": data.role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        if users.find_one({"email": email}):
            raise HTTPException(status_code=409, detail="An account with this email already exists.")
        users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    return to_user_out(doc)


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn):
    try:
        user = get_db().users.find_one({"email": data.email.lower()})
    except PyMongoError:
        raise HTTPException(status_code=503, detail=DB_DOWN)
    if (
        not user
        or not user.get("is_active", True)
        or not verify_password(data.password, user["password_hash"])
    ):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    token = create_access_token(str(user["_id"]), user["role"])
    return TokenOut(access_token=token, user=to_user_out(user))


@router.get("/me", response_model=UserOut)
def me(current: dict = Depends(get_current_user)):
    return to_user_out(current)
