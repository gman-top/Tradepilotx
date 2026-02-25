// ═══════════════════════════════════════════════════════════════════════════════
// TradePilot — Scoring Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// This is the CORE scoring engine. It is:
//   - Pure functions: no side effects, no DB access, no network calls
//   - Deterministic: same inputs → same outputs, always
//   - Version-aware: scoring rules come from ScoringVersion config
//   - Isomorphic: can run server-side (Node.js) or client-side (browser)
//
// PIPELINE:
//   1. Collect raw data snapshots for an asset
//   2. Run individual metric scorers → produce SignalInput[]
//   3. Apply FX pair-relative adjustments (if applicable)
//   4. Apply asset-specific exceptions (Gold, indices, etc.)
//   5. Aggregate signals → CategoryScore[]
//   6. Aggregate categories → total_score + bias_label
//   7. Package as AssetScorecard
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  Direction,
  BiasLabel,
  SignalCategory,
  CategoryWeights,
  Asset,
  MacroRelease,
  COTPosition,
  RetailSentiment,
  TechnicalIndicator,
  SeasonalityStat,
  InterestRate,
  AssetEconomyLink,
} from '../types/database';

import type {
  SignalInput,
  EconomySignal,
  CategoryScore,
  AssetScorecard,
  MetricKey,
  MacroScoringConfig,
  COTScoringParams,
  SentimentScoringParams,
  TopSetupsEntry,
  TopSetupsColumnKey,
} from '../types/scoring';

import {
  METRIC_KEYS,
  METRIC_CATEGORY_MAP,
  MACRO_SCORING_CONFIGS,
  DEFAULT_COT_SCORING,
  DEFAULT_SENTIMENT_SCORING,
  DEFAULT_SEASONALITY_SCORING,
  DEFAULT_CATEGORY_WEIGHTS,
  COLUMN_TO_METRIC,
  TOP_SETUPS_COLUMNS,
  clampScore,
  scoreToDirection,
  scoreToBiasLabel,
} from '../types/scoring';


// ═══════════════════════════════════════════════════════════════════════════════
// INPUT DATA SNAPSHOT — All data needed to score one asset
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Everything the scoring engine needs to compute a full scorecard for one asset.
 * The caller (pipeline/service) is responsible for fetching and assembling this.
 */
export interface AssetDataSnapshot {
  asset: Asset;
  economy_links: AssetEconomyLink[];

  // Technical data (latest)
  technical: TechnicalIndicator | null;

  // COT data
  cot_latest: COTPosition | null;
  cot_history: COTPosition[];        // For percentile calculation (up to 156 weeks)

  // Retail sentiment (latest)
  sentiment: RetailSentiment | null;

  // Macro releases per economy (most recent per indicator)
  // Key: `${economy_code}:${indicator_key}` e.g., "US:gdp", "EU:cpi"
  macro_releases: Record<string, MacroRelease>;

  // Interest rates per economy
  interest_rates: Record<string, InterestRate>;  // economy_code → latest rate

  // Seasonality for current month
  seasonality: SeasonalityStat | null;

  // Data freshness
  data_timestamps: Record<string, string>;  // source → latest timestamp
}


// ═══════════════════════════════════════════════════════════════════════════════
// INDIVIDUAL METRIC SCORERS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── TECHNICAL SCORERS ──────────────────────────────────────────────────────

function scoreTrend(tech: TechnicalIndicator | null, timeframe: '4h' | 'daily'): SignalInput | null {
  if (!tech) return null;
  const trend = timeframe === '4h' ? tech.trend_4h : tech.trend_daily;
  if (!trend) return null;

  const metricKey = timeframe === '4h' ? METRIC_KEYS.TREND_4H : METRIC_KEYS.TREND_DAILY;
  const scoreMap: Record<string, number> = {
    'strong_up': 2, 'up': 1, 'neutral': 0, 'down': -1, 'strong_down': -2,
  };
  const score = clampScore(scoreMap[trend] ?? 0);

  return {
    metric_key: metricKey,
    category: 'technical',
    raw_value: null,
    direction: scoreToDirection(score),
    score,
    confidence: 1.0,
    explanation: `${timeframe === '4h' ? '4H' : 'Daily'} trend: ${trend.replace('_', ' ')}`,
    source_timestamp: tech.timestamp,
  };
}

function scoreRSI(tech: TechnicalIndicator | null): SignalInput | null {
  if (!tech || tech.rsi_14 === null) return null;

  const rsi = tech.rsi_14;

  // Momentum confirmation (trend-following interpretation):
  // High RSI confirms uptrend; low RSI confirms downtrend.
  let score: -2 | -1 | 0 | 1 | 2 = 0;
  if (rsi >= 70)      score =  2;  // Strong bullish momentum / overbought extension
  else if (rsi >= 55) score =  1;  // Mild bullish momentum
  else if (rsi <= 30) score = -2;  // Strong bearish momentum / oversold extension
  else if (rsi <= 45) score = -1;  // Mild bearish momentum

  const label = rsi >= 70 ? 'strong momentum' : rsi <= 30 ? 'weak momentum' : rsi >= 55 ? 'bullish' : rsi <= 45 ? 'bearish' : 'neutral';

  return {
    metric_key: METRIC_KEYS.RSI_14,
    category: 'technical',
    raw_value: rsi,
    direction: scoreToDirection(score),
    score,
    confidence: 1.0,
    explanation: `RSI(14): ${rsi.toFixed(1)} — ${label}`,
    source_timestamp: tech.timestamp,
  };
}

function scoreSMAAlignment(tech: TechnicalIndicator | null): SignalInput | null {
  if (!tech) return null;

  const smas = [tech.sma_20, tech.sma_50, tech.sma_100, tech.sma_200].filter(v => v !== null) as number[];
  if (smas.length === 0) return null;

  // We need current close to compare (approximation: use price_vs_sma200)
  // In practice, the close price comes from the latest PriceOHLC
  const pctAbove = tech.price_vs_sma200;
  let score: -2 | -1 | 0 | 1 | 2 = 0;

  if (pctAbove !== null) {
    if (pctAbove > 5) score = 2;       // Well above SMA200
    else if (pctAbove > 0) score = 1;  // Above SMA200
    else if (pctAbove > -5) score = -1; // Below SMA200
    else score = -2;                    // Well below SMA200
  }

  return {
    metric_key: METRIC_KEYS.SMA_ALIGNMENT,
    category: 'technical',
    raw_value: pctAbove,
    direction: scoreToDirection(score),
    score,
    confidence: smas.length >= 3 ? 1.0 : 0.7,
    explanation: `Price is ${pctAbove !== null ? `${pctAbove > 0 ? '+' : ''}${pctAbove.toFixed(1)}%` : 'N/A'} from SMA200`,
    source_timestamp: tech.timestamp,
  };
}


// ─── COT SCORERS ────────────────────────────────────────────────────────────

function scoreCOT(
  latest: COTPosition | null,
  history: COTPosition[],
  params: COTScoringParams = DEFAULT_COT_SCORING
): SignalInput[] {
  const signals: SignalInput[] = [];

  if (!latest) return signals;

  // 1. Net position direction
  const netScore = clampScore(latest.nc_net > 0 ? 1 : latest.nc_net < 0 ? -1 : 0);
  signals.push({
    metric_key: METRIC_KEYS.COT_NC_NET,
    category: 'cot',
    raw_value: latest.nc_net,
    direction: scoreToDirection(netScore),
    score: netScore,
    confidence: 1.0,
    explanation: `Non-Commercial net: ${latest.nc_net > 0 ? '+' : ''}${latest.nc_net.toLocaleString()} contracts`,
    source_timestamp: latest.report_date,
  });

  // 2. Weekly change
  if (latest.delta_nc_net !== 0) {
    const changePct = latest.nc_net !== 0
      ? (latest.delta_nc_net / Math.abs(latest.nc_net)) * 100
      : 0;
    let changeScore: -2 | -1 | 0 | 1 | 2 = 0;
    if (changePct > params.significant_change_pct) changeScore = 1;
    else if (changePct < -params.significant_change_pct) changeScore = -1;

    signals.push({
      metric_key: METRIC_KEYS.COT_NC_CHANGE,
      category: 'cot',
      raw_value: changePct,
      direction: scoreToDirection(changeScore),
      score: changeScore,
      confidence: 0.8,
      explanation: `Weekly net change: ${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%`,
      source_timestamp: latest.report_date,
    });
  }

  // 3. Percentile ranking
  if (history.length >= 10) {
    const netValues = history.map(h => h.nc_net);
    const currentNet = latest.nc_net;
    const belowCount = netValues.filter(v => v < currentNet).length;
    const percentile = (belowCount / (netValues.length - 1)) * 100;

    let pctlScore: -2 | -1 | 0 | 1 | 2 = 0;
    if (percentile >= params.extreme_long_pct) pctlScore = 2;
    else if (percentile >= params.crowded_long_pct) pctlScore = 1;
    else if (percentile <= params.extreme_short_pct) pctlScore = -2;
    else if (percentile <= params.crowded_short_pct) pctlScore = -1;

    signals.push({
      metric_key: METRIC_KEYS.COT_PERCENTILE,
      category: 'cot',
      raw_value: percentile,
      direction: scoreToDirection(pctlScore),
      score: pctlScore,
      confidence: history.length >= 52 ? 1.0 : 0.7,
      explanation: `NC net percentile: ${percentile.toFixed(0)}% (${history.length}-week window)`,
      source_timestamp: latest.report_date,
    });
  }

  return signals;
}


// ─── RETAIL SENTIMENT SCORERS ───────────────────────────────────────────────

function scoreSentiment(
  sentiment: RetailSentiment | null,
  params: SentimentScoringParams = DEFAULT_SENTIMENT_SCORING
): SignalInput[] {
  if (!sentiment) return [];

  const signals: SignalInput[] = [];
  const longPct = sentiment.long_pct;

  // Contrarian logic: majority retail position → fade it
  let contrarianScore: -2 | -1 | 0 | 1 | 2 = 0;
  let explanation = '';

  if (longPct >= params.extreme_long_pct) {
    contrarianScore = -2;
    explanation = `Retail is ${longPct.toFixed(0)}% long — extreme contrarian bearish`;
  } else if (longPct >= params.moderate_long_pct) {
    contrarianScore = -1;
    explanation = `Retail is ${longPct.toFixed(0)}% long — contrarian bearish`;
  } else if (longPct <= params.extreme_short_pct) {
    contrarianScore = 2;
    explanation = `Retail is only ${longPct.toFixed(0)}% long — extreme contrarian bullish`;
  } else if (longPct <= params.moderate_short_pct) {
    contrarianScore = 1;
    explanation = `Retail is ${longPct.toFixed(0)}% long — contrarian bullish`;
  } else {
    contrarianScore = 0;
    explanation = `Retail sentiment neutral (${longPct.toFixed(0)}% long)`;
  }

  signals.push({
    metric_key: METRIC_KEYS.RETAIL_CONTRARIAN,
    category: 'sentiment',
    raw_value: longPct,
    direction: scoreToDirection(contrarianScore),
    score: contrarianScore,
    confidence: 1.0,
    explanation,
    source_timestamp: sentiment.timestamp,
  });

  // Raw sentiment direction (non-contrarian, for reference)
  const rawDirection: Direction = longPct > 55 ? 'bullish' : longPct < 45 ? 'bearish' : 'neutral';
  signals.push({
    metric_key: METRIC_KEYS.RETAIL_SENTIMENT,
    category: 'sentiment',
    raw_value: longPct,
    direction: rawDirection,
    score: 0,  // Raw sentiment doesn't contribute to score (contrarian does)
    confidence: 1.0,
    explanation: `Raw retail: ${longPct.toFixed(1)}% long / ${sentiment.short_pct.toFixed(1)}% short`,
    source_timestamp: sentiment.timestamp,
  });

  return signals;
}


// ─── MACRO SCORERS ──────────────────────────────────────────────────────────

/**
 * Score a single macro release for a single economy.
 * Returns an EconomySignal (not yet pair-relative).
 */
function scoreMacroRelease(
  release: MacroRelease,
  config: MacroScoringConfig,
  economyCode: string
): EconomySignal | null {
  if (release.actual === null || release.forecast === null) return null;

  const surprise = release.actual - release.forecast;
  const normalizedSurprise = config.typical_surprise_std > 0
    ? surprise / config.typical_surprise_std
    : 0;

  // Apply direction inversion if needed (e.g., unemployment)
  const effectiveSurprise = config.invert_direction ? -normalizedSurprise : normalizedSurprise;

  // Map normalized surprise to score
  let score: -2 | -1 | 0 | 1 | 2;
  if (effectiveSurprise >= 1.5) score = 2;
  else if (effectiveSurprise >= 0.5) score = 1;
  else if (effectiveSurprise <= -1.5) score = -2;
  else if (effectiveSurprise <= -0.5) score = -1;
  else score = 0;

  const beatMiss = surprise > 0 ? 'beat' : surprise < 0 ? 'miss' : 'inline';

  return {
    metric_key: config.indicator_key as MetricKey,
    category: config.category,
    raw_value: release.actual,
    direction: scoreToDirection(score),
    score,
    confidence: 1.0,
    explanation: `${economyCode} ${config.display_name}: ${release.actual}${config.unit} vs ${release.forecast}${config.unit} forecast (${beatMiss})`,
    source_timestamp: release.release_date,
    economy_code: economyCode,
    macro_context: {
      actual: release.actual,
      forecast: release.forecast,
      previous: release.previous,
      surprise,
      unit: config.unit,
    },
  };
}


// ─── SEASONALITY SCORER ─────────────────────────────────────────────────────

function scoreSeasonality(stat: SeasonalityStat | null): SignalInput | null {
  if (!stat || stat.avg_return_10y === null) return null;

  const params = DEFAULT_SEASONALITY_SCORING;
  const avgReturn = stat.avg_return_10y;
  const winRate = stat.win_rate_10y ?? 50;

  let score: -2 | -1 | 0 | 1 | 2 = 0;
  if (avgReturn >= params.strong_positive_pct) score = 2;
  else if (avgReturn >= params.mild_positive_pct) score = 1;
  else if (avgReturn <= params.strong_negative_pct) score = -2;
  else if (avgReturn <= params.mild_negative_pct) score = -1;

  // Reduce confidence if win rate is low
  const confidence = winRate >= params.min_win_rate ? 1.0 : 0.5;

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthName = monthNames[stat.month - 1] || `M${stat.month}`;

  return {
    metric_key: METRIC_KEYS.SEASONALITY,
    category: 'technical',
    raw_value: avgReturn,
    direction: scoreToDirection(score),
    score,
    confidence,
    explanation: `${monthName} 10Y avg: ${avgReturn > 0 ? '+' : ''}${avgReturn.toFixed(2)}%, win rate: ${winRate.toFixed(0)}%`,
    source_timestamp: stat.computed_at,
  };
}


// ─── INTEREST RATE SCORER ───────────────────────────────────────────────────

function scoreInterestRate(rate: InterestRate | null, economyCode: string): EconomySignal | null {
  if (!rate || rate.policy_rate === null) return null;

  const policyRate = rate.policy_rate;

  // Score based on absolute rate level (higher rate = more attractive via carry trade).
  // Pair-relative logic in scoreFXMacro handles the differential.
  // Thresholds calibrated to Feb 2026 rate environment:
  //   >= 4.0%  → +2  (extreme carry advantage: e.g. 4.5%+ range)
  //   >= 2.5%  → +1  (carry positive: US ~3.6%, UK ~3.75%, AU ~3.85%)
  //   >= 1.0%  →  0  (moderate/neutral: EU ~2.15%, NZ ~2.25%, CA ~2.25%)
  //   >= 0.25% → -1  (low: JP ~0.75%)
  //   <  0.25% → -2  (ZIRP/near-zero: CH ~0.00%)
  let rateScore: -2 | -1 | 0 | 1 | 2 = 0;
  if (policyRate >= 4.0)       rateScore =  2;
  else if (policyRate >= 2.5)  rateScore =  1;
  else if (policyRate >= 1.0)  rateScore =  0;
  else if (policyRate >= 0.25) rateScore = -1;
  else                         rateScore = -2;

  const label = rateScore === 2 ? 'very high'
    : rateScore === 1 ? 'high'
    : rateScore === 0 ? 'moderate'
    : rateScore === -1 ? 'low'
    : 'near-zero';

  return {
    metric_key: METRIC_KEYS.INTEREST_RATE,
    category: 'rates',
    raw_value: policyRate,
    direction: scoreToDirection(rateScore),
    score: rateScore,
    confidence: 1.0,
    explanation: `${economyCode} policy rate: ${policyRate.toFixed(2)}% (${label} carry)`,
    source_timestamp: rate.timestamp,
    economy_code: economyCode,
  };
}


// ─── YIELD CURVE SCORER ─────────────────────────────────────────────────────

function scoreYieldCurve(rate: InterestRate | null, economyCode: string): EconomySignal | null {
  if (!rate || rate.spread_2_10 === null) return null;

  const spread = rate.spread_2_10; // 10Y minus 2Y yield

  // Positive/steep curve → growth expectations → bullish
  // Inverted curve → recession signal → bearish
  let score: -2 | -1 | 0 | 1 | 2 = 0;
  if (spread >= 1.0)       score =  2;  // Steep normal: strong growth signal
  else if (spread >= 0.25) score =  1;  // Mild positive: growth leaning
  else if (spread <= -1.0) score = -2;  // Deeply inverted: strong recession risk
  else if (spread <= -0.25) score = -1; // Inverted: mild recession warning

  const label = score === 2 ? 'steep (growth)' : score === 1 ? 'positive' : score === 0 ? 'flat' : score === -1 ? 'inverted' : 'deeply inverted';

  return {
    metric_key: METRIC_KEYS.YIELD_CURVE,
    category: 'rates',
    raw_value: spread,
    direction: scoreToDirection(score),
    score,
    confidence: (rate.yield_10y !== null && rate.yield_2y !== null) ? 1.0 : 0.5,
    explanation: `${economyCode} yield curve (2-10): ${spread >= 0 ? '+' : ''}${spread.toFixed(2)}% — ${label}`,
    source_timestamp: rate.timestamp,
    economy_code: economyCode,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// FX PAIR-RELATIVE SCORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * For FX pairs: score_pair(metric) = score(base_economy) - score(quote_economy)
 *
 * Example: EURUSD GDP scoring
 *   EUR GDP beat → base_score = +1
 *   USD GDP beat → quote_score = +1
 *   Pair net score = +1 - (+1) = 0 (neutral, both economies equally strong)
 *
 *   EUR GDP miss → base_score = -1
 *   USD GDP beat → quote_score = +1
 *   Pair net score = -1 - (+1) = -2 (bearish EURUSD)
 */
export function computePairRelativeScore(
  baseSignal: EconomySignal | null,
  quoteSignal: EconomySignal | null,
  metricKey: MetricKey,
  category: SignalCategory,
): SignalInput {
  const baseScore = baseSignal?.score ?? 0;
  const quoteScore = quoteSignal?.score ?? 0;
  const netScore = clampScore(baseScore - quoteScore);

  const baseExpl = baseSignal?.explanation ?? 'no data';
  const quoteExpl = quoteSignal?.explanation ?? 'no data';

  // Confidence: lower if one side has no data
  const confidence = (baseSignal ? 0.5 : 0) + (quoteSignal ? 0.5 : 0);

  return {
    metric_key: metricKey,
    category,
    raw_value: netScore,
    direction: scoreToDirection(netScore),
    score: netScore,
    confidence,
    explanation: `Base: ${baseExpl} | Quote: ${quoteExpl} → Net: ${netScore > 0 ? '+' : ''}${netScore}`,
    source_timestamp: baseSignal?.source_timestamp ?? quoteSignal?.source_timestamp ?? null,
    macro_context: baseSignal?.macro_context,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// ASSET-SPECIFIC EXCEPTION HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Apply asset-specific scoring exceptions.
 * E.g., Gold: GDP beat is normally bullish for an economy, but bearish for Gold
 * because it strengthens USD.
 */
export function applyAssetExceptions(
  signal: SignalInput,
  asset: Asset,
  macroConfig?: MacroScoringConfig
): SignalInput {
  if (!macroConfig) return signal;

  const exceptions = macroConfig.special_rules;
  for (const exception of exceptions) {
    const matches = matchAssetPattern(exception.asset_pattern, asset);
    if (!matches) continue;

    switch (exception.modifier) {
      case 'invert':
        return {
          ...signal,
          score: clampScore(-signal.score),
          direction: scoreToDirection(-signal.score),
          explanation: `${signal.explanation} [INVERTED for ${asset.symbol}: ${exception.reason}]`,
        };
      case 'ignore':
        return {
          ...signal,
          score: 0,
          direction: 'neutral',
          confidence: 0,
          explanation: `${signal.explanation} [IGNORED for ${asset.symbol}: ${exception.reason}]`,
        };
      case 'double':
        return {
          ...signal,
          score: clampScore(signal.score * 2),
          explanation: `${signal.explanation} [DOUBLED for ${asset.symbol}]`,
        };
      case 'halve':
        return {
          ...signal,
          confidence: signal.confidence * 0.5,
          explanation: `${signal.explanation} [HALVED confidence for ${asset.symbol}]`,
        };
    }
  }

  return signal;
}

function matchAssetPattern(pattern: string, asset: Asset): boolean {
  if (pattern === asset.symbol) return true;
  if (pattern.startsWith('index:') && asset.asset_class === 'index') return true;
  if (pattern.startsWith('metal:') && asset.asset_class === 'metal') return true;
  if (pattern.startsWith('energy:') && asset.asset_class === 'energy') return true;
  if (pattern.startsWith('crypto:') && asset.asset_class === 'crypto') return true;
  if (pattern === '*') return true;
  return false;
}


// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Aggregate signals into category scores.
 * Weighted average of signal scores within each category.
 */
export function aggregateByCategory(signals: SignalInput[]): Record<SignalCategory, CategoryScore> {
  const categories: SignalCategory[] = [
    'technical', 'sentiment', 'cot', 'eco_growth', 'inflation', 'jobs', 'rates', 'confidence',
  ];

  const result: Record<string, CategoryScore> = {};

  for (const cat of categories) {
    const catSignals = signals.filter(s => s.category === cat);
    if (catSignals.length === 0) {
      result[cat] = {
        category: cat,
        score: 0,
        direction: 'neutral',
        signal_count: 0,
        coverage: 0,
        signals: [],
      };
      continue;
    }

    // Weighted average (using confidence as weight)
    const totalWeight = catSignals.reduce((sum, s) => sum + s.confidence, 0);
    const weightedScore = totalWeight > 0
      ? catSignals.reduce((sum, s) => sum + s.score * s.confidence, 0) / totalWeight
      : 0;

    result[cat] = {
      category: cat,
      score: Math.round(weightedScore * 100) / 100,
      direction: scoreToDirection(weightedScore),
      signal_count: catSignals.length,
      coverage: catSignals.filter(s => s.confidence > 0).length / catSignals.length,
      signals: catSignals,
    };
  }

  return result as Record<SignalCategory, CategoryScore>;
}


// ═══════════════════════════════════════════════════════════════════════════════
// TOTAL SCORE COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute the total weighted score from category scores.
 *
 * Formula:
 *   total = sum(category_score * category_weight) * normalization_factor
 *
 * Where normalization_factor scales to the -10..+10 range:
 *   max_raw = 2 * sum(weights) = 2 * 1.0 = 2.0
 *   normalization_factor = 10 / 2.0 = 5.0
 */
export function computeTotalScore(
  categoryScores: Record<SignalCategory, CategoryScore>,
  weights: CategoryWeights = DEFAULT_CATEGORY_WEIGHTS
): { total_score: number; bias_label: BiasLabel } {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const maxRaw = 2 * totalWeight;  // Max possible if all categories score +2
  const normFactor = maxRaw > 0 ? 10 / maxRaw : 1;

  let rawScore = 0;
  for (const [cat, weight] of Object.entries(weights)) {
    const catScore = categoryScores[cat as SignalCategory];
    if (catScore) {
      rawScore += catScore.score * weight;
    }
  }

  const totalScore = Math.round(rawScore * normFactor * 100) / 100;
  const clampedTotal = Math.max(-10, Math.min(10, totalScore));

  return {
    total_score: clampedTotal,
    bias_label: scoreToBiasLabel(clampedTotal),
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute the full scorecard for a single asset.
 * This is the main entry point for the scoring engine.
 */
export function computeAssetScorecard(
  snapshot: AssetDataSnapshot,
  weights: CategoryWeights = DEFAULT_CATEGORY_WEIGHTS,
  scoringVersion: string = 'v1.0.0'
): AssetScorecard {
  const { asset } = snapshot;
  const allSignals: SignalInput[] = [];
  const missingData: string[] = [];
  const freshness: Record<string, string> = {};

  // ─── 1. TECHNICAL SIGNALS ──────────────────────────────────────────────

  const trend4h = scoreTrend(snapshot.technical, '4h');
  if (trend4h) allSignals.push(trend4h);
  else missingData.push('trend_4h');

  const trendDaily = scoreTrend(snapshot.technical, 'daily');
  if (trendDaily) allSignals.push(trendDaily);
  else missingData.push('trend_daily');

  const sma = scoreSMAAlignment(snapshot.technical);
  if (sma) allSignals.push(sma);

  const rsi = scoreRSI(snapshot.technical);
  if (rsi) allSignals.push(rsi);

  if (snapshot.technical) freshness['technical'] = snapshot.technical.timestamp;

  // ─── 2. SEASONALITY ────────────────────────────────────────────────────

  const seasonality = scoreSeasonality(snapshot.seasonality);
  if (seasonality) allSignals.push(seasonality);
  else missingData.push('seasonality');

  // ─── 3. COT SIGNALS ───────────────────────────────────────────────────

  if (asset.has_cot) {
    const cotSignals = scoreCOT(snapshot.cot_latest, snapshot.cot_history);
    if (cotSignals.length > 0) {
      allSignals.push(...cotSignals);
      if (snapshot.cot_latest) freshness['cot'] = snapshot.cot_latest.report_date;
    } else {
      missingData.push('cot');
    }
  } else {
    missingData.push('cot');
  }

  // ─── 4. RETAIL SENTIMENT ──────────────────────────────────────────────

  if (asset.has_sentiment) {
    const sentimentSignals = scoreSentiment(snapshot.sentiment);
    if (sentimentSignals.length > 0) {
      allSignals.push(...sentimentSignals);
      if (snapshot.sentiment) freshness['sentiment'] = snapshot.sentiment.timestamp;
    } else {
      missingData.push('sentiment');
    }
  } else {
    missingData.push('sentiment');
  }

  // ─── 5. MACRO SIGNALS ────────────────────────────────────────────────

  if (asset.asset_class === 'fx' && asset.base_currency && asset.quote_currency) {
    // FX PAIR: pair-relative macro scoring
    scoreFXMacro(snapshot, asset, allSignals, missingData, freshness);
  } else {
    // NON-FX: score against primary economy
    scoreNonFXMacro(snapshot, asset, allSignals, missingData, freshness);
  }

  // ─── 6. AGGREGATE ─────────────────────────────────────────────────────

  const categoryScores = aggregateByCategory(allSignals);
  const { total_score, bias_label } = computeTotalScore(categoryScores, weights);

  return {
    symbol: asset.symbol,
    name: asset.name,
    scoring_version: scoringVersion,
    computed_at: new Date().toISOString(),
    total_score,
    bias_label,
    categories: categoryScores,
    readings: allSignals,
    missing_data: missingData,
    data_freshness: freshness,
  };
}


// ─── FX PAIR MACRO SCORING (PRIVATE) ────────────────────────────────────────

function scoreFXMacro(
  snapshot: AssetDataSnapshot,
  asset: Asset,
  allSignals: SignalInput[],
  missingData: string[],
  freshness: Record<string, string>,
) {
  const baseCcy = asset.base_currency!;
  const quoteCcy = asset.quote_currency!;

  // Find economy codes for base and quote
  const baseEconLink = snapshot.economy_links.find(l => l.role === 'base');
  const quoteEconLink = snapshot.economy_links.find(l => l.role === 'quote');

  if (!baseEconLink || !quoteEconLink) {
    missingData.push('economy_links');
    return;
  }

  // Map currency to economy code (simplified — in production this comes from DB)
  const ccyToEcon: Record<string, string> = {
    'EUR': 'EU', 'GBP': 'UK', 'USD': 'US', 'JPY': 'JP',
    'AUD': 'AU', 'NZD': 'NZ', 'CAD': 'CA', 'CHF': 'CH',
  };
  const baseEcon = ccyToEcon[baseCcy] ?? baseCcy;
  const quoteEcon = ccyToEcon[quoteCcy] ?? quoteCcy;

  // Score each macro indicator as pair-relative
  for (const macroConfig of MACRO_SCORING_CONFIGS) {
    const baseKey = `${baseEcon}:${macroConfig.indicator_key}`;
    const quoteKey = `${quoteEcon}:${macroConfig.indicator_key}`;

    const baseRelease = snapshot.macro_releases[baseKey];
    const quoteRelease = snapshot.macro_releases[quoteKey];

    if (!baseRelease && !quoteRelease) {
      missingData.push(macroConfig.indicator_key);
      continue;
    }

    const baseSignal = baseRelease
      ? scoreMacroRelease(baseRelease, macroConfig, baseEcon)
      : null;
    const quoteSignal = quoteRelease
      ? scoreMacroRelease(quoteRelease, macroConfig, quoteEcon)
      : null;

    const pairSignal = computePairRelativeScore(
      baseSignal,
      quoteSignal,
      macroConfig.indicator_key as MetricKey,
      macroConfig.category,
    );

    // Apply asset-specific exceptions
    const finalSignal = applyAssetExceptions(pairSignal, asset, macroConfig);
    allSignals.push(finalSignal);

    if (baseRelease) freshness[`macro:${baseEcon}:${macroConfig.indicator_key}`] = baseRelease.release_date;
    if (quoteRelease) freshness[`macro:${quoteEcon}:${macroConfig.indicator_key}`] = quoteRelease.release_date;
  }

  // Interest rates (pair-relative)
  const baseRate = snapshot.interest_rates[baseEcon];
  const quoteRate = snapshot.interest_rates[quoteEcon];
  const baseRateSignal = scoreInterestRate(baseRate, baseEcon);
  const quoteRateSignal = scoreInterestRate(quoteRate, quoteEcon);

  if (baseRateSignal || quoteRateSignal) {
    const rateSignal = computePairRelativeScore(
      baseRateSignal, quoteRateSignal,
      METRIC_KEYS.INTEREST_RATE, 'rates',
    );
    allSignals.push(rateSignal);
  }

  // Yield curve (pair-relative)
  const baseYieldCurveSignal = scoreYieldCurve(baseRate, baseEcon);
  const quoteYieldCurveSignal = scoreYieldCurve(quoteRate, quoteEcon);

  if (baseYieldCurveSignal || quoteYieldCurveSignal) {
    const curveSignal = computePairRelativeScore(
      baseYieldCurveSignal, quoteYieldCurveSignal,
      METRIC_KEYS.YIELD_CURVE, 'rates',
    );
    allSignals.push(curveSignal);
  }
}


// ─── NON-FX MACRO SCORING (PRIVATE) ────────────────────────────────────────

function scoreNonFXMacro(
  snapshot: AssetDataSnapshot,
  asset: Asset,
  allSignals: SignalInput[],
  missingData: string[],
  freshness: Record<string, string>,
) {
  // Determine the primary economy for this asset
  // Use metadata.economy (code like 'US') — economy_id is a DB integer, not usable as key
  const primaryLink = snapshot.economy_links.find(l => l.role === 'primary');
  const economyCode = (asset.metadata as Record<string, string>).economy
    ?? (primaryLink ? String(primaryLink.economy_id) : 'US');

  for (const macroConfig of MACRO_SCORING_CONFIGS) {
    const key = `${economyCode}:${macroConfig.indicator_key}`;
    const release = snapshot.macro_releases[key];

    if (!release) {
      missingData.push(macroConfig.indicator_key);
      continue;
    }

    const signal = scoreMacroRelease(release, macroConfig, economyCode);
    if (!signal) continue;

    // Convert EconomySignal to SignalInput
    const assetSignal: SignalInput = {
      metric_key: signal.metric_key,
      category: signal.category,
      raw_value: signal.raw_value,
      direction: signal.direction,
      score: signal.score,
      confidence: signal.confidence,
      explanation: signal.explanation,
      source_timestamp: signal.source_timestamp,
      macro_context: signal.macro_context,
    };

    // Apply weight from economy link (e.g., Gold has weight -1.0 for US)
    const weight = primaryLink?.weight ?? 1.0;
    const weightedSignal = weight < 0
      ? { ...assetSignal, score: clampScore(-assetSignal.score), direction: scoreToDirection(-assetSignal.score) }
      : assetSignal;

    // Apply asset-specific exceptions
    const finalSignal = applyAssetExceptions(weightedSignal, asset, macroConfig);
    allSignals.push(finalSignal);

    freshness[`macro:${economyCode}:${macroConfig.indicator_key}`] = release.release_date;
  }

  // Interest rate (single economy)
  const rate = snapshot.interest_rates[economyCode];
  const rateSignal = scoreInterestRate(rate, economyCode);
  if (rateSignal) {
    allSignals.push({
      metric_key: rateSignal.metric_key,
      category: rateSignal.category,
      raw_value: rateSignal.raw_value,
      direction: rateSignal.direction,
      score: rateSignal.score,
      confidence: rateSignal.confidence,
      explanation: rateSignal.explanation,
      source_timestamp: rateSignal.source_timestamp,
    });
  }

  // Yield curve (single economy)
  const yieldCurveSignal = scoreYieldCurve(rate, economyCode);
  if (yieldCurveSignal) {
    allSignals.push({
      metric_key: yieldCurveSignal.metric_key,
      category: yieldCurveSignal.category,
      raw_value: yieldCurveSignal.raw_value,
      direction: yieldCurveSignal.direction,
      score: yieldCurveSignal.score,
      confidence: yieldCurveSignal.confidence,
      explanation: yieldCurveSignal.explanation,
      source_timestamp: yieldCurveSignal.source_timestamp,
    });
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// TOP SETUPS HEATMAP GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute the Top Setups heatmap from an array of scorecards.
 * Each scorecard's signals are mapped to the heatmap columns.
 */
export function computeTopSetups(scorecards: AssetScorecard[]): TopSetupsEntry[] {
  return scorecards.map(card => {
    const columnScores: Partial<Record<TopSetupsColumnKey, number | null>> = {};

    for (const col of TOP_SETUPS_COLUMNS) {
      const metricKey = COLUMN_TO_METRIC[col];
      const signal = card.readings.find(r => r.metric_key === metricKey);
      columnScores[col] = signal ? signal.score : null;
    }

    return {
      symbol: card.symbol,
      name: card.name,
      asset_class: '',  // Filled by caller from asset metadata
      total_score: card.total_score,
      bias_label: card.bias_label,
      column_scores: columnScores,
    };
  });
}
