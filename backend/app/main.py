import sys
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
import yfinance as yf
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mcp.server.fastmcp import FastMCP

from contextlib import asynccontextmanager
from app.services.ai_gateway import get_llm
from app.endpoints.api.routes import router as api_router, register_tools
from app.endpoints.api.auth import router as auth_router
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(title="Quant AI REST & MCP Engine", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
mcp = FastMCP("MarketQuantitativeMCP")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# Try loading the trained model (dict with model + features, or bare model)
try:
    MODEL_DATA = joblib.load(PROJECT_ROOT / "models" / "production_random_forest.pkl")
    if isinstance(MODEL_DATA, dict):
        REAL_RF_MODEL = MODEL_DATA["model"]
        MODEL_FEATURES = MODEL_DATA["features"]
    else:
        REAL_RF_MODEL = MODEL_DATA
        MODEL_FEATURES = ["RSI_14", "Price_vs_SMA50_%", "Volume_Surge"]
except FileNotFoundError:
    REAL_RF_MODEL = None
    MODEL_FEATURES = None


# =====================================================================
#  HELPER FUNCTIONS
# =====================================================================
def compute_rsi(series, window=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def compute_macd(series, fast=12, slow=26, signal=9):
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram

def compute_bollinger(series, window=20, num_std=2):
    sma = series.rolling(window=window).mean()
    std = series.rolling(window=window).std()
    upper = sma + num_std * std
    lower = sma - num_std * std
    pct_b = (series - lower) / (upper - lower)
    bandwidth = (upper - lower) / sma
    return sma, upper, lower, pct_b, bandwidth

def compute_atr(high, low, close, window=14):
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=window).mean()

def compute_adx(high, low, close, window=14):
    plus_dm = high.diff()
    minus_dm = -low.diff()
    plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0)
    minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0)
    atr = compute_atr(high, low, close, window)
    plus_di = 100 * (plus_dm.rolling(window=window).mean() / atr)
    minus_di = 100 * (minus_dm.rolling(window=window).mean() / atr)
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di)
    adx = dx.rolling(window=window).mean()
    return adx, plus_di, minus_di

def engineer_features_live(df):
    df = df.copy()
    df['SMA_50'] = df['Close'].rolling(window=50).mean()
    df['Price_vs_SMA50_%'] = ((df['Close'] - df['SMA_50']) / df['SMA_50']) * 100
    df['SMA_200'] = df['Close'].rolling(window=200).mean()
    df['Price_vs_SMA200_%'] = ((df['Close'] - df['SMA_200']) / df['SMA_200']) * 100
    df['RSI_14'] = compute_rsi(df['Close'], 14)
    df['RSI_7'] = compute_rsi(df['Close'], 7)
    df['Vol_SMA_20'] = df['Volume'].rolling(window=20).mean()
    df['Volume_Surge'] = df['Volume'] / df['Vol_SMA_20']
    macd_line, signal_line, histogram = compute_macd(df['Close'])
    df['MACD'] = macd_line
    df['MACD_Signal'] = signal_line
    df['MACD_Histogram'] = histogram
    df['MACD_Cross'] = (macd_line > signal_line).astype(int)
    sma_bb, upper_bb, lower_bb, pct_b, bandwidth = compute_bollinger(df['Close'])
    df['BB_PctB'] = pct_b
    df['BB_Bandwidth'] = bandwidth
    if 'High' in df.columns and 'Low' in df.columns:
        df['ATR_14'] = compute_atr(df['High'], df['Low'], df['Close'], 14)
        df['ATR_Pct'] = df['ATR_14'] / df['Close'] * 100
        adx, plus_di, minus_di = compute_adx(df['High'], df['Low'], df['Close'], 14)
        df['ADX'] = adx
        df['Plus_DI'] = plus_di
        df['Minus_DI'] = minus_di
    df['Volatility_20'] = df['Close'].pct_change().rolling(window=20).std() * np.sqrt(252)
    df['Momentum_10'] = df['Close'] / df['Close'].shift(10) - 1
    df['Momentum_20'] = df['Close'] / df['Close'].shift(20) - 1
    return df


# =====================================================================
#  TOOL 1: STATISTICAL MATH ENGINE
# =====================================================================
@mcp.tool()
async def calculate_moving_average_crossover(ticker: str) -> dict:
    """Calculates 50-day and 200-day Simple Moving Average crossovers for a stock."""
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period="1y")
        if df.empty: return {"error": "No data"}

        current_price = float(df['Close'].iloc[-1])
        sma_50 = float(df['Close'].rolling(window=50).mean().iloc[-1])
        sma_200 = float(df['Close'].rolling(window=200).mean().iloc[-1])

        signal = "BULLISH (Golden Cross)" if sma_50 > sma_200 else "BEARISH (Death Cross)"
        return {"ticker": ticker, "current_price": current_price, "sma_50": sma_50, "sma_200": sma_200, "signal": signal}
    except Exception as e:
        return {"error": str(e)}


# =====================================================================
#  TOOL 2: MACHINE LEARNING RECOMMENDER (18 features)
# =====================================================================
@mcp.tool()
async def real_world_ml_recommender(ticker: str) -> dict:
    """Fetches LIVE market data, engineers 18 features, and runs ML inference."""
    if not REAL_RF_MODEL:
        return {"error": "Production model .pkl not found. Run train.py first."}

    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period="200d")
        if df.empty: return {"error": "No data found."}

        df = engineer_features_live(df)
        latest = df.iloc[-1]

        current_price = float(latest['Close'])

        feature_values = []
        feature_dict = {}
        for feat in MODEL_FEATURES:
            val = latest[feat]
            if pd.isna(val):
                val = 0.0
            feature_values.append(float(val))
            feature_dict[feat] = round(float(val), 4)

        features = pd.DataFrame([feature_values], columns=MODEL_FEATURES)
        probs = REAL_RF_MODEL.predict_proba(features)[0]
        prediction_index = REAL_RF_MODEL.predict(features)[0]
        classes = ["SELL", "HOLD", "BUY"]

        return {
            "target_asset": ticker.upper(),
            "live_price_usd": round(current_price, 2),
            "features": feature_dict,
            "ml_recommendation": classes[prediction_index],
            "confidence_score": round(float(probs[prediction_index]), 4),
            "probability_matrix": {"SELL": round(float(probs[0]),3), "HOLD": round(float(probs[1]),3), "BUY": round(float(probs[2]),3)}
        }
    except Exception as e:
        return {"error": str(e)}


# =====================================================================
#  TOOL 3: MACD ANALYSIS
# =====================================================================
@mcp.tool()
async def analyze_macd(ticker: str) -> dict:
    """Analyzes MACD (12/26/9) for a stock: signal line crossover, histogram trend, momentum."""
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period="6mo")
        if df.empty: return {"error": "No data"}

        macd_line, signal_line, histogram = compute_macd(df['Close'])
        latest_macd = float(macd_line.iloc[-1])
        latest_signal = float(signal_line.iloc[-1])
        latest_hist = float(histogram.iloc[-1])
        prev_hist = float(histogram.iloc[-2])

        if latest_macd > latest_signal and prev_hist <= 0:
            crossover = "BULLISH CROSS (MACD just crossed above signal)"
        elif latest_macd < latest_signal and prev_hist >= 0:
            crossover = "BEARISH CROSS (MACD just crossed below signal)"
        elif latest_macd > latest_signal:
            crossover = "BULLISH (above signal)"
        else:
            crossover = "BEARISH (below signal)"

        hist_trending = "EXPANDING" if abs(latest_hist) > abs(prev_hist) else "CONTRACTING"

        return {
            "ticker": ticker.upper(),
            "macd_line": round(latest_macd, 4),
            "signal_line": round(latest_signal, 4),
            "histogram": round(latest_hist, 4),
            "crossover_status": crossover,
            "histogram_trend": hist_trending
        }
    except Exception as e:
        return {"error": str(e)}


# =====================================================================
#  TOOL 4: BOLLINGER BANDS ANALYSIS
# =====================================================================
@mcp.tool()
async def analyze_bollinger_bands(ticker: str) -> dict:
    """Analyzes Bollinger Bands (20/2): %B position, bandwidth squeeze, mean reversion signals."""
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period="6mo")
        if df.empty: return {"error": "No data"}

        sma, upper, lower, pct_b, bandwidth = compute_bollinger(df['Close'])
        latest_price = float(df['Close'].iloc[-1])
        latest_upper = float(upper.iloc[-1])
        latest_lower = float(lower.iloc[-1])
        latest_mid = float(sma.iloc[-1])
        latest_pct_b = float(pct_b.iloc[-1])
        latest_bw = float(bandwidth.iloc[-1])
        avg_bw = float(bandwidth.rolling(50).mean().iloc[-1])

        if latest_pct_b > 1.0:
            position = "ABOVE UPPER BAND (overbought)"
        elif latest_pct_b < 0.0:
            position = "BELOW LOWER BAND (oversold)"
        elif latest_pct_b > 0.8:
            position = "NEAR UPPER BAND"
        elif latest_pct_b < 0.2:
            position = "NEAR LOWER BAND"
        else:
            position = "WITHIN BANDS"

        squeeze = "SQUEEZE (low volatility, breakout imminent)" if latest_bw < avg_bw * 0.75 else "NORMAL"

        return {
            "ticker": ticker.upper(),
            "current_price": round(latest_price, 2),
            "upper_band": round(latest_upper, 2),
            "middle_band": round(latest_mid, 2),
            "lower_band": round(latest_lower, 2),
            "percent_b": round(latest_pct_b, 4),
            "bandwidth": round(latest_bw, 4),
            "position": position,
            "squeeze_status": squeeze
        }
    except Exception as e:
        return {"error": str(e)}


# =====================================================================
#  TOOL 5: RSI DIVERGENCE DETECTOR
# =====================================================================
@mcp.tool()
async def detect_rsi_divergence(ticker: str) -> dict:
    """Detects bullish and bearish RSI divergences by comparing price action vs RSI over recent highs/lows."""
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period="6mo")
        if df.empty or len(df) < 30: return {"error": "Insufficient data"}

        rsi = compute_rsi(df['Close'], 14)

        # Find recent swing lows and highs (simple approach using rolling min/max)
        lookback = 20
        price_lows = df['Close'].rolling(lookback).min().dropna()
        price_highs = df['Close'].rolling(lookback).max().dropna()
        rsi_lows = rsi.rolling(lookback).min().dropna()
        rsi_highs = rsi.rolling(lookback).max().dropna()

        # Check last 60 days
        recent = 60
        p = df['Close'].iloc[-recent:]
        r = rsi.iloc[-recent:]

        # Simplified divergence: compare last two swing lows and swing highs
        p_low_idx = p.idxmin()
        r_at_p_low = float(r.loc[p_low_idx]) if p_low_idx in r.index else None

        # Check price making lower low but RSI making higher low (bullish divergence)
        prev_half = p.iloc[:len(p)//2]
        prev_r = r.iloc[:len(r)//2]
        if len(prev_half) > 0 and len(prev_r) > 0:
            prev_low_price = float(prev_half.min())
            curr_low_price = float(p.iloc[len(p)//2:].min())
            prev_low_rsi = float(prev_r.min())
            curr_low_rsi = float(r.iloc[len(r)//2:].min())

            if curr_low_price < prev_low_price and curr_low_rsi > prev_low_rsi:
                bullish_div = "BULLISH DIVERGENCE DETECTED (price lower low, RSI higher low)"
            else:
                bullish_div = "None detected"

            prev_high_price = float(prev_half.max())
            curr_high_price = float(p.iloc[len(p)//2:].max())
            prev_high_rsi = float(prev_r.max())
            curr_high_rsi = float(r.iloc[len(r)//2:].max())

            if curr_high_price > prev_high_price and curr_high_rsi < prev_high_rsi:
                bearish_div = "BEARISH DIVERGENCE DETECTED (price higher high, RSI lower high)"
            else:
                bearish_div = "None detected"
        else:
            bullish_div = "Insufficient data"
            bearish_div = "Insufficient data"

        current_rsi = float(rsi.iloc[-1])

        return {
            "ticker": ticker.upper(),
            "current_rsi_14": round(current_rsi, 2),
            "rsi_zone": "OVERBOUGHT (>70)" if current_rsi > 70 else ("OVERSOLD (<30)" if current_rsi < 30 else "NEUTRAL"),
            "bullish_divergence": bullish_div,
            "bearish_divergence": bearish_div
        }
    except Exception as e:
        return {"error": str(e)}


# =====================================================================
#  TOOL 6: SUPPORT & RESISTANCE LEVELS
# =====================================================================
@mcp.tool()
async def find_support_resistance(ticker: str) -> dict:
    """Identifies key support and resistance levels using pivot points and volume profile."""
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period="6mo")
        if df.empty: return {"error": "No data"}

        current_price = float(df['Close'].iloc[-1])

        # Pivot points (classic method)
        recent_30 = df.tail(30)
        high_30 = float(recent_30['High'].max())
        low_30 = float(recent_30['Low'].min())
        close_30 = float(recent_30['Close'].iloc[-1])
        pivot = (high_30 + low_30 + close_30) / 3
        r1 = 2 * pivot - low_30
        s1 = 2 * pivot - high_30
        r2 = pivot + (high_30 - low_30)
        s2 = pivot - (high_30 - low_30)
        r3 = high_30 + 2 * (pivot - low_30)
        s3 = low_30 - 2 * (high_30 - pivot)

        # Price-based levels: 52-week high/low, recent swing points
        year_data = df.tail(252) if len(df) >= 252 else df
        high_52w = float(year_data['High'].max())
        low_52w = float(year_data['Low'].min())

        return {
            "ticker": ticker.upper(),
            "current_price": round(current_price, 2),
            "pivot_point": round(pivot, 2),
            "resistance": {"R1": round(r1, 2), "R2": round(r2, 2), "R3": round(r3, 2)},
            "support": {"S1": round(s1, 2), "S2": round(s2, 2), "S3": round(s3, 2)},
            "52_week_high": round(high_52w, 2),
            "52_week_low": round(low_52w, 2),
            "distance_to_resistance_%": round(((r1 - current_price) / current_price) * 100, 2),
            "distance_to_support_%": round(((current_price - s1) / current_price) * 100, 2)
        }
    except Exception as e:
        return {"error": str(e)}


# =====================================================================
#  TOOL 7: ATR VOLATILITY ANALYSIS
# =====================================================================
@mcp.tool()
async def analyze_volatility(ticker: str) -> dict:
    """Analyzes volatility using ATR, historical volatility, and ADX trend strength."""
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period="6mo")
        if df.empty: return {"error": "No data"}

        current_price = float(df['Close'].iloc[-1])

        # ATR
        atr_14 = compute_atr(df['High'], df['Low'], df['Close'], 14)
        latest_atr = float(atr_14.iloc[-1])
        atr_pct = (latest_atr / current_price) * 100

        # Historical volatility (20-day)
        hv_20 = float(df['Close'].pct_change().rolling(20).std().iloc[-1]) * np.sqrt(252) * 100

        # ADX
        adx, plus_di, minus_di = compute_adx(df['High'], df['Low'], df['Close'], 14)
        latest_adx = float(adx.iloc[-1])
        latest_plus = float(plus_di.iloc[-1])
        latest_minus = float(minus_di.iloc[-1])

        if latest_adx > 40:
            trend_strength = "STRONG TREND"
        elif latest_adx > 25:
            trend_strength = "MODERATE TREND"
        elif latest_adx > 20:
            trend_strength = "WEAK TREND"
        else:
            trend_strength = "NO TREND (ranging)"

        trend_direction = "BULLISH" if latest_plus > latest_minus else "BEARISH"

        # ATR-based stop loss suggestions
        atr_stop_long = current_price - 2 * latest_atr
        atr_stop_short = current_price + 2 * latest_atr

        return {
            "ticker": ticker.upper(),
            "current_price": round(current_price, 2),
            "atr_14": round(latest_atr, 2),
            "atr_pct": round(atr_pct, 2),
            "historical_volatility_20d": round(hv_20, 2),
            "adx": round(latest_adx, 2),
            "plus_di": round(latest_plus, 2),
            "minus_di": round(latest_minus, 2),
            "trend_strength": trend_strength,
            "trend_direction": trend_direction,
            "suggested_stop_loss_long": round(atr_stop_long, 2),
            "suggested_stop_loss_short": round(atr_stop_short, 2)
        }
    except Exception as e:
        return {"error": str(e)}


# =====================================================================
#  TOOL 8: SECTOR COMPARISON
# =====================================================================
@mcp.tool()
async def compare_sector(ticker: str) -> dict:
    """Compares a stock's technicals against sector ETFs and benchmarks."""
    SECTOR_MAP = {
        "XLK": "Technology", "XLV": "Healthcare", "XLF": "Financials",
        "XLE": "Energy", "XLI": "Industrials", "XLY": "Consumer Disc.",
        "XLP": "Consumer Staples", "XLU": "Utilities", "XLRE": "Real Estate",
        "XLB": "Materials", "XLC": "Communications"
    }
    BENCHMARKS = {"SPY": "S&P 500", "QQQ": "Nasdaq 100", "DIA": "Dow Jones"}

    try:
        stock = yf.Ticker(ticker)
        stock_info = stock.info
        stock_sector = stock_info.get("sector", None)

        sector_etf = None
        for etf, sector in SECTOR_MAP.items():
            if stock_sector and stock_sector.lower() in sector.lower():
                sector_etf = etf
                break

        comparison_tickers = list(BENCHMARKS.keys())
        if sector_etf:
            comparison_tickers.append(sector_etf)

        results = {}
        for comp in comparison_tickers:
            df = yf.Ticker(comp).history(period="1mo")
            if not df.empty and len(df) >= 2:
                ret_1m = float((df['Close'].iloc[-1] / df['Close'].iloc[0] - 1) * 100)
                sma_20 = df['Close'].rolling(20).mean().iloc[-1] if len(df) >= 20 else df['Close'].mean()
                pct_vs_sma = float((df['Close'].iloc[-1] / sma_20 - 1) * 100)
                results[comp] = {"name": BENCHMARKS.get(comp, SECTOR_MAP.get(comp, comp)), "1mo_return_%": round(ret_1m, 2), "vs_sma20_%": round(pct_vs_sma, 2)}

        stock_df = stock.history(period="1mo")
        stock_1m = float((stock_df['Close'].iloc[-1] / stock_df['Close'].iloc[0] - 1) * 100) if not stock_df.empty else 0

        return {
            "ticker": ticker.upper(),
            "sector": stock_sector or "Unknown",
            "stock_1mo_return_%": round(stock_1m, 2),
            "benchmarks": results
        }
    except Exception as e:
        return {"error": str(e)}


# =====================================================================
#  TOOL 9: PORTFOLIO ANALYZER
# =====================================================================
@mcp.tool()
async def analyze_portfolio(tickers: str) -> dict:
    """Analyzes a portfolio of tickers (comma-separated): correlation matrix, diversification, combined signals."""
    try:
        ticker_list = [t.strip().upper() for t in tickers.split(",")]
        if len(ticker_list) < 2:
            return {"error": "Provide at least 2 tickers separated by commas"}

        price_data = {}
        for t in ticker_list:
            df = yf.Ticker(t).history(period="6mo")
            if not df.empty:
                price_data[t] = df['Close']

        if len(price_data) < 2:
            return {"error": "Could not fetch data for enough tickers"}

        prices = pd.DataFrame(price_data).dropna()
        returns = prices.pct_change().dropna()

        # Correlation matrix
        corr_matrix = returns.corr()

        # Average pairwise correlation (diversification metric)
        pairs = []
        for i in range(len(ticker_list)):
            for j in range(i+1, len(ticker_list)):
                if ticker_list[i] in corr_matrix.columns and ticker_list[j] in corr_matrix.columns:
                    pairs.append(float(corr_matrix.loc[ticker_list[i], ticker_list[j]]))
        avg_corr = np.mean(pairs) if pairs else 0

        if avg_corr < 0.3:
            div_score = "WELL DIVERSIFIED"
        elif avg_corr < 0.6:
            div_score = "MODERATELY DIVERSIFIED"
        else:
            div_score = "POORLY DIVERSIFIED (high overlap)"

        # Individual signals
        signals = {}
        for t in ticker_list:
            df = yf.Ticker(t).history(period="200d")
            if df.empty: continue
            df_feat = engineer_features_live(df)
            latest = df_feat.iloc[-1]
            rsi = float(latest['RSI_14']) if not pd.isna(latest['RSI_14']) else 50
            sma50 = float(latest['Price_vs_SMA50_%']) if not pd.isna(latest['Price_vs_SMA50_%']) else 0
            signals[t] = {
                "price": round(float(df['Close'].iloc[-1]), 2),
                "rsi_14": round(rsi, 2),
                "price_vs_sma50_%": round(sma50, 2),
                "1mo_return_%": round(float((df['Close'].iloc[-1] / df['Close'].iloc[-21] - 1) * 100) if len(df) > 21 else 0, 2)
            }

        return {
            "tickers": ticker_list,
            "num_assets": len(ticker_list),
            "diversification_score": div_score,
            "average_correlation": round(avg_corr, 4),
            "correlation_matrix": {t: {t2: round(float(corr_matrix.loc[t, t2]), 4) for t2 in ticker_list if t2 in corr_matrix.columns} for t in ticker_list if t in corr_matrix.index},
            "individual_signals": signals
        }
    except Exception as e:
        return {"error": str(e)}


# =====================================================================
#  TOOL 10: BACKTESTER
# =====================================================================
@mcp.tool()
async def backtest_ml_strategy(ticker: str, period_years: int = 2) -> dict:
    """Backtests the ML Random Forest strategy on historical data, computing returns, Sharpe ratio, and max drawdown."""
    if not REAL_RF_MODEL:
        return {"error": "Model not found. Run train.py first."}

    try:
        period = f"{period_years}y"
        stock = yf.Ticker(ticker)
        df = stock.history(period=period)
        if df.empty or len(df) < 200:
            return {"error": "Insufficient data for backtest"}

        df = engineer_features_live(df)
        df = df.dropna(subset=MODEL_FEATURES)

        if len(df) < 50:
            return {"error": "Not enough feature-complete rows"}

        feature_values = []
        for _, row in df[MODEL_FEATURES].iterrows():
            feature_values.append([float(v) if not pd.isna(v) else 0.0 for v in row])

        X = np.array(feature_values)
        predictions = REAL_RF_MODEL.predict(X)

        # Simulate strategy
        initial_capital = 10000.0
        capital = initial_capital
        position = 0  # 0 = no position, 1 = long
        shares = 0
        entry_price = 0

        trades = []
        equity_curve = [initial_capital]

        for i in range(len(df)):
            price = float(df['Close'].iloc[i])
            signal = predictions[i]  # 0=SELL, 1=HOLD, 2=BUY

            if signal == 2 and position == 0:  # BUY signal
                shares = int(capital / price)
                if shares > 0:
                    entry_price = price
                    capital -= shares * price
                    position = 1
                    trades.append({"type": "BUY", "price": round(price, 2), "date": str(df.index[i].date())})

            elif signal == 0 and position == 1:  # SELL signal
                if shares > 0:
                    pnl = (price - entry_price) * shares
                    capital += shares * price
                    trades.append({"type": "SELL", "price": round(price, 2), "pnl": round(pnl, 2), "date": str(df.index[i].date())})
                    shares = 0
                    position = 0

            portfolio_value = capital + shares * price
            equity_curve.append(portfolio_value)

        # Final close
        if position == 1 and shares > 0:
            final_price = float(df['Close'].iloc[-1])
            capital += shares * final_price
            pnl = (final_price - entry_price) * shares
            trades.append({"type": "SELL (FINAL)", "price": round(final_price, 2), "pnl": round(pnl, 2)})
            shares = 0

        # Performance metrics
        final_capital = capital
        total_return = ((final_capital - initial_capital) / initial_capital) * 100

        equity_series = pd.Series(equity_curve)
        daily_returns = equity_series.pct_change().dropna()
        sharpe_ratio = float((daily_returns.mean() / daily_returns.std()) * np.sqrt(252)) if daily_returns.std() > 0 else 0

        rolling_max = equity_series.cummax()
        drawdowns = (equity_series - rolling_max) / rolling_max
        max_drawdown = float(drawdowns.min()) * 100

        buy_hold_return = ((float(df['Close'].iloc[-1]) / float(df['Close'].iloc[0])) - 1) * 100

        num_trades = len([t for t in trades if t['type'] == "SELL" or t['type'] == "SELL (FINAL)"])
        winning_trades = len([t for t in trades if t['type'] in ("SELL", "SELL (FINAL)") and t.get('pnl', 0) > 0])
        win_rate = (winning_trades / num_trades * 100) if num_trades > 0 else 0

        return {
            "ticker": ticker.upper(),
            "period_years": period_years,
            "initial_capital": initial_capital,
            "final_capital": round(final_capital, 2),
            "total_return_%": round(total_return, 2),
            "buy_hold_return_%": round(buy_hold_return, 2),
            "sharpe_ratio": round(sharpe_ratio, 3),
            "max_drawdown_%": round(max_drawdown, 2),
            "total_trades": num_trades,
            "win_rate_%": round(win_rate, 1),
            "trades": trades[-20:]  # last 20 trades
        }
    except Exception as e:
        return {"error": str(e)}


# =====================================================================
#  INCLUDE API ROUTERS & REGISTER TOOLS
# =====================================================================
app.include_router(auth_router)
app.include_router(api_router)

register_tools({
    "recommend": real_world_ml_recommender,
    "portfolio": analyze_portfolio,
    "backtest": backtest_ml_strategy,
})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", type=str, choices=["api", "mcp"], default="api")
    args = parser.parse_args()

    if args.mode == "mcp":
        mcp.run(transport="stdio")
    else:
        import uvicorn
        uvicorn.run("app.main:app", host="0.0.0.0", port=8350)
