from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.core.full_engine import EdgeFinderFullEngine
import uvicorn

app = FastAPI(title="Trade Pilot X - 1:1 EdgeFinder Structure")
engine = EdgeFinderFullEngine()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/v1/market")
def get_data():
    # Only Gold and SPX for the deep-structure test
    return [
        engine.get_full_asset_analysis("GC=F", "XAUUSD"),
        engine.get_full_asset_analysis("^GSPC", "SPX500")
    ]

@app.get("/", response_class=HTMLResponse)
def ui():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8"><title>TRADE PILOT X | FULL STRUCTURE</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
            :root { --bg: #1E1E24; --card: #2A2A32; --border: #3A3A44; --bull: #5B7FE8; --bear: #E85B6F; --text: #E8E8EE; --dim: #8A8A96; }
            body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; padding: 1.5rem; margin: 0; font-size: 13px; }
            .header { border-bottom: 1px solid var(--border); padding-bottom: 1rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; }
            .grid { display: grid; grid-template-columns: 1fr; gap: 3rem; }
            .ef-container { display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; background: var(--card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; padding: 1.5rem; }
            
            /* LEFT PANEL */
            .left-panel { border-right: 1px solid var(--border); padding-right: 1.5rem; }
            .bias-gauge { width: 150px; height: 75px; border-radius: 150px 150px 0 0; border: 15px solid #222; border-bottom: 0; margin: 1rem auto; position: relative; }
            .score-big { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); font-size: 2.5rem; font-weight: 800; }
            .bias-pill { background: var(--bull); color: #000; padding: 0.5rem; border-radius: 20px; text-align: center; font-weight: 800; text-transform: uppercase; margin: 1rem 0; }
            .sma-list { margin-top: 1.5rem; }
            .sma-row { display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #333; font-size: 0.75rem; }
            
            /* RIGHT PANEL */
            .right-panels { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); gap: 1rem; }
            .signal-card { border: 1px solid var(--border); background: rgba(0,0,0,0.1); border-radius: 4px; display: flex; flex-direction: column; }
            .sc-header { background: #333; padding: 0.5rem; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; display: flex; justify-content: space-between; }
            .sc-body { padding: 1rem; flex-grow: 1; }
            .sc-metric { display: flex; justify-content: space-between; font-size: 0.7rem; padding: 0.3rem 0; border-bottom: 1px solid #2d2d2d; color: var(--dim); }
            
            .c-bull { color: var(--bull); font-weight: 700; } .c-bear { color: var(--bear); font-weight: 700; }
            .bg-bull { background: var(--bull); } .bg-bear { background: var(--bear); color: #fff; }
        </style>
        <script>
            async function load() {
                const r = await fetch('/api/v1/market');
                const data = await r.json();
                document.getElementById('grid').innerHTML = data.map(a => `
                    <div class="ef-container">
                        <div class="left-panel">
                            <div style="font-weight:800; color:var(--dim)">Symbol: ${a.symbol}</div>
                            <div class="bias-gauge" style="border-top-color: ${a.bias_score >= 0 ? 'var(--bull)' : 'var(--bear)'}">
                                <div class="score-big ${a.bias_score >= 0 ? 'c-bull' : 'c-bear'}">${a.bias_score}</div>
                            </div>
                            <div class="bias-pill ${a.bias_score >= 0 ? 'bg-bull' : 'bg-bear'}">${a.bias_label}</div>
                            <div class="sma-list">
                                ${Object.entries(a.panels.technical.smas).map(([k,v]) => `
                                    <div class="sma-row"><span>${k}</span><span class="${v==='Bullish' ? 'c-bull' : 'c-bear'}">${v}</span></div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="right-panels">
                            <div class="signal-card">
                                <div class="sc-header">Technical Signal <span class="${a.panels.technical.score >= 0 ? 'c-bull' : 'c-bear'}">${a.panels.technical.signal}</span></div>
                                <div class="sc-body">
                                    <div class="sc-metric"><span>Seasonality</span><span class="${a.panels.technical.metrics.seasonality_10y==='Bullish'?'c-bull':'c-bear'}">${a.panels.technical.metrics.seasonality_10y}</span></div>
                                    <div class="sc-metric"><span>Trend</span><span class="${a.panels.technical.metrics.trend_4h_d==='Bullish'?'c-bull':'c-bear'}">${a.panels.technical.metrics.trend_4h_d}</span></div>
                                </div>
                            </div>
                            <div class="signal-card">
                                <div class="sc-header">Institutional (COT) <span class="${a.panels.institutional.score >= 0 ? 'c-bull' : 'c-bear'}">${a.panels.institutional.signal}</span></div>
                                <div class="sc-body">
                                    <div class="sc-metric"><span>Net Positioning</span><span class="${a.panels.institutional.metrics.net_positioning==='Bullish'?'c-bull':'c-bear'}">${a.panels.institutional.metrics.net_positioning}</span></div>
                                    <div class="sc-metric"><span>Weekly Change</span><span class="${a.panels.institutional.metrics.weekly_change==='Bullish'?'c-bull':'c-bear'}">${a.panels.institutional.metrics.weekly_change}</span></div>
                                </div>
                            </div>
                            <div class="signal-card">
                                <div class="sc-header">Sentiment Bias <span class="c-bull">${a.panels.sentiment.signal}</span></div>
                                <div class="sc-body">
                                    <div class="sc-metric"><span>Retail Sentiment</span><span>${a.panels.sentiment.metrics.sentiment_pct}%</span></div>
                                    <div class="sc-metric"><span>Crowd Bias</span><span class="c-bull">Bullish</span></div>
                                </div>
                            </div>
                            <div class="signal-card">
                                <div class="sc-header">Eco Growth Signal <span class="c-bull">Bullish</span></div>
                                <div class="sc-body">
                                    ${Object.entries(a.panels.fundamental.eco_growth.metrics).map(([k,v]) => `
                                        <div class="sc-metric"><span>${k.toUpperCase()}</span><span class="${v==='Bullish'?'c-bull':'c-bear'}">${v}</span></div>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="signal-card">
                                <div class="sc-header">Jobs Market Signal <span class="c-bear">Bearish</span></div>
                                <div class="sc-body">
                                    ${Object.entries(a.panels.fundamental.jobs_market.metrics).map(([k,v]) => `
                                        <div class="sc-metric"><span>${k.toUpperCase()}</span><span class="${v==='Bullish'?'c-bull':'c-bear'}">${v}</span></div>
                                    `).join('')}
                                </div>
                            </div>
                            <div class="signal-card">
                                <div class="sc-header">Inflation Data <span class="c-bull">Neutral</span></div>
                                <div class="sc-body">
                                    ${Object.entries(a.panels.fundamental.inflation.metrics).map(([k,v]) => `
                                        <div class="sc-metric"><span>${k.toUpperCase()}</span><span class="${v==='Bullish'?'c-bull':'c-bear'}">${v}</span></div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
            load();
        </script>
    </head>
    <body>
        <div class="header">
            <div style="font-weight:800; font-size:1.4rem">EDGEFINDER <span style="color:var(--bull)">NYX EDITION</span></div>
            <div style="font-size:0.7rem; color:var(--dim)">● STRUCTURE 1:1 REPLICATION</div>
        </div>
        <div class="grid" id="grid"></div>
    </body>
    </html>
    """

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3346)
