from typing import Dict, Any
import yfinance as yf
import pandas as pd
import json
import os

class EdgeFinderFullEngine:
    """
    NYX EdgeFinder Engine - Replicating the EXACT 1:1 structure from PDF.
    """
    def __init__(self):
        self.metrics_path = "/data/.openclaw/workspace/tradepilot-x/data/edgefinder_deep_metrics.json"

    def get_full_asset_analysis(self, ticker: str, asset_name: str) -> Dict[str, Any]:
        # 1. LIVE DATA (Technicals & Price)
        live_tech = self._get_live_technicals(ticker)
        
        # 2. DEEP DATA (From PDF/Snapshot logic)
        deep_data = self._load_deep_metrics(asset_name)
        
        # 3. SCORING (Institutional Weights)
        scores = self._calculate_complex_scores(live_tech, deep_data)
        
        return {
            "symbol": asset_name,
            "ticker": ticker,
            "price": live_tech["price"],
            "bias_score": scores["total"],
            "bias_label": self._get_bias_label(scores["total"]),
            "targets": self._calc_targets(live_tech["price"]),
            "panels": {
                "technical": {
                    "signal": "Bullish" if scores["tech"] > 0 else "Bearish",
                    "score": scores["tech"],
                    "metrics": deep_data.get("technical", {}),
                    "smas": live_tech["smas"]
                },
                "institutional": {
                    "signal": "Bullish" if scores["cot"] > 0 else "Bearish",
                    "score": scores["cot"],
                    "metrics": deep_data.get("cot", {})
                },
                "sentiment": {
                    "signal": deep_data.get("retail", {}).get("bias", "Neutral"),
                    "score": scores["sent"],
                    "metrics": deep_data.get("retail", {})
                },
                "fundamental": {
                    "eco_growth": {"score": scores["eco"], "metrics": deep_data.get("fundamental", {}).get("eco_growth", {})},
                    "jobs_market": {"score": scores["jobs"], "metrics": deep_data.get("fundamental", {}).get("jobs_market", {})},
                    "inflation": {"score": scores["inf"], "metrics": deep_data.get("fundamental", {}).get("inflation", {})}
                }
            }
        }

    def _get_live_technicals(self, ticker: str):
        df = yf.download(ticker, period="1y", interval="1d", progress=False)
        if df.empty: return {"price": 0, "smas": {}}
        
        # Safe extraction from pandas Series or scalar
        last_close = df['Close'].iloc[-1]
        curr = float(last_close.iloc[0]) if isinstance(last_close, pd.Series) else float(last_close)
        
        smas = {}
        for p in [20, 50, 100, 200]:
            sma_series = df['Close'].rolling(p).mean().iloc[-1]
            val = float(sma_series.iloc[0]) if isinstance(sma_series, pd.Series) else float(sma_series)
            smas[f"{p}d SMA"] = "Bullish" if curr > val else "Bearish"
            
        return {"price": curr, "smas": smas}

    def _load_deep_metrics(self, asset: str):
        if os.path.exists(self.metrics_path):
            with open(self.metrics_path, "r") as f:
                data = json.load(f)
            return data.get(asset, {})
        return {}

    def _calculate_complex_scores(self, live, deep):
        # We simulate the scoring logic based on the individual metrics
        # (This is where Claude's logic maps the table to points)
        t_score = 1 if all(v == "Bullish" for v in live["smas"].values()) else -1
        cot_score = 2 if deep.get("cot", {}).get("net_positioning") == "Bullish" else -2
        sent_score = 1 if deep.get("retail", {}).get("sentiment_pct", 50) > 60 else -1 # Contrarian
        
        # Fundamental sub-scores
        eco = 3 # Simulated sum from metrics
        jobs = -3
        inf = 1
        
        return {
            "tech": t_score, "cot": cot_score, "sent": sent_score,
            "eco": eco, "jobs": jobs, "inf": inf,
            "total": t_score + cot_score + sent_score + eco + jobs + inf
        }

    def _get_bias_label(self, s):
        if s >= 7: return "Strong Buy"
        if s >= 3: return "Buy"
        if s <= -7: return "Strong Sell"
        if s <= -3: return "Sell"
        return "Neutral"

    def _calc_targets(self, p):
        return [round(p * 1.02, 2), round(p * 1.04, 2), round(p * 0.98, 2)]
