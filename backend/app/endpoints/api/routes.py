import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.services.ai_gateway import get_llm
from app.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/v1", tags=["api"])


class AnalysisRequest(BaseModel):
    ticker: str
    lane: str = "FAST"


class PortfolioRequest(BaseModel):
    tickers: list[str]
    lane: str = "FAST"


class BacktestRequest(BaseModel):
    ticker: str
    period_years: int = 2
    lane: str = "FAST"


_tools = {}

def register_tools(tools: dict):
    _tools.update(tools)


@router.post("/recommend")
async def generate_live_recommendation(payload: AnalysisRequest, user: User = Depends(get_current_user)):
    ml_output = await _tools["recommend"](payload.ticker)
    summary = None
    try:
        llm = get_llm(lane=payload.lane)
        if llm:
            prompt = f"Write a professional trading summary for {payload.ticker}. Base it ONLY on this data: {ml_output}"
            response = await llm.ainvoke(prompt)
            summary = response.content
    except Exception as e:
        summary = f"LLM summary unavailable: {e}"
    return {"ticker": payload.ticker, "ml_data": ml_output, "summary": summary}


@router.post("/portfolio")
async def analyze_portfolio_api(payload: PortfolioRequest, user: User = Depends(get_current_user)):
    tickers_str = ",".join(payload.tickers)
    portfolio_output = await _tools["portfolio"](tickers_str)
    summary = None
    try:
        llm = get_llm(lane=payload.lane)
        if llm:
            prompt = f"Write a professional portfolio analysis summary. Base it ONLY on this data: {portfolio_output}"
            response = await llm.ainvoke(prompt)
            summary = response.content
    except Exception as e:
        summary = f"LLM summary unavailable: {e}"
    return {"portfolio_data": portfolio_output, "summary": summary}


@router.post("/backtest")
async def run_backtest_api(payload: BacktestRequest, user: User = Depends(get_current_user)):
    backtest_output = await _tools["backtest"](payload.ticker, payload.period_years)
    summary = None
    try:
        llm = get_llm(lane=payload.lane)
        if llm:
            prompt = f"Write a professional backtest report for {payload.ticker}. Base it ONLY on this data: {backtest_output}"
            response = await llm.ainvoke(prompt)
            summary = response.content
    except Exception as e:
        summary = f"LLM summary unavailable: {e}"
    return {"backtest_data": backtest_output, "summary": summary}
