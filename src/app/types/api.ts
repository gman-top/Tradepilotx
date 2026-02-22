// ═══════════════════════════════════════════════════════════════════════════════
// TradePilot — REST API Endpoint Contracts
// ═══════════════════════════════════════════════════════════════════════════════
//
// ARCHITECTURE DECISION: REST over GraphQL
//
// Reasons:
//   1. Read-heavy, write-rare workload — REST is simpler and cacheable (CDN/Redis).
//   2. Predictable data shapes — every screen has a known, fixed payload.
//   3. Precomputed snapshots — Top Setups and Scorecards are single JSON reads.
//   4. Team size — REST has lower cognitive overhead for a small team.
//   5. Edge caching — REST endpoints can use Cache-Control headers directly.
//
// If the API grows beyond ~30 endpoints or clients need flexible field selection,
// migrating to GraphQL (with persisted queries) would be straightforward because
// these types serve as the schema contract regardless.
//
// BASE URL: /api/v1
//
// AUTH: Bearer token (Supabase JWT) on all endpoints except /health
//       Admin endpoints require `role: 'admin'` in JWT claims
//
// PAGINATION: Cursor-based for time-series, offset-based for lists
//   ?cursor=<ISO timestamp>&limit=50
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  AssetClass,
  BiasLabel,
  Direction,
  SignalCategory,
  ImpactLevel,
  TrendDirection,
} from './database';

import type {
  AssetScorecard,
  TopSetupsEntry,
  SignalInput,
  CategoryScore,
  MetricKey,
} from './scoring';


// ═══════════════════════════════════════════════════════════════════════════════
// COMMON TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Standard API response wrapper */
export interface ApiResponse<T> {
  ok: boolean;
  data: T;
  meta?: {
    total?: number;
    cursor?: string;
    has_more?: boolean;
    cached?: boolean;
    cache_age_seconds?: number;
    scoring_version?: string;
    computed_at?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Pagination params */
export interface PaginationParams {
  cursor?: string;    // ISO timestamp for time-series
  offset?: number;    // For offset-based lists
  limit?: number;     // Default: 50, Max: 200
}

/** Time range filter */
export interface TimeRangeParams {
  from?: string;      // ISO timestamp
  to?: string;        // ISO timestamp
  period?: '1w' | '1m' | '3m' | '6m' | '1y' | '3y' | 'all';
}


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 1: GET /api/v1/assets
// Screen: Sidebar / Asset Selector / Universe
// ═══════════════════════════════════════════════════════════════════════════════

export interface AssetsListParams {
  asset_class?: AssetClass;
  active?: boolean;
  search?: string;
}

export interface AssetListItem {
  id: number;
  symbol: string;
  name: string;
  asset_class: AssetClass;
  base_currency: string | null;
  quote_currency: string | null;
  has_cot: boolean;
  has_sentiment: boolean;
  /** Quick-access: latest total score */
  latest_score: number | null;
  latest_bias: BiasLabel | null;
}

// Response: ApiResponse<AssetListItem[]>


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 2: GET /api/v1/assets/:symbol/scorecard
// Screen: Asset Profile / Asset Scorecard
// ═══════════════════════════════════════════════════════════════════════════════

// Response: ApiResponse<AssetScorecard>
// (Uses the AssetScorecard type from scoring.ts directly)


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 3: GET /api/v1/top-setups
// Screen: Top Setups Heatmap
// ═══════════════════════════════════════════════════════════════════════════════

export interface TopSetupsParams {
  asset_class?: AssetClass;    // Filter by class
  sort_by?: 'total' | 'name' | MetricKey;
  sort_dir?: 'asc' | 'desc';
}

export interface TopSetupsResponse {
  columns: string[];
  rows: TopSetupsEntry[];
  scoring_version: string;
  computed_at: string;
}

// Response: ApiResponse<TopSetupsResponse>


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 4: GET /api/v1/cot/latest
// Screen: COT Positioning — All Assets View
// ═══════════════════════════════════════════════════════════════════════════════

export interface COTLatestParams {
  trader_type?: 'non_commercial' | 'commercial' | 'retail' | 'all';
  sort_by?: 'net' | 'change' | 'name';
}

export interface COTLatestEntry {
  symbol: string;
  name: string;
  asset_class: string;
  report_date: string;
  // Positions
  long: number;
  short: number;
  net: number;
  open_interest: number;
  // Weekly changes
  delta_long: number;
  delta_short: number;
  delta_net: number;
  delta_oi: number;
  // Percentages
  long_pct: number;
  short_pct: number;
  // Net change as percentage
  net_change_pct: number;
  // Percentile rank
  percentile_52w: number | null;
  percentile_156w: number | null;
  percentile_label: string | null;
}

// Response: ApiResponse<COTLatestEntry[]>


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 5: GET /api/v1/cot/:symbol/history
// Screen: COT Positioning — Symbol View (History + Chart)
// ═══════════════════════════════════════════════════════════════════════════════

export interface COTHistoryParams extends TimeRangeParams {
  trader_type?: 'non_commercial' | 'commercial' | 'retail' | 'all';
}

export interface COTHistoryEntry {
  report_date: string;
  long: number;
  short: number;
  net: number;
  open_interest: number;
  delta_net: number;
  long_pct: number;
  short_pct: number;
  net_change_pct: number;
}

export interface COTHistoryResponse {
  symbol: string;
  name: string;
  trader_type: string;
  data: COTHistoryEntry[];
  percentile_52w: number | null;
  percentile_156w: number | null;
}

// Response: ApiResponse<COTHistoryResponse>


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 6: GET /api/v1/sentiment/latest
// Screen: Retail Sentiment — All Assets
// ═══════════════════════════════════════════════════════════════════════════════

export interface SentimentLatestEntry {
  symbol: string;
  name: string;
  long_pct: number;
  short_pct: number;
  /** Contrarian signal direction */
  contrarian_direction: Direction;
  contrarian_score: number;
  source: string;
  timestamp: string;
}

// Response: ApiResponse<SentimentLatestEntry[]>


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 7: GET /api/v1/sentiment/:symbol/history
// Screen: Retail Sentiment — Symbol History
// ═══════════════════════════════════════════════════════════════════════════════

export interface SentimentHistoryEntry {
  timestamp: string;
  long_pct: number;
  short_pct: number;
  source: string;
}

export interface SentimentHistoryResponse {
  symbol: string;
  data: SentimentHistoryEntry[];
}

// Response: ApiResponse<SentimentHistoryResponse>


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 8: GET /api/v1/macro/heatmap
// Screen: Economic Heatmaps — By Country/Currency
// ═══════════════════════════════════════════════════════════════════════════════

export interface MacroHeatmapParams {
  economies?: string[];          // Filter: ['US', 'EU', 'UK']
  categories?: string[];         // Filter: ['growth', 'inflation', 'jobs']
  period?: '1m' | '3m' | '6m' | '1y';
}

export interface MacroHeatmapRow {
  economy_code: string;
  economy_name: string;
  currency: string;
  indicators: MacroIndicatorReading[];
  /** Aggregate strength score for this economy */
  strength_score: number;
  strength_direction: Direction;
}

export interface MacroIndicatorReading {
  indicator_key: string;
  indicator_name: string;
  category: string;
  /** Most recent release */
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  surprise: number | null;
  beat_miss: 'beat' | 'miss' | 'inline' | null;
  impact: ImpactLevel;
  release_date: string;
  unit: string;
  /** Scoring */
  score: number;
  direction: Direction;
}

// Response: ApiResponse<MacroHeatmapRow[]>


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 9: GET /api/v1/macro/strength
// Screen: Economic Strength Index
// ═══════════════════════════════════════════════════════════════════════════════

export interface EconomicStrengthEntry {
  economy_code: string;
  economy_name: string;
  currency: string;
  /** Overall strength score (weighted sum of all macro indicators) */
  strength_index: number;
  strength_label: string;          // 'Strong', 'Moderate', 'Weak'
  direction: Direction;
  /** Strength by category */
  category_strength: Record<string, { score: number; direction: Direction }>;
  /** Trend: is it improving or deteriorating? */
  trend_1m: 'improving' | 'stable' | 'deteriorating';
  trend_3m: 'improving' | 'stable' | 'deteriorating';
}

// Response: ApiResponse<EconomicStrengthEntry[]>


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 10: GET /api/v1/macro/surprises
// Screen: Economic Surprise Index
// ═══════════════════════════════════════════════════════════════════════════════

export interface EconomicSurpriseEntry {
  economy_code: string;
  economy_name: string;
  currency: string;
  /** Rolling surprise index (sum of recent standardized surprises) */
  surprise_index: number;
  direction: Direction;
  /** Recent releases that contributed */
  recent_surprises: Array<{
    indicator_name: string;
    surprise: number;
    surprise_std: number;   // Standardized surprise (z-score)
    release_date: string;
    beat_miss: 'beat' | 'miss' | 'inline';
  }>;
}

// Response: ApiResponse<EconomicSurpriseEntry[]>


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 11: GET /api/v1/carry-trade
// Screen: Carry Trade Scanner
// ═══════════════════════════════════════════════════════════════════════════════

export interface CarryTradeEntry {
  symbol: string;
  name: string;
  base_currency: string;
  quote_currency: string;
  base_rate: number;
  quote_rate: number;
  carry_diff: number;            // base_rate - quote_rate (annualized)
  carry_direction: Direction;    // Positive carry = bullish for long position
  carry_score: number;           // -2..+2
  swap_long: number | null;      // Daily swap for long (in pips or currency)
  swap_short: number | null;
  /** Carry-adjusted trend: is the carry supported by price trend? */
  trend_alignment: boolean;
}

// Response: ApiResponse<CarryTradeEntry[]>


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 12: GET /api/v1/seasonality/:symbol
// Screen: Seasonality Charts
// ═══════════════════════════════════════════════════════════════════════════════

export interface SeasonalityParams {
  lookback?: 5 | 10;
}

export interface SeasonalityResponse {
  symbol: string;
  name: string;
  /** Monthly seasonality (12 entries) */
  monthly: SeasonalityMonthEntry[];
  /** Daily seasonality for full year (up to 252 trading days) */
  daily: SeasonalityDailyEntry[];
  /** Current month analysis */
  current_month: {
    month: number;
    month_name: string;
    avg_return_10y: number;
    win_rate_10y: number;
    score: number;
    direction: Direction;
  };
}

export interface SeasonalityMonthEntry {
  month: number;
  month_name: string;
  avg_return_10y: number;
  avg_return_5y: number;
  win_rate_10y: number;
  direction: Direction;
}

export interface SeasonalityDailyEntry {
  day_of_year: number;
  date_label: string;             // 'Jan 1', 'Feb 15', etc.
  cumulative_avg_return: number;
}

// Response: ApiResponse<SeasonalityResponse>


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 13: GET /api/v1/technical/heatmap
// Screen: Technical Heatmap
// ═══════════════════════════════════════════════════════════════════════════════

export interface TechnicalHeatmapEntry {
  symbol: string;
  name: string;
  asset_class: string;
  /** Current price */
  price: number;
  /** SMA readings */
  sma_20: { value: number; relation: 'above' | 'below' };
  sma_50: { value: number; relation: 'above' | 'below' };
  sma_100: { value: number; relation: 'above' | 'below' };
  sma_200: { value: number; relation: 'above' | 'below' };
  /** Oscillators */
  rsi_14: number;
  /** Volatility */
  atr_14: number;
  volatility: number;
  volatility_label: 'Low' | 'Normal' | 'High' | 'Extreme';
  /** Trend */
  trend_4h: TrendDirection;
  trend_daily: TrendDirection;
  /** Composite score */
  technical_score: number;
  technical_direction: Direction;
}

// Response: ApiResponse<TechnicalHeatmapEntry[]>


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 14: GET /api/v1/scores/:symbol/history
// Screen: Score History Chart (EdgeFinder score over time)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ScoreHistoryParams extends TimeRangeParams {
  /** Include category breakdown per point? */
  include_categories?: boolean;
}

export interface ScoreHistoryEntry {
  computed_at: string;
  total_score: number;
  bias_label: BiasLabel;
  categories?: Record<SignalCategory, number>;
  scoring_version: string;
}

export interface ScoreHistoryResponse {
  symbol: string;
  name: string;
  data: ScoreHistoryEntry[];
}

// Response: ApiResponse<ScoreHistoryResponse>


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT 15: GET /api/v1/rates
// Screen: Interest Rates / Yield Comparison
// ═══════════════════════════════════════════════════════════════════════════════

export interface RatesEntry {
  economy_code: string;
  economy_name: string;
  currency: string;
  policy_rate: number | null;
  yield_2y: number | null;
  yield_10y: number | null;
  yield_30y: number | null;
  spread_2_10: number | null;
  real_rate_10y: number | null;
  /** Is the yield curve inverted? */
  curve_inverted: boolean;
  /** Rate expectation: market pricing next move */
  next_meeting_date: string | null;
  market_expects: 'hike' | 'hold' | 'cut' | null;
}

// Response: ApiResponse<RatesEntry[]>


// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS (for pipeline monitoring / debugging)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/admin/ingestion-log
export interface IngestionLogParams extends PaginationParams {
  pipeline?: string;
  status?: string;
}

// GET /api/v1/admin/data-quality
export interface DataQualityParams extends PaginationParams {
  severity?: string;
  resolved?: boolean;
}

// POST /api/v1/admin/recompute-scores
export interface RecomputeScoresRequest {
  /** Recompute for specific assets, or all if empty */
  symbols?: string[];
  /** Force recompute even if data hasn't changed */
  force?: boolean;
}

// GET /api/v1/admin/scoring-versions
// POST /api/v1/admin/scoring-versions  (create new version)
// PUT  /api/v1/admin/scoring-versions/:id/activate


// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/health (no auth required)
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  uptime_seconds: number;
  services: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
    cftc_proxy: 'ok' | 'error';
  };
  latest_ingestion: {
    pipeline: string;
    status: string;
    finished_at: string;
  } | null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT → SCREEN MAPPING (Reference)
// ═══════════════════════════════════════════════════════════════════════════════
//
// UI Screen                     → API Endpoint(s)
// ──────────────────────────────────────────────────────────────────────────
// Overview (Dashboard)          → GET /assets (quick scores)
//                                 GET /top-setups (summary view)
//                                 GET /macro/strength (top bar)
//
// Asset Profile (Scorecard)     → GET /assets/:symbol/scorecard
//                                 GET /cot/:symbol/history
//                                 GET /sentiment/:symbol/history
//                                 GET /seasonality/:symbol
//                                 GET /scores/:symbol/history
//
// Top Setups (Heatmap)          → GET /top-setups
//
// COT Positioning               → GET /cot/latest
//                                 GET /cot/:symbol/history
//
// Fundamentals                  → GET /macro/heatmap
//                                 GET /macro/strength
//                                 GET /macro/surprises
//                                 GET /rates
//
// Bias Engine                   → GET /assets/:symbol/scorecard (detailed)
//                                 GET /scores/:symbol/history
//
// Retail Sentiment              → GET /sentiment/latest
//                                 GET /sentiment/:symbol/history
//
// Carry Trade                   → GET /carry-trade
//                                 GET /rates
//
// Seasonality                   → GET /seasonality/:symbol
//
// Technical Heatmap             → GET /technical/heatmap
//
// Account / Settings            → (Supabase Auth endpoints, not custom API)
// ═══════════════════════════════════════════════════════════════════════════════
