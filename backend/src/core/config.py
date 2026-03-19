import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Ensure we always look for .env in the backend folder
env_path = Path(__file__).resolve().parent.parent.parent / ".env"

class Settings(BaseSettings):
    vision_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    llm: str = "meta-llama/llama-4-scout-17b-16e-instruct"  #openai/gpt-oss-120b
    #db url in .env format : DATABASE_URL=postgresql+psycopg://dbuser:db-password@db_service:5432/mydb
    DATABASE_URL: str #Pydantic should get this from .env automatically
    PINECONE_API_KEY: str
    PINECONE_INDEX_NAME: str
    GROQ_API_KEY: str

    model_config = SettingsConfigDict(
        env_file=str(env_path),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()


#crash logic for databases that do not use the psycopg3
if settings.DATABASE_URL and settings.DATABASE_URL.startswith("postgres://"):
    settings.DATABASE_URL = settings.DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif settings.DATABASE_URL and settings.DATABASE_URL.startswith("postgresql://"):
    settings.DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)