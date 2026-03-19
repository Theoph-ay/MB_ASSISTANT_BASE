import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from typing import List

from src.db.session import get_session
from src.models.chat import Chat
from src.models.user import User
from src.schemas.chat import ChatResponse, ChatSidebarResponse, ChatUpdate, ChatRequest
from src.api.agent import agent_executor

router = APIRouter()

def get_current_user(request: Request, db: Session = Depends(get_session)) -> User:
    wallet_address = getattr(request.state, "wallet_address", None)
    if not wallet_address:
        raise HTTPException(status_code=401, detail="Wallet address missing from request")
    
    user_email = f"{wallet_address}@mbassistant.local"
    user = db.exec(select(User).where(User.email == user_email)).first()
    
    if not user:
        # Create a new pseudo-user for this wallet address dynamically
        user = User(
            email=user_email,
            full_name=wallet_address,
            username=wallet_address,
            hashed_password="web3_auth_no_password"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    return user


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(
    request: ChatRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
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
            user_id=current_user.id,
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
            config=config,
            stream_mode="messages"
        ):
            if chunk.content:
                full_response += chunk.content
                yield chunk.content
        # After loop finishes, save the final state
        new_messages = chat_record.messages.copy()
        new_messages.append({"role": "user", "content":request.message})
        new_messages.append({"role": "assistant", "content":full_response})
        chat_record.messages = new_messages

        if chat_record.title == "New Consultation":
            chat_record.title = " ".join(request.message.split()[:5] + "...")

        db.add(chat_record)
        db.commit()

    return StreamingResponse(event_generator(), media_type="text/plain")

@router.get("/history/{thread_id}", response_model=Chat)
async def get_chat_session(
    thread_id: uuid.UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Logic: Fetches the entire conversation history for a specific thread.
    """
    chat_record = db.exec(
        select(Chat).where(Chat.thread_id == thread_id, Chat.user_id == current_user.id)
    ).first()
    
    if not chat_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found"
        )
    return chat_record

@router.get("/sessions", response_model=List[ChatSidebarResponse])
async def get_user_chat_sessions(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Logic: Fetches all chat sessions for the current user.
    """
    statement = (
        select(Chat.thread_id, Chat.title, Chat.updated_at)
        .where(Chat.user_id == current_user.id)
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
    
    chat.messages = new_messages
    db.add(chat)
    db.commit()
    
    return {"status": "success", "message": "History truncated to edit point."}