from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.service_types import SERVICE_KEYS


def _clean(v):
    if v is None:
        return None
    v = v.strip()
    return v or None


class ServiceRecordIn(BaseModel):
    vehicle_id: str
    service_date: date
    service_type: str
    odometer_km: int = Field(ge=0, le=2_000_000)
    cost: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    workshop: Optional[str] = Field(default=None, max_length=80)
    notes: Optional[str] = Field(default=None, max_length=300)
    next_due_date: Optional[date] = None
    next_due_km: Optional[int] = Field(default=None, ge=0, le=2_000_000)

    @field_validator("service_type")
    @classmethod
    def check_type(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in SERVICE_KEYS:
            raise ValueError("Unsupported service type")
        return v

    @field_validator("service_date")
    @classmethod
    def check_date(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Service date cannot be in the future")
        return v

    @field_validator("workshop", "notes")
    @classmethod
    def clean_optional(cls, v):
        return _clean(v)

    @model_validator(mode="after")
    def check_next(self):
        if self.next_due_date and self.next_due_date <= self.service_date:
            raise ValueError("Next due date must be after the service date")
        if self.next_due_km is not None and self.next_due_km <= self.odometer_km:
            raise ValueError("Next due odometer must be higher than the current reading")
        return self


class ServiceRecordOut(BaseModel):
    id: str
    vehicle_id: str
    vehicle_label: str
    service_date: date
    service_type: str
    service_label: str
    odometer_km: int
    cost: Optional[int] = None
    workshop: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class ReminderIn(BaseModel):
    vehicle_id: str
    title: str = Field(min_length=2, max_length=80)
    due_date: Optional[date] = None
    due_km: Optional[int] = Field(default=None, ge=0, le=2_000_000)

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Title is too short")
        return v

    @model_validator(mode="after")
    def need_one(self):
        if self.due_date is None and self.due_km is None:
            raise ValueError("Set a due date, a due odometer reading, or both")
        return self


class ReminderOut(BaseModel):
    id: str
    vehicle_id: str
    vehicle_label: str
    title: str
    due_date: Optional[date] = None
    due_km: Optional[int] = None
    current_km: Optional[int] = None
    status: str
    done: bool