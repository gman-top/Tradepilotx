from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.core.engine_v2 import TradingEngine
from app.core.intelligence_hub import IntelligenceHub
import uvicorn

app = FastAPI(title="Trade Pilot X - Engine Edition")
engine = TradingEngine()
hub = IntelligenceHub()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/v1/market")
def get_market():
    assets = [
        ("GC=F", "GOLD"),
        ("EURUSD=X", "EURUSD"),
        ("CL=F", "USOIL"),
        ("JPY=X", "USDJPY"),
        ("^GSPC", "SPX500")
    ]
    results = []
    for ticker, name in assets:
        intel = hub.get_asset_intel(name)
        analysis = engine.calculate_final_score(ticker, name, intel)
        results.append(analysis)
    return results

@app.get("/", response_class=HTMLResponse)
def ui():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8"><title>TRADE PILOT X | ENGINE</title>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
            :root { --bg: #050505; --border: #1a1a1a; --blue: #3b82f6; --red: #ef4444; }
            body { background: var(--bg); color: #eee; font-family: 'JetBrains Mono', monospace; padding: 2rem; }
            .header { border-bottom: 2px solid var(--border); padding-bottom: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(450px, 1fr)); gap: 1.5rem; }
            .card { background: #0a0a0a; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; display: flex; }
            .side { width: 140px; padding: 1.5rem; background: #0f0f0f; display: flex; flex-direction: column; align-items: center; border-right: 1px solid var(--border); }
            .main { flex-grow: 1; padding: 1.5rem; }
            .score-big { font-size: 2.5rem; font-weight: 800; margin: 1rem 0; }
            .bias-tag { font-size: 0.6rem; font-weight: 800; padding: 0.4rem; width: 100%; text-align: center; border-radius: 2px; }
            .table-row { display: flex; justify-content: space-between; font-size: 0.75rem; padding: 0.5rem 0; border-bottom: 1px solid #111; }
            .val { font-weight: 700; }
            .blue { color: var(--blue); } .red { color: var(--red); }
            .bg-blue { background: var(--blue); color: #000; } .bg-red { background: var(--red); color: #fff; }
        </style>
        <script>
            async function load() {
                const r = await fetch('/api/v1/market');
                const data = await r.json();
                document.getElementById('grid').innerHTML = data.map(a => {
                    const isBull = a.scores.total >= 0;
                    const color = isBull ? 'blue' : 'red';
                    const bgColor = isBull ? 'bg-blue' : 'bg-red';
                    return `
                    <div class="card">
                        <div class="side">
                            <div style="font-size:0.7rem; color:#666">SCORE</div>
                            <div class="score-big ${color}">${a.scores.total > 0 ? '+' : ''}${a.scores.total}</div>
                            <div class="bias-tag ${bgColor}">${a.bias}</div>
                        </div>
                        <div class="main">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem">
                                <span style="font-weight:800; font-size:1.2rem">${a.name}</span>
                                <span style="font-size:0.9rem">${a.current_price.toLocaleString()}</span>
                            </div>
                            <div class="table-row"><span>Technical (0-3)</span><span class="val">${a.scores.technical}</span></div>
                            <div class="table-row"><span>Sentiment (0-2)</span><span class="val">${a.scores.sentiment}</span></div>
                            <div class="table-row"><span>Fundamental (0-5)</span><span class="val">${a.scores.fundamental}</span></div>
                            <div style="margin-top:1rem; font-size:0.6rem; color:#444">TECH DETAIL: ${Object.entries(a.technical_details).map(([k,v]) => k.toUpperCase()+': '+v).join(' | ')}</div>
                        </div>
                    </div>`;
                }).join('');
            }
            setInterval(load, 15000); load();
        </script>
    </head>
    <body>
        <div class="header">
            <div style="font-size:1.5rem; font-weight:900">TRADE PILOT <span class="blue">X</span></div>
            <div style="font-size:0.7rem; color:var(--blue)">● LIVE ENGINE ACTIVE</div>
        </div>
        <div class="grid" id="grid"></div>
    </body>
    </html>
    """

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3342)
