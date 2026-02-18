from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.core.live_bridge import TradePilotApp
from app.core.data_hub import DataHub
import uvicorn
import datetime

app = FastAPI(title="Trade Pilot X - Terminal")
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
            
            # Merge EdgeFinder intelligence with live technical
            sentiment_val = context.get("sentiment", {}).get("score", 0) if isinstance(context.get("sentiment"), dict) else context.get("sentiment", 0)
            macro_val = context.get("macro", {}).get("score", 0) if isinstance(context.get("macro"), dict) else context.get("macro", 0)
            
            live["sentiment_score"] = sentiment_val
            live["eco_score"] = macro_val
            live["total_score"] = live["technical_score"] + live["sentiment_score"] + live["eco_score"]
            
            # Recalc bias
            if live["total_score"] >= 6:
                live["bias"] = "STRONG BUY"
            elif live["total_score"] >= 2:
                live["bias"] = "BUY"
            elif live["total_score"] <= -6:
                live["bias"] = "STRONG SELL"
            elif live["total_score"] <= -2:
                live["bias"] = "SELL"
            else:
                live["bias"] = "NEUTRAL"
                
            results.append(live)
        except Exception as e:
            print(f"Error fetching {name}: {e}")
            
    return results

@app.get("/", response_class=HTMLResponse)
def get_ui():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TRADE PILOT X | TERMINAL</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg: #000000;
                --card-bg: #080808;
                --border: #1a1a1a;
                --accent: #00ff88;
                --danger: #ff3366;
                --text-main: #ffffff;
                --text-dim: #666666;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                background: var(--bg); 
                color: var(--text-main); 
                font-family: 'Inter', sans-serif; 
                padding: 1.5rem;
                overflow-x: hidden;
            }
            .header { 
                display: flex; 
                justify-content: space-between; 
                align-items: flex-end;
                margin-bottom: 2rem; 
                border-bottom: 1px solid var(--border);
                padding-bottom: 1rem;
            }
            .logo-container { display: flex; align-items: baseline; gap: 0.5rem; }
            .logo { font-size: 1.5rem; font-weight: 900; letter-spacing: -1px; }
            .logo span { color: var(--accent); }
            .ver { font-family: 'JetBrains Mono'; font-size: 0.6rem; color: var(--text-dim); }
            
            .clock-container { text-align: right; font-family: 'JetBrains Mono'; }
            #clock { font-size: 0.8rem; font-weight: 700; }
            .status-tag { font-size: 0.5rem; color: var(--accent); letter-spacing: 2px; text-transform: uppercase; }

            .grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); 
                gap: 1rem; 
            }
            
            .card { 
                background: var(--card-bg); 
                border: 1px solid var(--border); 
                padding: 1.25rem;
                position: relative;
                overflow: hidden;
                transition: transform 0.2s, border-color 0.2s;
            }
            .card:hover { border-color: #333; transform: translateY(-2px); }
            
            .card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
            .asset-info { display: flex; flex-direction: column; }
            .asset-name { font-size: 0.7rem; color: var(--text-dim); font-weight: 700; text-transform: uppercase; }
            .asset-symbol { font-size: 1.2rem; font-weight: 900; }
            
            .bias-badge { 
                font-size: 0.6rem; 
                font-weight: 900; 
                padding: 0.4rem 0.8rem; 
                border-radius: 2px;
                letter-spacing: 1px;
            }
            .bias-STRONG-BUY { background: var(--accent); color: #000; }
            .bias-BUY { border: 1px solid var(--accent); color: var(--accent); }
            .bias-STRONG-SELL { background: var(--danger); color: #fff; }
            .bias-SELL { border: 1px solid var(--danger); color: var(--danger); }
            .bias-NEUTRAL { background: #333; color: #fff; }

            .price-row { margin-bottom: 1.5rem; }
            .current-price { font-size: 2.5rem; font-weight: 900; letter-spacing: -2px; line-height: 1; }
            
            .score-bar-container { margin-bottom: 1.5rem; }
            .score-label { display: flex; justify-content: space-between; font-size: 0.7rem; margin-bottom: 0.4rem; font-weight: 700; }
            .score-total { font-family: 'JetBrains Mono'; }
            .bar-bg { background: #111; height: 6px; width: 100%; position: relative; }
            .bar-fill { height: 100%; transition: width 0.5s ease-out; }
            
            .metrics { 
                display: grid; 
                grid-template-columns: repeat(2, 1fr); 
                gap: 0.75rem;
                padding-top: 1rem;
                border-top: 1px solid var(--border);
            }
            .metric-item { display: flex; flex-direction: column; }
            .m-label { font-size: 0.55rem; color: var(--text-dim); font-weight: 700; text-transform: uppercase; margin-bottom: 0.2rem; }
            .m-val { font-family: 'JetBrains Mono'; font-size: 0.8rem; font-weight: 700; }
            .m-val span { color: var(--text-dim); font-weight: 400; font-size: 0.7rem; }

            .scan-line {
                position: absolute;
                top: 0; left: 0; width: 100%; height: 2px;
                background: rgba(0, 255, 136, 0.1);
                animation: scan 4s linear infinite;
                pointer-events: none;
            }
            @keyframes scan {
                0% { top: 0; }
                100% { top: 100%; }
            }

            @media (max-width: 600px) {
                body { padding: 1rem; }
                .grid { grid-template-columns: 1fr; }
            }
        </style>
        <script>
            function updateClock() {
                const now = new Date();
                document.getElementById('clock').innerText = now.toTimeString().split(' ')[0] + ' ' + Intl.DateTimeFormat().resolvedOptions().timeZone;
            }

            async function refresh() {
                try {
                    const res = await fetch('/api/v1/market');
                    const data = await res.json();
                    const container = document.getElementById('market-grid');
                    
                    container.innerHTML = data.map(item => {
                        const score = item.total_score;
                        const scorePct = Math.min(Math.max((score + 10) * 5, 0), 100);
                        const color = score >= 0 ? 'var(--accent)' : 'var(--danger)';
                        const biasClass = 'bias-' + item.bias.replace(' ', '-');
                        
                        return `
                        <div class="card">
                            <div class="scan-line"></div>
                            <div class="card-top">
                                <div class="asset-info">
                                    <span class="asset-name">${item.symbol}</span>
                                    <span class="asset-symbol">${item.name}</span>
                                </div>
                                <div class="bias-badge ${biasClass}">${item.bias}</div>
                            </div>
                            
                            <div class="price-row">
                                <div class="current-price">${item.breakdown.technical.current_price || '---'}</div>
                            </div>

                            <div class="score-bar-container">
                                <div class="score-label">
                                    <span>CONVICTION INDEX</span>
                                    <span class="score-total" style="color:${color}">${score > 0 ? '+' : ''}${score}/10</span>
                                </div>
                                <div class="bar-bg">
                                    <div class="bar-fill" style="width: ${scorePct}%; background: ${color}"></div>
                                </div>
                            </div>

                            <div class="metrics">
                                <div class="metric-item">
                                    <span class="m-label">Technical</span>
                                    <span class="m-val">${item.technical_score}<span>/3</span></span>
                                </div>
                                <div class="metric-item">
                                    <span class="m-label">Sentiment</span>
                                    <span class="m-val">${item.sentiment_score}<span>/2</span></span>
                                </div>
                                <div class="metric-item">
                                    <span class="m-label">Macro/Eco</span>
                                    <span class="m-val">${item.eco_score}<span>/5</span></span>
                                </div>
                                <div class="metric-item">
                                    <span class="m-label">Seasonality</span>
                                    <span class="m-val">0<span>/2</span></span>
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('');
                } catch (e) {
                    console.error('Update Error:', e);
                }
            }

            setInterval(updateClock, 1000);
            setInterval(refresh, 15000);
            refresh();
            updateClock();
        </script>
    </head>
    <body>
        <div class="header">
            <div class="logo-container">
                <div class="logo">TRADE PILOT <span>X</span></div>
                <div class="ver">v1.1-ALPHA</div>
            </div>
            <div class="clock-container">
                <div class="status-tag">● System Live</div>
                <div id="clock">00:00:00 UTC</div>
            </div>
        </div>
        
        <div class="grid" id="market-grid">
            <!-- Cards injected via JS -->
        </div>

        <div style="margin-top: 3rem; color: #1a1a1a; font-size: 0.6rem; letter-spacing: 5px; text-align: center;">
            PROPRIETARY INTEL ENGINE // GEORGE PATRU EDITION
        </div>
    </body>
    </html>
    """

if __name__ == "__main__":
    # Using 3338 to avoid any remaining conflicts from 3337/3336
    uvicorn.run(app, host="127.0.0.1", port=3338)
