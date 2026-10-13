import jwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.errors import PyMongoError

from app.core.security import decode_access_token
from app.db.mongo import get_db

bearer = HTTPBearer(auto_error=False)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    if creds is None:
        raise _unauthorized()
    try:
        payload = decode_access_token(creds.credentials)
        user_id = ObjectId(payload["sub"])
    except (jwt.PyJWTError, KeyError, InvalidId):
        raise _unauthorized()
    try:
        user = get_db().users.find_one({"_id": user_id})
    except PyMongoError:
        raise HTTPException(status_code=503, detail="Database is not reachable.")
    if not user or not user.get("is_active", True):
        raise _unauthorized()
    return user


def require_role(*roles: str):
    def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="You do not have access to this.")
        return user

    return checker
