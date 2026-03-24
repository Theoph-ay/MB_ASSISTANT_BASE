"""Add created_at to users

Revision ID: 002
Revises: 001
Create Date: 2026-03-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add created_at column with a server default for existing/new rows
    op.add_column('users', sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')))
    
    # Ensure full_name is indexed (as requested by autogenerate)
    op.create_index(op.f('ix_users_full_name'), 'users', ['full_name'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_full_name'), table_name='users')
    op.drop_column('users', 'created_at')
