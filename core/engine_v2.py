from typing import Dict, Any, List
import yfinance as yf
import pandas as pd
import numpy as np

class TradingEngine:
    """
    Core Trading Engine for Trade Pilot X.
    Calculates institutional-grade scores based on real-time and fundamental data.
    """
    
    def __init__(self):
        # Weights mimicking EdgeFinder's institutional logic
        self.weights = {
            "technical": 3,   # Max 3 pts
            "sentiment": 2,   # Max 2 pts (COT + Retail)
            "fundamental": 5  # Max 5 pts (Macro/Eco)
        }

    def get_technical_score(self, ticker: str) -> Dict[str, Any]:
        """
        Calculates Technical Score (0 to 3)
        Logic: Trend (4H/D) + SMA positioning (20, 50, 100, 200)
        """
        try:
            data = yf.download(ticker, period="1y", interval="1d", progress=False)
            if data.empty: return {"score": 0, "error": "No data"}
            
            close = data['Close'].iloc[-1].item()
            
            # SMA Calculations
            smas = {
                "sma20": data['Close'].rolling(window=20).mean().iloc[-1].item(),
                "sma50": data['Close'].rolling(window=50).mean().iloc[-1].item(),
                "sma100": data['Close'].rolling(window=100).mean().iloc[-1].item(),
                "sma200": data['Close'].rolling(window=200).mean().iloc[-1].item(),
            }
            
            # Logic: +0.5 for each SMA if price is above (Max 2)
            sma_score = 0
            details = {}
            for name, val in smas.items():
                above = close > val
                details[name] = "Bullish" if above else "Bearish"
                if above: sma_score += 0.5
                else: sma_score -= 0.5
                
            # Trend Logic: Price vs SMA50 & SMA200 (Max 1)
            trend_score = 1.0 if close > smas["sma50"] and smas["sma50"] > smas["sma200"] else -1.0
            
            total_tech = max(-3, min(3, sma_score + trend_score))
            
            return {
                "score": total_tech,
                "price": close,
                "smas": details,
                "trend": "Strong Bullish" if total_tech >= 2 else ("Bearish" if total_tech <= -2 else "Neutral")
            }
        except Exception as e:
            return {"score": 0, "error": str(e)}

    def calculate_final_score(self, ticker: str, asset_name: str, fundamental_data: Dict[str, Any]):
        """
        Combines Live Technicals with Fundamental Intelligence (COT/Macro).
        """
        tech = self.get_technical_score(ticker)
        
        # Fundamental/Sentiment comes from our Intelligence Hub (DataHub)
        # but the logic of combining them happens here.
        cot_score = fundamental_data.get("cot_score", 0)
        retail_score = fundamental_data.get("retail_score", 0)
        macro_score = fundamental_data.get("macro_score", 0)
        
        sentiment_total = max(-2, min(2, cot_score + retail_score))
        
        total_conviction = tech["score"] + sentiment_total + macro_score
        
        return {
            "symbol": ticker,
            "name": asset_name,
            "current_price": tech.get("price", 0),
            "scores": {
                "technical": tech["score"],
                "sentiment": sentiment_total,
                "fundamental": macro_score,
                "total": total_conviction
            },
            "technical_details": tech.get("smas", {}),
            "bias": self._get_bias_label(total_conviction)
        }

    def _get_bias_label(self, score: float) -> str:
        if score >= 7: return "STRONG BUY"
        if score >= 3: return "BUY"
        if score <= -7: return "STRONG SELL"
        if score <= -3: return "SELL"
        return "NEUTRAL"

if __name__ == "__main__":
    engine = TradingEngine()
    # Example for Gold
    print(engine.calculate_final_score("GC=F", "GOLD", {"cot_score": 1, "retail_score": 1, "macro_score": 2}))
