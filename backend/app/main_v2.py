from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.core.live_bridge import TradePilotApp
from app.core.data_hub import DataHub
import uvicorn

app = FastAPI(title="Trade Pilot X")
pilot = TradePilotApp()
hub = DataHub()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/v1/market")
def get_market_data():
    symbols = [
        ("GC=F", "GOLD"),
        ("BTC-USD", "BITCOIN"),
        ("CL=F", "USOIL"),
        ("EURUSD=X", "EURUSD"),
        ("GBPUSD=X", "GBPUSD"),
        ("^GSPC", "SPX500")
    ]
    results = []
    for ticker, name in symbols:
        live = pilot.get_live_analysis(ticker, name)
        context = hub.get_asset_context(name)
        
        # Merge EdgeFinder intelligence with live technical
        sentiment_val = context.get("sentiment", {}).get("score", 0) if isinstance(context.get("sentiment"), dict) else context.get("sentiment", 0)
        macro_val = context.get("macro", {}).get("score", 0) if isinstance(context.get("macro"), dict) else context.get("macro", 0)
        
        live["sentiment_score"] = sentiment_val
        live["eco_score"] = macro_val
        live["total_score"] = live["technical_score"] + live["sentiment_score"] + live["eco_score"]
        
        # Recalc bias
        if live["total_score"] >= 6:
            live["bias"] = "Strong Bullish"
        elif live["total_score"] >= 3:
            live["bias"] = "Bullish"
        elif live["total_score"] <= -6:
            live["bias"] = "Strong Bearish"
        elif live["total_score"] <= -3:
            live["bias"] = "Bearish"
        else:
            live["bias"] = "Neutral"
            
        results.append(live)
    return results

@app.get("/", response_class=HTMLResponse)
def get_ui():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TRADE PILOT X</title>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: #000; color: #fff; font-family: 'JetBrains Mono', monospace; padding: 2rem; }
            .header { border-bottom: 2px solid #111; padding-bottom: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; }
            .logo { font-size: 1.8rem; font-weight: 800; letter-spacing: -2px; }
            .logo .x { color: #00ff88; }
            .status { font-size: 0.7rem; color: #00ff88; text-transform: uppercase; letter-spacing: 2px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
            .card { background: #0a0a0a; border: 1px solid #1a1a1a; padding: 1.5rem; border-radius: 2px; transition: border-color 0.2s; }
            .card:hover { border-color: #333; }
            .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
            .symbol { font-size: 0.9rem; font-weight: 700; color: #999; }
            .badge { font-size: 0.65rem; padding: 0.3rem 0.6rem; border-radius: 2px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
            .badge.bullish { background: #00ff88; color: #000; }
            .badge.bearish { background: #ff3366; color: #000; }
            .badge.neutral { background: #666; color: #fff; }
            .price { font-size: 2.2rem; font-weight: 800; margin: 1rem 0; }
            .score-display { font-size: 1rem; margin-bottom: 1.5rem; }
            .score-value { font-weight: 700; }
            .score-value.positive { color: #00ff88; }
            .score-value.negative { color: #ff3366; }
            .breakdown { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; font-size: 0.75rem; color: #666; border-top: 1px solid #111; padding-top: 1rem; }
            .breakdown-item span { color: #ccc; font-weight: 700; }
            .footer { position: fixed; bottom: 1rem; right: 2rem; font-size: 0.65rem; color: #222; text-transform: uppercase; letter-spacing: 2px; }
        </style>
        <script>
            async function refresh() {
                try {
                    const res = await fetch('/api/v1/market');
                    const data = await res.json();
                    const container = document.getElementById('market-grid');
                    container.innerHTML = data.map(item => {
                        const isPositive = item.total_score >= 0;
                        const isBullish = item.bias.includes('Bullish');
                        const isBearish = item.bias.includes('Bearish');
                        const badgeClass = isBullish ? 'bullish' : (isBearish ? 'bearish' : 'neutral');
                        const scoreClass = isPositive ? 'positive' : 'negative';
                        
                        return `
                        <div class="card">
                            <div class="card-header">
                                <span class="symbol">${item.symbol}</span>
                                <span class="badge ${badgeClass}">${item.bias}</span>
                            </div>
                            <div class="price">${item.breakdown.technical.current_price || 'N/A'}</div>
                            <div class="score-display">
                                Score: <span class="score-value ${scoreClass}">${item.total_score > 0 ? '+' : ''}${item.total_score}/10</span>
                            </div>
                            <div class="breakdown">
                                <div class="breakdown-item">TECH: <span>${item.technical_score}/3</span></div>
                                <div class="breakdown-item">SENT: <span>${item.sentiment_score}/2</span></div>
                                <div class="breakdown-item">ECON: <span>${item.eco_score}/5</span></div>
                                <div class="breakdown-item">SEAS: <span>0/2</span></div>
                            </div>
                        </div>
                        `;
                    }).join('');
                } catch (e) {
                    console.error('Update failed:', e);
                }
            }
            
            setInterval(refresh, 10000);
            refresh();
        </script>
    </head>
    <body>
        <div class="header">
            <div class="logo">TRADEPILOT<span class="x">X</span></div>
            <div class="status">● Live Intel Engine</div>
        </div>
        <div class="grid" id="market-grid">
            <div class="card"><div class="symbol">Loading market data...</div></div>
        </div>
        <div class="footer">NYX Strategic OS // Encrypted Access</div>
    </body>
    </html>
    """

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3337)
