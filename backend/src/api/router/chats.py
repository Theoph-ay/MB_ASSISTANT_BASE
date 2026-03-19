import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from typing import List

from src.db.session import get_session
from src.models.chat import Chat
from src.schemas.chat import ChatResponse, ChatSidebarResponse, ChatUpdate
from src.api.agent import agent_executor

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(
    request: ChatResponse,
    db: Session = Depends(get_session),
):
    """
    Logic: Receives a message, runs the AI Agent, and persists the history to Postgres.
    """
    
    chat_record = db.exec(
        select(Chat).where(Chat.thread_id == request.thread_id)
    ).first()

    if not chat_record:
        chat_record = Chat(
            thread_id = request.thread_id,
            user_id=uuid.uuid4(), #get current_user.id
            title="New Consultation"
        )
        db.add(chat_record)
        db.commit()
        db.refresh(chat_record)
    
    async def event_generator():
        full_response = ""
        config = {"configurable": {"thread_id": str(request.thread_id)}}

        async for chunk, metadata in agent_executor.astream(
            {"messages": [("user", request.message)]},
            config=config
        ):
            if chunk.content:
                full_response += chunk.content
                yield chunk.content
        # After loop finishes, save the final state
        new_messages = chat_record.messages.copy()
        new_messages.append({"role": "user", "content":request.message})
        new_messages.append({"role": "user", "content":request.message})
        chat_record.messages = new_messages

        if chat_record.title == "New Consultation":
            chat_record.title = " ".join(request.message.split()[:5] + "...")

        db.add(chat_record)
        db.commit()

    return StreamingResponse(event_generator(), media_type="text/plain")

@router.get("/history/{thread_id}", response_model=Chat)
async def get_chat_session(
    thread_id: uuid.UUID,
    db: Session = Depends(get_session)
):
    """
    Logic: Fetches the entire conversation history for a specific thread.
    """
    chat_record = db.exec(
        select(Chat).where(Chat.thread_id == thread_id)
    ).first()
    if not chat_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found"
        )
    return chat_record

@router.get("/sessions", response_model=List[ChatSidebarResponse])
async def get_user_chat_sessions(
    db: Session = Depends(get_session)
):
    """
    Logic: Fetches all chat sessions for the current user.
    """
    mock_user_id = uuid.UUID("123e4567-e89b-12d3-a456-426614174000")
    statement = (
        select(Chat.thread_id, Chat.title, Chat.updated_at)
        .where(Chat.user_id == mock_user_id) #change to current_user.id
        .order_by(Chat.updated_at.desc())
    )
    results = db.exec(statement).all()
    return [
        ChatSidebarResponse(
            thread_id=row.thread_id,
            title=row.title,
            updated_at=row.updated_at
        )
        for row in results
    ]

@router.patch("/edit")
async def edit_message(update: ChatUpdate, db: Session = Depends(get_session)):
    chat = db.exec(select(Chat).where(Chat.thread_id == update.thread_id)).first()
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")

    new_messages = chat.messages[:update.message_index]
    new_messages.append({"role": "user", "content": update.new_content})
    
    chat.messages = new_messages
    db.add(chat)
    db.commit()
    
    return {"status": "success", "message": "History rewound to edit point."}