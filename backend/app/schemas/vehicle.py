import re
from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class VehicleIn(BaseModel):
    vehicle_type: str = Field(min_length=2, max_length=30)
    make: str = Field(min_length=1, max_length=40)
    model: str = Field(min_length=1, max_length=40)
    year: int = Field(ge=1980)
    registration_number: Optional[str] = Field(default=None, max_length=15)
    fuel_type: Literal["petrol", "diesel", "cng", "lpg", "electric", "hybrid"]
    mileage_km: int = Field(ge=0, le=2_000_000)
    last_service_date: Optional[date] = None

    @field_validator("vehicle_type")
    @classmethod
    def clean_type(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("make", "model")
    @classmethod
    def clean_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("This field cannot be empty")
        return v

    @field_validator("year")
    @classmethod
    def check_year(cls, v: int) -> int:
        if v > date.today().year + 1:
            raise ValueError("Year is in the future")
        return v

    @field_validator("registration_number")
    @classmethod
    def clean_registration(cls, v):
        if v is None:
            return None
        v = v.strip().upper()
        if v == "":
            return None
        if not re.fullmatch(r"[A-Z0-9 -]{4,15}", v):
            raise ValueError("Registration number format is not valid")
        return v

    @field_validator("last_service_date")
    @classmethod
    def check_service_date(cls, v):
        if v is not None and v > date.today():
            raise ValueError("Last service date cannot be in the future")
        return v


class VehicleOut(BaseModel):
    id: str
    vehicle_type: str
    make: str
    model: str
    year: int
    registration_number: Optional[str] = None
    fuel_type: str
    mileage_km: int
    last_service_date: Optional[date] = None
    created_at: datetime


class VehicleTypeOut(BaseModel):
    key: str
    label: str
    group: str


class VehicleMetaOut(BaseModel):
    types: List[VehicleTypeOut]
    fuel_types: List[str]
