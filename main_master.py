from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.core.master_logic import MasterLogicEngine
import uvicorn

app = FastAPI(title="Trade Pilot X - Master OS")
master = MasterLogicEngine()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/v1/market")
def get_master_data():
    assets = [
        ("GC=F", "GOLD"),
        ("EURUSD=X", "EURUSD"),
        ("JPY=X", "USDJPY"),
        ("CL=F", "USOIL"),
        ("^GSPC", "SPX500")
    ]
    return [master.get_real_trade_analysis(t, n) for t, n in assets]

@app.get("/", response_class=HTMLResponse)
def ui():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8"><title>TRADE PILOT X | MASTER TERMINAL</title>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
        <style>
            :root { --bg: #050505; --p: #0f0f11; --border: #1a1a1c; --blue: #5B7FE8; --coral: #E85B6F; }
            body { background: var(--bg); color: #e0e0e5; font-family: 'JetBrains Mono', monospace; padding: 2rem; font-size: 13px; }
            .header { border-bottom: 2px solid var(--border); padding-bottom: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-end; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(450px, 1fr)); gap: 1.5rem; }
            .card { background: var(--p); border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
            .card-header { padding: 1.25rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
            .card-body { padding: 1.5rem; }
            .score-box { font-size: 2.2rem; font-weight: 800; margin-bottom: 1rem; }
            .data-table { width: 100%; border-collapse: collapse; }
            .data-table td { padding: 8px 0; border-bottom: 1px solid #141416; }
            .label { color: #666; font-size: 10px; text-transform: uppercase; }
            .val { text-align: right; font-weight: 700; }
            .c-bull { color: var(--blue); } .c-bear { color: var(--coral); }
            .bias-pill { font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 2px; }
            .bg-bull { background: var(--blue); color: #000; } .bg-bear { background: var(--coral); color: #fff; }
        </style>
        <script>
            async function sync() {
                const r = await fetch('/api/v1/market');
                const data = await r.json();
                document.getElementById('grid').innerHTML = data.map(a => `
                    <div class="card">
                        <div class="card-header">
                            <div style="font-weight:800; font-size:1.1rem">${a.symbol}</div>
                            <div class="bias-pill ${a.score >= 0 ? 'bg-bull' : 'bg-bear'}">${a.bias}</div>
                        </div>
                        <div class="card-body">
                            <div class="score-box ${a.score >= 0 ? 'c-bull' : 'c-bear'}">${a.score > 0 ? '+' : ''}${a.score}</div>
                            <table class="data-table">
                                <tr><td class="label">Current Price</td><td class="val">$${a.price.toLocaleString()}</td></tr>
                                <tr><td class="label">Technical Signal</td><td class="val ${a.breakdown.technical.score > 0 ? 'c-bull' : 'c-bear'}">${a.breakdown.technical.status}</td></tr>
                                <tr><td class="label">COT Institutional</td><td class="val">${a.breakdown.institutional.net_long}% Long</td></tr>
                                <tr><td class="label">Retail Sentiment</td><td class="val ${a.breakdown.retail.score > 0 ? 'c-bull' : 'c-bear'}">${a.breakdown.retail.long_pct}% Long</td></tr>
                            </table>
                            ${a.trades_active.length > 0 ? `<div style="margin-top:1rem; padding:10px; background:rgba(91,127,232,0.1); border-left:3px solid var(--blue); font-size:11px">LIVE TRADE: ${a.trades_active[0]}</div>` : ''}
                        </div>
                    </div>
                `).join('');
            }
            setInterval(sync, 30000); sync();
        </script>
    </head>
    <body>
        <div class="header">
            <div style="font-size:1.5rem; font-weight:800">NYX <span style="color:var(--blue)">MASTER TERMINAL</span></div>
            <div style="font-size:0.7rem; color:#444">REAL-TIME DATA FEED: CFTC + MYFXBOOK + YFINANCE</div>
        </div>
        <div class="grid" id="grid"></div>
    </body>
    </html>
    """

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3347)
