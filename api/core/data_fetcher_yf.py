import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta

class YahooFinanceData:
    def __init__(self):
        pass

    def get_market_data(self, ticker: str, period: str = "1mo"):
        """
        Fetch historical data and basic info for a ticker.
        """
        try:
            data = yf.Ticker(ticker)
            hist = data.history(period=period)
            
            if hist.empty:
                return {"error": f"No data found for {ticker}"}
            
            # Extract basic technical indicators for the scoring engine
            current_price = hist['Close'].iloc[-1]
            prev_price = hist['Close'].iloc[-2]
            change = ((current_price - prev_price) / prev_price) * 100
            
            # Simple Moving Averages
            sma_20 = hist['Close'].rolling(window=20).mean().iloc[-1]
            sma_50 = hist['Close'].rolling(window=50).mean().iloc[-1] if len(hist) >= 50 else None
            sma_100 = hist['Close'].rolling(window=100).mean().iloc[-1] if len(hist) >= 100 else None
            sma_200 = hist['Close'].rolling(window=200).mean().iloc[-1] if len(hist) >= 200 else None
            
            return {
                "ticker": ticker,
                "current_price": round(float(current_price), 4),
                "change_percent": round(float(change), 2),
                "sma_20": round(float(sma_20), 4) if sma_20 else None,
                "sma_50": round(float(sma_50), 4) if sma_50 else None,
                "sma_100": round(float(sma_100), 4) if sma_100 else None,
                "sma_200": round(float(sma_200), 4) if sma_200 else None,
                "volume": int(hist['Volume'].iloc[-1]),
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {"error": str(e)}

if __name__ == "__main__":
    # Quick test for Gold and EURUSD
    yf_data = YahooFinanceData()
    print(yf_data.get_market_data("GC=F")) # Gold Futures
    print(yf_data.get_market_data("EURUSD=X")) # EUR/USD
