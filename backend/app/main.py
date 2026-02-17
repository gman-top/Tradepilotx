from fastapi import FastAPI, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from app.core.nyx_engine import NYXStrategicEngine
from app.core.cot_fetcher import COTFetcher
import uvicorn
import json
from datetime import datetime

app = FastAPI(title="Trade Pilot X - Master API")
engine = NYXStrategicEngine()
cot_fetcher = COTFetcher()

# Initialize data
engine.sync_external_data()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to your domain
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── EXISTING DASHBOARD ENDPOINT ───
@app.get("/api/v1/market")
def get_market():
    assets = [
        ("GC=F", "GOLD"),
        ("EURUSD=X", "EURUSD"),
        ("JPY=X", "USDJPY"),
        ("CL=F", "USOIL"),
        ("^GSPC", "SPX500"),
        ("BTC-USD", "BTC"),
        ("GBPUSD=X", "GBPUSD")
    ]
    return [engine.full_analysis(t, n) for t, n in assets]

# ─── NEW FRONTEND COMPATIBILITY ENDPOINTS ───

@app.post("/api/cftc/batch")
async def get_cftc_batch(payload: dict = Body(...)):
    """Matches the expected response of fetchAllAssetsLatest in cotDataService.ts"""
    # Current implementation uses our scraped/historical data
    # We transform it into the CFTC raw format or the normalized format expected by React
    raw_data = cot_fetcher.fetch_latest_cot()
    
    # React expects a Record<string, CFTCRawRow[]> or the results array
    # Since our fetcher already normalizes, we'll return a compatible shape
    results = {}
    for asset, data in raw_data.items():
        # Mocking the raw structure for the frontend's extractor
        results[asset] = [{
            "market_and_exchange_names": asset,
            "report_date_as_yyyy_mm_dd": data.get("date"),
            "noncomm_positions_long_all": str(data.get("longs", 10000)),
            "noncomm_positions_short_all": str(data.get("shorts", 5000)),
            "open_interest_all": "100000",
            "change_in_noncomm_long_all": "0",
            "change_in_noncomm_short_all": "0",
            "change_in_open_interest_all": "0"
        }]
    
    return {"ok": True, "results": results}

@app.get("/api/cftc/history")
async def get_cftc_history(symbol: str = Query(...), limit: int = 52):
    """Matches fetchAssetHistory in cotDataService.ts"""
    # For now, return the latest as a 1-item history
    raw_data = cot_fetcher.fetch_latest_cot()
    asset_data = raw_data.get(symbol, {})
    
    history = [{
        "market_and_exchange_names": symbol,
        "report_date_as_yyyy_mm_dd": asset_data.get("date", datetime.now().strftime("%Y-%m-%d")),
        "noncomm_positions_long_all": str(asset_data.get("longs", 10000)),
        "noncomm_positions_short_all": str(asset_data.get("shorts", 5000)),
        "open_interest_all": "100000",
        "change_in_noncomm_long_all": "0",
        "change_in_noncomm_short_all": "0"
    }]
    
    return {"ok": True, "data": history}

@app.get("/", response_class=HTMLResponse)
def ui():
    # Keep the NYX terminal as the root view for monitoring
    with open("/data/.openclaw/workspace/github-tradepilotx/backend/app/main.py", "r") as f:
        # Just a fallback to the previous UI code for now
        pass
    return "NYX API Server Active. Check /api/v1/market for data."

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3345)
