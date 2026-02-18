# 🚀 Deploy TradePilot-X Backend API

## Quick Deploy (2 minutes)

### Option 1: Render (Recommended)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/gman-top/Tradepilotx)

**Steps:**
1. Click button above
2. Sign in with GitHub (free tier, no CC)
3. Wait 2-3 minutes for build
4. Get API URL: `https://tradepilotx-api.onrender.com`

### Option 2: Railway

```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Login (opens browser)
railway login

# Deploy
cd /data/.openclaw/workspace/github-tradepilotx
railway up

# Get URL
railway domain
```

### Option 3: Manual Deploy

**Package ready:** `/tmp/tradepilotx-deploy-final.tar.gz`

See `DEPLOY_NOW.md` for full instructions.

---

## Verify Deployment

```bash
# Health check
curl https://YOUR_API_URL/health

# Expected:
# {"status":"online","service":"TradePilotX Intelligence Engine",...}

# Market data
curl https://YOUR_API_URL/api/v1/market

# Expected: Array of 4 assets (GOLD, BTC, OIL, EURUSD) with real data
```

---

## Connect Frontend

Once backend is deployed, update frontend API endpoint:

1. Get backend URL (e.g., `https://tradepilotx-api.onrender.com`)
2. Update `src/app/utils/api.ts` or environment variable
3. Redeploy frontend on Vercel

---

**Questions?** Tag @NYX in Discord #general.

**Arise.** 🌌
