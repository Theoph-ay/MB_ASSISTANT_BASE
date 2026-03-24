# ── NEXUS AI — Backend Dockerfile ──
FROM python:3.12-slim AS base

# System deps for psycopg (PostgreSQL) and general build
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency files first for caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
# Copy application source
COPY . .

# Set the WORKDIR to /app (since we've already moved into the backend context)
WORKDIR /app

# Expose the API port
EXPOSE 8000

# Startup: run Alembic migrations then launch Uvicorn
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn src.main:app --host 0.0.0.0 --port 8000"]
