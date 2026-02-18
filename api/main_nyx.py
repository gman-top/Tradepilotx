from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.core.nyx_engine import NYXStrategicEngine
import uvicorn

app = FastAPI(title="Trade Pilot X - Strategic OS")
engine = NYXStrategicEngine()

# Initialize Engine with external data (COT)
engine.sync_external_data()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/v1/market")
def get_market():
    assets = [
        ("GC=F", "GOLD"),
        ("EURUSD=X", "EURUSD"),
        ("JPY=X", "USDJPY"),
        ("CL=F", "USOIL"),
        ("^GSPC", "SPX500")
    ]
    return [engine.full_analysis(t, n) for t, n in assets]

@app.get("/", response_class=HTMLResponse)
def ui():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8"><title>TRADE PILOT X | NYX OS</title>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
            :root { --bg: #0c0c0e; --panel: #16161a; --border: #26262b; --bull: #5B7FE8; --bear: #E85B6F; }
            body { background: var(--bg); color: #f0f0f5; font-family: 'JetBrains Mono', monospace; padding: 2rem; margin:0; }
            .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(500px, 1fr)); gap: 1.5rem; }
            .card { background: var(--panel); border: 1px solid var(--border); border-radius: 4px; display: grid; grid-template-columns: 140px 1fr; overflow: hidden; }
            .score-side { padding: 1.5rem; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.2); border-right: 1px solid var(--border); }
            .score-big { font-size: 2.5rem; font-weight: 800; margin: 0.5rem 0; }
            .bias-tag { font-size: 0.6rem; font-weight: 800; padding: 0.4rem; text-align: center; width: 100%; border-radius: 2px; }
            .main-content { padding: 1.5rem; }
            .stat-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #1c1c21; font-size: 0.75rem; }
            .tech-pills { display: flex; gap: 0.5rem; margin-top: 1rem; }
            .pill { font-size: 0.55rem; padding: 0.2rem 0.5rem; border: 1px solid var(--border); border-radius: 2px; }
            .c-bull { color: var(--bull); } .c-bear { color: var(--bear); }
            .bg-bull { background: var(--bull); color: #000; } .bg-bear { background: var(--bear); color: #fff; }
        </style>
        <script>
            async function refresh() {
                const r = await fetch('/api/v1/market');
                const data = await r.json();
                document.getElementById('grid').innerHTML = data.map(a => {
                    const isBull = a.scores.total >= 0;
                    return `
                    <div class="card">
                        <div class="score-side">
                            <div style="font-size:0.6rem; color:#666">CONVICTION</div>
                            <div class="score-big ${isBull ? 'c-bull' : 'c-bear'}">${a.scores.total > 0 ? '+' : ''}${a.scores.total}</div>
                            <div class="bias-tag ${isBull ? 'bg-bull' : 'bg-bear'}">${a.bias}</div>
                        </div>
                        <div class="main-content">
                            <div style="display:flex; justify-content:space-between; margin-bottom:1rem">
                                <span style="font-weight:800; font-size:1.1rem">${a.name}</span>
                                <span style="font-size:0.9rem">${a.price.toLocaleString()}</span>
                            </div>
                            <div class="stat-row"><span>Technical (Max 3)</span><span class="val">${a.scores.technical}</span></div>
                            <div class="stat-row"><span>Institutional (COT)</span><span class="val">${a.scores.institutional}</span></div>
                            <div class="stat-row"><span>Fundamental/Macro</span><span class="val">${a.scores.fundamental}</span></div>
                            <div class="tech-pills">
                                ${Object.entries(a.tech_details).map(([k,v]) => `<span class="pill ${v==='BULLISH' ? 'c-bull' : 'c-bear'}">${k}</span>`).join('')}
                            </div>
                            <div style="font-size:0.5rem; color:#444; margin-top:1rem">COT STATUS: ${a.cot_details.status || 'N/A'} (Long: ${a.cot_details.perc_long || '--'}%)</div>
                        </div>
                    </div>`;
                }).join('');
            }
            setInterval(refresh, 20000); refresh();
        </script>
    </head>
    <body>
        <div class="top-bar">
            <div style="font-weight:900; font-size:1.4rem">NYX STRATEGIC <span style="color:var(--bull)">TERMINAL</span></div>
            <div style="font-size:0.7rem; color:var(--bull)">● CORE LOGIC REFACTORED (ACCURACY: HIGH)</div>
        </div>
        <div class="grid" id="grid"></div>
    </body>
    </html>
    """

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3345)
