from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.core.live_bridge import TradePilotApp
from app.core.data_hub import DataHub
import uvicorn
import json

app = FastAPI(title="Trade Pilot X - Pro Terminal")
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
            
            # Extract scores safely
            sentiment_val = context.get("sentiment", {}).get("score", 0) if isinstance(context.get("sentiment"), dict) else context.get("sentiment", 0)
            macro_val = context.get("macro", {}).get("score", 0) if isinstance(context.get("macro"), dict) else context.get("macro", 0)
            
            live["sentiment_score"] = sentiment_val
            live["eco_score"] = macro_val
            live["total_score"] = live["technical_score"] + live["sentiment_score"] + live["eco_score"]
            
            # Format price safely to avoid undefined
            tech = live.get("breakdown", {}).get("technical", {})
            current_price = tech.get("current_price")
            if current_price is None:
                live["display_price"] = "---"
            elif isinstance(current_price, (int, float)):
                live["display_price"] = f"{current_price:,.2f}"
            else:
                live["display_price"] = str(current_price)
            
            # Recalc bias for EdgeFinder levels
            score = live["total_score"]
            if score >= 7: live["bias"] = "STRONG BUY"
            elif score >= 3: live["bias"] = "BUY"
            elif score >= 1: live["bias"] = "WEAK BUY"
            elif score <= -7: live["bias"] = "STRONG SELL"
            elif score <= -3: live["bias"] = "SELL"
            elif score <= -1: live["bias"] = "WEAK SELL"
            else: live["bias"] = "NEUTRAL"
            
            # Map labels to EdgeFinder style
            live["name"] = name
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
        <title>TRADE PILOT X | PRO TERMINAL</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg: #0c0c0e;
                --card-bg: #141417;
                --header-bg: #1c1c21;
                --border: #26262b;
                --bullish: #3b82f6; /* EdgeFinder Blue */
                --bearish: #ef4444; /* EdgeFinder Red/Coral */
                --neutral: #94a3b8;
                --text-main: #f8fafc;
                --text-dim: #64748b;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                background: var(--bg); 
                color: var(--text-main); 
                font-family: 'Inter', sans-serif; 
                padding: 1rem;
            }
            
            /* TOP BAR */
            .top-bar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.75rem 1.5rem;
                background: var(--header-bg);
                border-radius: 6px;
                margin-bottom: 1.5rem;
                border: 1px solid var(--border);
            }
            .brand { display: flex; align-items: center; gap: 0.75rem; }
            .brand-icon { width: 32px; height: 32px; background: var(--bullish); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #000; }
            .brand-text h1 { font-size: 1rem; font-weight: 800; letter-spacing: -0.5px; }
            .brand-text p { font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; }

            .market-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
                gap: 1.5rem;
            }

            /* EDGEFINDER CARD STYLE */
            .ef-card {
                background: var(--card-bg);
                border: 1px solid var(--border);
                border-radius: 8px;
                overflow: hidden;
                display: grid;
                grid-template-columns: 140px 1fr;
            }

            /* LEFT PANEL: GAUGE & BIAS */
            .ef-left {
                padding: 1.25rem;
                border-right: 1px solid var(--border);
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                background: rgba(255,255,255,0.02);
            }
            .ef-sym-label { font-size: 0.65rem; color: var(--text-dim); font-weight: 700; margin-bottom: 0.25rem; }
            .ef-sym-name { font-size: 1.1rem; font-weight: 800; margin-bottom: 1rem; }
            
            .ef-gauge {
                width: 90px;
                height: 90px;
                border-radius: 50%;
                border: 8px solid #222;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 1rem;
                position: relative;
            }
            .ef-score-big { font-size: 1.5rem; font-weight: 800; font-family: 'JetBrains Mono'; }
            
            .ef-bias-pill {
                font-size: 0.6rem;
                font-weight: 800;
                padding: 0.4rem 0.8rem;
                border-radius: 20px;
                text-transform: uppercase;
                width: 100%;
            }

            /* RIGHT PANEL: DATA BOXES */
            .ef-right {
                display: grid;
                grid-template-rows: auto 1fr;
            }
            .ef-price-strip {
                padding: 0.75rem 1.25rem;
                border-bottom: 1px solid var(--border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .ef-price { font-family: 'JetBrains Mono'; font-size: 1.4rem; font-weight: 800; }
            
            .ef-data-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-template-rows: 1fr 1fr;
            }
            .ef-box {
                padding: 0.75rem 1rem;
                border-right: 1px solid var(--border);
                border-bottom: 1px solid var(--border);
            }
            .ef-box:nth-child(2n) { border-right: none; }
            .ef-box:nth-last-child(-n+2) { border-bottom: none; }
            
            .ef-box-h { font-size: 0.6rem; color: var(--text-dim); font-weight: 800; text-transform: uppercase; margin-bottom: 0.4rem; }
            .ef-box-val { font-size: 0.85rem; font-weight: 700; display: flex; justify-content: space-between; }
            .ef-box-score { font-family: 'JetBrains Mono'; font-size: 0.75rem; color: var(--text-dim); }

            /* DYNAMIC COLORS */
            .c-bull { color: var(--bullish); }
            .c-bear { color: var(--bearish); }
            .bg-bull { background: var(--bullish); color: #000; }
            .bg-bear { background: var(--bearish); color: #fff; }
            .bg-neut { background: #334155; color: #fff; }

            @media (max-width: 500px) {
                .market-grid { grid-template-columns: 1fr; }
                .ef-card { grid-template-columns: 1fr; }
                .ef-left { border-right: none; border-bottom: 1px solid var(--border); }
            }
        </style>
        <script>
            async function refresh() {
                try {
                    const res = await fetch('/api/v1/market');
                    const data = await res.json();
                    const container = document.getElementById('market-grid');
                    
                    container.innerHTML = data.map(item => {
                        const score = item.total_score;
                        const isBear = score < 0;
                        const colorClass = isBear ? 'c-bear' : 'c-bull';
                        const bgClass = isBear ? 'bg-bear' : 'bg-bull';
                        const neutralClass = score === 0 ? 'bg-neut' : bgClass;
                        
                        // Gauge rotation simulation
                        const rotation = (score / 10) * 180;
                        
                        return `
                        <div class="ef-card">
                            <div class="ef-left">
                                <span class="ef-sym-label">SYMBOL</span>
                                <span class="ef-sym-name">${item.name}</span>
                                <div class="ef-gauge" style="border-top-color: ${isBear ? 'var(--bearish)' : 'var(--bullish)'}">
                                    <span class="ef-score-big ${colorClass}">${score > 0 ? '+' : ''}${score}</span>
                                </div>
                                <div class="ef-bias-pill ${neutralClass}">${item.bias}</div>
                            </div>
                            <div class="ef-right">
                                <div class="ef-price-strip">
                                    <span class="ef-price">${item.display_price}</span>
                                    <span style="font-size:0.6rem; color:var(--text-dim)">LIVE FEED</span>
                                </div>
                                <div class="ef-data-grid">
                                    <div class="ef-box">
                                        <div class="ef-box-h">Technical Signal</div>
                                        <div class="ef-box-val">
                                            <span class="${item.technical_score < 0 ? 'c-bear' : 'c-bull'}">${item.technical_score < 0 ? 'BEARISH' : 'BULLISH'}</span>
                                            <span class="ef-box-score">${item.technical_score}/3</span>
                                        </div>
                                    </div>
                                    <div class="ef-box">
                                        <div class="ef-box-h">Institutional (COT)</div>
                                        <div class="ef-box-val">
                                            <span>STABLE</span>
                                            <span class="ef-box-score">--/2</span>
                                        </div>
                                    </div>
                                    <div class="ef-box">
                                        <div class="ef-box-h">Retail Sentiment</div>
                                        <div class="ef-box-val">
                                            <span class="${item.sentiment_score < 0 ? 'c-bear' : 'c-bull'}">${item.sentiment_score < 0 ? 'SHORT' : 'LONG'}</span>
                                            <span class="ef-box-score">${item.sentiment_score}/2</span>
                                        </div>
                                    </div>
                                    <div class="ef-box">
                                        <div class="ef-box-h">Fundamental (Eco)</div>
                                        <div class="ef-box-val">
                                            <span class="${item.eco_score < 0 ? 'c-bear' : 'c-bull'}">${item.eco_score < 0 ? 'WEAK' : 'STRONG'}</span>
                                            <span class="ef-box-score">${item.eco_score}/5</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('');
                } catch (e) {
                    console.error('Update Error:', e);
                }
            }
            setInterval(refresh, 15000);
            refresh();
        </script>
    </head>
    <body>
        <div class="top-bar">
            <div class="brand">
                <div class="brand-icon">X</div>
                <div class="brand-text">
                    <h1>TRADE PILOT PRO</h1>
                    <p>EdgeFinder Intelligent Scanner</p>
                </div>
            </div>
            <div style="text-align: right">
                <div style="font-size: 0.8rem; font-weight: 700; font-family: 'JetBrains Mono';">SYSTEM OPERATIONAL</div>
                <div style="font-size: 0.5rem; color: var(--bullish); letter-spacing: 2px;">● LIVE DATA STREAM</div>
            </div>
        </div>
        
        <div class="market-grid" id="market-grid">
            <!-- Cards injected via JS -->
        </div>

        <div style="margin-top: 3rem; color: #1c1c21; font-size: 0.6rem; letter-spacing: 5px; text-align: center; font-weight: 800;">
            PROPRIETARY ARCHITECTURE // DESIGNED FOR ALPHA
        </div>
    </body>
    </html>
    """

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3339)
