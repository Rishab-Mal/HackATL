"""Database connection.

The app runs on Supabase (Postgres). The connection string lives in
backend/.env as DATABASE_URL, e.g.

    DATABASE_URL=postgresql://postgres.<ref>:<password>@<pooler-host>:6543/postgres

so no credentials are committed. If DATABASE_URL is unset we fall back to a
local SQLite file purely so the app can still boot for offline development.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# database.py can be imported before main.py loads the env, so load it here too.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./scraps.db")

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # Supabase/Postgres: pre-ping so dropped pooler connections are recycled
    # transparently instead of erroring on the next request.
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from . import models  # noqa: F401 (ensures models are registered)

    # Tables are created and owned by the Supabase migration (see the Supabase
    # project). create_all only fills in anything missing, so it is a no-op
    # against the managed schema and still works for the SQLite fallback.
    Base.metadata.create_all(bind=engine)
