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
    _ensure_scan_run_columns()
    _ensure_user_location_columns()


def _ensure_user_location_columns():
    """Add the buyer location columns to older databases (and the managed
    Supabase users table) without a separate migration step."""
    inspector = inspect(engine)
    if not inspector.has_table("users"):
        return
    columns = {col["name"] for col in inspector.get_columns("users")}
    statements = []
    if "lat" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN lat FLOAT")
    if "lng" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN lng FLOAT")
    if not statements:
        return
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))


def _ensure_lot_metadata_columns():
    """Keep older local dev databases compatible with the current Lot model."""
    inspector = inspect(engine)
    if not inspector.has_table("lots"):
        return
    columns = {col["name"] for col in inspector.get_columns("lots")}
    statements = []
    dialect = engine.dialect.name
    has_scan_runs = inspector.has_table("scan_runs")
    if "lot_key" not in columns:
        statements.append("ALTER TABLE lots ADD COLUMN lot_key VARCHAR")
    if "scan_run_id" not in columns:
        if dialect == "postgresql" and has_scan_runs:
            statements.append("ALTER TABLE lots ADD COLUMN scan_run_id INTEGER REFERENCES scan_runs(id) ON DELETE SET NULL")
        else:
            statements.append("ALTER TABLE lots ADD COLUMN scan_run_id INTEGER")
    if "piece_images" not in columns:
        if dialect == "postgresql":
            statements.append("ALTER TABLE lots ADD COLUMN piece_images JSONB DEFAULT '[]'::jsonb")
        else:
            statements.append("ALTER TABLE lots ADD COLUMN piece_images JSON DEFAULT '[]'")
    if "origin_lat" not in columns:
        statements.append("ALTER TABLE lots ADD COLUMN origin_lat FLOAT")
    if "origin_lng" not in columns:
        statements.append("ALTER TABLE lots ADD COLUMN origin_lng FLOAT")

    if not statements:
        return
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))


def _ensure_scan_run_columns():
    """Keep local SQLite/Postgres dev databases compatible with ScanRun."""
    inspector = inspect(engine)
    if not inspector.has_table("scan_runs"):
        return
    columns = {col["name"] for col in inspector.get_columns("scan_runs")}
    dialect = engine.dialect.name
    statements = []
    expected = {
        "annotated_image_data_url": "TEXT",
        "image_width": "INTEGER DEFAULT 0",
        "image_height": "INTEGER DEFAULT 0",
        "piece_count": "INTEGER DEFAULT 0",
        "group_count": "INTEGER DEFAULT 0",
        "total_weight_kg": "FLOAT DEFAULT 0",
        "total_carbon_saved_kg": "FLOAT DEFAULT 0",
        "total_water_saved_l": "FLOAT DEFAULT 0",
        "created_at": "TIMESTAMP",
    }
    for name, sql_type in expected.items():
        if name not in columns:
            statements.append(f"ALTER TABLE scan_runs ADD COLUMN {name} {sql_type}")
    if "summary" not in columns:
        if dialect == "postgresql":
            statements.append("ALTER TABLE scan_runs ADD COLUMN summary JSONB DEFAULT '{}'::jsonb")
        else:
            statements.append("ALTER TABLE scan_runs ADD COLUMN summary JSON DEFAULT '{}'")

    if not statements:
        return
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
