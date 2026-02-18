from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.core.live_bridge import TradePilotApp
from app.core.data_hub import DataHub
import uvicorn
import json

app = FastAPI(title="Trade Pilot X - Full Transparency")
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
        ("JPY=X", "USDJPY"),
        ("^GSPC", "SPX500")
    ]
    results = []
    for ticker, name in symbols:
        try:
            live = pilot.get_live_analysis(ticker, name)
            context = hub.get_asset_context(name)
            
            # Extract real EdgeFinder scores from our snapshot
            sentiment = context.get("sentiment", {})
            macro = context.get("macro", {})
            
            sentiment_score = sentiment.get("score", 0) if isinstance(sentiment, dict) else sentiment
            macro_score = macro.get("score", 0) if isinstance(macro, dict) else macro
            
            # Combine
            live["sentiment_score"] = sentiment_score
            live["eco_score"] = macro_score
            live["total_score"] = live["technical_score"] + sentiment_score + macro_score
            
            # Detailed Breakdown for the Table
            live["details"] = {
                "COT": sentiment.get("cot", "Neutral"),
                "Retail": sentiment.get("retail", "Mixed"),
                "Macro": macro.get("status", "Stable"),
                "Seasonality": "Neutral"
            }
            
            current_price = live.get("breakdown", {}).get("technical", {}).get("current_price")
            live["display_price"] = f"{current_price:,.2f}" if current_price else "---"
            live["name"] = name
            results.append(live)
        except Exception as e:
            print(f"Error {name}: {e}")
            
    return results

@app.get("/", response_class=HTMLResponse)
def get_ui():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8"><title>TRADE PILOT X | TERMINAL</title>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
        <style>
            :root { --bg: #0a0a0a; --border: #222; --accent: #3b82f6; --danger: #ef4444; }
            body { background: var(--bg); color: #fff; font-family: 'JetBrains Mono', monospace; padding: 1rem; font-size: 13px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 1.5rem; }
            table { width: 100%; border-collapse: collapse; background: #0f0f0f; }
            th { text-align: left; padding: 12px; border-bottom: 1px solid var(--border); color: #666; font-size: 11px; text-transform: uppercase; }
            td { padding: 12px; border-bottom: 1px solid #151515; }
            .bullish { color: var(--accent); font-weight: 700; }
            .bearish { color: var(--danger); font-weight: 700; }
            .score-pill { padding: 2px 8px; border-radius: 2px; font-weight: 800; }
            .bg-bull { background: var(--accent); color: #000; }
            .bg-bear { background: var(--danger); color: #fff; }
            .bg-neut { background: #333; }
        </style>
        <script>
            async function refresh() {
                const res = await fetch('/api/v1/market');
                const data = await res.json();
                document.getElementById('table-body').innerHTML = data.map(item => {
                    const total = item.total_score;
                    const biasClass = total > 0 ? 'bullish' : (total < 0 ? 'bearish' : '');
                    const bgClass = total > 0 ? 'bg-bull' : (total < 0 ? 'bg-bear' : 'bg-neut');
                    return `
                        <tr>
                            <td style="font-weight:700">${item.name}</td>
                            <td>${item.display_price}</td>
                            <td class="${item.sentiment_score > 0 ? 'bullish' : 'bearish'}">${item.sentiment_score > 0 ? 'BULL' : 'BEAR'}</td>
                            <td class="${item.eco_score > 0 ? 'bullish' : 'bearish'}">${item.eco_score > 0 ? 'BULL' : 'BEAR'}</td>
                            <td class="${item.technical_score > 0 ? 'bullish' : 'bearish'}">${item.technical_score > 0 ? 'BULL' : 'BEAR'}</td>
                            <td class="${biasClass}" style="text-align:center">
                                <span class="score-pill ${bgClass}">${total > 0 ? '+' : ''}${total}</span>
                            </td>
                            <td class="${biasClass}">${item.bias}</td>
                        </tr>
                    `;
                }).join('');
            }
            setInterval(refresh, 15000); refresh();
        </script>
    </head>
    <body>
        <div class="header">
            <div style="font-weight:900; font-size:1.2rem">TRADE PILOT <span style="color:var(--accent)">X</span></div>
            <div style="font-size:0.7rem; color:#444">EDGEFINDER ENGINE V1.3</div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Asset</th><th>Price</th><th>COT/Retail</th><th>Macro</th><th>Tech</th><th>Score</th><th>Bias</th>
                </tr>
            </thead>
            <tbody id="table-body"></tbody>
        </table>
    </body>
    </html>
    """

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3341)
