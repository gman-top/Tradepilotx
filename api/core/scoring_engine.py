"""
Trade Pilot X - Core Scoring Engine
Replicates EdgeFinder's multi-factor scoring system

Score Range: -10 (Very Bearish) to +10 (Very Bullish)

Components:
- Technical Score (0-3): Trend + SMA positioning + volatility
- Sentiment Score (-2 to +2): COT + retail sentiment
- ECO Score (-5 to +5): Economic fundamentals (14 metrics)
"""

from typing import Dict, Any, Optional, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ScoringEngine:
    """
    Main scoring engine for Trade Pilot X
    """
    
    def __init__(self):
        self.weights = {
            "technical": 1.0,
            "sentiment": 1.0,
            "eco": 1.0
        }
    
    def calculate_asset_score(self, asset_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate comprehensive score for a single asset
        
        Args:
            asset_data: Dict containing:
                - symbol: str
                - technical: Dict (trend, smas, volatility)
                - cot: Dict (positioning, weekly_change)
                - retail: Dict (long_pct, short_pct)
                - economic: Dict (gdp, pmis, cpi, jobs, etc.)
                - seasonality: Dict (current_month_avg)
        
        Returns:
            Dict with:
                - total_score: int
                - technical_score: int
                - sentiment_score: int
                - eco_score: int
                - bias: str
                - breakdown: Dict
        """
        symbol = asset_data.get("symbol", "UNKNOWN")
        
        try:
            # Calculate individual scores
            technical_score = self._calculate_technical_score(asset_data.get("technical", {}))
            sentiment_score = self._calculate_sentiment_score(
                asset_data.get("cot", {}),
                asset_data.get("retail", {})
            )
            eco_score = self._calculate_eco_score(asset_data.get("economic", {}))
            
            # Add seasonality bonus
            seasonality_bonus = self._calculate_seasonality_score(
                asset_data.get("seasonality", {})
            )
            
            # Total score
            total_score = technical_score + sentiment_score + eco_score + seasonality_bonus
            
            # Determine bias
            bias = self._determine_bias(total_score)
            
            return {
                "symbol": symbol,
                "total_score": total_score,
                "technical_score": technical_score,
                "sentiment_score": sentiment_score,
                "eco_score": eco_score,
                "seasonality_score": seasonality_bonus,
                "bias": bias,
                "timestamp": datetime.now().isoformat(),
                "breakdown": {
                    "technical": asset_data.get("technical", {}),
                    "cot": asset_data.get("cot", {}),
                    "retail": asset_data.get("retail", {}),
                    "economic": asset_data.get("economic", {})
                }
            }
        
        except Exception as e:
            logger.error(f"Error scoring {symbol}: {e}")
            return {
                "symbol": symbol,
                "total_score": 0,
                "technical_score": 0,
                "sentiment_score": 0,
                "eco_score": 0,
                "bias": "Neutral",
                "error": str(e)
            }
    
    def _calculate_technical_score(self, technical: Dict[str, Any]) -> int:
        """
        Technical Score: -3 to +3
        
        Components:
        - Trend (4H/Daily): +2 bullish, -2 bearish
        - SMA positioning (20/50/100/200): +1 each if above (bullish) or -1 if below
        - Capped at ±3
        """
        score = 0
        
        # Trend direction
        trend = technical.get("trend", "neutral").lower()
        if trend == "bullish":
            score += 2
        elif trend == "bearish":
            score -= 2
        elif trend == "neutral":
            score += 0
        
        # SMA positioning
        sma_scores = {
            "20_day_sma": technical.get("above_20_sma", None),
            "50_day_sma": technical.get("above_50_sma", None),
            "100_day_sma": technical.get("above_100_sma", None),
            "200_day_sma": technical.get("above_200_sma", None)
        }
        
        for sma, above in sma_scores.items():
            if above is True:
                score += 0.25  # +1 total if all above
            elif above is False:
                score -= 0.25
        
        # Volatility adjustment (optional)
        volatility = technical.get("volatility", "normal").lower()
        if volatility == "high":
            # High volatility = less confidence, reduce score magnitude
            score = score * 0.8
        
        # Cap at ±3
        score = max(-3, min(3, round(score)))
        
        return score
    
    def _calculate_sentiment_score(self, cot: Dict[str, Any], retail: Dict[str, Any]) -> int:
        """
        Sentiment Score: -2 to +2
        
        Components:
        - COT positioning: +1 if bullish, -1 if bearish
        - COT weekly change: +1 if buying, -1 if selling
        - Retail sentiment (contrarian): -1 if retail long, +1 if retail short
        - Capped at ±2
        """
        score = 0
        
        # COT Net Positioning
        cot_positioning = cot.get("positioning", "neutral").lower()
        if cot_positioning == "bullish":
            score += 1
        elif cot_positioning == "bearish":
            score -= 1
        
        # COT Weekly Change
        cot_change = cot.get("weekly_change", 0)
        if cot_change > 2:  # >2% increase in positioning
            score += 1
        elif cot_change < -2:
            score -= 1
        
        # Retail sentiment (CONTRARIAN indicator)
        # If retail is >60% long, market likely to go down (bearish)
        # If retail is >60% short, market likely to go up (bullish)
        retail_long_pct = retail.get("long_pct", 50)
        if retail_long_pct > 60:
            score -= 1  # Too many longs = bearish
        elif retail_long_pct < 40:
            score += 1  # Too many shorts = bullish
        
        # Cap at ±2
        score = max(-2, min(2, score))
        
        return score
    
    def _calculate_eco_score(self, economic: Dict[str, Any]) -> int:
        """
        Economic Score: -5 to +5
        
        Components (14 metrics):
        - GDP: +1 beat, -1 miss
        - Manufacturing PMI: +1 beat, -1 miss
        - Services PMI: +1 beat, -1 miss
        - Retail Sales: +1 beat, -1 miss
        - CPI: +1 above target (bullish for stocks), -1 below
        - PPI: +1 beat, -1 miss
        - PCE: +1 above target, -1 below
        - Interest Rates: +1 rising (bullish USD), -1 falling
        - Consumer Confidence: +1 beat, -1 miss
        - NFP: +1 beat, -1 miss
        - Unemployment: +1 lower (bullish), -1 higher (bearish)
        - Weekly Jobless Claims: +1 lower, -1 higher
        - ADP Employment: +1 beat, -1 miss
        - JOLTS Job Openings: +1 beat, -1 miss
        
        For forex pairs: Compare base vs quote currency scores
        """
        score = 0
        
        metrics = {
            "gdp": economic.get("gdp_surprise", 0),
            "manufacturing_pmi": economic.get("mPMI_surprise", 0),
            "services_pmi": economic.get("sPMI_surprise", 0),
            "retail_sales": economic.get("retail_surprise", 0),
            "cpi": economic.get("cpi_surprise", 0),
            "ppi": economic.get("ppi_surprise", 0),
            "pce": economic.get("pce_surprise", 0),
            "interest_rates": economic.get("rate_surprise", 0),
            "consumer_confidence": economic.get("confidence_surprise", 0),
            "nfp": economic.get("nfp_surprise", 0),
            "unemployment": economic.get("unemployment_surprise", 0),
            "jobless_claims": economic.get("claims_surprise", 0),
            "adp": economic.get("adp_surprise", 0),
            "jolts": economic.get("jolts_surprise", 0)
        }
        
        for metric, surprise in metrics.items():
            if surprise is None or surprise == 0:
                continue
            
            # Beat = positive surprise
            if surprise > 0:
                score += 1
            elif surprise < 0:
                score -= 1
        
        # Cap at ±5
        score = max(-5, min(5, score))
        
        return score
    
    def _calculate_seasonality_score(self, seasonality: Dict[str, Any]) -> int:
        """
        Seasonality Score: -2 to +2
        
        Current month's 10-year average performance
        """
        current_month_avg = seasonality.get("current_month_avg_return", 0)
        
        if current_month_avg > 1.0:  # >1% avg return
            return 2
        elif current_month_avg > 0.5:
            return 1
        elif current_month_avg < -1.0:
            return -2
        elif current_month_avg < -0.5:
            return -1
        else:
            return 0
    
    def _determine_bias(self, total_score: int) -> str:
        """
        Determine bias label based on total score
        """
        if total_score >= 8:
            return "Very Bullish"
        elif total_score >= 5:
            return "Bullish"
        elif total_score >= 3:
            return "Bullish"
        elif total_score > 0:
            return "Neutral"
        elif total_score == 0:
            return "Neutral"
        elif total_score > -3:
            return "Neutral"
        elif total_score > -5:
            return "Bearish"
        elif total_score > -8:
            return "Bearish"
        else:
            return "Very Bearish"
    
    def rank_assets(self, assets: list) -> list:
        """
        Rank all assets by total score (descending)
        
        Returns list of dicts sorted by score
        """
        scored_assets = []
        
        for asset_data in assets:
            score_result = self.calculate_asset_score(asset_data)
            scored_assets.append(score_result)
        
        # Sort by total score (descending)
        scored_assets.sort(key=lambda x: x["total_score"], reverse=True)
        
        return scored_assets


# Example usage
if __name__ == "__main__":
    # Test the scoring engine
    engine = ScoringEngine()
    
    test_asset = {
        "symbol": "USOIL",
        "technical": {
            "trend": "bullish",
            "above_20_sma": True,
            "above_50_sma": True,
            "above_100_sma": True,
            "above_200_sma": True,
            "volatility": "high"
        },
        "cot": {
            "positioning": "bullish",
            "weekly_change": 2.47
        },
        "retail": {
            "long_pct": 55.72,
            "short_pct": 44.28
        },
        "economic": {
            "gdp_surprise": 1,
            "mPMI_surprise": 1,
            "sPMI_surprise": 1,
            "retail_surprise": 1,
            "cpi_surprise": 0,
            "ppi_surprise": -1,
            "nfp_surprise": -1,
            "unemployment_surprise": -1
        },
        "seasonality": {
            "current_month_avg_return": 1.07
        }
    }
    
    result = engine.calculate_asset_score(test_asset)
    print(f"Asset: {result['symbol']}")
    print(f"Total Score: {result['total_score']}")
    print(f"Bias: {result['bias']}")
    print(f"Technical: {result['technical_score']}")
    print(f"Sentiment: {result['sentiment_score']}")
    print(f"ECO: {result['eco_score']}")
