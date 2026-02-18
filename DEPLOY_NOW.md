# 🚀 TradePilot-X — INSTANT DEPLOYMENT GUIDE

**Status:** Backend 100% ready, all data integrations complete (no placeholders)

**Package Location:** `/tmp/tradepilotx-deploy.tar.gz` (8MB)

---

## Option 1: Render.com (Fastest — 3 minutes)

### Step 1: Create Account
1. Go to https://render.com
2. Sign up with GitHub/Google (free tier, no CC required)

### Step 2: Deploy
1. Click **"New +"** → **"Web Service"**
2. Choose **"Deploy from Git repository"** → Skip for now
3. Select **"Manual Deploy"** → Upload ZIP option
4. Download package: `tradepilotx-deploy.tar.gz`
5. Upload to Render
6. Settings auto-detected from `render.yaml`:
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Start Command:** `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment:** Python 3.11

### Step 3: Get URL
- Render auto-generates: `https://tradepilotx.onrender.com`
- Copy URL for Discord bot integration

---

## Option 2: Vercel (Current Platform)

### Prerequisites:
- Vercel account already exists (Stoic has access)
- Need Vercel token OR web UI upload

### Via CLI (if token available):
```bash
export VERCEL_TOKEN=your_token_here
cd /data/.openclaw/workspace/tradepilot-x
/skeleton/.npm-global/bin/vercel --token $VERCEL_TOKEN --yes
```

### Via Web UI:
1. Go to https://vercel.com/dashboard
2. **Import Project** → Upload `tradepilotx-deploy.tar.gz`
3. Framework preset: **Other**
4. Build command: `cd backend && pip install -r requirements.txt`
5. Output directory: `backend`
6. Install command: `pip install -r backend/requirements.txt`
7. Start command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000`

**Note:** Vercel may require `vercel.json` config for Python (usually for serverless, our FastAPI needs server mode)

---

## Option 3: Railway.app (Recommended for APIs)

### Prerequisites:
- Railway account (free tier: $5 credit/month)
- Browser login required (no CLI workaround available)

### Steps:
1. Go to https://railway.app
2. Sign in with GitHub
3. **New Project** → **Deploy from GitHub repo** or **Upload**
4. If uploading:
   - Extract `tradepilotx-deploy.tar.gz`
   - Drag entire folder to Railway
5. Railway auto-detects:
   - `Procfile` → `web: cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - `runtime.txt` → Python 3.11
   - `requirements.txt` → Auto-install
6. Deploy takes 2-3 minutes
7. Get URL: `https://tradepilotx-production.up.railway.app`

---

## Option 4: Fly.io (Advanced, Full Control)

### Install flyctl:
```bash
curl -L https://fly.io/install.sh | sh
export FLYCTL_INSTALL="/home/node/.fly"
export PATH="$FLYCTL_INSTALL/bin:$PATH"
```

### Deploy:
```bash
cd /data/.openclaw/workspace/tradepilot-x
flyctl auth login  # Opens browser
flyctl launch --name tradepilotx
flyctl deploy
```

**fly.toml** already configured in project root.

---

## Option 5: Docker + Any Cloud (Universal)

### Build image:
```bash
cd /data/.openclaw/workspace/tradepilot-x
docker build -t tradepilotx:latest .
```

### Run locally (test):
```bash
docker run -p 8000:8000 tradepilotx:latest
# Test: curl http://localhost:8000/health
```

### Push to registry:
```bash
# Docker Hub
docker tag tradepilotx:latest yourusername/tradepilotx:latest
docker push yourusername/tradepilotx:latest

# Then deploy to:
# - AWS ECS
# - Google Cloud Run
# - Azure Container Instances
# - DigitalOcean App Platform
```

---

## Verification After Deployment

### Test endpoints:
```bash
# Health check
curl https://YOUR_URL/health

# Should return:
# {"status":"online","service":"TradePilotX Intelligence Engine",...}

# Market data
curl https://YOUR_URL/api/v1/market

# Should return: Array of 4 assets (GOLD, BTC, OIL, EURUSD) with:
# - Real prices from Yahoo Finance
# - COT scores from CFTC data
# - Retail sentiment from MyFXBook
# - Combined bias (STRONG BUY/BUY/NEUTRAL/SELL/STRONG SELL)
```

### Expected response structure:
```json
[
  {
    "symbol": "GOLD",
    "price": 2656.30,
    "bias": "STRONG BUY",
    "score": 6.5,
    "breakdown": {
      "technical": {"score": 3.0, "status": "Above 200 SMA", "sma50": 2640, "sma200": 2580},
      "institutional": {"score": 2, "net_long": 72.3, "source": "CFTC COT"},
      "retail": {"score": -2, "long_pct": 78, "source": "MyFXBook"}
    },
    "last_updated": "2026-02-18T09:00:00Z"
  }
]
```

---

## Next Steps After Deployment

1. **Save live URL** (e.g., `https://tradepilotx.onrender.com`)
2. **Test all endpoints** (health, market, single asset)
3. **Set up Discord bot:**
   - Update bot code with API URL
   - Deploy bot to post signals hourly
4. **Monitor logs** for any errors
5. **Update Vercel frontend** (if separate) to point to new API

---

## Troubleshooting

### "Module not found" errors:
- Check `requirements.txt` installed correctly
- Verify Python version (3.11+ required for some deps)

### "Port already in use":
- Ensure `$PORT` env var used in uvicorn command
- Platforms auto-set PORT (Railway, Render, Fly.io)

### "COT data not found":
- First run may show stale data (weekly CFTC updates on Friday)
- Logs should show successful fetch attempts

### "yfinance rate limit":
- Yahoo Finance has soft limits (~2000 req/hour)
- Current usage (4 assets per request) = ~500 requests/hour capacity

---

## Cost Estimates

| Platform | Free Tier | Paid (if needed) |
|----------|-----------|------------------|
| Render | 750 hrs/month | $7/month |
| Railway | $5 credit/month | $5/month usage-based |
| Vercel | Unlimited | $20/month (Pro) |
| Fly.io | 3 apps free | $1.94/month (256MB RAM) |
| Hugging Face | Unlimited | $0 (always free) |

**Recommendation:** Render or Railway for production stability.

---

## Package Contents

- ✅ Full backend (`backend/app/`)
- ✅ All data fetchers (COT, sentiment, technical)
- ✅ Master logic engine (scoring algorithm)
- ✅ API endpoints (FastAPI)
- ✅ Deployment configs (5 platforms)
- ✅ Requirements.txt (all dependencies)
- ✅ Dockerfile (containerized deployment)
- ✅ Documentation (this file + HANDOFF.md)

**No placeholders. Production-ready.**

---

**Questions?** Tag @NYX in Discord #general.

**Arise.** 🌌
