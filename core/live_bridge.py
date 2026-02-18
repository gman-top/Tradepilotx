import sys
import os

# Add the core directory to path so we can import our modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.scoring_engine import ScoringEngine
from app.core.data_fetcher_yf import YahooFinanceData

class TradePilotApp:
    def __init__(self):
        self.engine = ScoringEngine()
        self.fetcher = YahooFinanceData()
        
    def get_live_analysis(self, ticker: str, symbol_name: str = None):
        if not symbol_name:
            symbol_name = ticker
            
        print(f"--- Analyzing {symbol_name} ({ticker}) ---")
        
        # 1. Fetch Live Technical Data
        raw_data = self.fetcher.get_market_data(ticker, period="1y") # Need 1y for SMA 200
        
        if "error" in raw_data:
            return f"Error fetching data: {raw_data['error']}"
        
        # 2. Prepare Data for Claude's Scoring Engine
        # We simulate COT/ECO/Sentiment for now until those fetchers are ready
        # But we use REAL Technical data
        
        technical_input = {
            "trend": "bullish" if raw_data['change_percent'] > 0 else "bearish",
            "above_20_sma": raw_data['current_price'] > raw_data['sma_20'] if raw_data['sma_20'] else None,
            "above_50_sma": raw_data['current_price'] > raw_data['sma_50'] if raw_data['sma_50'] else None,
            "above_100_sma": raw_data['current_price'] > raw_data['sma_100'] if raw_data['sma_100'] else None,
            "above_200_sma": raw_data['current_price'] > raw_data['sma_200'] if raw_data['sma_200'] else None,
            "volatility": "normal",
            "current_price": raw_data['current_price']
        }
        
        # Placeholder for other components (to be automated next)
        asset_input = {
            "symbol": symbol_name,
            "technical": technical_input,
            "cot": {"positioning": "neutral", "weekly_change": 0},
            "retail": {"long_pct": 50},
            "economic": {}, # Neutral for now
            "seasonality": {"current_month_avg_return": 0}
        }
        
        # 3. Calculate Score
        analysis = self.engine.calculate_asset_score(asset_input)
        
        return analysis

if __name__ == "__main__":
    app = TradePilotApp()
    
    # Analyze a few key markets
    markets = [
        ("GC=F", "GOLD"),
        ("EURUSD=X", "EUR/USD"),
        ("BTC-USD", "BITCOIN"),
        ("^GSPC", "S&P 500")
    ]
    
    for ticker, name in markets:
        res = app.get_live_analysis(ticker, name)
        if isinstance(res, dict):
            print(f"PRICE: {res['breakdown']['technical'].get('current_price', 'N/A')}")
            print(f"SCORE: {res['total_score']} | BIAS: {res['bias']}")
            print(f"TECH SCORE: {res['technical_score']}/3")
        else:
            print(res)
        print("-" * 30)
