"""Initial schema — users and chats tables.

Revision ID: 001
Revises: None
Create Date: 2026-03-19
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import sqlmodel

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=False),
        sa.Column("full_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("username", sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
        sa.Column("hashed_password", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.Column("profile_image", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False, server_default="default_med.jpg"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("username"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "chats",
        sa.Column("thread_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False, server_default="New Consultation"),
        sa.Column("messages", sa.JSON(), nullable=True),
        sa.Column("summary", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("thread_id"),
    )
    op.create_index(op.f("ix_chats_thread_id"), "chats", ["thread_id"], unique=False)
    op.create_index(op.f("ix_chats_user_id"), "chats", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_chats_user_id"), table_name="chats")
    op.drop_index(op.f("ix_chats_thread_id"), table_name="chats")
    op.drop_table("chats")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")
