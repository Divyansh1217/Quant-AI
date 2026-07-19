import asyncio
import os
from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from langchain_mcp_adapters.tools import load_mcp_tools
from langgraph.prebuilt import create_react_agent
from langchain_groq import ChatGroq

load_dotenv()

async def run_quantitative_agent(mode: str = "analyze", tickers: list[str] = None):
    llm = ChatGroq(
        model_name="llama-3.3-70b-versatile",
        groq_api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.1
    )

    server_params = StdioServerParameters(
        command="python",
        args=["main.py", "--mode", "mcp"],
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await load_mcp_tools(session)
            print(f"Loaded {len(tools)} market tools from MCP Gateway.")

            agent = create_react_agent(llm, tools)

            if mode == "portfolio" and tickers:
                ticker_str = ", ".join(tickers)
                query = (
                    f"I need a comprehensive portfolio analysis for: {ticker_str}. "
                    f"Use the 'analyze_portfolio' tool with tickers comma-separated: {','.join(tickers)}. "
                    f"Then use 'compare_sector' on the primary ticker {tickers[0]} for sector context. "
                    f"Synthesize: diversification quality, individual stock signals, and correlation insights. "
                    f"Provide a professional portfolio rebalancing recommendation."
                )
                print(f"\nAnalyzing portfolio: {ticker_str}\n")
            elif mode == "backtest" and tickers:
                ticker = tickers[0]
                query = (
                    f"I need a full backtest report for {ticker}. "
                    f"Use the 'backtest_ml_strategy' tool for {ticker} with 2 years of history. "
                    f"Also use 'real_world_ml_recommender' for the current ML recommendation. "
                    f"Compare the backtested strategy return vs buy-and-hold. "
                    f"Discuss risk metrics: Sharpe ratio, max drawdown, win rate. "
                    f"Provide a professional backtest summary."
                )
                print(f"\nRunning backtest for: {ticker}\n")
            else:
                ticker = tickers[0] if tickers else "SPY"
                query = (
                    f"I need a comprehensive quantitative analysis for {ticker}. "
                    f"Step 1: Use 'calculate_moving_average_crossover' for trend direction. "
                    f"Step 2: Use 'real_world_ml_recommender' for the ML prediction. "
                    f"Step 3: Use 'analyze_macd' for momentum signals. "
                    f"Step 4: Use 'analyze_bollinger_bands' for overbought/oversold levels. "
                    f"Step 5: Use 'detect_rsi_divergence' for hidden reversal signals. "
                    f"Step 6: Use 'find_support_resistance' for key price levels. "
                    f"Step 7: Use 'analyze_volatility' for ATR-based risk management. "
                    f"Step 8: Use 'compare_sector' for benchmark context. "
                    f"Synthesize ALL outputs into a professional final recommendation with entry/exit levels, "
                    f"stop loss, and risk assessment. Do not guess any prices."
                )
                print(f"\nAnalyzing {ticker}...\n")

            print("Agent is thinking and executing tools...\n")

            async for chunk in agent.astream({"messages": [("user", query)]}):
                if "agent" in chunk:
                    print(chunk["agent"]["messages"][0].content)
                elif "tools" in chunk:
                    print(f"[Tool]: {chunk['tools']['messages'][0].name}")

if __name__ == "__main__":
    print("=== Quant AI Agent ===")
    print("Modes: analyze | portfolio | backtest")
    mode = input("Select mode (default: analyze): ").strip().lower() or "analyze"

    if mode == "portfolio":
        tickers_input = input("Enter tickers (comma-separated, e.g., AAPL,MSFT,GOOGL): ")
        tickers = [t.strip().upper() for t in tickers_input.split(",") if t.strip()]
    elif mode == "backtest":
        ticker = input("Enter stock ticker to backtest (e.g., AAPL): ").strip().upper()
        tickers = [ticker]
    else:
        ticker = input("Enter stock ticker to analyze (e.g., TSLA, AAPL, NVDA): ").strip().upper()
        tickers = [ticker]

    asyncio.run(run_quantitative_agent(mode=mode, tickers=tickers))
