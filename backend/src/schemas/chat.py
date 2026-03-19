import uuid
from datetime import datetime
from uuid import UUID
from typing import List, Optional
from pydantic import BaseModel, Field

# Schema for Disease prompt
class DiseaseInput(BaseModel):
    disease_name: str = Field(
        description="The specific medical disease or condition to search for."
    )

# Schema for quiz prompts
class QuizInput(BaseModel):
    topic: str = Field(
        description="The specific Paediatrics or O&G disease to quiz the user on."
    )
    num: int = Field(description="The exact number of questions. Convert English words to integers.")

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str 
    timestamp: datetime = Field(default_factory=datetime.now)

class ChatCreate(BaseModel):
    title: Optional[str] = "New Consultation"
    user_id: Optional[UUID] = None

class ChatResponse(BaseModel):
    answer: str
    thread_id: str
    timestamp: datetime = Field(default_factory=datetime.now)

class ChatHistory(BaseModel):
    thread_id: str
    messages: List[ChatMessage]
    summary: Optional[str] = None

class ChatSidebarResponse(BaseModel):
    thread_id: uuid.UUID
    title: str
    updated_at: datetime

class ChatUpdate(BaseModel):
    thread_id: uuid.UUID
    message_index: int  # Logic: Which 'bubble' in the list are we editing?
    new_content: str