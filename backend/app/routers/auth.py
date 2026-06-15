"""Auth endpoints — login and current-user lookup."""

import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
import hashlib

from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = os.getenv("SECRET_KEY", "reweave-dev-secret-do-not-use-in-prod")
ALGORITHM = "HS256"
EXPIRE_HOURS = 8

bearer = HTTPBearer(auto_error=False)


def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _verify(password: str, hashed: str) -> bool:
    return _hash(password) == hashed


# ---------------------------------------------------------------------------
# Schemas (local — no need to pollute the shared schemas.py)
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    name: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_token(user: models.User) -> str:
    expire = datetime.utcnow() + timedelta(hours=EXPIRE_HOURS)
    return jwt.encode(
        {"sub": str(user.id), "role": user.role, "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> models.User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not _verify(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return TokenResponse(
        access_token=_create_token(user),
        role=user.role,
        name=user.name,
    )


@router.get("/me", response_model=UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        name=current_user.name,
    )
