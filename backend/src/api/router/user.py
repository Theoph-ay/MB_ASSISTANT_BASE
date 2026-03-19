import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from src.db.session import get_session
from src.models.user import User
from src.schemas.user import UserRead, UserUpdate

router = APIRouter()

@router.get("/me", response_model=UserRead)
async def get_my_profile(
    db: Session = Depends(get_session)
):
    """
    Logic: Returns the authenticated student's profile information.
    """
    # Placeholder: In the next step, this comes from your Auth token
    mock_id = uuid.UUID("123e4567-e89b-12d3-a456-426614174000")
    
    user = db.get(User, mock_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="User not found"
        )
    return user

@router.patch("/me", response_model=UserRead)
async def update_my_profile(
    user_data: UserUpdate,
    db: Session = Depends(get_session)
):
    """
    Logic: Allows a student to update their name or medical year.
    """
    mock_id = uuid.UUID("123e4567-e89b-12d3-a456-426614174000")
    db_user = db.get(User, mock_id)
    
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    data = user_data.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(db_user, key, value)

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_account(
    db: Session = Depends(get_session)
):
    """
    Logic: Permanently deletes the student's account and all associated data.
    """
    # Placeholder for current_user.id
    mock_id = uuid.UUID("123e4567-e89b-12d3-a456-426614174000")
    
    db_user = db.get(User, mock_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(db_user)
    db.commit()

    return None