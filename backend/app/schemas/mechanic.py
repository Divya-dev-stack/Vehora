import re
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


def _dedupe(values: List[str]) -> List[str]:
    seen = []
    for v in values:
        v = v.strip().lower()
        if v and v not in seen:
            seen.append(v)
    return seen


class MechanicProfileIn(BaseModel):
    shop_name: str = Field(min_length=2, max_length=80)
    phone: str
    city: str = Field(min_length=2, max_length=60)
    address: Optional[str] = Field(default=None, max_length=200)
    vehicle_types: List[str] = Field(min_length=1, max_length=20)
    service_types: List[str] = Field(min_length=1, max_length=20)
    working_hours: Optional[str] = Field(default=None, max_length=80)
    is_available: bool = True

    @field_validator("shop_name", "city")
    @classmethod
    def clean_required(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("This field is too short")
        return v

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v: str) -> str:
        v = v.strip()
        if not re.fullmatch(r"[0-9]{10}", v):
            raise ValueError("Phone must be 10 digits")
        return v

    @field_validator("address", "working_hours")
    @classmethod
    def clean_optional(cls, v):
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("vehicle_types", "service_types")
    @classmethod
    def clean_list(cls, v: List[str]) -> List[str]:
        out = _dedupe(v)
        if not out:
            raise ValueError("Select at least one")
        return out


class MechanicProfileOut(BaseModel):
    shop_name: str
    phone: str
    city: str
    address: Optional[str] = None
    vehicle_types: List[str]
    service_types: List[str]
    working_hours: Optional[str] = None
    is_available: bool
    verified: bool
    updated_at: datetime
