import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, select

from src.db.session import get_session
from src.models.user import User
from src.models.chat import Chat
from src.schemas.user import UserRead, UserUpdate
from src.api.router.chats import get_current_user

router = APIRouter()


@router.get("/me", response_model=UserRead)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    """Returns the authenticated student's profile information."""
    return current_user


@router.patch("/me", response_model=UserRead)
async def update_my_profile(
    user_data: UserUpdate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Allows a student to update their name or email."""
    data = user_data.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(current_user, key, value)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/me/stats")
async def get_my_stats(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Returns consultation count and join date for the profile panel."""
    total = len(
        db.exec(
            select(Chat.thread_id).where(Chat.user_id == current_user.id)
        ).all()
    )
    return {
        "total_consultations": total,
        "wallet_address": current_user.email.replace("@mbassistant.local", ""),
        "member_since": str(current_user.id),  # UUID-based, no created_at yet
    }


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Permanently deletes the student's account and all associated data."""
    db.delete(current_user)
    db.commit()
    return None