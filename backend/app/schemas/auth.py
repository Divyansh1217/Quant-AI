from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class WatchlistItem(BaseModel):
    ticker: str
    label: str = "My Watchlist"


class WatchlistResponse(BaseModel):
    id: str
    ticker: str
    label: str
    created_at: datetime

    model_config = {"from_attributes": True}


class HistoryResponse(BaseModel):
    id: str
    ticker: str
    analysis_type: str
    result: str
    created_at: datetime

    model_config = {"from_attributes": True}
