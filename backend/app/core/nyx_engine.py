from typing import Dict, Any, List
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
from app.core.cot_fetcher import COTFetcher
from app.core.intelligence_hub import IntelligenceHub

class NYXStrategicEngine:
    """
    NYX Strategic Engine v2.0
    Institutional-grade scoring mapping EdgeFinder Pro logic.
    - Technical: 0 to 3 pts (Live SMAs + Trend)
    - Institutional: 0 to 2 pts (Live CFTC COT)
    - Sentiment: 0 to 2 pts (Retail Bias)
    - Fundamental: 0 to 5 pts (Macro Surprises)
    """
    
    def __init__(self):
        self.cot = COTFetcher()
        self.hub = IntelligenceHub()
        self.cot_cache = None
        self.last_cot_sync = None

    def sync_external_data(self):
        """Pre-fetch data that doesn't change every minute (COT)"""
        print("[ENGINE] Syncing COT data from CFTC...")
        self.cot_cache = self.cot.fetch_latest_cot()
        self.last_cot_sync = datetime.now()
        return self.cot_cache

    def full_analysis(self, ticker: str, asset_name: str) -> Dict[str, Any]:
        """Runs the complete logic chain for an asset"""
        # 1. TECHNICAL (Live)
        tech = self._score_technical(ticker)
        
        # 2. INSTITUTIONAL (Real COT)
        cot_data = self.cot_cache.get(asset_name, {}) if self.cot_cache else {}
        cot_score = cot_data.get("score", 0)
        
        # 3. FUNDAMENTAL & RETAIL (Hub Data)
        intel = self.hub.get_asset_intel(asset_name)
        macro_score = intel.get("macro_score", 0)
        retail_score = intel.get("retail_score", 0)
        
        # 4. AGGREGATE
        total = tech["score"] + cot_score + retail_score + macro_score
        
        return {
            "symbol": ticker,
            "name": asset_name,
            "price": tech["price"],
            "bias": self._get_bias(total),
            "scores": {
                "total": round(total, 1),
                "technical": tech["score"],
                "institutional": cot_score,
                "sentiment": retail_score,
                "fundamental": macro_score
            },
            "tech_details": tech["details"],
            "cot_details": cot_data,
            "timestamp": datetime.now().isoformat()
        }

    def _score_technical(self, ticker: str) -> Dict[str, Any]:
        df = yf.download(ticker, period="1y", interval="1d", progress=False)
        if df.empty: return {"score": 0, "price": 0, "details": {}}
        
        # Correctly extract scalar from pandas Series
        curr = float(df['Close'].iloc[-1].iloc[0]) if isinstance(df['Close'].iloc[-1], pd.Series) else float(df['Close'].iloc[-1])
        
        smas = {
            "20": float(df['Close'].rolling(20).mean().iloc[-1].iloc[0]) if isinstance(df['Close'].iloc[-1], pd.Series) else float(df['Close'].rolling(20).mean().iloc[-1]),
            "50": float(df['Close'].rolling(50).mean().iloc[-1].iloc[0]) if isinstance(df['Close'].iloc[-1], pd.Series) else float(df['Close'].rolling(50).mean().iloc[-1]),
            "100": float(df['Close'].rolling(100).mean().iloc[-1].iloc[0]) if isinstance(df['Close'].iloc[-1], pd.Series) else float(df['Close'].rolling(100).mean().iloc[-1]),
            "200": float(df['Close'].rolling(200).mean().iloc[-1].iloc[0]) if isinstance(df['Close'].iloc[-1], pd.Series) else float(df['Close'].rolling(200).mean().iloc[-1])
        }
        
        score = 0
        details = {}
        for p, val in smas.items():
            above = curr > val
            score += 0.5 if above else -0.5
            details[f"SMA{p}"] = "BULLISH" if above else "BEARISH"
            
        # Structure bonus (Golden Cross)
        if smas["50"] > smas["200"]: score += 1.0
        else: score -= 1.0
        
        return {
            "score": max(-3.0, min(3.0, score)),
            "price": curr,
            "details": details
        }

    def _get_bias(self, score: float) -> str:
        if score >= 7: return "STRONG BUY"
        if score >= 3: return "BUY"
        if score >= 1: return "WEAK BUY"
        if score <= -7: return "STRONG SELL"
        if score <= -3: return "SELL"
        if score <= -1: return "WEAK SELL"
        return "NEUTRAL"
