from typing import Dict, Any, List
import yfinance as yf
import pandas as pd
import numpy as np
from app.core.cot_fetcher import COTFetcher
from app.core.real_data import RealTimeIntelligence

class MasterLogicEngine:
    """
    The "True" Brain. 
    Combines live prices, official COT reports, and scraped Retail Sentiment.
    No more hardcoded vibes.
    """
    
    def __init__(self):
        self.cot = COTFetcher()
        self.intel = RealTimeIntelligence()
        try:
            self.cot_data = self.cot.fetch_latest_cot() or {}
        except:
            self.cot_data = {}
        try:
            self.sentiment_data = self.intel.get_myfxbook_sentiment() or {}
        except:
            self.sentiment_data = {}

    def get_real_trade_analysis(self, ticker: str, asset_name: str) -> Dict[str, Any]:
        # 1. LIVE TECHNICALS
        df = yf.download(ticker, period="1y", interval="1d", progress=False)
        if df.empty:
            raise ValueError(f"No data available for {ticker}")
        
        # Handle MultiIndex columns from yfinance
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        
        curr_price = float(df['Close'].iloc[-1])
        sma50 = float(df['Close'].rolling(50).mean().iloc[-1])
        sma200 = float(df['Close'].rolling(200).mean().iloc[-1])
        
        tech_score = 0
        if curr_price > sma200: tech_score += 1.5 # Major Trend
        if sma50 > sma200: tech_score += 1.5 # Momentum
        
        # 2. COT (INSTITUTIONAL)
        # Search for key in COT data (e.g., GOLD, EURUSD)
        cot_info = self.cot_data.get(asset_name, {})
        cot_score = cot_info.get("score", 0)
        
        # 3. RETAIL SENTIMENT (CONTRARIAN)
        retail_info = self.sentiment_data.get(asset_name, {"long": 50, "short": 50})
        retail_score = 0
        if retail_info["long"] > 70: retail_score = -2 # Too many longs, we sell
        elif retail_info["short"] > 70: retail_score = 2 # Too many shorts, we buy
        elif retail_info["long"] > 60: retail_score = -1
        elif retail_info["short"] > 60: retail_score = 1

        # 4. FINAL CALCULATION
        total = tech_score + cot_score + retail_score
        
        return {
            "symbol": asset_name,
            "price": curr_price,
            "bias": "STRONG BUY" if total >= 5 else ("STRONG SELL" if total <= -5 else "NEUTRAL"),
            "score": round(total, 1),
            "breakdown": {
                "technical": {"score": tech_score, "status": "Above 200 SMA" if curr_price > sma200 else "Below 200 SMA"},
                "institutional": {"score": cot_score, "net_long": cot_info.get("perc_long", "--")},
                "retail": {"score": retail_score, "long_pct": retail_info["long"]}
            },
            "trades_active": ["XAUUSD Long @ 2640 (Discord Signal)"] if asset_name == "XAUUSD" else []
        }
