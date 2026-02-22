// ═══════════════════════════════════════════════════════════════════════════════
// TradePilot — PostgreSQL Data Model (ERD Logic)
// ═══════════════════════════════════════════════════════════════════════════════
//
// This file is the SINGLE SOURCE OF TRUTH for the database schema.
// TypeScript types mirror the Postgres tables 1:1.
// SQL DDL is embedded as comments above each type.
//
// PARTITIONING STRATEGY:
//   price_ohlc         → TimescaleDB hypertable on `timestamp`, chunk_interval 1 month
//   technical_indicators → TimescaleDB hypertable on `timestamp`, chunk_interval 1 month
//   signals            → Range partition on `computed_at`, monthly
//   asset_scores       → Range partition on `computed_at`, monthly
//   macro_releases     → Range partition on `release_date`, yearly
//
// INDEXING STRATEGY:
//   All time-series tables: composite index on (asset_id, timestamp DESC)
//   signals: (asset_id, metric_key, computed_at DESC)
//   asset_scores: (asset_id, computed_at DESC)
//   macro_releases: (economy_id, category, release_date DESC)
//
// ═══════════════════════════════════════════════════════════════════════════════


// ─── ENUMS ───────────────────────────────────────────────────────────────────

/*
CREATE TYPE asset_class AS ENUM (
  'fx', 'commodity', 'index', 'crypto', 'rate', 'metal', 'energy'
);

CREATE TYPE timeframe AS ENUM (
  '15m', '1h', '4h', '1d', '1w'
);

CREATE TYPE direction AS ENUM ('bullish', 'neutral', 'bearish');

CREATE TYPE bias_label AS ENUM (
  'very_bearish', 'bearish', 'neutral', 'bullish', 'very_bullish'
);

CREATE TYPE impact_level AS ENUM ('high', 'medium', 'low');

CREATE TYPE beat_miss AS ENUM ('beat', 'miss', 'inline');

CREATE TYPE trend_direction AS ENUM ('strong_up', 'up', 'neutral', 'down', 'strong_down');

CREATE TYPE ingestion_status AS ENUM ('running', 'success', 'partial', 'failed');
*/

export type AssetClass = 'fx' | 'commodity' | 'index' | 'crypto' | 'rate' | 'metal' | 'energy';
export type Timeframe = '15m' | '1h' | '4h' | '1d' | '1w';
export type Direction = 'bullish' | 'neutral' | 'bearish';
export type BiasLabel = 'very_bearish' | 'bearish' | 'neutral' | 'bullish' | 'very_bullish';
export type ImpactLevel = 'high' | 'medium' | 'low';
export type BeatMiss = 'beat' | 'miss' | 'inline';
export type TrendDirection = 'strong_up' | 'up' | 'neutral' | 'down' | 'strong_down';
export type IngestionStatus = 'running' | 'success' | 'partial' | 'failed';


// ═══════════════════════════════════════════════════════════════════════════════
// 1. ECONOMIES
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE economies (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(4) UNIQUE NOT NULL,   -- 'US', 'EU', 'UK', 'JP', 'AU', 'NZ', 'CA', 'CH', 'CN'
  name          VARCHAR(64) NOT NULL,         -- 'United States'
  currency_code VARCHAR(4) NOT NULL,          -- 'USD'
  central_bank  VARCHAR(64),                  -- 'Federal Reserve'
  region        VARCHAR(32),                  -- 'North America'
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data
INSERT INTO economies (code, name, currency_code, central_bank, region) VALUES
  ('US', 'United States',    'USD', 'Federal Reserve',     'North America'),
  ('EU', 'Eurozone',         'EUR', 'ECB',                 'Europe'),
  ('UK', 'United Kingdom',   'GBP', 'Bank of England',     'Europe'),
  ('JP', 'Japan',            'JPY', 'Bank of Japan',       'Asia'),
  ('AU', 'Australia',        'AUD', 'RBA',                 'Asia-Pacific'),
  ('NZ', 'New Zealand',      'NZD', 'RBNZ',               'Asia-Pacific'),
  ('CA', 'Canada',           'CAD', 'Bank of Canada',      'North America'),
  ('CH', 'Switzerland',      'CHF', 'SNB',                 'Europe'),
  ('CN', 'China',            'CNY', 'PBoC',                'Asia');
*/

export interface Economy {
  id: number;
  code: string;
  name: string;
  currency_code: string;
  central_bank: string | null;
  region: string | null;
  active: boolean;
  created_at: string;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 2. ASSETS
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE assets (
  id              SERIAL PRIMARY KEY,
  symbol          VARCHAR(16) UNIQUE NOT NULL,   -- 'EURUSD', 'Gold', 'SPX500'
  name            VARCHAR(128) NOT NULL,         -- 'Euro / US Dollar'
  asset_class     asset_class NOT NULL,
  base_currency   VARCHAR(4),                    -- 'EUR' (FX pairs)
  quote_currency  VARCHAR(4),                    -- 'USD' (FX pairs)
  economy_id      INTEGER REFERENCES economies(id),  -- Primary economy link
  cot_symbol      VARCHAR(16),                   -- Key into COT_SYMBOL_MAPPINGS
  cot_pattern     TEXT,                          -- SoQL LIKE pattern for CFTC
  has_cot         BOOLEAN DEFAULT FALSE,
  has_sentiment   BOOLEAN DEFAULT FALSE,
  display_order   INTEGER DEFAULT 0,
  active          BOOLEAN DEFAULT TRUE,
  metadata        JSONB DEFAULT '{}',            -- Flexible extra fields
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assets_class ON assets (asset_class);
CREATE INDEX idx_assets_economy ON assets (economy_id);
CREATE INDEX idx_assets_active ON assets (active) WHERE active = TRUE;
*/

export interface Asset {
  id: number;
  symbol: string;
  name: string;
  asset_class: AssetClass;
  base_currency: string | null;
  quote_currency: string | null;
  economy_id: number | null;
  cot_symbol: string | null;
  cot_pattern: string | null;
  has_cot: boolean;
  has_sentiment: boolean;
  display_order: number;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 3. ASSET ECONOMY LINKS (many-to-many for non-trivial cases)
// ═══════════════════════════════════════════════════════════════════════════════

/*
-- For assets that relate to multiple economies (e.g., EURUSD → EU + US)
-- Or commodities influenced by multiple economies
CREATE TABLE asset_economy_links (
  asset_id    INTEGER REFERENCES assets(id) ON DELETE CASCADE,
  economy_id  INTEGER REFERENCES economies(id) ON DELETE CASCADE,
  role        VARCHAR(16) NOT NULL,  -- 'base', 'quote', 'primary', 'secondary'
  weight      NUMERIC(3,2) DEFAULT 1.0,  -- For scoring weight (FX: base=+1, quote=-1)
  PRIMARY KEY (asset_id, economy_id, role)
);

-- Example: EURUSD → (EU, 'base', +1.0), (US, 'quote', -1.0)
-- Example: Gold   → (US, 'primary', -1.0)  (gold is inversely correlated to USD strength)
-- Example: SPX500 → (US, 'primary', +1.0)
*/

export interface AssetEconomyLink {
  asset_id: number;
  economy_id: number;
  role: 'base' | 'quote' | 'primary' | 'secondary';
  weight: number;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 4. PRICE OHLC (TimescaleDB hypertable)
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE price_ohlc (
  asset_id    INTEGER NOT NULL REFERENCES assets(id),
  timestamp   TIMESTAMPTZ NOT NULL,
  timeframe   timeframe NOT NULL,
  open        NUMERIC(18,8) NOT NULL,
  high        NUMERIC(18,8) NOT NULL,
  low         NUMERIC(18,8) NOT NULL,
  close       NUMERIC(18,8) NOT NULL,
  volume      BIGINT DEFAULT 0,
  PRIMARY KEY (asset_id, timestamp, timeframe)
);

-- TimescaleDB: convert to hypertable
SELECT create_hypertable('price_ohlc', 'timestamp', chunk_time_interval => INTERVAL '1 month');

CREATE INDEX idx_price_asset_tf_time ON price_ohlc (asset_id, timeframe, timestamp DESC);
*/

export interface PriceOHLC {
  asset_id: number;
  timestamp: string;
  timeframe: Timeframe;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 5. TECHNICAL INDICATORS (TimescaleDB hypertable)
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE technical_indicators (
  asset_id    INTEGER NOT NULL REFERENCES assets(id),
  timestamp   TIMESTAMPTZ NOT NULL,
  timeframe   timeframe NOT NULL,
  -- Moving Averages
  sma_20      NUMERIC(18,8),
  sma_50      NUMERIC(18,8),
  sma_100     NUMERIC(18,8),
  sma_200     NUMERIC(18,8),
  -- Oscillators
  rsi_14      NUMERIC(6,2),
  -- Volatility
  atr_14      NUMERIC(18,8),
  volatility  NUMERIC(8,4),            -- Annualized vol
  -- Derived
  trend_4h    trend_direction,
  trend_daily trend_direction,
  price_vs_sma200 NUMERIC(8,4),        -- % distance from SMA200
  PRIMARY KEY (asset_id, timestamp, timeframe)
);

SELECT create_hypertable('technical_indicators', 'timestamp', chunk_time_interval => INTERVAL '1 month');

CREATE INDEX idx_tech_asset_tf_time ON technical_indicators (asset_id, timeframe, timestamp DESC);
*/

export interface TechnicalIndicator {
  asset_id: number;
  timestamp: string;
  timeframe: Timeframe;
  sma_20: number | null;
  sma_50: number | null;
  sma_100: number | null;
  sma_200: number | null;
  rsi_14: number | null;
  atr_14: number | null;
  volatility: number | null;
  trend_4h: TrendDirection | null;
  trend_daily: TrendDirection | null;
  price_vs_sma200: number | null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 6. COT POSITIONS (weekly, from CFTC)
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE cot_positions (
  asset_id          INTEGER NOT NULL REFERENCES assets(id),
  report_date       DATE NOT NULL,
  -- Non-Commercials (Speculators)
  nc_long           BIGINT NOT NULL,
  nc_short          BIGINT NOT NULL,
  nc_spreading      BIGINT DEFAULT 0,
  nc_net            BIGINT GENERATED ALWAYS AS (nc_long - nc_short) STORED,
  -- Commercials (Hedgers)
  comm_long         BIGINT NOT NULL,
  comm_short        BIGINT NOT NULL,
  comm_net          BIGINT GENERATED ALWAYS AS (comm_long - comm_short) STORED,
  -- Non-Reportable (Retail)
  nr_long           BIGINT NOT NULL,
  nr_short          BIGINT NOT NULL,
  nr_net            BIGINT GENERATED ALWAYS AS (nr_long - nr_short) STORED,
  -- Aggregates
  open_interest     BIGINT NOT NULL,
  delta_oi          BIGINT DEFAULT 0,
  -- Weekly Changes
  delta_nc_long     BIGINT DEFAULT 0,
  delta_nc_short    BIGINT DEFAULT 0,
  delta_nc_net      BIGINT DEFAULT 0,
  delta_comm_long   BIGINT DEFAULT 0,
  delta_comm_short  BIGINT DEFAULT 0,
  -- Metadata
  raw_market_name   TEXT,
  fetched_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (asset_id, report_date)
);

CREATE INDEX idx_cot_asset_date ON cot_positions (asset_id, report_date DESC);
CREATE INDEX idx_cot_date ON cot_positions (report_date DESC);
*/

export interface COTPosition {
  asset_id: number;
  report_date: string;
  nc_long: number;
  nc_short: number;
  nc_spreading: number;
  nc_net: number;        // computed: nc_long - nc_short
  comm_long: number;
  comm_short: number;
  comm_net: number;      // computed: comm_long - comm_short
  nr_long: number;
  nr_short: number;
  nr_net: number;        // computed: nr_long - nr_short
  open_interest: number;
  delta_oi: number;
  delta_nc_long: number;
  delta_nc_short: number;
  delta_nc_net: number;
  delta_comm_long: number;
  delta_comm_short: number;
  raw_market_name: string | null;
  fetched_at: string;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 7. RETAIL SENTIMENT (from broker APIs)
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE retail_sentiment (
  asset_id    INTEGER NOT NULL REFERENCES assets(id),
  timestamp   TIMESTAMPTZ NOT NULL,
  long_pct    NUMERIC(5,2) NOT NULL,     -- e.g. 65.30
  short_pct   NUMERIC(5,2) NOT NULL,     -- e.g. 34.70
  source      VARCHAR(32) NOT NULL,      -- 'oanda', 'ig', 'myfxbook'
  long_count  INTEGER,                   -- absolute trader count if available
  short_count INTEGER,
  PRIMARY KEY (asset_id, timestamp, source)
);

CREATE INDEX idx_sentiment_asset_time ON retail_sentiment (asset_id, timestamp DESC);
*/

export interface RetailSentiment {
  asset_id: number;
  timestamp: string;
  long_pct: number;
  short_pct: number;
  source: string;
  long_count: number | null;
  short_count: number | null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 8. MACRO RELEASES (economic data)
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE macro_releases (
  id             BIGSERIAL PRIMARY KEY,
  economy_id     INTEGER NOT NULL REFERENCES economies(id),
  indicator_key  VARCHAR(32) NOT NULL,       -- 'gdp', 'cpi', 'nfp', 'pmi_manufacturing', etc.
  indicator_name VARCHAR(128) NOT NULL,      -- 'Gross Domestic Product (QoQ)'
  category       VARCHAR(32) NOT NULL,       -- 'growth', 'inflation', 'jobs', 'housing', 'rates', 'confidence'
  release_date   TIMESTAMPTZ NOT NULL,
  actual         NUMERIC(12,4),
  forecast       NUMERIC(12,4),
  previous       NUMERIC(12,4),
  surprise       NUMERIC(12,4) GENERATED ALWAYS AS (actual - forecast) STORED,
  surprise_pct   NUMERIC(8,4),               -- (actual - forecast) / |forecast| * 100
  beat_miss      beat_miss,
  impact         impact_level DEFAULT 'medium',
  unit           VARCHAR(16),                -- '%', 'K', 'B', 'index'
  revision       NUMERIC(12,4),              -- Revised previous value if different
  source         VARCHAR(64),                -- 'FRED', 'BLS', 'ECB', etc.
  fetched_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by year on release_date
CREATE INDEX idx_macro_economy_cat ON macro_releases (economy_id, category, release_date DESC);
CREATE INDEX idx_macro_indicator ON macro_releases (indicator_key, economy_id, release_date DESC);
CREATE INDEX idx_macro_date ON macro_releases (release_date DESC);
*/

export interface MacroRelease {
  id: number;
  economy_id: number;
  indicator_key: string;
  indicator_name: string;
  category: 'growth' | 'inflation' | 'jobs' | 'housing' | 'rates' | 'confidence';
  release_date: string;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  surprise: number | null;     // computed: actual - forecast
  surprise_pct: number | null;
  beat_miss: BeatMiss | null;
  impact: ImpactLevel;
  unit: string | null;
  revision: number | null;
  source: string | null;
  fetched_at: string;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 9. INTEREST RATES & YIELDS
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE interest_rates (
  economy_id      INTEGER NOT NULL REFERENCES economies(id),
  timestamp       TIMESTAMPTZ NOT NULL,
  policy_rate     NUMERIC(6,4),              -- Central bank rate
  yield_2y        NUMERIC(6,4),
  yield_5y        NUMERIC(6,4),
  yield_10y       NUMERIC(6,4),
  yield_30y       NUMERIC(6,4),
  spread_2_10     NUMERIC(6,4) GENERATED ALWAYS AS (yield_10y - yield_2y) STORED,
  real_rate_10y   NUMERIC(6,4),              -- yield_10y - inflation expectation
  source          VARCHAR(64),
  PRIMARY KEY (economy_id, timestamp)
);

CREATE INDEX idx_rates_economy_time ON interest_rates (economy_id, timestamp DESC);
*/

export interface InterestRate {
  economy_id: number;
  timestamp: string;
  policy_rate: number | null;
  yield_2y: number | null;
  yield_5y: number | null;
  yield_10y: number | null;
  yield_30y: number | null;
  spread_2_10: number | null;   // computed: yield_10y - yield_2y
  real_rate_10y: number | null;
  source: string | null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 10. SEASONALITY STATISTICS (precomputed)
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE seasonality_stats (
  asset_id        INTEGER NOT NULL REFERENCES assets(id),
  month           SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  day_of_year     SMALLINT,                  -- 1..366, NULL for monthly aggregates
  -- 10-Year averages
  avg_return_10y  NUMERIC(8,4),              -- % return for this month over 10 years
  win_rate_10y    NUMERIC(5,2),              -- % of years this month was positive (10Y)
  median_return_10y NUMERIC(8,4),
  -- 5-Year averages
  avg_return_5y   NUMERIC(8,4),
  win_rate_5y     NUMERIC(5,2),
  -- Full-year pattern (for the daily row)
  cumulative_avg  NUMERIC(8,4),              -- cumulative avg return to this day
  -- Metadata
  lookback_years  SMALLINT DEFAULT 10,
  computed_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (asset_id, month, COALESCE(day_of_year, 0))
);

CREATE INDEX idx_season_asset_month ON seasonality_stats (asset_id, month);
*/

export interface SeasonalityStat {
  asset_id: number;
  month: number;
  day_of_year: number | null;
  avg_return_10y: number | null;
  win_rate_10y: number | null;
  median_return_10y: number | null;
  avg_return_5y: number | null;
  win_rate_5y: number | null;
  cumulative_avg: number | null;
  lookback_years: number;
  computed_at: string;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 11. SIGNALS (normalized output from all data sources)
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE signals (
  id                BIGSERIAL PRIMARY KEY,
  asset_id          INTEGER NOT NULL REFERENCES assets(id),
  metric_key        VARCHAR(64) NOT NULL,     -- 'trend_4h', 'cot_nc_net', 'gdp_surprise', etc.
  category          VARCHAR(32) NOT NULL,     -- 'technical', 'sentiment', 'cot', 'eco_growth', 'inflation', 'jobs', 'rates'
  -- Signal payload
  raw_value         NUMERIC(18,6),            -- The actual data value
  direction         direction NOT NULL,
  score             SMALLINT NOT NULL CHECK (score BETWEEN -2 AND 2),
  confidence        NUMERIC(3,2) DEFAULT 1.0 CHECK (confidence BETWEEN 0 AND 1),
  explanation       TEXT,                     -- 'GDP beat forecast by 0.3% → Bullish for USD'
  -- Provenance
  source_timestamp  TIMESTAMPTZ,             -- When the underlying data was released/measured
  scoring_version   INTEGER NOT NULL,        -- FK to scoring_versions.id
  computed_at       TIMESTAMPTZ DEFAULT NOW(),
  -- For FX pair-relative signals (NULL for single-economy assets)
  economy_id        INTEGER REFERENCES economies(id),
  is_pair_relative  BOOLEAN DEFAULT FALSE,    -- TRUE if score = base - quote
  UNIQUE (asset_id, metric_key, scoring_version, computed_at)
);

-- Partition by computed_at (monthly)
CREATE INDEX idx_signals_asset_metric ON signals (asset_id, metric_key, computed_at DESC);
CREATE INDEX idx_signals_category ON signals (asset_id, category, computed_at DESC);
CREATE INDEX idx_signals_version ON signals (scoring_version, computed_at DESC);
*/

export interface Signal {
  id: number;
  asset_id: number;
  metric_key: string;
  category: SignalCategory;
  raw_value: number | null;
  direction: Direction;
  score: -2 | -1 | 0 | 1 | 2;
  confidence: number;
  explanation: string | null;
  source_timestamp: string | null;
  scoring_version: number;
  computed_at: string;
  economy_id: number | null;
  is_pair_relative: boolean;
}

export type SignalCategory =
  | 'technical'
  | 'sentiment'
  | 'cot'
  | 'eco_growth'
  | 'inflation'
  | 'jobs'
  | 'rates'
  | 'confidence';


// ═══════════════════════════════════════════════════════════════════════════════
// 12. SCORING VERSIONS (immutable rule snapshots)
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE scoring_versions (
  id          SERIAL PRIMARY KEY,
  version     VARCHAR(16) UNIQUE NOT NULL,   -- 'v1.0.0', 'v1.1.0'
  description TEXT,
  -- Weights per category (sum to 1.0)
  weights     JSONB NOT NULL,                -- { "technical": 0.15, "cot": 0.15, ... }
  -- Per-metric scoring rules
  rules       JSONB NOT NULL,                -- { "gdp_surprise": { "thresholds": [...], "invert_for": [...] } }
  -- Lifecycle
  active      BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

CREATE INDEX idx_scoring_active ON scoring_versions (active) WHERE active = TRUE;
*/

export interface ScoringVersion {
  id: number;
  version: string;
  description: string | null;
  weights: CategoryWeights;
  rules: Record<string, MetricScoringRule>;
  active: boolean;
  created_at: string;
  activated_at: string | null;
}

export interface CategoryWeights {
  technical: number;
  sentiment: number;
  cot: number;
  eco_growth: number;
  inflation: number;
  jobs: number;
  rates: number;
  confidence: number;
}

export interface MetricScoringRule {
  /** Metric identifier (matches signal.metric_key) */
  metric_key: string;
  /** Thresholds for score assignment: [-2, -1, 0, +1, +2] */
  thresholds: {
    very_bearish: { max: number };   // score = -2 if value <= max
    bearish: { min: number; max: number };
    neutral: { min: number; max: number };
    bullish: { min: number; max: number };
    very_bullish: { min: number };   // score = +2 if value >= min
  };
  /** Asset symbols where this metric's score is INVERTED */
  invert_for: string[];
  /** If true, higher value = bearish (e.g., unemployment rate) */
  invert_direction: boolean;
  /** Category this metric belongs to */
  category: SignalCategory;
  /** Weight within category (default 1.0) */
  intra_category_weight: number;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 13. ASSET SCORES (precomputed snapshots)
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE asset_scores (
  id                  BIGSERIAL PRIMARY KEY,
  asset_id            INTEGER NOT NULL REFERENCES assets(id),
  scoring_version_id  INTEGER NOT NULL REFERENCES scoring_versions(id),
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Aggregate scores
  total_score         NUMERIC(5,2) NOT NULL,   -- -10..+10
  bias_label          bias_label NOT NULL,
  -- Category breakdown (JSONB for flexibility + fast reads)
  category_scores     JSONB NOT NULL,
  /*  {
        "technical":  { "score": 1.5, "direction": "bullish", "signal_count": 3 },
        "cot":        { "score": -0.5, "direction": "neutral", "signal_count": 1 },
        ...
      }
  */
  -- Full signal details for scorecard UI
  signal_details      JSONB NOT NULL,
  /*  [
        { "metric_key": "trend_4h", "category": "technical", "score": 1, "direction": "bullish",
          "raw_value": null, "explanation": "4H trend is upward" },
        ...
      ]
  */
  -- Meta
  data_freshness      JSONB,                    -- { "cot": "2026-02-17", "macro": "2026-02-20", ... }
  missing_data        TEXT[],                    -- ['cot', 'sentiment'] if not available
  UNIQUE (asset_id, scoring_version_id, computed_at)
);

-- Partition by computed_at (monthly)
CREATE INDEX idx_scores_asset_time ON asset_scores (asset_id, computed_at DESC);
CREATE INDEX idx_scores_version ON asset_scores (scoring_version_id, computed_at DESC);
*/

export interface AssetScore {
  id: number;
  asset_id: number;
  scoring_version_id: number;
  computed_at: string;
  total_score: number;
  bias_label: BiasLabel;
  category_scores: Record<SignalCategory, CategoryScoreDetail>;
  signal_details: SignalDetail[];
  data_freshness: Record<string, string> | null;
  missing_data: string[];
}

export interface CategoryScoreDetail {
  score: number;
  direction: Direction;
  signal_count: number;
}

export interface SignalDetail {
  metric_key: string;
  category: SignalCategory;
  score: -2 | -1 | 0 | 1 | 2;
  direction: Direction;
  raw_value: number | null;
  confidence: number;
  explanation: string | null;
  actual?: number | null;
  forecast?: number | null;
  previous?: number | null;
  surprise?: number | null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 14. TOP SETUPS SNAPSHOTS (precomputed heatmap)
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE top_setups_snapshots (
  id                  SERIAL PRIMARY KEY,
  scoring_version_id  INTEGER NOT NULL REFERENCES scoring_versions(id),
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Full grid data as JSONB (optimized for single-read from UI)
  data                JSONB NOT NULL,
  /*  {
        "columns": ["Trend","Seasonality","COT","Crowd","GDP","mPMI","sPMI",
                     "Retail Sales","Consumer Confidence","CPI","PPI","PCE",
                     "Interest Rates","NFP","Unemployment Rate","Claims","ADP","JOLTS"],
        "rows": [
          { "asset": "EURUSD", "total": 5, "scores": { "Trend": 1, "COT": 2, "GDP": -1, ... } },
          ...
        ],
        "updated_at": "2026-02-21T10:00:00Z"
      }
  */
  UNIQUE (scoring_version_id, computed_at)
);

CREATE INDEX idx_topsetups_time ON top_setups_snapshots (computed_at DESC);
*/

export interface TopSetupsSnapshot {
  id: number;
  scoring_version_id: number;
  computed_at: string;
  data: {
    columns: string[];
    rows: TopSetupsRow[];
    updated_at: string;
  };
}

export interface TopSetupsRow {
  asset: string;
  total: number;
  scores: Record<string, number>;   // column_name → score (-2..+2)
}


// ═══════════════════════════════════════════════════════════════════════════════
// 15. INGESTION LOG (pipeline audit trail)
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE ingestion_log (
  id          BIGSERIAL PRIMARY KEY,
  pipeline    VARCHAR(64) NOT NULL,          -- 'cot_weekly', 'macro_releases', 'price_15m', etc.
  status      ingestion_status NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  rows_fetched INTEGER DEFAULT 0,
  rows_inserted INTEGER DEFAULT 0,
  rows_updated INTEGER DEFAULT 0,
  error_message TEXT,
  metadata    JSONB,                         -- { "symbols_failed": ["NIKKEI"], "source": "CFTC" }
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ingestion_pipeline_time ON ingestion_log (pipeline, started_at DESC);
CREATE INDEX idx_ingestion_status ON ingestion_log (status) WHERE status IN ('failed', 'partial');
*/

export interface IngestionLogEntry {
  id: number;
  pipeline: string;
  status: IngestionStatus;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  rows_fetched: number;
  rows_inserted: number;
  rows_updated: number;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 16. DATA QUALITY LOG
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE data_quality_log (
  id          BIGSERIAL PRIMARY KEY,
  asset_id    INTEGER REFERENCES assets(id),
  economy_id  INTEGER REFERENCES economies(id),
  issue_type  VARCHAR(32) NOT NULL,          -- 'missing_cot', 'stale_price', 'api_error', 'outlier'
  severity    VARCHAR(16) NOT NULL,          -- 'warning', 'error', 'info'
  message     TEXT NOT NULL,
  pipeline    VARCHAR(64),
  resolved    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_dq_unresolved ON data_quality_log (resolved, created_at DESC) WHERE resolved = FALSE;
*/

export interface DataQualityEntry {
  id: number;
  asset_id: number | null;
  economy_id: number | null;
  issue_type: string;
  severity: 'warning' | 'error' | 'info';
  message: string;
  pipeline: string | null;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 17. CARRY TRADE DATA (derived/precomputed)
// ═══════════════════════════════════════════════════════════════════════════════

/*
CREATE TABLE carry_trade_scores (
  asset_id      INTEGER NOT NULL REFERENCES assets(id),
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  base_rate     NUMERIC(6,4),
  quote_rate    NUMERIC(6,4),
  carry_diff    NUMERIC(6,4) GENERATED ALWAYS AS (base_rate - quote_rate) STORED,
  carry_score   SMALLINT CHECK (carry_score BETWEEN -2 AND 2),
  swap_long     NUMERIC(12,4),
  swap_short    NUMERIC(12,4),
  PRIMARY KEY (asset_id, computed_at)
);
*/

export interface CarryTradeScore {
  asset_id: number;
  computed_at: string;
  base_rate: number | null;
  quote_rate: number | null;
  carry_diff: number | null;
  carry_score: number | null;
  swap_long: number | null;
  swap_short: number | null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// FULL ASSET UNIVERSE — Phase 1 (MVP) Seed Data
// ═══════════════════════════════════════════════════════════════════════════════

export const ASSET_UNIVERSE_PHASE1: Omit<Asset, 'id' | 'created_at' | 'updated_at'>[] = [
  // FX Majors
  { symbol: 'EURUSD', name: 'Euro / US Dollar',           asset_class: 'fx',        base_currency: 'EUR', quote_currency: 'USD', economy_id: null, cot_symbol: 'EUR', cot_pattern: '%EURO FX%CHICAGO MERCANTILE%',           has_cot: true,  has_sentiment: true,  display_order: 1,  active: true, metadata: {} },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar',  asset_class: 'fx',        base_currency: 'GBP', quote_currency: 'USD', economy_id: null, cot_symbol: 'GBP', cot_pattern: '%BRITISH POUND%CHICAGO MERCANTILE%',     has_cot: true,  has_sentiment: true,  display_order: 2,  active: true, metadata: {} },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen',   asset_class: 'fx',        base_currency: 'USD', quote_currency: 'JPY', economy_id: null, cot_symbol: 'JPY', cot_pattern: '%JAPANESE YEN%CHICAGO MERCANTILE%',      has_cot: true,  has_sentiment: true,  display_order: 3,  active: true, metadata: {} },
  { symbol: 'AUDUSD', name: 'Australian Dollar / USD',    asset_class: 'fx',        base_currency: 'AUD', quote_currency: 'USD', economy_id: null, cot_symbol: 'AUD', cot_pattern: '%AUSTRALIAN DOLLAR%CHICAGO MERCANTILE%', has_cot: true,  has_sentiment: true,  display_order: 4,  active: true, metadata: {} },
  { symbol: 'NZDUSD', name: 'New Zealand Dollar / USD',   asset_class: 'fx',        base_currency: 'NZD', quote_currency: 'USD', economy_id: null, cot_symbol: 'NZD', cot_pattern: '%NEW ZEALAND DOLLAR%CHICAGO MERCANTILE%',has_cot: true,  has_sentiment: true,  display_order: 5,  active: true, metadata: {} },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', asset_class: 'fx',       base_currency: 'USD', quote_currency: 'CAD', economy_id: null, cot_symbol: 'CAD', cot_pattern: '%CANADIAN DOLLAR%CHICAGO MERCANTILE%',   has_cot: true,  has_sentiment: true,  display_order: 6,  active: true, metadata: {} },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc',    asset_class: 'fx',        base_currency: 'USD', quote_currency: 'CHF', economy_id: null, cot_symbol: 'CHF', cot_pattern: '%SWISS FRANC%CHICAGO MERCANTILE%',       has_cot: true,  has_sentiment: true,  display_order: 7,  active: true, metadata: {} },
  // Metals
  { symbol: 'XAUUSD', name: 'Gold',                       asset_class: 'metal',     base_currency: null,  quote_currency: null,  economy_id: null, cot_symbol: 'Gold',    cot_pattern: '%GOLD%COMMODITY EXCHANGE%',          has_cot: true,  has_sentiment: true,  display_order: 10, active: true, metadata: { scoring_exceptions: { gdp: 'inverse' } } },
  { symbol: 'XAGUSD', name: 'Silver',                     asset_class: 'metal',     base_currency: null,  quote_currency: null,  economy_id: null, cot_symbol: 'SILVER',  cot_pattern: '%SILVER%COMMODITY EXCHANGE%',        has_cot: true,  has_sentiment: true,  display_order: 11, active: true, metadata: {} },
  // Energy
  { symbol: 'USOIL',  name: 'Crude Oil WTI',              asset_class: 'energy',    base_currency: null,  quote_currency: null,  economy_id: null, cot_symbol: 'USOIL',   cot_pattern: '%CRUDE OIL, LIGHT SWEET%NEW YORK MERCANTILE%', has_cot: true, has_sentiment: true, display_order: 15, active: true, metadata: {} },
  // Indices
  { symbol: 'SPX500', name: 'S&P 500',                    asset_class: 'index',     base_currency: null,  quote_currency: null,  economy_id: null, cot_symbol: 'SPX',     cot_pattern: '%E-MINI S&P 500%CHICAGO MERCANTILE%', has_cot: true, has_sentiment: true, display_order: 20, active: true, metadata: { economy: 'US' } },
  { symbol: 'NAS100', name: 'Nasdaq 100',                 asset_class: 'index',     base_currency: null,  quote_currency: null,  economy_id: null, cot_symbol: 'NASDAQ',  cot_pattern: '%NASDAQ%MINI%CHICAGO MERCANTILE%',    has_cot: true, has_sentiment: true, display_order: 21, active: true, metadata: { economy: 'US' } },
  { symbol: 'US30',   name: 'Dow Jones',                  asset_class: 'index',     base_currency: null,  quote_currency: null,  economy_id: null, cot_symbol: 'DOW',     cot_pattern: '%DJIA%$5%CHICAGO BOARD%',             has_cot: true, has_sentiment: false, display_order: 22, active: true, metadata: { economy: 'US' } },
  // Crypto
  { symbol: 'BTCUSD', name: 'Bitcoin',                    asset_class: 'crypto',    base_currency: null,  quote_currency: null,  economy_id: null, cot_symbol: 'BTC',     cot_pattern: '%BITCOIN%CHICAGO MERCANTILE%',        has_cot: true, has_sentiment: true, display_order: 30, active: true, metadata: {} },
  // Fixed Income
  { symbol: 'US10Y',  name: '10-Year Treasury',           asset_class: 'rate',      base_currency: null,  quote_currency: null,  economy_id: null, cot_symbol: 'US10T',   cot_pattern: '%10-YEAR%TREASURY%CHICAGO BOARD%',    has_cot: true, has_sentiment: false, display_order: 40, active: true, metadata: { economy: 'US' } },
];
