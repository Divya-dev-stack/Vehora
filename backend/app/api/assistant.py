import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import PyMongoError

from app.api.deps import get_current_user
from app.db.mongo import get_db
from app.ml.train_complaints import METRICS
from app.services.complaint_classifier import classify

router = APIRouter(prefix="/assistant", tags=["assistant"])


class ClassifyIn(BaseModel):
    text: str = Field(min_length=2, max_length=500)

    @field_validator("text")
    @classmethod
    def clean(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Please describe the problem in a few words")
        return v


@router.post("/classify")
def classify_complaint(data: ClassifyIn, user: dict = Depends(get_current_user)):
    try:
        result = classify(data.text)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    try:
        get_db().complaints.insert_one({
            "user_id": user["_id"],
            "text": data.text,
            "category": result["category"],
            "confidence": result["confidence"],
            "created_at": datetime.now(timezone.utc),
        })
    except PyMongoError:
        pass
    return result


@router.get("/model-info")
def model_info(_user: dict = Depends(get_current_user)):
    if not METRICS.exists():
        raise HTTPException(status_code=404, detail="Model has not been trained yet.")
    return json.loads(METRICS.read_text(encoding="utf-8"))
