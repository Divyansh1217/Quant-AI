# Quant AI Backend

A full-stack quantitative analysis platform combining MCP tools, LangGraph orchestration, machine learning, and user authentication to provide institutional-grade stock analysis, portfolio insights, and strategy backtesting.

## Architecture

```
Frontend (React + Vite :5173)
    |
    v
FastAPI REST API (:8351)
    |
    +-- Auth (JWT + bcrypt, Supabase PostgreSQL)
    +-- Statistical Engine (SMA, MACD, Bollinger, RSI, ATR, ADX, S/R)
    +-- ML Engine (18-feature Random Forest Classifier)
    +-- Portfolio Engine (Correlation, Diversification)
    +-- Backtest Engine (Strategy simulation, Sharpe, Drawdown)
    +-- LLM Summaries (Groq Llama 3.1/3.3)
    |
    v
FastMCP Server (10 tools, stdio transport)
```

## Project Structure

```
backend/
├── .env                              # Secrets (GROQ_API_KEY, DATABASE_URL, JWT_SECRET)
├── .gitignore
├── requirements.txt
├── models/
│   └── production_random_forest.pkl  # Trained Random Forest model
│   └── spy_data_cache.csv           # Cached Yahoo Finance data
└── app/
    ├── __init__.py
    ├── main.py                       # FastAPI app, 10 MCP tools, lifespan, uvicorn
    ├── agent.py                      # LangGraph ReAct agent (3 modes)
    ├── train.py                      # ML model trainer with MLflow tracking
    ├── security.py                   # bcrypt hashing, JWT create/decode
    ├── deps.py                       # get_current_user dependency
    ├── core/
    │   ├── config.py                 # Settings (env vars)
    │   └── database.py               # Async SQLAlchemy engine + session
    ├── models/
    │   ├── user.py                   # User ORM model
    │   ├── watchlist.py              # Watchlist ORM model
    │   └── history.py                # AnalysisHistory ORM model
    ├── schemas/
    │   └── auth.py                   # Pydantic request/response schemas
    ├── services/
    │   └── ai_gateway.py             # LLM provider abstraction (Groq)
    └── endpoints/
        └── api/
            ├── auth.py               # Auth routes (register, login, me, watchlist, history)
            └── routes.py             # Protected API routes (recommend, portfolio, backtest)
```

## Quick Start

### 1. Install Dependencies

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` or create `.env`:

```
GROQ_API_KEY="your_groq_api_key"
DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/postgres"
JWT_SECRET="your-secret-key-change-this"
JWT_ALGORITHM="HS256"
JWT_EXPIRE_MINUTES=1440
```

- **GROQ_API_KEY**: Get from [console.groq.com](https://console.groq.com)
- **DATABASE_URL**: Supabase or any PostgreSQL instance (URL-encode special characters in password)
- **JWT_SECRET**: Any random string for signing tokens

### 3. Train the ML Model (optional)

```bash
python -m app.train
```

Downloads 5 years of SPY data, engineers 18 features, runs GridSearchCV, logs to MLflow, saves to `models/production_random_forest.pkl`.

### 4. Launch the Server

```bash
python -m app.main
```

Starts on `http://localhost:8351`. Tables are auto-created on first startup.

## REST API

### Authentication

All analysis endpoints require a JWT token in the `Authorization` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Create account (returns JWT) |
| `POST` | `/auth/login` | Sign in (returns JWT) |
| `GET` | `/auth/me` | Get current user |
| `GET` | `/auth/watchlist` | Get user watchlist |
| `POST` | `/auth/watchlist` | Add ticker to watchlist |
| `DELETE` | `/auth/watchlist/{id}` | Remove from watchlist |
| `POST` | `/auth/history` | Save analysis to history |
| `GET` | `/auth/history` | Get analysis history (last 50) |

### Analysis (requires auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/recommend` | ML recommendation + LLM summary |
| `POST` | `/api/v1/portfolio` | Portfolio analysis + LLM summary |
| `POST` | `/api/v1/backtest` | Backtest report + LLM summary |

### Example

```bash
# Register
curl -X POST http://localhost:8351/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","username":"trader","password":"secret123"}'

# Use the returned token
TOKEN="eyJ..."

# Get recommendation
curl -X POST http://localhost:8351/api/v1/recommend \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ticker":"AAPL"}'
```

## MCP Server Mode

Start as a standalone MCP server (for Claude Desktop or other MCP clients):

```bash
python -m app.main --mode mcp
```

Exposes all 10 tools via the Model Context Protocol over stdio transport.

## MCP Tools

### Technical Analysis (7)

| # | Tool | Description |
|---|------|-------------|
| 1 | `calculate_moving_average_crossover` | SMA 50/200 golden cross / death cross |
| 2 | `analyze_macd` | MACD line, signal, histogram, crossover |
| 3 | `analyze_bollinger_bands` | %B position, bandwidth squeeze |
| 4 | `detect_rsi_divergence` | Bullish/bearish RSI divergence |
| 5 | `find_support_resistance` | Pivot points, S/R levels, 52-week range |
| 6 | `analyze_volatility` | ATR, ADX, historical volatility, stop loss |
| 7 | `compare_sector` | Stock vs sector ETF vs benchmarks |

### ML & Portfolio (3)

| # | Tool | Description |
|---|------|-------------|
| 8 | `real_world_ml_recommender` | 18-feature Random Forest (BUY/HOLD/SELL) |
| 9 | `backtest_ml_strategy` | Strategy backtest with equity curve |
| 10 | `analyze_portfolio` | Correlation matrix, diversification score |

## ML Features (18)

| Feature | Description |
|---------|-------------|
| `RSI_14` | 14-day Relative Strength Index |
| `RSI_7` | 7-day Relative Strength Index |
| `Price_vs_SMA50_%` | Price deviation from 50-day SMA |
| `Price_vs_SMA200_%` | Price deviation from 200-day SMA |
| `Volume_Surge` | Current volume / 20-day average |
| `MACD` | MACD line (12/26 EMA) |
| `MACD_Signal` | Signal line (9-day EMA of MACD) |
| `MACD_Histogram` | MACD - Signal |
| `MACD_Cross` | 1 if MACD > Signal, 0 otherwise |
| `BB_PctB` | Bollinger Bands %B |
| `BB_Bandwidth` | Bollinger Bands bandwidth |
| `ATR_Pct` | ATR as % of price |
| `ADX` | Average Directional Index |
| `Plus_DI` | +DI directional indicator |
| `Minus_DI` | -DI directional indicator |
| `Volatility_20` | 20-day annualized volatility |
| `Momentum_10` | 10-day price momentum |
| `Momentum_20` | 20-day price momentum |

## Database Schema

### Supabase PostgreSQL (async via SQLAlchemy + asyncpg)

**users**
- `id` (UUID, PK)
- `email` (unique, indexed)
- `username` (unique, indexed)
- `hashed_password` (bcrypt)
- `created_at` (timestamptz)

**watchlists**
- `id` (UUID, PK)
- `user_id` (FK → users, cascade delete)
- `ticker` (varchar)
- `label` (varchar)
- `created_at` (timestamptz)

**analysis_history**
- `id` (UUID, PK)
- `user_id` (FK → users, cascade delete)
- `ticker` (varchar)
- `analysis_type` (varchar)
- `result` (text/jsonb)
- `created_at` (timestamptz)

## Tech Stack

- **API**: FastAPI + Uvicorn (port 8351)
- **Database**: Supabase PostgreSQL (asyncpg + SQLAlchemy 2.0)
- **Auth**: JWT (python-jose) + bcrypt password hashing
- **LLM**: Groq Llama 3.1/3.3 (via LangChain)
- **Agent**: LangGraph ReAct Agent
- **Protocol**: MCP via FastMCP
- **ML**: scikit-learn Random Forest Classifier
- **Experiment Tracking**: MLflow
- **Data**: Yahoo Finance (yfinance)
- **Frontend**: React 19 + Vite + TailwindCSS v4 + Recharts
