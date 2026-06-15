import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

from .database import SessionLocal, init_db
from .routers import factory, lots, marketplace, vision
from .routers import chat, auth, admin, destinations
from .seed import seed_data

app = FastAPI(title="Scrap Sorter API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vision.router)
app.include_router(factory.router)
app.include_router(lots.router)
app.include_router(marketplace.router)
app.include_router(marketplace.impact_router)
app.include_router(chat.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(destinations.router)


@app.on_event("startup")
def on_startup():
    init_db()
    db = SessionLocal()
    try:
        seed_data(db)
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}
