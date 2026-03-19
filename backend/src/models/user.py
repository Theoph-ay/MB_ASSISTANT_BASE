import uuid
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship

# Logic: Only import Chat for type hints to avoid circular errors
if TYPE_CHECKING:
    from src.models.chat import Chat

from src.schemas.user import UserBase

class User(UserBase, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True
    )

    username: str = Field(unique=True, index=True, max_length=50)
    email: str = Field(unique=True, index=True, max_length=120)
    hashed_password: str = Field(max_length=255)
    
    profile_image: str = Field(default="default_med.jpg", max_length=255)
    
    chats: List["Chat"] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

    @property
    def avatar_url(self) -> str:
        return f"/api/static/avatars/{self.profile_image}"