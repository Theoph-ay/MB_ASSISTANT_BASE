"""Alembic environment configuration.

Reads the DATABASE_URL from the application's Settings and uses
SQLModel's metadata as the target for auto-generation.
"""

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# ── App imports ──
from src.core.config import settings

# Import ALL models so SQLModel registers them on the metadata
from src.models.user import User  # noqa: F401
from src.models.chat import Chat  # noqa: F401

from sqlmodel import SQLModel

# Alembic Config object
config = context.config

# Set the DB URL programmatically from our Settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — generates SQL without connecting."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode — connects to the database."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
