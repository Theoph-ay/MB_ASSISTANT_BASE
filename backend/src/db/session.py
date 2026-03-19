import sqlmodel
from sqlmodel import Session, SQLModel

from src.core.config import settings

engine = sqlmodel.create_engine(settings.DATABASE_URL)

#init db
def init_db():
    print("creating database tables")
    SQLModel.metadata.create_all(engine)

#get db sessions
def get_session():
    with Session(engine) as session:
        yield session