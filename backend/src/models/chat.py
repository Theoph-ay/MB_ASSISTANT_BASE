import uuid
from datetime import datetime, timezone
from typing import Optional, List, Any, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship, JSON, Column

if TYPE_CHECKING:
    from src.models.user import User

class Chat(SQLModel, table=True):
    __tablename__ = "chats"

    thread_id: uuid.UUID = Field(
        default_factory=uuid.uuid4, 
        primary_key=True, 
        index=True
    )

    user_id: uuid.UUID = Field(foreign_key="users.id", index=True, nullable=False)

    title: str = Field(default="New Consultation", max_length=100)
    
    messages: List[dict] = Field(default=[], sa_column=Column(JSON))
    
    summary: Optional[str] = Field(default=None)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)}
    )

    user: "User" = Relationship(back_populates="chats")