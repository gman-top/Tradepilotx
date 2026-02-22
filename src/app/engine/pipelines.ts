// ═══════════════════════════════════════════════════════════════════════════════
// TradePilot — Ingestion Pipelines & Job Definitions
// ═══════════════════════════════════════════════════════════════════════════════
//
// ARCHITECTURE:
//
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │                        JOB SCHEDULER                                │
//   │              (BullMQ + Redis + cron expressions)                     │
//   │                                                                      │
//   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
//   │  │ Price    │  │ COT      │  │ Sentiment│  │ Macro    │            │
//   │  │ 15min   │  │ 12h check│  │ 30min   │  │ on-event │            │
//   │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
//   │       │              │              │              │                  │
//   │       ▼              ▼              ▼              ▼                  │
//   │  ┌──────────────────────────────────────────────────────┐            │
//   │  │              DATA PROVIDERS (interfaces)             │            │
//   │  │  IPriceProvider  ICOTProvider  ISentimentProvider ... │            │
//   │  └────────────────────────┬─────────────────────────────┘            │
//   │                           │                                          │
//   │                           ▼                                          │
//   │  ┌──────────────────────────────────────────────────────┐            │
//   │  │                 POSTGRESQL + REDIS                    │            │
//   │  │  Tables: price_ohlc, cot_positions, macro_releases   │            │
//   │  │  Cache: snapshots, heatmaps, score cards             │            │
//   │  └────────────────────────┬─────────────────────────────┘            │
//   │                           │                                          │
//   │                           ▼                                          │
//   │  ┌──────────────────────────────────────────────────────┐            │
//   │  │              SCORING ENGINE (pure)                    │            │
//   │  │  computeAssetScorecard() → AssetScorecard            │            │
//   │  │  computeTopSetups()      → TopSetupsEntry[]          │            │
//   │  └────────────────────────┬─────────────────────────────┘            │
//   │                           │                                          │
//   │                           ▼                                          │
//   │  ┌──────────────────────────────────────────────────────┐            │
//   │  │              SNAPSHOT WRITER                          │            │
//   │  │  → asset_scores (per asset)                          │            │
//   │  │  → top_setups_snapshots (heatmap)                    │            │
//   │  │  → Redis cache (instant reads)                       │            │
//   │  └──────────────────────────────────────────────────────┘            │
//   └──────────────────────────────────────────────────────────────────────┘
//
// JOB FAILURE HANDLING:
//   - Each job logs to ingestion_log table
//   - Failed jobs retry 3 times with exponential backoff
//   - After 3 failures: log to data_quality_log, send alert
//   - Partial success (e.g., 17/19 COT symbols) → status: 'partial'
//   - Stale data detection: if data hasn't updated in 2x expected interval
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { IngestionLogEntry, DataQualityEntry } from '../types/database';
import type { ProviderRegistry } from './providers';


// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface PipelineConfig {
  /** Unique pipeline identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Cron expression for scheduling */
  cron: string;
  /** How often this pipeline should run (for stale detection) */
  expected_interval_minutes: number;
  /** Maximum execution time before timeout */
  timeout_ms: number;
  /** Number of retries on failure */
  max_retries: number;
  /** Retry delay (exponential: delay * 2^attempt) */
  retry_delay_ms: number;
  /** Should this pipeline trigger score recomputation? */
  triggers_scoring: boolean;
  /** Dependencies: other pipelines that must have run recently */
  depends_on: string[];
  /** Priority: lower number = higher priority */
  priority: number;
}

/**
 * Master pipeline registry.
 * Each pipeline fetches from one data source and writes to one DB table.
 */
export const PIPELINE_CONFIGS: PipelineConfig[] = [
  // ─── PRICE QUOTES ──────────────────────────────────────────────────────
  // Runs every 15 minutes during market hours
  // Fetches OHLC for all active assets at 15m, 1h, 4h timeframes
  // 1D and 1W bars are derived from 15m data at EOD
  {
    id: 'price_15m',
    name: 'Price OHLC (15-minute)',
    cron: '*/15 * * * 1-5',           // Every 15 min, Mon-Fri
    expected_interval_minutes: 15,
    timeout_ms: 60_000,
    max_retries: 3,
    retry_delay_ms: 5_000,
    triggers_scoring: false,           // Technical indicators pipeline handles scoring
    depends_on: [],
    priority: 1,                       // Highest priority
  },

  // ─── TECHNICAL INDICATORS ─────────────────────────────────────────────
  // Runs after price updates, computes SMA/RSI/ATR/trend
  {
    id: 'technical_indicators',
    name: 'Technical Indicators',
    cron: '2,17,32,47 * * * 1-5',    // 2 min after each price fetch
    expected_interval_minutes: 15,
    timeout_ms: 120_000,
    max_retries: 2,
    retry_delay_ms: 10_000,
    triggers_scoring: true,
    depends_on: ['price_15m'],
    priority: 2,
  },

  // ─── COT POSITIONS ────────────────────────────────────────────────────
  // CFTC publishes weekly (usually Friday 3:30 PM ET for Tuesday report date)
  // We check every 12 hours and only process if new data is found
  {
    id: 'cot_weekly',
    name: 'COT Weekly (CFTC)',
    cron: '0 */12 * * *',            // Every 12 hours
    expected_interval_minutes: 720,   // 12 hours
    timeout_ms: 300_000,              // 5 min (19 symbols in parallel)
    max_retries: 3,
    retry_delay_ms: 30_000,
    triggers_scoring: true,
    depends_on: [],
    priority: 3,
  },

  // ─── RETAIL SENTIMENT ─────────────────────────────────────────────────
  // Fetches from broker APIs every 30 minutes
  {
    id: 'retail_sentiment',
    name: 'Retail Sentiment',
    cron: '*/30 * * * *',            // Every 30 min
    expected_interval_minutes: 30,
    timeout_ms: 60_000,
    max_retries: 3,
    retry_delay_ms: 10_000,
    triggers_scoring: true,
    depends_on: [],
    priority: 4,
  },

  // ─── MACRO RELEASES ───────────────────────────────────────────────────
  // Economic data releases are event-driven but we poll hourly for updates
  // High-impact releases (NFP, CPI, FOMC) may need more frequent checks
  {
    id: 'macro_releases',
    name: 'Macro Economic Data',
    cron: '5 * * * *',               // Every hour at :05
    expected_interval_minutes: 60,
    timeout_ms: 120_000,
    max_retries: 3,
    retry_delay_ms: 15_000,
    triggers_scoring: true,
    depends_on: [],
    priority: 5,
  },

  // ─── INTEREST RATES ───────────────────────────────────────────────────
  // Policy rates change rarely; yields change continuously
  // Check every 4 hours for rate decisions, hourly for yields
  {
    id: 'interest_rates',
    name: 'Interest Rates & Yields',
    cron: '10 */4 * * *',            // Every 4 hours at :10
    expected_interval_minutes: 240,
    timeout_ms: 60_000,
    max_retries: 3,
    retry_delay_ms: 15_000,
    triggers_scoring: true,
    depends_on: [],
    priority: 6,
  },

  // ─── SEASONALITY COMPUTATION ──────────────────────────────────────────
  // Recomputed daily at market close (needs full price history)
  {
    id: 'seasonality_daily',
    name: 'Seasonality Statistics',
    cron: '0 22 * * 1-5',            // 10 PM UTC, Mon-Fri (after US close)
    expected_interval_minutes: 1440,  // Daily
    timeout_ms: 600_000,              // 10 min (heavy computation)
    max_retries: 2,
    retry_delay_ms: 60_000,
    triggers_scoring: true,
    depends_on: ['price_15m'],
    priority: 7,
  },

  // ─── SCORE RECOMPUTATION ──────────────────────────────────────────────
  // Runs after any scoring-triggering pipeline completes
  // Also runs on a schedule as a safety net
  {
    id: 'score_recompute',
    name: 'Score Recomputation',
    cron: '15 */2 * * *',            // Every 2 hours at :15
    expected_interval_minutes: 120,
    timeout_ms: 300_000,
    max_retries: 2,
    retry_delay_ms: 30_000,
    triggers_scoring: false,          // This IS the scoring pipeline
    depends_on: [],
    priority: 10,
  },

  // ─── SNAPSHOT WRITER ──────────────────────────────────────────────────
  // Writes precomputed snapshots to Redis for instant UI reads
  // Runs immediately after score recomputation
  {
    id: 'snapshot_writer',
    name: 'Snapshot Writer (Redis)',
    cron: '20 */2 * * *',            // 5 min after score_recompute
    expected_interval_minutes: 120,
    timeout_ms: 60_000,
    max_retries: 2,
    retry_delay_ms: 5_000,
    triggers_scoring: false,
    depends_on: ['score_recompute'],
    priority: 11,
  },

  // ─── DATA QUALITY CHECKER ─────────────────────────────────────────────
  // Checks for stale data, missing symbols, anomalies
  {
    id: 'data_quality',
    name: 'Data Quality Checker',
    cron: '0 */6 * * *',             // Every 6 hours
    expected_interval_minutes: 360,
    timeout_ms: 120_000,
    max_retries: 1,
    retry_delay_ms: 60_000,
    triggers_scoring: false,
    depends_on: [],
    priority: 20,
  },
];


// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE EXECUTION FRAMEWORK (Pseudocode / Types)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Base class for all pipeline executors.
 * Each pipeline implements the `execute` method.
 *
 * PSEUDOCODE — This would be implemented in the Node.js backend:
 *
 *   class COTWeeklyPipeline extends BasePipeline {
 *     async execute(ctx: PipelineContext): Promise<PipelineResult> {
 *       const provider = ctx.registry.cot;
 *       const symbols = await ctx.db.getActiveCOTSymbols();
 *
 *       // Fetch from provider
 *       const result = await provider.fetchLatest(symbols);
 *       if (!result.ok) throw new Error(`COT fetch failed: ${result.source}`);
 *
 *       // Check if data is new (compare report_date with latest in DB)
 *       const latestInDb = await ctx.db.getLatestCOTDate();
 *       const newReportDate = Object.values(result.data)[0]?.report_date;
 *       if (newReportDate === latestInDb) {
 *         return { status: 'success', message: 'No new data', rows_inserted: 0 };
 *       }
 *
 *       // Insert new data
 *       const inserted = await ctx.db.insertCOTBatch(result.data);
 *
 *       // Log data quality issues
 *       for (const symbol of symbols) {
 *         if (!result.data[symbol]) {
 *           await ctx.logQuality({
 *             asset_id: await ctx.db.getAssetId(symbol),
 *             issue_type: 'missing_cot',
 *             severity: 'warning',
 *             message: `No COT data returned for ${symbol}`,
 *             pipeline: 'cot_weekly',
 *           });
 *         }
 *       }
 *
 *       return { status: 'success', rows_inserted: inserted };
 *     }
 *   }
 */

export interface PipelineContext {
  /** Provider registry for data fetching */
  registry: ProviderRegistry;
  /** Database access layer */
  db: DatabaseAccess;
  /** Redis cache access */
  cache: CacheAccess;
  /** Logger */
  log: PipelineLogger;
  /** Current execution metadata */
  execution: {
    pipeline_id: string;
    started_at: string;
    attempt: number;
  };
}

export interface PipelineResult {
  status: 'success' | 'partial' | 'failed';
  message?: string;
  rows_fetched?: number;
  rows_inserted?: number;
  rows_updated?: number;
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

/** Database access interface (implemented by the backend service layer) */
export interface DatabaseAccess {
  // These are type signatures for the methods the pipeline needs
  getActiveAssets(): Promise<Array<{ id: number; symbol: string; cot_symbol: string | null }>>;
  getActiveCOTSymbols(): Promise<string[]>;
  getLatestCOTDate(): Promise<string | null>;
  insertCOTBatch(data: Record<string, unknown>): Promise<number>;
  insertMacroBatch(data: unknown[]): Promise<number>;
  insertSentimentBatch(data: unknown[]): Promise<number>;
  insertPriceBatch(data: unknown[]): Promise<number>;
  getAssetId(symbol: string): Promise<number>;
  getAssetDataSnapshot(assetId: number): Promise<unknown>;
  insertAssetScore(score: unknown): Promise<void>;
  insertTopSetupsSnapshot(snapshot: unknown): Promise<void>;
}

/** Cache access interface */
export interface CacheAccess {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Invalidate all keys matching a pattern */
  invalidatePattern(pattern: string): Promise<number>;
}

/** Pipeline logger */
export interface PipelineLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  /** Log a data quality issue to the database */
  logQuality(entry: Omit<DataQualityEntry, 'id' | 'created_at' | 'resolved_at'>): Promise<void>;
}


// ═══════════════════════════════════════════════════════════════════════════════
// CACHING STRATEGY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CACHING & PRECOMPUTING STRATEGY
 *
 * Layer 1: PostgreSQL (source of truth)
 *   - All time-series data
 *   - All computed scores with full audit trail
 *   - Queryable for history, backfill, debugging
 *
 * Layer 2: Redis (hot cache for UI)
 *   - Precomputed snapshots that the UI reads directly
 *   - TTL-based expiration with background refresh
 *   - Invalidated when source data updates
 *
 * CACHE KEY SCHEMA:
 *   tp:scorecard:<symbol>           → Full AssetScorecard JSON (TTL: 5 min)
 *   tp:top-setups                   → Full TopSetups heatmap (TTL: 5 min)
 *   tp:cot:latest                   → All COT latest data (TTL: 1 hour)
 *   tp:cot:history:<symbol>         → COT history (TTL: 12 hours)
 *   tp:sentiment:latest             → All sentiment data (TTL: 5 min)
 *   tp:sentiment:history:<symbol>   → Sentiment history (TTL: 30 min)
 *   tp:macro:heatmap                → Economic heatmap (TTL: 30 min)
 *   tp:macro:strength               → Economic strength (TTL: 30 min)
 *   tp:macro:surprises              → Surprise index (TTL: 30 min)
 *   tp:technical:heatmap            → Technical heatmap (TTL: 5 min)
 *   tp:seasonality:<symbol>         → Seasonality data (TTL: 24 hours)
 *   tp:rates                        → Interest rates (TTL: 1 hour)
 *   tp:carry-trade                  → Carry trade scanner (TTL: 1 hour)
 *   tp:scores:history:<symbol>      → Score history (TTL: 2 hours)
 *
 * INVALIDATION RULES:
 *   When pipeline X completes → invalidate keys:
 *     price_15m            → tp:technical:heatmap
 *     technical_indicators → tp:technical:heatmap, tp:scorecard:*, tp:top-setups
 *     cot_weekly           → tp:cot:*, tp:scorecard:*, tp:top-setups
 *     retail_sentiment     → tp:sentiment:*, tp:scorecard:*, tp:top-setups
 *     macro_releases       → tp:macro:*, tp:scorecard:*, tp:top-setups
 *     interest_rates       → tp:rates, tp:carry-trade, tp:scorecard:*, tp:top-setups
 *     seasonality_daily    → tp:seasonality:*, tp:scorecard:*, tp:top-setups
 *     score_recompute      → tp:scorecard:*, tp:top-setups, tp:scores:history:*
 */

export const CACHE_KEYS = {
  scorecard: (symbol: string) => `tp:scorecard:${symbol}`,
  topSetups: () => 'tp:top-setups',
  cotLatest: () => 'tp:cot:latest',
  cotHistory: (symbol: string) => `tp:cot:history:${symbol}`,
  sentimentLatest: () => 'tp:sentiment:latest',
  sentimentHistory: (symbol: string) => `tp:sentiment:history:${symbol}`,
  macroHeatmap: () => 'tp:macro:heatmap',
  macroStrength: () => 'tp:macro:strength',
  macroSurprises: () => 'tp:macro:surprises',
  technicalHeatmap: () => 'tp:technical:heatmap',
  seasonality: (symbol: string) => `tp:seasonality:${symbol}`,
  rates: () => 'tp:rates',
  carryTrade: () => 'tp:carry-trade',
  scoreHistory: (symbol: string) => `tp:scores:history:${symbol}`,
} as const;

export const CACHE_TTLS: Record<string, number> = {
  scorecard: 300,           // 5 min
  topSetups: 300,           // 5 min
  cotLatest: 3600,          // 1 hour
  cotHistory: 43200,        // 12 hours
  sentimentLatest: 300,     // 5 min
  sentimentHistory: 1800,   // 30 min
  macroHeatmap: 1800,       // 30 min
  macroStrength: 1800,      // 30 min
  macroSurprises: 1800,     // 30 min
  technicalHeatmap: 300,    // 5 min
  seasonality: 86400,       // 24 hours
  rates: 3600,              // 1 hour
  carryTrade: 3600,         // 1 hour
  scoreHistory: 7200,       // 2 hours
};

export const INVALIDATION_MAP: Record<string, string[]> = {
  price_15m: ['tp:technical:heatmap'],
  technical_indicators: ['tp:technical:heatmap', 'tp:scorecard:*', 'tp:top-setups'],
  cot_weekly: ['tp:cot:*', 'tp:scorecard:*', 'tp:top-setups'],
  retail_sentiment: ['tp:sentiment:*', 'tp:scorecard:*', 'tp:top-setups'],
  macro_releases: ['tp:macro:*', 'tp:scorecard:*', 'tp:top-setups'],
  interest_rates: ['tp:rates', 'tp:carry-trade', 'tp:scorecard:*', 'tp:top-setups'],
  seasonality_daily: ['tp:seasonality:*', 'tp:scorecard:*', 'tp:top-setups'],
  score_recompute: ['tp:scorecard:*', 'tp:top-setups', 'tp:scores:history:*'],
};


// ═══════════════════════════════════════════════════════════════════════════════
// DATA QUALITY & BACKFILL STRATEGY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * DATA QUALITY RULES:
 *
 * 1. MISSING COT DATA
 *    - Some assets don't have CFTC COT coverage (UK100, DAX, CHINA50, etc.)
 *    - These are marked with `has_cot: false` in the assets table
 *    - Scoring engine treats missing COT as "not available" → category gets 0 weight
 *    - UI shows "N/A" instead of a score cell
 *
 * 2. STALE DATA DETECTION
 *    - Each pipeline has an `expected_interval_minutes`
 *    - If last successful run > 2x expected interval → alert
 *    - Staleness is checked by the `data_quality` pipeline
 *    - Stale data reduces confidence in scoring (confidence *= 0.5)
 *
 * 3. OUTLIER DETECTION
 *    - For macro releases: if |surprise| > 5 * typical_surprise_std → flag as potential error
 *    - For COT: if |delta_nc_net| > 3 * avg(|delta_nc_net|) last 52w → flag
 *    - Flagged items are logged but still processed (no auto-rejection)
 *
 * 4. BACKFILL STRATEGY
 *    - Price: backfill from provider, chunk by month, oldest first
 *    - COT: CFTC SODA API supports historical queries — backfill up to 10 years
 *    - Macro: FRED/TradingEconomics have historical data — backfill per indicator
 *    - Sentiment: usually no historical API — start from "now" and accumulate
 *    - Seasonality: requires price history → compute after price backfill
 *
 * 5. SCORING VERSION MIGRATION
 *    - Old scores are NEVER deleted or modified
 *    - New scoring version creates new rows in asset_scores
 *    - UI always reads scores for the ACTIVE scoring version
 *    - Historical comparison: can compare v1.0.0 vs v1.1.0 for same date range
 */

export interface DataQualityCheck {
  check_id: string;
  name: string;
  description: string;
  /** How to run this check */
  type: 'staleness' | 'completeness' | 'outlier' | 'consistency';
  /** SQL or logic pseudocode */
  check_logic: string;
}

export const DATA_QUALITY_CHECKS: DataQualityCheck[] = [
  {
    check_id: 'stale_cot',
    name: 'COT Data Staleness',
    description: 'Alert if COT data is older than 10 days (weekly + buffer)',
    type: 'staleness',
    check_logic: `
      SELECT asset_id, symbol, MAX(report_date) as latest
      FROM cot_positions cp
      JOIN assets a ON a.id = cp.asset_id
      WHERE a.has_cot = TRUE
      GROUP BY asset_id, symbol
      HAVING MAX(report_date) < NOW() - INTERVAL '10 days'
    `,
  },
  {
    check_id: 'stale_sentiment',
    name: 'Sentiment Data Staleness',
    description: 'Alert if sentiment data is older than 2 hours',
    type: 'staleness',
    check_logic: `
      SELECT asset_id, symbol, MAX(timestamp) as latest
      FROM retail_sentiment rs
      JOIN assets a ON a.id = rs.asset_id
      WHERE a.has_sentiment = TRUE
      GROUP BY asset_id, symbol
      HAVING MAX(timestamp) < NOW() - INTERVAL '2 hours'
    `,
  },
  {
    check_id: 'missing_macro',
    name: 'Missing Macro Coverage',
    description: 'Check that each economy has all expected indicators',
    type: 'completeness',
    check_logic: `
      -- For each economy, check that we have GDP, CPI, PMI at minimum
      -- within the last 90 days
      SELECT e.code, e.name,
        array_agg(DISTINCT mr.indicator_key) as available,
        ARRAY['gdp','cpi','pmi_manufacturing'] as required
      FROM economies e
      LEFT JOIN macro_releases mr ON mr.economy_id = e.id
        AND mr.release_date > NOW() - INTERVAL '90 days'
      GROUP BY e.code, e.name
    `,
  },
  {
    check_id: 'cot_outlier',
    name: 'COT Position Outlier',
    description: 'Flag unusually large weekly changes in COT positions',
    type: 'outlier',
    check_logic: `
      WITH avg_changes AS (
        SELECT asset_id, AVG(ABS(delta_nc_net)) as avg_delta,
               STDDEV(ABS(delta_nc_net)) as std_delta
        FROM cot_positions
        WHERE report_date > NOW() - INTERVAL '1 year'
        GROUP BY asset_id
      )
      SELECT cp.asset_id, a.symbol, cp.report_date, cp.delta_nc_net,
             ac.avg_delta, ac.std_delta
      FROM cot_positions cp
      JOIN avg_changes ac ON ac.asset_id = cp.asset_id
      JOIN assets a ON a.id = cp.asset_id
      WHERE ABS(cp.delta_nc_net) > ac.avg_delta + 3 * ac.std_delta
        AND cp.report_date = (SELECT MAX(report_date) FROM cot_positions)
    `,
  },
  {
    check_id: 'score_coverage',
    name: 'Score Signal Coverage',
    description: 'Verify that computed scores have adequate signal coverage',
    type: 'consistency',
    check_logic: `
      SELECT symbol, computed_at, total_score,
             jsonb_array_length(signal_details) as signal_count,
             array_length(missing_data, 1) as missing_count
      FROM asset_scores ascore
      JOIN assets a ON a.id = ascore.asset_id
      WHERE ascore.computed_at = (
        SELECT MAX(computed_at) FROM asset_scores
        WHERE scoring_version_id = ascore.scoring_version_id
      )
      AND jsonb_array_length(ascore.signal_details) < 5
    `,
  },
];


// ═══════════════════════════════════════════════════════════════════════════════
// MVP PHASE PLAN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PHASE 1 — MVP (4-6 weeks)
 * ─────────────────────────────────────────────────────
 * Assets:    15 (7 FX majors, Gold, Silver, Oil, SPX, NAS, DOW, BTC, US10Y)
 * Data:
 *   - COT: CFTC via existing Supabase Edge Function (LIVE, already working)
 *   - Macro: Mock provider → swap to FRED/TradingEconomics
 *   - Sentiment: Mock provider → swap to Oanda/IG
 *   - Price: Mock provider → swap to TwelveData/Polygon
 *   - Rates: Mock provider → swap to FRED
 *   - Seasonality: Computed from price history
 * Scoring:   v1.0.0 with default weights
 * Screens:   Asset Scorecard, Top Setups heatmap, COT page (live)
 * Infra:     Single VPS (4GB RAM), Postgres, Redis, BullMQ
 * Auth:      Supabase Auth
 * Deploy:    Docker Compose
 *
 * Deliverables:
 *   [x] Database schema (this file)
 *   [x] Scoring engine (scoringEngine.ts)
 *   [x] Provider interfaces + mocks (providers.ts)
 *   [x] API contracts (api.ts)
 *   [ ] Node.js backend service
 *   [ ] BullMQ job scheduler
 *   [ ] FRED provider (US macro data)
 *   [ ] Score recomputation pipeline
 *   [ ] Snapshot writer (Redis)
 *   [ ] Frontend integration (replace mock data)
 *
 * PHASE 2 — Full Product (6-10 weeks after Phase 1)
 * ─────────────────────────────────────────────────────
 * Assets:    30+ (add FX crosses, UK100, DAX, NIKKEI, COPPER, more crypto)
 * Data:
 *   - Live price feed (WebSocket)
 *   - Multiple sentiment sources (Oanda + IG + Myfxbook)
 *   - Full macro coverage: FRED + ECB + ONS + Stats Canada
 *   - Carry trade data from broker swap rates
 * Scoring:   v1.1.0 with tuned weights (backtested)
 * Screens:   All 10+ screens fully data-driven
 * Features:
 *   - Alerts: email/push when score changes significantly
 *   - Notifications: upcoming high-impact events
 *   - Explainability: "Why is EURUSD bullish?" with citation chain
 *   - Backtesting: "How did this score perform historically?"
 *   - Custom weights: users can adjust category weights
 * Infra:     2x VPS, load balancer, dedicated Redis, DB replicas
 * Observability: Grafana + Prometheus + structured logging
 * Deploy:    Docker Swarm or K8s-lite (Nomad)
 */

export const MVP_PHASE_1 = {
  target_weeks: 6,
  asset_count: 15,
  scoring_version: 'v1.0.0',
  live_data_sources: ['cot_cftc'],
  mock_data_sources: ['macro', 'sentiment', 'price', 'rates'],
  key_milestones: [
    { week: 1, deliverable: 'DB schema + migrations + seed data' },
    { week: 2, deliverable: 'Backend service skeleton + BullMQ + health checks' },
    { week: 3, deliverable: 'COT pipeline (already working) + FRED provider (US macro)' },
    { week: 4, deliverable: 'Scoring engine integration + snapshot writer' },
    { week: 5, deliverable: 'API endpoints + frontend integration for Scorecard & Top Setups' },
    { week: 6, deliverable: 'Testing, data quality checks, monitoring, deploy' },
  ],
} as const;

export const MVP_PHASE_2 = {
  target_weeks: 10,
  asset_count: 30,
  scoring_version: 'v1.1.0',
  new_features: [
    'Live price WebSocket feed',
    'Multiple sentiment providers',
    'Full macro coverage (8 economies)',
    'Score alerts (email + push)',
    'High-impact event notifications',
    'Score explainability ("Why?") panel',
    'Custom user weight profiles',
    'Score backtesting tool',
    'Carry trade scanner (live swap rates)',
    'Technical heatmap (live)',
  ],
} as const;
