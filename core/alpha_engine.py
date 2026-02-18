from typing import Dict, Any, List
import yfinance as yf
import pandas as pd
import numpy as np

class AlphaTradingEngine:
    """
    NYX Pro Trading Engine.
    Institutional-grade logic mapping EdgeFinder Pro scoring.
    """
    
    def __init__(self):
        # Weights (EdgeFinder Pro v4)
        self.max_technical = 3.0
        self.max_sentiment = 2.0
        self.max_fundamental = 5.0

    def get_market_analysis(self, ticker: str, asset_name: str, intel: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs full analysis on an asset.
        """
        # 1. LIVE TECHNICALS
        tech = self._analyze_technicals(ticker)
        
        # 2. INTELLIGENCE DATA (from Hub)
        cot_score = intel.get("cot_score", 0)
        retail_score = intel.get("retail_score", 0)
        macro_score = intel.get("macro_score", 0)
        
        # 3. SCORE AGGREGATION
        sentiment_total = max(-2.0, min(2.0, cot_score + retail_score))
        total_conviction = tech["score"] + sentiment_total + macro_score
        
        # 4. TARGET CALCULATION (Volatility Based)
        targets = self._calculate_targets(tech["current_price"], tech["volatility_pct"])
        
        return {
            "symbol": ticker,
            "name": asset_name,
            "price": tech["current_price"],
            "change_24h": tech["change_24h"],
            "scores": {
                "technical": tech["score"],
                "sentiment": sentiment_total,
                "fundamental": macro_score,
                "total": round(total_conviction, 1)
            },
            "signals": {
                "technical": "BULLISH" if tech["score"] > 0 else "BEARISH",
                "institutional": "BULLISH" if cot_score > 0 else "BEARISH",
                "retail": "LONG" if retail_score < 0 else "SHORT", # Contrarian
                "fundamental": "STRONG" if macro_score > 2 else "WEAK"
            },
            "smas": tech["smas"],
            "targets": targets,
            "bias": self._get_bias_label(total_conviction),
            "volatility": f"{tech['volatility_pct']:.2f}%"
        }

    def _analyze_technicals(self, ticker: str) -> Dict[str, Any]:
        try:
            # Fetch 1y daily data
            df = yf.download(ticker, period="1y", interval="1d", progress=False)
            if df.empty: return {"score": 0, "current_price": 0, "change_24h": 0, "volatility_pct": 0, "smas": {}}
            
            curr = df['Close'].iloc[-1].item()
            if hasattr(curr, 'item'): curr = curr.item()
            curr = float(curr)
            
            prev = df['Close'].iloc[-2].item()
            if hasattr(prev, 'item'): prev = prev.item()
            prev = float(prev)
            
            change = float(((curr - prev) / prev) * 100)
            
            # SMAs
            smas_raw = {
                "20": df['Close'].rolling(20).mean().iloc[-1],
                "50": df['Close'].rolling(50).mean().iloc[-1],
                "100": df['Close'].rolling(100).mean().iloc[-1],
                "200": df['Close'].rolling(200).mean().iloc[-1],
            }
            
            smas = {}
            for k, v in smas_raw.items():
                val = v.item() if hasattr(v, 'item') else v
                smas[k] = float(val)
            
            # Logic
            score = 0
            sma_status = {}
            for period, val in smas.items():
                is_above = curr > val
                sma_status[period] = "BULLISH" if is_above else "BEARISH"
                score += 0.5 if is_above else -0.5
            
            # Trend (Golden/Death Cross logic)
            trend_bonus = 1.0 if smas["50"] > smas["200"] else -1.0
            
            # Volatility (ATR-like 14 day)
            vol = float(df['Close'].pct_change().std() * np.sqrt(252) * 100) # Annualized
            
            final_tech = float(max(-3.0, min(3.0, score + trend_bonus)))
            
            return {
                "score": final_tech,
                "current_price": float(curr),
                "change_24h": float(change),
                "volatility_pct": float(vol),
                "smas": sma_status
            }
        except:
            return {"score": 0, "current_price": 0, "change_24h": 0, "volatility_pct": 0, "smas": {}}

    def _calculate_targets(self, price: float, vol: float) -> List[float]:
        # Simple targets based on 1% and 2% expected move
        move = price * 0.015
        return [round(price + move, 2), round(price + (move*2), 2), round(price - move, 2)]

    def _get_bias_label(self, score: float) -> str:
        if score >= 7: return "STRONG BUY"
        if score >= 3: return "BUY"
        if score <= -7: return "STRONG SELL"
        if score <= -3: return "SELL"
        return "NEUTRAL"
