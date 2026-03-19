import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from typing import List
from pydantic import BaseModel

from src.db.session import get_session
from src.models.chat import Chat
from src.models.user import User
from src.schemas.chat import ChatResponse, ChatSidebarResponse, ChatUpdate, ChatRequest
from src.api.agent import agent_executor

router = APIRouter()


# ── Schemas for rename / delete ──
class RenameRequest(BaseModel):
    thread_id: uuid.UUID
    new_title: str


class DeleteRequest(BaseModel):
    thread_id: uuid.UUID


# ── Dependency: wallet → User ──
def get_current_user(request: Request, db: Session = Depends(get_session)) -> User:
    wallet_address = getattr(request.state, "wallet_address", None)
    if not wallet_address:
        raise HTTPException(status_code=401, detail="Wallet address missing from request")

    user_email = f"{wallet_address}@mbassistant.local"
    user = db.exec(select(User).where(User.email == user_email)).first()

    if not user:
        user = User(
            email=user_email,
            full_name=wallet_address,
            username=wallet_address,
            hashed_password="web3_auth_no_password",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user


# ── POST /chat  –  stream AI answer & persist ──
@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(
    request: ChatRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    chat_record = db.exec(
        select(Chat).where(Chat.thread_id == request.thread_id)
    ).first()

    if not chat_record:
        chat_record = Chat(
            thread_id=request.thread_id,
            user_id=current_user.id,
            title="New Consultation",
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
            stream_mode="messages",
        ):
            # Only stream content from the *agent* (LLM) node, not tool nodes.
            # This prevents raw Pinecone source blocks from leaking to the UI.
            langgraph_node = metadata.get("langgraph_node", "")
            if langgraph_node == "agent" and chunk.content:
                full_response += chunk.content
                yield chunk.content

        # ── Persist after streaming is done ──
        try:
            new_messages = list(chat_record.messages or [])
            new_messages.append({"role": "user", "content": request.message})
            new_messages.append({"role": "assistant", "content": full_response})
            chat_record.messages = new_messages

            # Auto-title from first user message
            if chat_record.title == "New Consultation":
                words = request.message.split()[:6]
                chat_record.title = " ".join(words) + ("…" if len(request.message.split()) > 6 else "")

            db.add(chat_record)
            db.commit()
        except Exception as e:
            print(f"[MB_ASSISTANT] Error persisting chat: {e}")

    return StreamingResponse(event_generator(), media_type="text/plain")


# ── GET /history/{thread_id} ──
@router.get("/history/{thread_id}", response_model=Chat)
async def get_chat_session(
    thread_id: uuid.UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    chat_record = db.exec(
        select(Chat).where(Chat.thread_id == thread_id, Chat.user_id == current_user.id)
    ).first()

    if not chat_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found",
        )
    return chat_record


# ── GET /sessions ──
@router.get("/sessions", response_model=List[ChatSidebarResponse])
async def get_user_chat_sessions(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
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
            updated_at=row.updated_at,
        )
        for row in results
    ]


# ── PATCH /edit ──
@router.patch("/edit")
async def edit_message(update: ChatUpdate, db: Session = Depends(get_session)):
    chat = db.exec(select(Chat).where(Chat.thread_id == update.thread_id)).first()
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")

    chat.messages = list(chat.messages or [])[:update.message_index]
    db.add(chat)
    db.commit()
    return {"status": "success", "message": "History truncated."}


# ── PATCH /rename ──
@router.patch("/rename")
async def rename_session(
    body: RenameRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    chat = db.exec(
        select(Chat).where(Chat.thread_id == body.thread_id, Chat.user_id == current_user.id)
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    chat.title = body.new_title.strip() or "Untitled"
    db.add(chat)
    db.commit()
    return {"status": "success", "title": chat.title}


# ── DELETE /delete ──
@router.delete("/delete/{thread_id}")
async def delete_session(
    thread_id: uuid.UUID,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    chat = db.exec(
        select(Chat).where(Chat.thread_id == thread_id, Chat.user_id == current_user.id)
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    db.delete(chat)
    db.commit()
    return {"status": "success", "message": "Session deleted."}