import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.user import User
from app.models.watchlist import Watchlist
from app.models.history import AnalysisHistory
from app.schemas.auth import UserCreate, UserLogin, UserResponse, Token, WatchlistItem, WatchlistResponse, HistoryResponse
from app.security import hash_password, verify_password, create_access_token
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(User).where((User.email == payload.email) | (User.username == payload.username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email or username already taken")

    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": user.id, "email": user.email})
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=Token)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token({"sub": user.id, "email": user.email})
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


@router.get("/watchlist", response_model=list[WatchlistResponse])
async def get_watchlist(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Watchlist).where(Watchlist.user_id == user.id).order_by(Watchlist.created_at.desc()))
    return [WatchlistResponse.model_validate(w) for w in result.scalars().all()]


@router.post("/watchlist", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(payload: WatchlistItem, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    item = Watchlist(user_id=user.id, ticker=payload.ticker.upper(), label=payload.label)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return WatchlistResponse.model_validate(item)


@router.delete("/watchlist/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(item_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Watchlist).where(Watchlist.id == item_id, Watchlist.user_id == user.id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    await db.delete(item)
    await db.commit()


@router.post("/history", status_code=status.HTTP_201_CREATED)
async def save_history(payload: dict, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    entry = AnalysisHistory(
        user_id=user.id,
        ticker=payload.get("ticker", ""),
        analysis_type=payload.get("analysis_type", "recommend"),
        result=json.dumps(payload.get("result", {})),
    )
    db.add(entry)
    await db.commit()
    return {"status": "saved"}


@router.get("/history", response_model=list[HistoryResponse])
async def get_history(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AnalysisHistory).where(AnalysisHistory.user_id == user.id).order_by(AnalysisHistory.created_at.desc()).limit(50)
    )
    return [HistoryResponse.model_validate(h) for h in result.scalars().all()]
