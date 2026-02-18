from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.core.alpha_engine import AlphaTradingEngine
from app.core.intelligence_hub import IntelligenceHub
import uvicorn

app = FastAPI(title="Trade Pilot X - Pro Alpha")
engine = AlphaTradingEngine()
hub = IntelligenceHub()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/v1/market")
def get_alpha_data():
    assets = [
        ("GC=F", "GOLD"),
        ("EURUSD=X", "EURUSD"),
        ("CL=F", "USOIL"),
        ("JPY=X", "USDJPY"),
        ("^GSPC", "SPX500"),
        ("BTC-USD", "BITCOIN"),
        ("GBPUSD=X", "GBPUSD")
    ]
    return [engine.get_market_analysis(t, n, hub.get_asset_intel(n)) for t, n in assets]

@app.get("/", response_class=HTMLResponse)
def pro_ui():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8"><title>TRADE PILOT X | PRO ALPHA TERMINAL</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg: #111114;
                --card: #1c1c21;
                --border: #2d2d35;
                --bullish: #5B7FE8; /* EdgeFinder Blue */
                --bearish: #E85B6F; /* EdgeFinder Coral */
                --text: #F0F0F5;
                --text-dim: #8A8A96;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; padding: 1.5rem; overflow-x: hidden; }
            
            .terminal-header { 
                display: flex; justify-content: space-between; align-items: flex-end;
                padding-bottom: 1rem; border-bottom: 1px solid var(--border); margin-bottom: 2rem;
            }
            .logo { font-size: 1.5rem; font-weight: 800; letter-spacing: -1px; }
            .logo span { color: var(--bullish); }
            .status-line { font-family: 'JetBrains Mono'; font-size: 0.6rem; color: var(--bullish); letter-spacing: 2px; text-transform: uppercase; }

            .alpha-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 1.5rem; }
            
            .pro-card {
                background: var(--card); border: 1px solid var(--border); border-radius: 8px;
                display: grid; grid-template-columns: 160px 1fr; overflow: hidden;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }

            /* LEFT PANEL: CONVICTION GAUGE */
            .conviction-panel {
                padding: 1.5rem; background: rgba(0,0,0,0.2);
                border-right: 1px solid var(--border);
                display: flex; flex-direction: column; align-items: center; text-align: center;
            }
            .symbol-label { font-size: 0.6rem; color: var(--text-dim); font-weight: 800; text-transform: uppercase; }
            .symbol-name { font-size: 1.2rem; font-weight: 800; margin-bottom: 1rem; }
            
            .gauge-wrap {
                width: 100px; height: 100px; border-radius: 50%; 
                border: 8px solid #222; display: flex; align-items: center; justify-content: center;
                margin-bottom: 1.5rem; position: relative;
            }
            .score-val { font-family: 'JetBrains Mono'; font-size: 1.8rem; font-weight: 800; }
            
            .bias-badge {
                font-size: 0.6rem; font-weight: 900; padding: 0.5rem; width: 100%;
                border-radius: 4px; letter-spacing: 1px;
            }

            /* RIGHT PANEL: DATA BOXES */
            .data-panel { display: flex; flex-direction: column; }
            .price-strip {
                padding: 1rem 1.5rem; border-bottom: 1px solid var(--border);
                display: flex; justify-content: space-between; align-items: center;
            }
            .price-val { font-family: 'JetBrains Mono'; font-size: 1.6rem; font-weight: 700; }
            .price-chg { font-size: 0.75rem; font-weight: 800; }

            .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; flex-grow: 1; }
            .metric-box { padding: 1rem 1.25rem; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
            .metric-box:nth-child(2n) { border-right: none; }
            .metric-box:nth-last-child(-n+2) { border-bottom: none; }
            
            .m-label { font-size: 0.55rem; color: var(--text-dim); font-weight: 800; text-transform: uppercase; margin-bottom: 0.4rem; }
            .m-flex { display: flex; justify-content: space-between; align-items: center; }
            .m-status { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.5px; }
            .m-score { font-family: 'JetBrains Mono'; font-size: 0.7rem; color: var(--text-dim); }

            /* HELPERS */
            .c-bull { color: var(--bullish); } .c-bear { color: var(--bearish); }
            .bg-bull { background: var(--bullish); color: #fff; } .bg-bear { background: var(--bearish); color: #fff; }
            .bg-neut { background: #333; color: #fff; }

            .sma-strip { background: #141418; padding: 0.5rem 1.5rem; font-size: 0.55rem; color: var(--text-dim); display: flex; gap: 1rem; }
            .sma-item span { color: #fff; font-weight: 800; }
        </style>
        <script>
            async function sync() {
                try {
                    const r = await fetch('/api/v1/market');
                    const data = await r.json();
                    document.getElementById('alpha-grid').innerHTML = data.map(a => {
                        const total = a.scores.total;
                        const isBull = total > 0;
                        const colorClass = isBull ? 'c-bull' : 'c-bear';
                        const bgClass = total >= 3 ? 'bg-bull' : (total <= -3 ? 'bg-bear' : 'bg-neut');
                        
                        return `
                        <div class="pro-card">
                            <div class="conviction-panel">
                                <div class="symbol-label">CONVICTION</div>
                                <div class="symbol-name">${a.name}</div>
                                <div class="gauge-wrap" style="border-top-color: ${isBull ? 'var(--bullish)' : 'var(--bearish)'}">
                                    <div class="score-val ${colorClass}">${total > 0 ? '+' : ''}${total}</div>
                                </div>
                                <div class="bias-badge ${bgClass}">${a.bias}</div>
                            </div>
                            <div class="data-panel">
                                <div class="price-strip">
                                    <div class="price-val">${a.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                                    <div class="price-chg ${a.change_24h >= 0 ? 'c-bull' : 'c-bear'}">
                                        ${a.change_24h >= 0 ? '▲' : '▼'} ${Math.abs(a.change_24h).toFixed(2)}%
                                    </div>
                                </div>
                                <div class="metrics-grid">
                                    <div class="metric-box">
                                        <div class="m-label">Technical Signal</div>
                                        <div class="m-flex">
                                            <span class="m-status ${a.signals.technical === 'BULLISH' ? 'c-bull' : 'c-bear'}">${a.signals.technical}</span>
                                            <span class="m-score">${a.scores.technical}/3</span>
                                        </div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="m-label">Institutional (COT)</div>
                                        <div class="m-flex">
                                            <span class="m-status ${a.signals.institutional === 'BULLISH' ? 'c-bull' : 'c-bear'}">${a.signals.institutional}</span>
                                            <span class="m-score">--/2</span>
                                        </div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="m-label">Retail Sentiment</div>
                                        <div class="m-flex">
                                            <span class="m-status ${a.signals.retail === 'SHORT' ? 'c-bull' : 'c-bear'}">${a.signals.retail}</span>
                                            <span class="m-score">--/2</span>
                                        </div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="m-label">Fundamental (Eco)</div>
                                        <div class="m-flex">
                                            <span class="m-status ${a.signals.fundamental === 'STRONG' ? 'c-bull' : 'c-bear'}">${a.signals.fundamental}</span>
                                            <span class="m-score">${a.scores.fundamental}/5</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="sma-strip">
                                    <div class="sma-item">SMA20: <span class="${a.smas['20'] === 'BULLISH' ? 'c-bull' : 'c-bear'}">●</span></div>
                                    <div class="sma-item">SMA50: <span class="${a.smas['50'] === 'BULLISH' ? 'c-bull' : 'c-bear'}">●</span></div>
                                    <div class="sma-item">SMA100: <span class="${a.smas['100'] === 'BULLISH' ? 'c-bull' : 'c-bear'}">●</span></div>
                                    <div class="sma-item">SMA200: <span class="${a.smas['200'] === 'BULLISH' ? 'c-bull' : 'c-bear'}">●</span></div>
                                    <div style="margin-left:auto; font-weight:800">VOL: ${a.volatility}</div>
                                </div>
                            </div>
                        </div>`;
                    }).join('');
                } catch(e) {}
            }
            setInterval(sync, 15000); sync();
        </script>
    </head>
    <body>
        <div class="terminal-header">
            <div class="brand">
                <div class="status-line">● Strategic Intel Active</div>
                <div class="logo">TRADE PILOT <span>X</span> ALPHA</div>
            </div>
            <div style="text-align: right; font-size: 0.6rem; color: var(--text-dim);">
                NYX STRATEGIC OPERATING SYSTEM<br>INSTITUTIONAL GRADE ALPHA ENGINE
            </div>
        </div>
        <div class="alpha-grid" id="alpha-grid"></div>
    </body>
    </html>
    """

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3343)
