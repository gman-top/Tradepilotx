# TradePilot — Handoff Complet pentru Urmatorul AI

## 1. CE ESTE TRADEPILOT

Dashboard premium de macro trading. React + Tailwind v4 + shadcn/ui.
Scorul fiecarui asset se calculeaza dinamic prin scoring engine (nu hardcoded).
Branding: **TradePilot** — zero referinte la EdgeFinder sau A1Trading.

---

## 2. FILE TREE — STRUCTURA COMPLETA

```
/src/app/
  App.tsx                          # Shell: sidebar desktop + bottom tabs mobile
                                   # Navigatie: useState<Page> (fara URL routing)
                                   # Auth gate: if (!user) → AuthPage
  /components/
    AuthContext.tsx                 # Auth 100% MOCK (localStorage)
                                   # login/register/OAuth → localStorage
                                   # User: id, email, name, plan, favorites, settings
    /pages/
      AuthPage.tsx                 # Login/Register/OAuth UI
      Overview.tsx                 # ✅ WIRED la dataService → regime, biases, favored/hurt
      TopSetups.tsx                # ✅ WIRED la dataService → 20 assets scored, heatmap 8 coloane
      BiasEngine.tsx               # ✅ WIRED la dataService → scorecard complet per asset
      Fundamentals.tsx             # ✅ WIRED la dataService → macro releases + rates per economie
      AssetProfile.tsx             # ⚠️  PARTIAL — edgeFinderScore redenumit tpScore, dar DATELE
                                   #     sunt inca generate LOCAL (getSymbolData), NU din dataService
      COTPositioning.tsx           # ⚠️  SEPARAT — pipeline propriu CFTC (live dar blocat 403)
                                   #     Foloseste cotDataService → cotCache → cotApiService → percentileEngine
      AccountPage.tsx              # Settings page, mock preferences

  /engine/                         # === SCORING SYSTEM (CORE) ===
    dataService.ts                 # ✅ CENTRAL DATA SERVICE — importat de 4 pagini
                                   # - Defineste 20 assets (15 FX + 2 metals + 2 indices + 1 crypto)
                                   # - 8 economii (US, EU, UK, JP, AU, NZ, CA, CH)
                                   # - Construieste AssetDataSnapshot per asset
                                   # - Ruleaza scoringEngine.computeAssetScorecard()
                                   # - Exporta: useTradePilotData() hook, SetupRow, MacroRegime
                                   # - SINGLETON CACHE (compileaza o data, reutilizat)
    scoringEngine.ts               # ✅ SCORING ENGINE PUR (fara side effects)
                                   # - computeAssetScorecard(snapshot) → AssetScorecard
                                   # - computeTopSetups(scorecards) → TopSetupsEntry[]
                                   # - Scoreri per metric: trend, SMA, RSI, COT, sentiment, macro, seasonality
                                   # - FX pair-relative scoring (base - quote economy)
                                   # - Asset-specific exceptions (Gold invers la USD data)
    providers.ts                   # ✅ 5 PROVIDER INTERFACES + MOCK IMPLEMENTATIONS
                                   # - ICOTProvider → MockCOTProvider (hash-based deterministic)
                                   # - ISentimentProvider → MockSentimentProvider
                                   # - IMacroProvider → MockMacroProvider (date REALE pt 9 economii)
                                   # - IRateProvider → MockRateProvider (rate reale 8 economii)
                                   # - IPriceProvider → MockPriceProvider
    pipelines.ts                   # 📐 BLUEPRINT ONLY — 10 pipeline definitions cu cron schedules
                                   # - Nu ruleaza nimic, defineste structura pentru backend

  /types/                          # === TYPE SYSTEM ===
    database.ts                    # Schema PostgreSQL completa — 17 tabele, SQL DDL, indexuri
                                   # Asset, Economy, COTPosition, MacroRelease, InterestRate,
                                   # Signal, AssetScore, TopSetupsSnapshot, etc.
    scoring.ts                     # Signal contract, MetricKey registry, category weights,
                                   # scoring rules (COT, sentiment, technical, seasonality, macro)
                                   # TOP_SETUPS_COLUMNS, COLUMN_TO_METRIC mappings
    api.ts                         # REST API contracts (15 endpoints) — blueprint pt backend

  /utils/                          # === COT PIPELINE (SEPARAT) ===
    cotMappings.ts                 # 20 COT symbols → CFTC futures mapping (SINGLE SOURCE OF TRUTH)
    cotDataService.ts              # Client → Supabase Edge Function → CFTC SODA API
    cotApiService.ts               # Cache refresh + API wrapper
    cotCache.ts                    # In-memory cache cu TTL
    percentileEngine.ts            # Percentile rank calculator (1Y/3Y windows)

/supabase/functions/server/        # === EDGE FUNCTION (Deno + Hono) ===
  index.tsx                        # Hono app: CORS, logger, routes
  cftc_proxy.tsx                   # 3 endpoints: /batch, /history, /query → CFTC SODA API
  kv_store.tsx                     # Key-value store (unused)

/utils/supabase/info.tsx           # projectId + publicAnonKey (autogenerated)
/src/styles/theme.css              # Design system: 4 surface layers, 3 text tiers, accents
```

---

## 3. DATA FLOW — CUM CIRCULA DATELE

### A. Scoring Pipeline (FUNCTIONAL — Mock Data)
```
MockProviders (providers.ts)
    │
    ├── MockCOTProvider.fetchLatest(['EUR']) → COTPosition
    ├── MockSentimentProvider.fetchLatest(['EUR/USD']) → RetailSentiment
    ├── MockMacroProvider.fetchReleases('US') → MacroRelease[]
    ├── MockMacroProvider.fetchReleases('EU') → MacroRelease[]
    └── MockRateProvider.fetchRates(['US','EU']) → InterestRate
            │
            ▼
    dataService.ts: buildSnapshot(asset) → AssetDataSnapshot
            │
            ▼
    scoringEngine.ts: computeAssetScorecard(snapshot) → AssetScorecard
            │                                              │
            │   AssetScorecard contine:                    │
            │   - total_score: number (-10..+10)           │
            │   - bias_label: BiasLabel                    │
            │   - categories: Record<SignalCategory, CategoryScore>
            │   - readings: SignalInput[] (toate semnalele individuale)
            │   - missing_data: string[]                   │
            │                                              │
            ▼                                              ▼
    dataService exports:                    Pages consume:
    - scorecards: Record<symbol, AssetScorecard>
    - setups: SetupRow[] (sorted by score)     → TopSetups.tsx
    - regime: MacroRegime                      → Overview.tsx
    - macroReleases: Record<econ, MacroRelease[]> → Fundamentals.tsx
    - rates: Record<econ, InterestRate>        → Fundamentals.tsx
    - assets: AssetDef[]                       → BiasEngine.tsx
```

### B. COT Live Pipeline (BLOCAT — 403 Error)
```
COTPositioning.tsx
    │
    ├── cotDataService.ts: fetchAllAssetsLatest() / fetchAssetHistory()
    │       │
    │       ├── cotCache.ts (in-memory TTL cache)
    │       │
    │       └── fetch(`https://${projectId}.supabase.co/functions/v1/make-server-.../cftc/batch`)
    │               │
    │               ▼
    │           supabase/functions/server/cftc_proxy.tsx
    │               │
    │               └── fetch('https://publicreporting.cftc.gov/resource/6dca-aqww.json')
    │                       │
    │                       └── ❌ 403 Forbidden (Edge Function deployment issue)
    │
    └── Falls back to empty data (nu crashuieste, dar nu arata nimic util)
```

---

## 4. CE FUNCTIONEAZA ACUM

| Component | Status | Detalii |
|-----------|--------|---------|
| UI Shell (sidebar, tabs, mobile) | ✅ Full | App.tsx — responsive, colapsabil |
| Auth (login/register/OAuth) | ✅ Mock | localStorage, fara Supabase Auth |
| Overview page | ✅ Computed | Regime + biases + favored/hurt din scorecards |
| Top Setups page | ✅ Computed | 20 assets, 8 coloane heatmap, sortabil |
| Bias Engine page | ✅ Computed | Scorecard complet, signal readings, why/invalidates |
| Fundamentals page | ✅ Computed | Macro releases per 8 economii, interest rates |
| Asset Profile page | ⚠️ Partial | Rebranded (tpScore), dar date inca locale |
| COT Positioning page | ⚠️ Blocked | Pipeline code-complete, Edge Function da 403 |
| Account/Settings page | ✅ Mock | Preferences in localStorage |
| Scoring Engine | ✅ Full | computeAssetScorecard() + computeTopSetups() |
| Mock Providers | ✅ Full | COT, Sentiment, Macro, Rates, Price |
| CFTC Edge Function | ⚠️ Deployed | Code valid, dar da 403 la apeluri |

---

## 5. CE TREBUIE FACUT — PRIORITIZAT

### P0: Reconectare Supabase (deblocheza COT live)
- Supabase project: `wegeehbxrsokuknftkwc`
- Edge Function path: `/functions/v1/make-server-d198f9ee/cftc/`
- **Problema**: Edge Function returneaza 403 la orice request
- **Cauza probabila**: integrarea Figma Make → Supabase trebuie re-autorizata
- **Fix**: Reconecteaza Supabase din dashboard → re-deploy Edge Function
- **Dupa fix**: COT Positioning page va arata date CFTC live automat
- **Fisiere implicate**: `/utils/supabase/info.tsx`, `/src/app/utils/cotDataService.ts`

### P1: Migrare Asset Profile la dataService
- **Acum**: `AssetProfile.tsx` (~900 linii) genereaza date local cu `getSymbolData()`
- **Target**: Importa `useTradePilotData()` si mapeaza `AssetScorecard` la UI
- **Mapping**:
  - `data.tpScore` → `scorecard.total_score`
  - `data.technicalScore` → `scorecard.categories.technical.score`
  - `data.sentimentCotScore` → average of `cot` + `sentiment` category scores
  - `data.fundamentalsScore` → average of `eco_growth` + `inflation` + `jobs` + `rates`
  - Score history chart → genereaza mock history din scorecard (sau skip for now)
  - Economic/inflation/jobs metrics → `scorecard.readings.filter(r => r.category === 'eco_growth')`
- **Complexitate**: Mare — pagina are Gauge component, SMA display, targets, news section
- **Recomandare**: Pastram UI-ul existent, doar inlocuim sursa datelor

### P2: Conectare COT Positioning la dataService
- **Acum**: COT page are pipeline propriu (cotDataService → Edge Function)
- **Cand Supabase merge**: Pipeline-ul functioneaza automat
- **Cand Supabase NU merge**: Ar putea fallback la MockCOTProvider din providers.ts
- **Fisiere**: `COTPositioning.tsx` importa din `cotDataService.ts` (NU din `dataService.ts`)

### P3: Auth real cu Supabase
- **Acum**: `AuthContext.tsx` e 100% localStorage mock
- **Target**: `supabase.auth.signInWithPassword()`, `supabase.auth.signUp()`, `supabase.auth.signInWithOAuth()`
- **AuthContext** are deja comentarii `// TODO: Replace with Supabase OAuth when connected`
- **User interface** se potriveste cu Supabase user metadata

### P4: Live Providers (inlocuiesc MockProviders)
- **providers.ts** defineste 5 interfete gata de implementat:
  - `ICOTProvider` → `CFTCProvider` (via Edge Function proxy, deja construit)
  - `ISentimentProvider` → `OandaSentimentProvider` / `IGSentimentProvider`
  - `IMacroProvider` → `FREDProvider` / `TradingEconomicsProvider`
  - `IRateProvider` → `FREDRateProvider`
  - `IPriceProvider` → `TwelveDataProvider`
- **dataService.ts** trebuie doar sa schimbe `new MockCOTProvider()` → `new CFTCProvider()`
- Logica de scoring ramane identica

### P5: Persistenta scorecards in Supabase
- **database.ts** defineste schema completa (17 tabele + SQL DDL)
- Tabele cheie: `asset_scores`, `top_setups_snapshots`, `signals`
- **pipelines.ts** defineste 10 pipeline jobs cu cron schedules
- Target: scoring ruleaza server-side, rezultatele se stocheaza in DB, UI citeste din DB

### P6: URL Routing (optional)
- **Acum**: Navigatie prin `useState<Page>` in App.tsx
- **Target**: React Router cu `createBrowserRouter` + URL paths
- 7 pagini: `/`, `/cot`, `/fundamentals`, `/bias`, `/setups`, `/profile`, `/account`

---

## 6. SCORING ENGINE — CUM FUNCTIONEAZA

### Input: AssetDataSnapshot
Contine TOATE datele necesare pentru un asset:
- `asset`: Asset metadata (symbol, class, economies)
- `economy_links`: AssetEconomyLink[] (FX: base/quote; non-FX: primary)
- `technical`: TechnicalIndicator (trend, SMA, RSI)
- `cot_latest`: COTPosition (NC net, OI, deltas)
- `cot_history`: COTPosition[] (156 saptamani pt percentile)
- `sentiment`: RetailSentiment (long/short %)
- `macro_releases`: Record<string, MacroRelease> keyed `${econ}:${indicator}`
- `interest_rates`: Record<string, InterestRate> keyed by economy code
- `seasonality`: SeasonalityStat (current month)

### Pipeline intern:
1. **Metric Scorers** (functii pure): scoreTrend, scoreSMA, scoreRSI, scoreCOT, scoreSentiment, scoreMacroRelease, scoreSeasonality → produce `SignalInput[]` (score -2..+2)
2. **FX Pair-Relative**: Pentru EURUSD → scoreaza economia EUR si USD separat, diferenta = scor net
3. **Asset Exceptions**: Gold inverseaza scorurile USD-pozitive
4. **Aggregation**: Semnale → CategoryScore (media ponderata per categorie)
5. **Total Score**: Sum(category_score * weight) normalizat la -10..+10
6. **Bias Label**: total_score → very_bearish/bearish/neutral/bullish/very_bullish

### Category Weights (DEFAULT_CATEGORY_WEIGHTS):
```
technical:  0.15 | sentiment: 0.10 | cot:        0.15
eco_growth: 0.15 | inflation: 0.12 | jobs:       0.13
rates:      0.10 | confidence: 0.10
```

### Output: AssetScorecard
```typescript
{
  symbol: 'EUR/USD',
  name: 'Euro / US Dollar',
  total_score: 3.4,          // -10 to +10
  bias_label: 'bullish',
  categories: {
    technical:  { score: 1.2, direction: 'bullish', signal_count: 4 },
    cot:        { score: 0.8, direction: 'bullish', signal_count: 3 },
    eco_growth: { score: -0.5, direction: 'neutral', signal_count: 4 },
    // ...
  },
  readings: [
    { metric_key: 'trend_daily', category: 'technical', score: 1, explanation: '...' },
    { metric_key: 'gdp', category: 'eco_growth', score: -1, explanation: '...' },
    // ...
  ],
  missing_data: [],
}
```

---

## 7. MOCK DATA — DE UNDE VIN

### MockMacroProvider (providers.ts lines 360-419)
Date REALISTE pentru 9 economii (US, EU, UK, JP, AU, NZ, CA, CH):
- US: 14 indicatori (GDP 2.8%, CPI 3.1%, NFP 227K, Fed Rate 4.50%, etc.)
- EU: 5 indicatori (GDP 0.3%, PMI 46.6, ECB 3.75%)
- UK: 3, JP: 3, AU: 2, NZ: 2, CA: 2, CH: 2

### MockRateProvider (providers.ts lines 488-497)
Policy rates + yield curves reale:
- US: 4.50% / 2Y 4.25% / 10Y 4.18% / 30Y 4.35%
- JP: 0.25% / 10Y 0.95%
- CH: 1.50% / 10Y 0.65%

### MockCOTProvider
Hash-based deterministic per symbol. NC long/short/net, comm, retail, OI, deltas.

### MockSentimentProvider
Hash-based: long% intre 25-75% per symbol.

---

## 8. DESIGN SYSTEM

Theme in `/src/styles/theme.css`:
- **Surfaces**: `--tp-l0` (darkest) → `--tp-l3` (lightest)
- **Borders**: `--tp-border-subtle` / `--tp-border` / `--tp-border-strong`
- **Text**: `--tp-text-1` (primary) / `--tp-text-2` / `--tp-text-3` (muted)
- **Accents**: `--tp-accent` (#5B6CFF), `--tp-bullish` (#34D399), `--tp-bearish` (#F87171)

Pagini folosesc un obiect `C` local:
```typescript
const C = {
  l1: 'var(--tp-l1)', l2: 'var(--tp-l2)', l3: 'var(--tp-l3)',
  t1: 'var(--tp-text-1)', t2: 'var(--tp-text-2)', t3: 'var(--tp-text-3)',
  bullish: 'var(--tp-bullish)', bearish: 'var(--tp-bearish)', neutral: 'var(--tp-neutral)',
};
```

---

## 9. DEPENDINTE CHEIE

- React 18.3.1, Tailwind v4, Vite 6
- recharts (charts in COT + AssetProfile)
- lucide-react (icons everywhere)
- shadcn/ui components in `/src/app/components/ui/`
- motion (for animations, installed but barely used)
- Supabase Edge Functions (Deno + Hono)
- NO react-router (navigatie prin useState)
- NO state management (zustand/redux) — doar React hooks + context

---

## 10. GOTCHAS & NOTES

1. **`scoreToDirection`** avea un bug (returna 'neutral' in loc de 'bearish') — FIXAT
2. **Asset Profile** e cea mai mare pagina (~900 linii) cu Gauge SVG, recharts BarChart, multiple sections — atentie la refactor
3. **COT Positioning** are pipeline propriu complet separat de dataService — nu le amesteca
4. **Edge Function** route prefix: `/make-server-d198f9ee/` — generat automat, nu schimba
5. **`cotDataService.ts`** importa `projectId` din `/utils/supabase/info.tsx` — path special
6. **Mock providers** sunt deterministe (hash-based) — acelasi symbol da mereu aceleasi date
7. **FX pairs** in dataService: 15 pairs (7 majors + 8 crosses) — fiecare cu base/quote economy links
8. **Non-FX** (Gold, SPX, BTC): au `primary` economy link cu weight (+1.0 sau -1.0)
9. **Gold** are weight -1.0 pe US → macro scorurile sunt inversate (GDP beat = bearish pt Gold)
10. **Supabase project**: `wegeehbxrsokuknftkwc` — anon key in `/utils/supabase/info.tsx`
