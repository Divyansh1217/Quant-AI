# Quant AI System

A multi-agent quantitative analysis platform that combines MCP (Model Context Protocol) tools, LangGraph orchestration, and machine learning to provide institutional-grade stock analysis, portfolio insights, and strategy backtesting.

## Architecture

```
agent.py          LangGraph ReAct Agent (Groq Llama 3.3 70B)
    |
    v
main.py           FastAPI + FastMCP Server (10 tools)
    |
    +-- Statistical Engine (SMA, MACD, Bollinger, RSI, ATR, ADX, S/R)
    +-- ML Engine (18-feature Random Forest Classifier)
    +-- Portfolio Engine (Correlation, Diversification)
    +-- Backtest Engine (Strategy simulation, Sharpe, Drawdown)
    |
    v
train.py          Model Trainer (5y SPY data, GridSearchCV)
```

## Project Structure

```
quant-ai-system/
├── agent.py                          # LangGraph agent with 3 modes (analyze/portfolio/backtest)
├── main.py                           # FastAPI REST + MCP server with 10 tools
├── train.py                          # ML model trainer (18 features, hyperparameter tuning)
├── requirements.txt                  # Python dependencies
├── .env                              # GROQ_API_KEY (do not commit)
├── models/
│   └── production_random_forest.pkl  # Trained Random Forest model
└── app/
    ├── core/
    │   └── config.py
    └── services/
        └── ai_gateway.py             # LLM provider abstraction
```

## Quick Start

### 1. Create Virtual Environment

```bash
cd quant-ai-system
python -m venv venv

# Mac/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure API Key

Create a `.env` file in the project root:

```
GROQ_API_KEY="your_groq_api_key_here"
```

Get your key from [console.groq.com](https://console.groq.com).

### 4. Train the ML Model

```bash
python train.py
```

This downloads 5 years of SPY data, engineers 18 features, runs hyperparameter tuning with `GridSearchCV`, and saves the model to `models/production_random_forest.pkl`.

### 5. Launch the Agent

```bash
python agent.py
```

Select a mode when prompted:

| Mode | Description |
|------|-------------|
| `analyze` | Full 8-tool technical + ML analysis for a single stock |
| `portfolio` | Multi-ticker correlation, diversification, and rebalancing advice |
| `backtest` | Historical strategy backtest with Sharpe ratio, max drawdown, and win rate |

## MCP Tools

### Technical Analysis

| # | Tool | Description |
|---|------|-------------|
| 1 | `calculate_moving_average_crossover` | SMA 50/200 golden cross / death cross detection |
| 2 | `analyze_macd` | MACD line, signal line, histogram, crossover status |
| 3 | `analyze_bollinger_bands` | %B position, bandwidth squeeze, mean reversion signals |
| 4 | `detect_rsi_divergence` | Bullish and bearish RSI divergence detection |
| 5 | `find_support_resistance` | Classic pivot points, S/R levels, 52-week high/low |
| 6 | `analyze_volatility` | ATR, historical volatility, ADX trend strength, stop loss levels |
| 7 | `compare_sector` | Stock performance vs sector ETF vs market benchmarks |

### Machine Learning

| # | Tool | Description |
|---|------|-------------|
| 8 | `real_world_ml_recommender` | 18-feature Random Forest inference (BUY / HOLD / SELL) |
| 9 | `backtest_ml_strategy` | Strategy backtest with equity curve, Sharpe, drawdown, win rate |

### Portfolio

| # | Tool | Description |
|---|------|-------------|
| 10 | `analyze_portfolio` | Correlation matrix, diversification score, individual stock signals |

## ML Features (18)

The Random Forest model is trained on these features:

| Feature | Description |
|---------|-------------|
| `RSI_14` | 14-day Relative Strength Index |
| `RSI_7` | 7-day Relative Strength Index |
| `Price_vs_SMA50_%` | Price deviation from 50-day SMA |
| `Price_vs_SMA200_%` | Price deviation from 200-day SMA |
| `Volume_Surge` | Current volume / 20-day average volume |
| `MACD` | MACD line (12/26 EMA difference) |
| `MACD_Signal` | MACD signal line (9-day EMA of MACD) |
| `MACD_Histogram` | MACD - Signal |
| `MACD_Cross` | 1 if MACD > Signal, 0 otherwise |
| `BB_PctB` | Bollinger Bands %B (position within bands) |
| `BB_Bandwidth` | Bollinger Bands bandwidth (squeeze indicator) |
| `ATR_Pct` | ATR as % of price (volatility magnitude) |
| `ADX` | Average Directional Index (trend strength) |
| `Plus_DI` | +DI directional indicator |
| `Minus_DI` | -DI directional indicator |
| `Volatility_20` | 20-day annualized volatility |
| `Momentum_10` | 10-day price momentum |
| `Momentum_20` | 20-day price momentum |

## REST API

Start the API server:

```bash
python main.py --mode api
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/recommend` | ML recommendation + LLM-generated summary |
| `POST` | `/api/v1/portfolio` | Portfolio analysis + LLM-generated summary |
| `POST` | `/api/v1/backtest` | Backtest report + LLM-generated summary |

### Example Request

```json
POST /api/v1/recommend
{
  "ticker": "AAPL",
  "lane": "FAST"
}
```

### Example Response

```json
{
  "ticker": "AAPL",
  "ml_data": {
    "target_asset": "AAPL",
    "live_price_usd": 195.89,
    "ml_recommendation": "BUY",
    "confidence_score": 0.72
  },
  "summary": "AAPL shows bullish momentum..."
}
```

## MCP Server Mode

Start as a standalone MCP server (for integration with Claude Desktop or other MCP clients):

```bash
python main.py --mode mcp
```

The server exposes all 10 tools via the Model Context Protocol over stdio transport.

## Tech Stack

- **LLM**: Groq Llama 3.3 70B (via LangChain)
- **Agent Framework**: LangGraph ReAct Agent
- **Protocol**: MCP (Model Context Protocol) via FastMCP
- **ML**: scikit-learn Random Forest Classifier
- **Data**: Yahoo Finance (yfinance)
- **API**: FastAPI + Uvicorn
