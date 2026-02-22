// ═══════════════════════════════════════════════════════════════════════════════
// TradePilot — Signal Contract & Scoring Type System
// ═══════════════════════════════════════════════════════════════════════════════
//
// This file defines the complete type system for the scoring pipeline:
//
//   Raw Data → Normalized Signal → Category Score → Total Score → Bias Label
//
// Every data source (price, COT, sentiment, macro) produces Signals.
// Signals are aggregated by category, then by total.
// The pipeline is deterministic and version-aware.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  Direction,
  BiasLabel,
  SignalCategory,
  CategoryWeights,
} from './database';


// ═══════════════════════════════════════════════════════════════════════════════
// METRIC KEY REGISTRY — Canonical list of all scoreable metrics
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete list of metric keys used across the scoring engine.
 * Each key maps to exactly one SignalCategory.
 * UI "Item Readings" map 1:1 to these keys.
 */
export const METRIC_KEYS = {
  // ── Technical ──
  TREND_4H:           'trend_4h',
  TREND_DAILY:        'trend_daily',
  SMA_ALIGNMENT:      'sma_alignment',        // price vs SMA 20/50/100/200
  RSI_14:             'rsi_14',
  VOLATILITY:         'volatility',

  // ── Sentiment ──
  RETAIL_SENTIMENT:   'retail_sentiment',       // crowd long/short %
  RETAIL_CONTRARIAN:  'retail_contrarian',      // contrarian signal (>70% one side)

  // ── COT ──
  COT_NC_NET:         'cot_nc_net',            // Non-Commercial net position
  COT_NC_CHANGE:      'cot_nc_change',         // Weekly change in NC net
  COT_PERCENTILE:     'cot_percentile',        // Percentile rank of current NC net

  // ── ECO Growth ──
  GDP:                'gdp',
  PMI_MANUFACTURING:  'pmi_manufacturing',     // mPMI
  PMI_SERVICES:       'pmi_services',          // sPMI
  RETAIL_SALES:       'retail_sales',
  CONSUMER_CONFIDENCE:'consumer_confidence',

  // ── Inflation ──
  CPI:                'cpi',
  PPI:                'ppi',
  PCE:                'pce',

  // ── Jobs ──
  NFP:                'nfp',
  UNEMPLOYMENT_RATE:  'unemployment_rate',
  INITIAL_CLAIMS:     'initial_claims',
  ADP:                'adp',
  JOLTS:              'jolts',

  // ── Rates ──
  INTEREST_RATE:      'interest_rate',
  YIELD_10Y:          'yield_10y',
  YIELD_CURVE:        'yield_curve',            // 2-10 spread

  // ── Seasonality ──
  SEASONALITY:        'seasonality',
} as const;

export type MetricKey = typeof METRIC_KEYS[keyof typeof METRIC_KEYS];

/** Map each metric key to its category */
export const METRIC_CATEGORY_MAP: Record<MetricKey, SignalCategory> = {
  // Technical
  [METRIC_KEYS.TREND_4H]:           'technical',
  [METRIC_KEYS.TREND_DAILY]:        'technical',
  [METRIC_KEYS.SMA_ALIGNMENT]:      'technical',
  [METRIC_KEYS.RSI_14]:             'technical',
  [METRIC_KEYS.VOLATILITY]:         'technical',
  // Sentiment
  [METRIC_KEYS.RETAIL_SENTIMENT]:   'sentiment',
  [METRIC_KEYS.RETAIL_CONTRARIAN]:  'sentiment',
  // COT
  [METRIC_KEYS.COT_NC_NET]:         'cot',
  [METRIC_KEYS.COT_NC_CHANGE]:      'cot',
  [METRIC_KEYS.COT_PERCENTILE]:     'cot',
  // ECO Growth
  [METRIC_KEYS.GDP]:                'eco_growth',
  [METRIC_KEYS.PMI_MANUFACTURING]:  'eco_growth',
  [METRIC_KEYS.PMI_SERVICES]:       'eco_growth',
  [METRIC_KEYS.RETAIL_SALES]:       'eco_growth',
  [METRIC_KEYS.CONSUMER_CONFIDENCE]:'confidence',
  // Inflation
  [METRIC_KEYS.CPI]:                'inflation',
  [METRIC_KEYS.PPI]:                'inflation',
  [METRIC_KEYS.PCE]:                'inflation',
  // Jobs
  [METRIC_KEYS.NFP]:                'jobs',
  [METRIC_KEYS.UNEMPLOYMENT_RATE]:  'jobs',
  [METRIC_KEYS.INITIAL_CLAIMS]:     'jobs',
  [METRIC_KEYS.ADP]:                'jobs',
  [METRIC_KEYS.JOLTS]:              'jobs',
  // Rates
  [METRIC_KEYS.INTEREST_RATE]:      'rates',
  [METRIC_KEYS.YIELD_10Y]:          'rates',
  [METRIC_KEYS.YIELD_CURVE]:        'rates',
  // Seasonality (treated as part of technical or standalone)
  [METRIC_KEYS.SEASONALITY]:        'technical',
};


// ═══════════════════════════════════════════════════════════════════════════════
// SIGNAL CONTRACT — The universal data transfer object
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A Signal is the normalized output of ANY data source.
 * Every scorer function produces one or more Signals.
 * Signals flow into aggregation → category scores → total score.
 */
export interface SignalInput {
  /** Which metric produced this signal */
  metric_key: MetricKey;

  /** Which category does this belong to */
  category: SignalCategory;

  /** The raw data value (e.g., 2.3 for GDP%, 65 for long%, 0.85 for percentile) */
  raw_value: number | null;

  /** Qualitative direction */
  direction: Direction;

  /** Numeric score: -2 (very bearish) to +2 (very bullish) */
  score: -2 | -1 | 0 | 1 | 2;

  /** Confidence multiplier 0..1 (1.0 = full confidence, <1.0 for stale/uncertain data) */
  confidence: number;

  /** Human-readable explanation for UI tooltip */
  explanation: string;

  /** When the underlying data was measured/released */
  source_timestamp: string | null;

  /** For macro signals: the actual/forecast/previous data */
  macro_context?: {
    actual: number | null;
    forecast: number | null;
    previous: number | null;
    surprise: number | null;
    unit: string;
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// ECONOMY SIGNAL — Intermediate type for FX pair scoring
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Before computing a pair-relative score, we first score each economy independently.
 * An EconomySignal is a Signal that applies to a specific economy, not a tradeable asset.
 */
export interface EconomySignal extends SignalInput {
  /** Economy code this signal belongs to */
  economy_code: string;
}

/**
 * Pair-relative scoring result.
 * For EURUSD with GDP: if EUR GDP score = +1 and USD GDP score = -1, then net = +2.
 */
export interface PairRelativeSignal extends SignalInput {
  base_economy: string;
  quote_economy: string;
  base_score: number;
  quote_score: number;
  /** Net = base_score - quote_score, clamped to [-2, +2] */
}


// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY SCORE — Aggregated result per scoring category
// ═══════════════════════════════════════════════════════════════════════════════

export interface CategoryScore {
  category: SignalCategory;
  /** Weighted average of constituent signal scores */
  score: number;
  /** Derived from score */
  direction: Direction;
  /** Number of signals that contributed */
  signal_count: number;
  /** Number of signals that had data vs expected */
  coverage: number;    // 0..1
  /** Individual signals in this category */
  signals: SignalInput[];
}


// ═══════════════════════════════════════════════════════════════════════════════
// ASSET SCORECARD — The final composite output
// ═══════════════════════════════════════════════════════════════════════════════

export interface AssetScorecard {
  /** Asset symbol */
  symbol: string;
  /** Asset display name */
  name: string;
  /** Scoring version used */
  scoring_version: string;
  /** When this scorecard was computed */
  computed_at: string;

  /** Total weighted score (-10..+10) */
  total_score: number;
  /** Derived bias label */
  bias_label: BiasLabel;

  /** Per-category breakdown */
  categories: Record<SignalCategory, CategoryScore>;

  /** Flat list of all signals for UI "Item Readings" */
  readings: SignalInput[];

  /** Which data sources are missing */
  missing_data: string[];
  /** Freshness timestamps per data source */
  data_freshness: Record<string, string>;
}


// ═══════════════════════════════════════════════════════════════════════════════
// TOP SETUPS HEATMAP — Row/column model matching UI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The heatmap columns match 1:1 with the EdgeFinder-style grid.
 * Each cell is a score from -2 to +2.
 */
export const TOP_SETUPS_COLUMNS = [
  'Trend',
  'Seasonality',
  'COT',
  'Crowd',               // Retail sentiment (contrarian)
  'GDP',
  'mPMI',                // Manufacturing PMI
  'sPMI',                // Services PMI
  'Retail Sales',
  'Consumer Confidence',
  'CPI',
  'PPI',
  'PCE',
  'Interest Rates',
  'NFP',
  'Unemployment Rate',
  'Claims',
  'ADP',
  'JOLTS',
] as const;

export type TopSetupsColumnKey = typeof TOP_SETUPS_COLUMNS[number];

/** Maps heatmap column names to metric keys */
export const COLUMN_TO_METRIC: Record<TopSetupsColumnKey, MetricKey> = {
  'Trend':                METRIC_KEYS.TREND_DAILY,
  'Seasonality':          METRIC_KEYS.SEASONALITY,
  'COT':                  METRIC_KEYS.COT_NC_NET,
  'Crowd':                METRIC_KEYS.RETAIL_CONTRARIAN,
  'GDP':                  METRIC_KEYS.GDP,
  'mPMI':                 METRIC_KEYS.PMI_MANUFACTURING,
  'sPMI':                 METRIC_KEYS.PMI_SERVICES,
  'Retail Sales':         METRIC_KEYS.RETAIL_SALES,
  'Consumer Confidence':  METRIC_KEYS.CONSUMER_CONFIDENCE,
  'CPI':                  METRIC_KEYS.CPI,
  'PPI':                  METRIC_KEYS.PPI,
  'PCE':                  METRIC_KEYS.PCE,
  'Interest Rates':       METRIC_KEYS.INTEREST_RATE,
  'NFP':                  METRIC_KEYS.NFP,
  'Unemployment Rate':    METRIC_KEYS.UNEMPLOYMENT_RATE,
  'Claims':               METRIC_KEYS.INITIAL_CLAIMS,
  'ADP':                  METRIC_KEYS.ADP,
  'JOLTS':                METRIC_KEYS.JOLTS,
};

export interface TopSetupsEntry {
  symbol: string;
  name: string;
  asset_class: string;
  total_score: number;
  bias_label: BiasLabel;
  /** Column name → score (-2..+2), null if data unavailable */
  column_scores: Partial<Record<TopSetupsColumnKey, number | null>>;
}


// ═══════════════════════════════════════════════════════════════════════════════
// SCORING CONFIGURATION — Version-aware rules
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Default category weights for v1.0.0.
 * The total_score is: sum(category_score * weight) across all categories.
 * Max possible: 2 * sum(weights) = 2 * (sum) per category.
 * We normalize to -10..+10 range.
 */
export const DEFAULT_CATEGORY_WEIGHTS: CategoryWeights = {
  technical:  0.15,
  sentiment:  0.10,
  cot:        0.15,
  eco_growth: 0.15,
  inflation:  0.12,
  jobs:       0.13,
  rates:      0.10,
  confidence: 0.10,
};

/** Score → direction mapping */
export function scoreToDirection(score: number): Direction {
  if (score > 0.3) return 'bullish';
  if (score < -0.3) return 'neutral';   // conservative: only "bearish" at < -0.3
  return 'neutral';
}

/** Total score → bias label */
export function scoreToBiasLabel(totalScore: number): BiasLabel {
  if (totalScore >= 5)  return 'very_bullish';
  if (totalScore >= 2)  return 'bullish';
  if (totalScore <= -5) return 'very_bearish';
  if (totalScore <= -2) return 'bearish';
  return 'neutral';
}

/** Clamp a raw calculated score to valid range */
export function clampScore(score: number): -2 | -1 | 0 | 1 | 2 {
  const clamped = Math.max(-2, Math.min(2, Math.round(score)));
  return clamped as -2 | -1 | 0 | 1 | 2;
}


// ═══════════════════════════════════════════════════════════════════════════════
// MACRO SCORING RULES — How surprise values map to scores
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generic macro surprise → score mapping.
 *
 * Logic:
 *   - "beat" = actual > forecast → generally bullish for that economy's currency
 *   - "miss" = actual < forecast → generally bearish
 *   - Score magnitude depends on surprise size relative to historical range
 *
 * Exception handling:
 *   - `invert_direction`: for metrics where higher = bearish (unemployment, claims)
 *   - `invert_for_assets`: Gold often reacts inversely to USD-positive data
 */
export interface MacroScoringConfig {
  indicator_key: string;
  display_name: string;
  category: SignalCategory;
  /** If true, higher actual = bearish (e.g., unemployment rate, claims) */
  invert_direction: boolean;
  /** Standard deviation of historical surprises (for normalization) */
  typical_surprise_std: number;
  /** Unit for display */
  unit: string;
  /** Assets where this metric's normal scoring is inverted */
  special_rules: AssetScoringException[];
}

export interface AssetScoringException {
  /** Asset symbol or pattern (e.g., 'XAUUSD', 'index:*') */
  asset_pattern: string;
  /** How to modify the score for this asset */
  modifier: 'invert' | 'ignore' | 'double' | 'halve';
  /** Why this exception exists */
  reason: string;
}

/**
 * Master list of macro indicators with scoring rules.
 * These define how every macro release gets scored for every economy.
 */
export const MACRO_SCORING_CONFIGS: MacroScoringConfig[] = [
  // ── Growth ──
  {
    indicator_key: 'gdp',
    display_name: 'GDP',
    category: 'eco_growth',
    invert_direction: false,
    typical_surprise_std: 0.3,
    unit: '%',
    special_rules: [
      { asset_pattern: 'XAUUSD', modifier: 'invert', reason: 'Gold is inversely correlated to strong economic data — GDP beat strengthens USD, weakening Gold' },
    ],
  },
  {
    indicator_key: 'pmi_manufacturing',
    display_name: 'Manufacturing PMI',
    category: 'eco_growth',
    invert_direction: false,
    typical_surprise_std: 1.5,
    unit: 'index',
    special_rules: [],
  },
  {
    indicator_key: 'pmi_services',
    display_name: 'Services PMI',
    category: 'eco_growth',
    invert_direction: false,
    typical_surprise_std: 1.2,
    unit: 'index',
    special_rules: [],
  },
  {
    indicator_key: 'retail_sales',
    display_name: 'Retail Sales',
    category: 'eco_growth',
    invert_direction: false,
    typical_surprise_std: 0.4,
    unit: '%',
    special_rules: [],
  },
  {
    indicator_key: 'consumer_confidence',
    display_name: 'Consumer Confidence',
    category: 'confidence',
    invert_direction: false,
    typical_surprise_std: 3.0,
    unit: 'index',
    special_rules: [],
  },

  // ── Inflation ──
  {
    indicator_key: 'cpi',
    display_name: 'CPI',
    category: 'inflation',
    invert_direction: false,       // Higher CPI = hawkish = bullish for currency
    typical_surprise_std: 0.2,
    unit: '%',
    special_rules: [
      { asset_pattern: 'XAUUSD', modifier: 'invert', reason: 'Higher inflation weakens real yields, but hawkish response strengthens USD vs Gold — net effect depends on context, default: invert' },
    ],
  },
  {
    indicator_key: 'ppi',
    display_name: 'PPI',
    category: 'inflation',
    invert_direction: false,
    typical_surprise_std: 0.3,
    unit: '%',
    special_rules: [],
  },
  {
    indicator_key: 'pce',
    display_name: 'PCE',
    category: 'inflation',
    invert_direction: false,
    typical_surprise_std: 0.1,
    unit: '%',
    special_rules: [],
  },

  // ── Jobs ──
  {
    indicator_key: 'nfp',
    display_name: 'Non-Farm Payrolls',
    category: 'jobs',
    invert_direction: false,       // Higher NFP = bullish
    typical_surprise_std: 50,      // in thousands
    unit: 'K',
    special_rules: [
      { asset_pattern: 'XAUUSD', modifier: 'invert', reason: 'Strong jobs → hawkish Fed → stronger USD → bearish Gold' },
    ],
  },
  {
    indicator_key: 'unemployment_rate',
    display_name: 'Unemployment Rate',
    category: 'jobs',
    invert_direction: true,        // Higher unemployment = BEARISH
    typical_surprise_std: 0.2,
    unit: '%',
    special_rules: [],
  },
  {
    indicator_key: 'initial_claims',
    display_name: 'Initial Claims',
    category: 'jobs',
    invert_direction: true,        // Higher claims = BEARISH
    typical_surprise_std: 15,
    unit: 'K',
    special_rules: [],
  },
  {
    indicator_key: 'adp',
    display_name: 'ADP Employment',
    category: 'jobs',
    invert_direction: false,
    typical_surprise_std: 40,
    unit: 'K',
    special_rules: [],
  },
  {
    indicator_key: 'jolts',
    display_name: 'JOLTS Job Openings',
    category: 'jobs',
    invert_direction: false,
    typical_surprise_std: 200,
    unit: 'K',
    special_rules: [],
  },

  // ── Rates ──
  {
    indicator_key: 'interest_rate',
    display_name: 'Interest Rate Decision',
    category: 'rates',
    invert_direction: false,
    typical_surprise_std: 0.25,
    unit: '%',
    special_rules: [
      { asset_pattern: 'XAUUSD', modifier: 'invert', reason: 'Higher rates → stronger USD → bearish Gold' },
      { asset_pattern: 'index:*', modifier: 'invert', reason: 'Rate hikes generally bearish for equities' },
    ],
  },
];


// ═══════════════════════════════════════════════════════════════════════════════
// COT SCORING RULES
// ═══════════════════════════════════════════════════════════════════════════════

export interface COTScoringParams {
  /** Percentile thresholds for scoring */
  extreme_long_pct: number;     // >= this → score +2 or -2 (crowded)
  crowded_long_pct: number;     // >= this → score +1 or -1
  crowded_short_pct: number;    // <= this → score -1 or +1
  extreme_short_pct: number;    // <= this → score -2 or +2
  /** Weekly change threshold for bonus signal */
  significant_change_pct: number;  // e.g., 10% change in net = significant
}

export const DEFAULT_COT_SCORING: COTScoringParams = {
  extreme_long_pct: 85,
  crowded_long_pct: 70,
  crowded_short_pct: 30,
  extreme_short_pct: 15,
  significant_change_pct: 10,
};


// ═══════════════════════════════════════════════════════════════════════════════
// RETAIL SENTIMENT SCORING RULES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SentimentScoringParams {
  /** Contrarian signal: if retail is >X% long, that's bearish for the asset */
  extreme_long_pct: number;     // e.g., 75% → contrarian bearish
  moderate_long_pct: number;    // e.g., 65% → slight contrarian bearish
  neutral_range: [number, number]; // e.g., [40, 60] → no signal
  moderate_short_pct: number;   // e.g., 35% → slight contrarian bullish
  extreme_short_pct: number;    // e.g., 25% → contrarian bullish
}

export const DEFAULT_SENTIMENT_SCORING: SentimentScoringParams = {
  extreme_long_pct: 75,
  moderate_long_pct: 65,
  neutral_range: [40, 60],
  moderate_short_pct: 35,
  extreme_short_pct: 25,
};


// ═══════════════════════════════════════════════════════════════════════════════
// TECHNICAL SCORING RULES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TechnicalScoringParams {
  /** Trend scoring based on price vs SMAs */
  sma_alignment: {
    all_above: 2;     // Price above all SMAs → strong bullish
    above_50: 1;      // Price above SMA50 → mild bullish
    below_50: -1;     // Price below SMA50 → mild bearish
    all_below: -2;    // Price below all SMAs → strong bearish
  };
  /** RSI thresholds */
  rsi: {
    overbought: number;    // e.g., 70
    oversold: number;      // e.g., 30
  };
}

export const DEFAULT_TECHNICAL_SCORING: TechnicalScoringParams = {
  sma_alignment: {
    all_above: 2,
    above_50: 1,
    below_50: -1,
    all_below: -2,
  },
  rsi: {
    overbought: 70,
    oversold: 30,
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// SEASONALITY SCORING RULES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SeasonalityScoringParams {
  /** Average return thresholds for current month (10Y) */
  strong_positive_pct: number;   // e.g., 1.0% avg return → +2
  mild_positive_pct: number;     // e.g., 0.3% → +1
  mild_negative_pct: number;     // e.g., -0.3% → -1
  strong_negative_pct: number;   // e.g., -1.0% → -2
  /** Win rate must be >= this to have confidence */
  min_win_rate: number;          // e.g., 40% (below this → confidence reduced)
}

export const DEFAULT_SEASONALITY_SCORING: SeasonalityScoringParams = {
  strong_positive_pct: 1.0,
  mild_positive_pct: 0.3,
  mild_negative_pct: -0.3,
  strong_negative_pct: -1.0,
  min_win_rate: 40,
};
