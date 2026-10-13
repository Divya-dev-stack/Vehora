import re
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.service_types import SERVICE_KEYS


def _clean(v):
    if v is None:
        return None
    v = v.strip()
    return v or None


class AssistanceIn(BaseModel):
    vehicle_id: Optional[str] = None
    service_type: str = "emergency"
    description: Optional[str] = Field(default=None, max_length=300)
    contact_phone: str
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    location_text: Optional[str] = Field(default=None, max_length=200)
    is_sos: bool = False

    @field_validator("contact_phone")
    @classmethod
    def check_phone(cls, v: str) -> str:
        v = v.strip()
        if not re.fullmatch(r"[0-9]{10}", v):
            raise ValueError("Phone must be 10 digits")
        return v

    @field_validator("description", "location_text")
    @classmethod
    def clean_optional(cls, v):
        return _clean(v)

    @model_validator(mode="after")
    def check_all(self):
        if self.is_sos:
            self.service_type = "emergency"
        else:
            self.service_type = self.service_type.strip().lower()
            if self.service_type not in SERVICE_KEYS:
                raise ValueError("Choose the problem type")
            if not self.vehicle_id:
                raise ValueError("Select a vehicle")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Location is incomplete")
        if self.latitude is None and not self.location_text:
            raise ValueError("Share your location or type a landmark or address")
        return self


class AssistanceOut(BaseModel):
    id: str
    vehicle_label: Optional[str] = None
    service_type: str
    service_label: str
    description: Optional[str] = None
    is_sos: bool
    status: str
    location_text: Optional[str] = None
    has_coordinates: bool
    created_at: datetime
    mechanic_shop: Optional[str] = None
    mechanic_phone: Optional[str] = None


class MechanicRequestOut(BaseModel):
    id: str
    vehicle_label: Optional[str] = None
    service_type: str
    service_label: str
    description: Optional[str] = None
    is_sos: bool
    status: str
    distance_km: Optional[float] = None
    created_at: datetime
    contact_phone: Optional[str] = None
    location_text: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class LocationIn(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    consent: bool


class NearbyMechanicOut(BaseModel):
    id: str
    shop_name: str
    phone: str
    city: str
    address: Optional[str] = None
    working_hours: Optional[str] = None
    vehicle_types: List[str]
    service_types: List[str]
    verified: bool
    distance_km: float
    latitude: float
    longitude: float