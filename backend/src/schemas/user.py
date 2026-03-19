import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel

class UserBase(SQLModel):
    email: str = Field(unique=True, index=True, nullable=False)
    full_name: str = Field(unique=True, index=True, nullable=False)
    is_active: bool = Field(default=True)

class UserCreate(UserBase):
    password: str = Field(nullable=False)

class UserRead(UserBase):
    id: uuid.UUID
    created_at: datetime

class UserUpdate(SQLModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None