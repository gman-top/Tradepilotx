from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from core.master_logic import MasterLogicEngine
import uvicorn
import json
import os

app = FastAPI(title="Trade Pilot X Dashboard")

# Initialize the REAL engine (no more placeholders)
engine = MasterLogicEngine()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/v1/market")
def get_market_data():
    """
    LIVE MARKET INTELLIGENCE ENDPOINT
    Returns real-time analysis with:
    - Live Technical Data (yfinance)
    - Real COT Data (CFTC)
    - Retail Sentiment (MyFXBook)
    """
    symbols = [
        ("GC=F", "GOLD"),
        ("BTC-USD", "BITCOIN"),
        ("CL=F", "OIL"),
        ("EURUSD=X", "EURUSD")
    ]
    
    results = []
    for ticker, name in symbols:
        try:
            analysis = engine.get_real_trade_analysis(ticker, name)
            results.append(analysis)
        except Exception as e:
            results.append({
                "symbol": name,
                "error": str(e),
                "price": 0,
                "bias": "ERROR",
                "score": 0,
                "breakdown": {}
            })
    
    return results

@app.get("/api/v1/asset/{symbol}")
def get_single_asset(symbol: str):
    """
    Get analysis for a single asset
    Example: /api/v1/asset/GOLD
    """
    ticker_map = {
        "GOLD": "GC=F",
        "BITCOIN": "BTC-USD",
        "OIL": "CL=F",
        "EURUSD": "EURUSD=X",
        "GBPUSD": "GBPUSD=X",
        "USDJPY": "USDJPY=X"
    }
    
    ticker = ticker_map.get(symbol.upper(), symbol)
    try:
        analysis = engine.get_real_trade_analysis(ticker, symbol.upper())
        return analysis
    except Exception as e:
        return {"error": str(e)}

@app.get("/health")
def health_check():
    """Health check endpoint for deployment platforms"""
    return {
        "status": "online",
        "service": "TradePilotX Intelligence Engine",
        "version": "1.0.0",
        "data_sources": ["CFTC COT", "MyFXBook Sentiment", "Yahoo Finance"]
    }

@app.get("/", response_class=HTMLResponse)
def get_ui():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8"><title>TRADE PILOT X</title>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
        <style>
            body { background: #050505; color: #fff; font-family: 'JetBrains Mono', monospace; padding: 2rem; margin: 0; }
            .header { border-bottom: 1px solid #333; padding-bottom: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
            .card { background: #111; border: 1px solid #222; padding: 1.5rem; border-radius: 4px; transition: all 0.2s ease; }
            .card:hover { border-color: #444; }
            .bullish { color: #00ff88; } .bearish { color: #ff3366; }
            .score { font-size: 2.5rem; font-weight: 700; margin: 0.5rem 0; }
            .meta { font-size: 0.8rem; color: #666; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 1rem; }
            .footer { position: fixed; bottom: 1rem; right: 1rem; font-size: 0.7rem; color: #333; }
            .status { padding: 0.25rem 0.5rem; background: #00ff8822; color: #00ff88; border-radius: 3px; font-size: 0.6rem; }
        </style>
        <script>
            async function refresh() {
                const res = await fetch('/api/v1/market');
                const data = await res.json();
                const container = document.getElementById('market-grid');
                container.innerHTML = data.map(item => `
                    <div class="card">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:700">${item.symbol}</span>
                            <span class="${item.score >= 0 ? 'bullish' : 'bearish'}" style="font-size:0.7rem">${item.bias}</span>
                        </div>
                        <div class="score ${item.score >= 0 ? 'bullish' : 'bearish'}">${item.score > 0 ? '+' : ''}${item.score}</div>
                        <div style="font-size:1.2rem; margin-bottom:1rem">$${item.price.toFixed(2)}</div>
                        <div class="meta">
                            <div>TECH: ${item.breakdown.technical?.score || 0}</div>
                            <div>INST: ${item.breakdown.institutional?.score || 0}</div>
                            <div>SENT: ${item.breakdown.retail?.score || 0}</div>
                            <div>COT: ${item.breakdown.institutional?.net_long || '--'}%</div>
                        </div>
                        ${item.trades_active?.length > 0 ? `
                            <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid #222; font-size:0.7rem; color:#00ff88">
                                🎯 ${item.trades_active[0]}
                            </div>
                        ` : ''}
                    </div>
                `).join('');
            }
            setInterval(refresh, 30000); // Refresh every 30s
            refresh();
        </script>
    </head>
    <body>
        <div class="header">
            <div style="font-size:1.5rem; font-weight:700; letter-spacing:-1px">TRADE PILOT <span style="color:#00ff88">X</span></div>
            <div style="display:flex; gap:1rem; align-items:center;">
                <span class="status">LIVE DATA</span>
                <div style="font-size:0.7rem; color:#444">Real COT + Sentiment</div>
            </div>
        </div>
        <div class="grid" id="market-grid"></div>
        <div class="footer">NYX STRATEGIC OS // ENCRYPTED ACCESS</div>
    </body>
    </html>
    """

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3336))
    uvicorn.run(app, host="0.0.0.0", port=port)
