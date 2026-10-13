import re
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(min_length=8, max_length=64)
    role: Literal["user", "mechanic"] = "user"

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name is too short")
        return v

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v):
        if v is None:
            return None
        v = v.strip()
        if v == "":
            return None
        if not re.fullmatch(r"[0-9]{10}", v):
            raise ValueError("Phone must be 10 digits")
        return v

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v) or not re.search(r"[0-9]", v):
            raise ValueError("Password needs a letter and a number")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=64)


class UserOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
