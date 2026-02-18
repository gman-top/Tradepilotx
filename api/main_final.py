from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.core.live_bridge import TradePilotApp
from app.core.data_hub import DataHub
from app.core.news_analyzer import NewsAnalyzer
import uvicorn
import json

app = FastAPI(title="Trade Pilot X - Full Terminal")
pilot = TradePilotApp()
hub = DataHub()
news_engine = NewsAnalyzer()

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
        ("^GSPC", "SPX500"),
        ("ETH-USD", "ETH"),
        ("AUDUSD=X", "AUDUSD"),
        ("^GDAXI", "GER40")
    ]
    results = []
    for ticker, name in symbols:
        try:
            live = pilot.get_live_analysis(ticker, name)
            context = hub.get_asset_context(name)
            
            # 1. EdgeFinder Intelligence
            sentiment_val = context.get("sentiment", {}).get("score", 0) if isinstance(context.get("sentiment"), dict) else context.get("sentiment", 0)
            macro_val = context.get("macro", {}).get("score", 0) if isinstance(context.get("macro"), dict) else context.get("macro", 0)
            
            # 2. News Intelligence (Simulated feed for now, MiniMax Analysis)
            # In production, this would pull from a real news API
            news_data = news_engine.analyze_market_sentiment(name, f"Latest market sentiment for {name} shows stable volume and institutional interest.")
            news_score = news_data.get("score", 0)
            news_summary = news_data.get("summary", "Market news stable.")

            live["sentiment_score"] = sentiment_val
            live["eco_score"] = macro_val
            live["news_score"] = news_score
            live["news_summary"] = news_summary
            
            # 3. Final Weighted Score (Claude + MiniMax logic)
            live["total_score"] = live["technical_score"] + sentiment_val + macro_val + (news_score // 2)
            
            # Formatting
            current_price = live.get("breakdown", {}).get("technical", {}).get("current_price")
            live["display_price"] = f"{current_price:,.2f}" if current_price else "---"
            
            # EdgeFinder Bias Mapping
            score = live["total_score"]
            if score >= 7: live["bias"] = "STRONG BUY"
            elif score >= 3: live["bias"] = "BUY"
            elif score >= 1: live["bias"] = "WEAK BUY"
            elif score <= -7: live["bias"] = "STRONG SELL"
            elif score <= -3: live["bias"] = "SELL"
            elif score <= -1: live["bias"] = "WEAK SELL"
            else: live["bias"] = "NEUTRAL"
            
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
        <title>TRADE PILOT X | TERMINAL PRO</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg: #050505;
                --card-bg: #0d0d0e;
                --header-bg: #111;
                --border: #1a1a1c;
                --bullish: #3b82f6;
                --bearish: #ef4444;
                --text-main: #ffffff;
                --text-dim: #555;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: var(--bg); color: var(--text-main); font-family: 'Inter', sans-serif; padding: 1.5rem; }
            
            .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); margin-bottom: 2rem; }
            .logo { font-size: 1.4rem; font-weight: 900; letter-spacing: -1px; }
            .logo span { color: var(--bullish); }
            .status { font-family: 'JetBrains Mono'; font-size: 0.6rem; color: var(--bullish); letter-spacing: 2px; }

            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 1.5rem; }
            
            .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; transition: border-color 0.3s; }
            .card:hover { border-color: #333; }
            
            .card-top { padding: 1.25rem; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border); }
            .asset-meta h2 { font-size: 1.2rem; font-weight: 800; }
            .asset-meta p { font-size: 0.65rem; color: var(--text-dim); font-weight: 700; text-transform: uppercase; }
            
            .bias-pill { font-size: 0.6rem; font-weight: 900; padding: 0.4rem 0.8rem; border-radius: 2px; text-transform: uppercase; }
            .bias-STRONG-BUY { background: var(--bullish); color: #000; }
            .bias-BUY { border: 1px solid var(--bullish); color: var(--bullish); }
            .bias-STRONG-SELL { background: var(--bearish); color: #fff; }
            .bias-SELL { border: 1px solid var(--bearish); color: var(--bearish); }
            .bias-NEUTRAL { background: #222; color: #888; }

            .card-body { padding: 1.25rem; flex-grow: 1; }
            .price-display { font-family: 'JetBrains Mono'; font-size: 2.2rem; font-weight: 800; margin-bottom: 1rem; letter-spacing: -1px; }
            
            .score-section { margin-bottom: 1.5rem; }
            .score-header { display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-dim); font-weight: 800; margin-bottom: 0.5rem; }
            .score-bar-bg { background: #111; height: 4px; width: 100%; position: relative; }
            .score-bar-fill { height: 100%; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); }

            .data-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; border-top: 1px solid var(--border); padding-top: 1rem; }
            .data-item { display: flex; flex-direction: column; }
            .d-label { font-size: 0.55rem; color: var(--text-dim); font-weight: 800; text-transform: uppercase; margin-bottom: 0.2rem; }
            .d-val { font-family: 'JetBrains Mono'; font-size: 0.8rem; font-weight: 700; }
            .d-val span { color: var(--text-dim); font-weight: 400; font-size: 0.65rem; }

            .news-footer { background: #080808; padding: 0.75rem 1.25rem; font-size: 0.65rem; color: #777; border-top: 1px solid var(--border); font-style: italic; line-height: 1.4; }
        </style>
        <script>
            async function refresh() {
                try {
                    const res = await fetch('/api/v1/market');
                    const data = await res.json();
                    const container = document.getElementById('market-grid');
                    
                    container.innerHTML = data.map(item => {
                        const score = item.total_score;
                        const scorePct = Math.min(Math.max((score + 10) * 5, 0), 100);
                        const isBear = score < 0;
                        const accent = isBear ? 'var(--bearish)' : 'var(--bullish)';
                        const biasClass = 'bias-' + item.bias.replace(' ', '-');
                        
                        return `
                        <div class="card">
                            <div class="card-top">
                                <div class="asset-meta">
                                    <p>${item.symbol}</p>
                                    <h2>${item.name}</h2>
                                </div>
                                <div class="bias-pill ${biasClass}">${item.bias}</div>
                            </div>
                            <div class="card-body">
                                <div class="price-display">${item.display_price}</div>
                                <div class="score-section">
                                    <div class="score-header">
                                        <span>CONVICTION INDEX</span>
                                        <span style="color: ${accent}">${score > 0 ? '+' : ''}${score}/10</span>
                                    </div>
                                    <div class="score-bar-bg">
                                        <div class="score-bar-fill" style="width: ${scorePct}%; background: ${accent}"></div>
                                    </div>
                                </div>
                                <div class="data-grid">
                                    <div class="data-item">
                                        <span class="d-label">Technical</span>
                                        <span class="d-val">${item.technical_score}<span>/3</span></span>
                                    </div>
                                    <div class="data-item">
                                        <span class="d-label">Institutional</span>
                                        <span class="d-val">${item.sentiment_score}<span>/2</span></span>
                                    </div>
                                    <div class="data-item">
                                        <span class="d-label">Fundamental</span>
                                        <span class="d-val">${item.eco_score}<span>/5</span></span>
                                    </div>
                                    <div class="data-item">
                                        <span class="d-label">News Impact</span>
                                        <span class="d-val">${item.news_score}<span>/5</span></span>
                                    </div>
                                </div>
                            </div>
                            <div class="news-footer">
                                AI Intel: ${item.news_summary}
                            </div>
                        </div>
                        `;
                    }).join('');
                } catch (e) {
                    console.error('Update Error:', e);
                }
            }
            setInterval(refresh, 20000);
            refresh();
        </script>
    </head>
    <body>
        <div class="header">
            <div class="logo">TRADE PILOT <span>X</span></div>
            <div class="status">● MULTI-MODEL INTELLIGENCE ACTIVE (CLAUDE + MINIMAX)</div>
        </div>
        <div class="grid" id="market-grid">
            <!-- Cards -->
        </div>
    </body>
    </html>
    """

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=3340)
