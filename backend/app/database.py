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
from sqlalchemy import create_engine, inspect, text
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
    _ensure_lot_metadata_columns()


def _ensure_lot_metadata_columns():
    """Keep older local dev databases compatible with the current Lot model."""
    inspector = inspect(engine)
    if not inspector.has_table("lots"):
        return
    columns = {col["name"] for col in inspector.get_columns("lots")}
    statements = []
    dialect = engine.dialect.name
    if "lot_key" not in columns:
        statements.append("ALTER TABLE lots ADD COLUMN lot_key VARCHAR")
    if "piece_images" not in columns:
        if dialect == "postgresql":
            statements.append("ALTER TABLE lots ADD COLUMN piece_images JSONB DEFAULT '[]'::jsonb")
        else:
            statements.append("ALTER TABLE lots ADD COLUMN piece_images JSON DEFAULT '[]'")

    if not statements:
        return
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
