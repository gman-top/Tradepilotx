// ═══════════════════════════════════════════════════════════════════════════════
// TradePilot — Scoring Engine Test Suite
// ═══════════════════════════════════════════════════════════════════════════════
//
// Tests the CORE scoring logic: pure functions, deterministic, no side effects.
// Run: npm test
//
// Coverage:
//   1. Utility functions (clampScore, scoreToDirection, scoreToBiasLabel)
//   2. Pair-relative scoring (FX carry/macro differentials)
//   3. Category aggregation
//   4. Total score computation + bias labels
//   5. Full scorecard computation with realistic snapshot
//   6. Interest rate scoring (carry trade logic)
//   7. Yield curve scoring
//   8. RSI scoring
//   9. Top setups heatmap generation
//
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

import {
  computePairRelativeScore,
  aggregateByCategory,
  computeTotalScore,
  computeAssetScorecard,
  computeTopSetups,
  applyAssetExceptions,
  type AssetDataSnapshot,
} from '../scoringEngine';

import {
  DEFAULT_CATEGORY_WEIGHTS,
  clampScore,
  scoreToDirection,
  scoreToBiasLabel,
  METRIC_KEYS,
} from '../../types/scoring';

import type {
  Asset,
  TechnicalIndicator,
  COTPosition,
  RetailSentiment,
  SeasonalityStat,
  InterestRate,
  MacroRelease,
  AssetEconomyLink,
  SignalCategory,
} from '../../types/database';

import type { SignalInput, EconomySignal } from '../../types/scoring';


// ═══════════════════════════════════════════════════════════════════════════════
// TEST HELPERS — Factory functions for known-state test data
// ═══════════════════════════════════════════════════════════════════════════════

const NOW = '2026-02-24T12:00:00.000Z';

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 1, symbol: 'EUR/USD', name: 'Euro / US Dollar',
    asset_class: 'fx', base_currency: 'EUR', quote_currency: 'USD',
    economy_id: 2, cot_symbol: 'EUR', cot_pattern: null,
    has_cot: true, has_sentiment: true, display_order: 1, active: true,
    metadata: { economy: 'EU' }, created_at: '', updated_at: '',
    ...overrides,
  };
}

function makeLinks(base: string, quote: string): AssetEconomyLink[] {
  const econIds: Record<string, number> = { US: 1, EU: 2, UK: 3, JP: 4, AU: 5, NZ: 6, CA: 7, CH: 8 };
  return [
    { asset_id: 1, economy_id: econIds[base] ?? 1, role: 'base', weight: 1.0 },
    { asset_id: 1, economy_id: econIds[quote] ?? 1, role: 'quote', weight: -1.0 },
  ];
}

function makeTechnical(overrides: Partial<TechnicalIndicator> = {}): TechnicalIndicator {
  return {
    asset_id: 0, timestamp: NOW, timeframe: '1d',
    sma_20: 1.0850, sma_50: 1.0800, sma_100: 1.0750, sma_200: 1.0700,
    rsi_14: 58, atr_14: 0.0060, volatility: 8.5,
    trend_4h: 'up', trend_daily: 'up', price_vs_sma200: 1.5,
    ...overrides,
  };
}

function makeCOTPosition(ncNet: number, seed = 0): COTPosition {
  const ncLong = Math.max(0, 150000 + ncNet / 2);
  const ncShort = Math.max(0, 150000 - ncNet / 2);
  return {
    asset_id: 0, report_date: '2026-02-18',
    nc_long: ncLong, nc_short: ncShort, nc_spreading: 20000,
    nc_net: ncNet, comm_long: 180000, comm_short: 170000, comm_net: 10000,
    nr_long: 40000, nr_short: 45000, nr_net: -5000,
    open_interest: 400000, delta_oi: 5000,
    delta_nc_long: 3000, delta_nc_short: -2000, delta_nc_net: 5000,
    delta_comm_long: -1000, delta_comm_short: 1000,
    raw_market_name: 'TEST FUTURES', fetched_at: NOW,
  };
}

function makeCOTHistory(weeks: number, trendUp = true): COTPosition[] {
  return Array.from({ length: weeks }, (_, i) => {
    const base = trendUp ? -50000 + (i * 2000) : 50000 - (i * 2000);
    return makeCOTPosition(base, i);
  });
}

function makeSentiment(longPct: number): RetailSentiment {
  return {
    asset_id: 0, timestamp: NOW,
    long_pct: longPct, short_pct: 100 - longPct,
    source: 'test', long_count: 1000, short_count: 1000,
  };
}

function makeSeasonality(avgReturn: number, winRate = 55): SeasonalityStat {
  return {
    asset_id: 0, month: 2, day_of_year: null,
    avg_return_10y: avgReturn, win_rate_10y: winRate,
    median_return_10y: avgReturn * 0.9, avg_return_5y: avgReturn * 1.1,
    win_rate_5y: winRate, cumulative_avg: null,
    lookback_years: 10, computed_at: NOW,
  };
}

function makeRate(policyRate: number, y2: number, y10: number): InterestRate {
  return {
    economy_id: 0, timestamp: NOW,
    policy_rate: policyRate, yield_2y: y2, yield_5y: (y2 + y10) / 2,
    yield_10y: y10, yield_30y: y10 + 0.3,
    spread_2_10: y10 - y2, real_rate_10y: null, source: 'test',
  };
}

function makeMacroRelease(key: string, actual: number, forecast: number, category: string): MacroRelease {
  const surprise = actual - forecast;
  return {
    id: 0, economy_id: 0, indicator_key: key, indicator_name: key.toUpperCase(),
    category: category as MacroRelease['category'],
    release_date: NOW, actual, forecast, previous: forecast,
    surprise, surprise_pct: forecast !== 0 ? (surprise / Math.abs(forecast)) * 100 : 0,
    beat_miss: surprise > 0 ? 'beat' : surprise < 0 ? 'miss' : 'inline',
    impact: 'high', unit: '%', revision: null, source: 'test', fetched_at: NOW,
  };
}

function makeSignal(category: SignalCategory, score: -2 | -1 | 0 | 1 | 2, metricKey = 'test'): SignalInput {
  return {
    metric_key: metricKey as any,
    category, raw_value: score, direction: scoreToDirection(score),
    score, confidence: 1.0, explanation: `Test signal: ${score}`,
    source_timestamp: NOW,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// 1. UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Utility Functions', () => {
  describe('clampScore', () => {
    it('clamps to -2..+2 range', () => {
      expect(clampScore(5)).toBe(2);
      expect(clampScore(-5)).toBe(-2);
      expect(clampScore(0)).toBe(0);
      expect(clampScore(1.7)).toBe(2);
      expect(clampScore(-1.3)).toBe(-1);
    });

    it('rounds to nearest integer', () => {
      expect(clampScore(0.4)).toBe(0);
      expect(clampScore(0.6)).toBe(1);
      expect(clampScore(-0.6)).toBe(-1);
    });
  });

  describe('scoreToDirection', () => {
    it('maps score ranges to directions', () => {
      expect(scoreToDirection(2)).toBe('bullish');
      expect(scoreToDirection(1)).toBe('bullish');
      expect(scoreToDirection(0.5)).toBe('bullish');
      expect(scoreToDirection(0.3)).toBe('neutral');
      expect(scoreToDirection(0)).toBe('neutral');
      expect(scoreToDirection(-0.3)).toBe('neutral');
      expect(scoreToDirection(-0.5)).toBe('bearish');
      expect(scoreToDirection(-2)).toBe('bearish');
    });
  });

  describe('scoreToBiasLabel', () => {
    it('maps total score to bias labels', () => {
      expect(scoreToBiasLabel(7)).toBe('very_bullish');
      expect(scoreToBiasLabel(5)).toBe('very_bullish');
      expect(scoreToBiasLabel(3)).toBe('bullish');
      expect(scoreToBiasLabel(2)).toBe('bullish');
      expect(scoreToBiasLabel(1)).toBe('neutral');
      expect(scoreToBiasLabel(0)).toBe('neutral');
      expect(scoreToBiasLabel(-1)).toBe('neutral');
      expect(scoreToBiasLabel(-3)).toBe('bearish');
      expect(scoreToBiasLabel(-5)).toBe('very_bearish');
      expect(scoreToBiasLabel(-8)).toBe('very_bearish');
    });
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 2. PAIR-RELATIVE SCORING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Pair-Relative Scoring', () => {
  it('computes net score = base - quote', () => {
    const base: EconomySignal = {
      ...makeSignal('eco_growth', 1, 'gdp'), economy_code: 'EU',
    };
    const quote: EconomySignal = {
      ...makeSignal('eco_growth', -1, 'gdp'), economy_code: 'US',
    };

    const result = computePairRelativeScore(base, quote, METRIC_KEYS.GDP, 'eco_growth');
    expect(result.score).toBe(2); // +1 - (-1) = +2
    expect(result.direction).toBe('bullish');
  });

  it('clamps net score to [-2, +2]', () => {
    const base: EconomySignal = { ...makeSignal('eco_growth', 2, 'gdp'), economy_code: 'EU' };
    const quote: EconomySignal = { ...makeSignal('eco_growth', -2, 'gdp'), economy_code: 'US' };

    const result = computePairRelativeScore(base, quote, METRIC_KEYS.GDP, 'eco_growth');
    // +2 - (-2) = +4, clamped to +2
    expect(result.score).toBe(2);
  });

  it('handles null signals (one side missing data)', () => {
    const base: EconomySignal = { ...makeSignal('eco_growth', 1, 'gdp'), economy_code: 'EU' };

    const result = computePairRelativeScore(base, null, METRIC_KEYS.GDP, 'eco_growth');
    expect(result.score).toBe(1);
    expect(result.confidence).toBe(0.5); // Only base has data
  });

  it('returns neutral when both sides are null', () => {
    const result = computePairRelativeScore(null, null, METRIC_KEYS.GDP, 'eco_growth');
    expect(result.score).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('correctly scores carry trade: USD(+1) vs JPY(-1) = +2 bullish', () => {
    const usd: EconomySignal = { ...makeSignal('rates', 1, 'interest_rate'), economy_code: 'US' };
    const jpy: EconomySignal = { ...makeSignal('rates', -1, 'interest_rate'), economy_code: 'JP' };

    // USD/JPY: base=USD, quote=JPY
    const result = computePairRelativeScore(usd, jpy, METRIC_KEYS.INTEREST_RATE, 'rates');
    expect(result.score).toBe(2); // +1 - (-1) = +2 (strong carry for USD/JPY)
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 3. CATEGORY AGGREGATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Category Aggregation', () => {
  it('computes weighted average per category', () => {
    const signals: SignalInput[] = [
      makeSignal('technical', 2, METRIC_KEYS.TREND_DAILY),
      makeSignal('technical', 1, METRIC_KEYS.TREND_4H),
      makeSignal('technical', 0, METRIC_KEYS.SMA_ALIGNMENT),
    ];

    const result = aggregateByCategory(signals);
    expect(result.technical.signal_count).toBe(3);
    expect(result.technical.score).toBe(1); // (2+1+0)/3 = 1
    expect(result.technical.direction).toBe('bullish');
  });

  it('returns zero score for empty categories', () => {
    const signals: SignalInput[] = [
      makeSignal('technical', 1, METRIC_KEYS.TREND_DAILY),
    ];

    const result = aggregateByCategory(signals);
    expect(result.sentiment.signal_count).toBe(0);
    expect(result.sentiment.score).toBe(0);
    expect(result.cot.signal_count).toBe(0);
  });

  it('uses confidence as weight', () => {
    const signals: SignalInput[] = [
      { ...makeSignal('cot', 2, METRIC_KEYS.COT_NC_NET), confidence: 1.0 },
      { ...makeSignal('cot', -2, METRIC_KEYS.COT_NC_CHANGE), confidence: 0.5 },
    ];

    const result = aggregateByCategory(signals);
    // Weighted average: (2*1.0 + (-2)*0.5) / (1.0 + 0.5) = 1.0/1.5 ≈ 0.67
    expect(result.cot.score).toBeCloseTo(0.67, 1);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 4. TOTAL SCORE COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Total Score Computation', () => {
  it('computes weighted total in [-10, +10] range', () => {
    const catScores = aggregateByCategory([
      makeSignal('technical', 2, METRIC_KEYS.TREND_DAILY),
      makeSignal('sentiment', -1, METRIC_KEYS.RETAIL_CONTRARIAN),
      makeSignal('cot', 1, METRIC_KEYS.COT_NC_NET),
      makeSignal('eco_growth', 2, METRIC_KEYS.GDP),
      makeSignal('inflation', 1, METRIC_KEYS.CPI),
      makeSignal('jobs', 1, METRIC_KEYS.NFP),
      makeSignal('rates', 2, METRIC_KEYS.INTEREST_RATE),
      makeSignal('confidence', 0, METRIC_KEYS.CONSUMER_CONFIDENCE),
    ]);

    const { total_score, bias_label } = computeTotalScore(catScores, DEFAULT_CATEGORY_WEIGHTS);
    expect(total_score).toBeGreaterThan(0);
    expect(total_score).toBeLessThanOrEqual(10);
    expect(['bullish', 'very_bullish']).toContain(bias_label);
  });

  it('returns 0 when all categories are zero', () => {
    const catScores = aggregateByCategory([]);
    const { total_score, bias_label } = computeTotalScore(catScores, DEFAULT_CATEGORY_WEIGHTS);
    expect(total_score).toBe(0);
    expect(bias_label).toBe('neutral');
  });

  it('clamps to -10 when all categories maximally bearish', () => {
    const catScores = aggregateByCategory([
      makeSignal('technical', -2, METRIC_KEYS.TREND_DAILY),
      makeSignal('sentiment', -2, METRIC_KEYS.RETAIL_CONTRARIAN),
      makeSignal('cot', -2, METRIC_KEYS.COT_NC_NET),
      makeSignal('eco_growth', -2, METRIC_KEYS.GDP),
      makeSignal('inflation', -2, METRIC_KEYS.CPI),
      makeSignal('jobs', -2, METRIC_KEYS.NFP),
      makeSignal('rates', -2, METRIC_KEYS.INTEREST_RATE),
      makeSignal('confidence', -2, METRIC_KEYS.CONSUMER_CONFIDENCE),
    ]);

    const { total_score, bias_label } = computeTotalScore(catScores, DEFAULT_CATEGORY_WEIGHTS);
    expect(total_score).toBe(-10);
    expect(bias_label).toBe('very_bearish');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 5. FULL SCORECARD (EUR/USD)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Full Scorecard — EUR/USD', () => {
  function makeEURUSDSnapshot(overrides: Partial<AssetDataSnapshot> = {}): AssetDataSnapshot {
    return {
      asset: makeAsset(),
      economy_links: makeLinks('EU', 'US'),
      technical: makeTechnical({ trend_daily: 'up', trend_4h: 'neutral', rsi_14: 62, price_vs_sma200: 2.0 }),
      cot_latest: makeCOTPosition(30000),
      cot_history: makeCOTHistory(52, true),
      sentiment: makeSentiment(72), // 72% long → contrarian bearish
      macro_releases: {
        'EU:gdp':  makeMacroRelease('gdp', 0.1, 0.2, 'eco_growth'),   // EU GDP miss
        'US:gdp':  makeMacroRelease('gdp', 2.3, 2.0, 'eco_growth'),   // US GDP beat
        'EU:cpi':  makeMacroRelease('cpi', 2.4, 2.3, 'inflation'),
        'US:cpi':  makeMacroRelease('cpi', 2.9, 2.8, 'inflation'),
        'EU:nfp':  makeMacroRelease('nfp', 0, 0, 'jobs'),
        'US:nfp':  makeMacroRelease('nfp', 143, 175, 'jobs'),         // US NFP miss
      },
      interest_rates: {
        'EU': makeRate(2.15, 2.09, 2.70),  // ECB at 2.15%
        'US': makeRate(3.63, 4.00, 4.50),  // Fed at 3.63%
      },
      seasonality: makeSeasonality(0.5, 60), // Mild positive Feb seasonality
      data_timestamps: {},
      ...overrides,
    };
  }

  it('produces a valid scorecard with all fields', () => {
    const snapshot = makeEURUSDSnapshot();
    const card = computeAssetScorecard(snapshot);

    expect(card.symbol).toBe('EUR/USD');
    expect(card.scoring_version).toBe('v1.0.0');
    expect(card.total_score).toBeGreaterThanOrEqual(-10);
    expect(card.total_score).toBeLessThanOrEqual(10);
    expect(['very_bullish', 'bullish', 'neutral', 'bearish', 'very_bearish']).toContain(card.bias_label);
    expect(card.readings.length).toBeGreaterThan(0);
    expect(card.categories).toBeDefined();
  });

  it('interest rate differential correctly scored (EUR rate < USD rate → bearish EUR/USD)', () => {
    const snapshot = makeEURUSDSnapshot();
    const card = computeAssetScorecard(snapshot);

    // Find interest rate signal
    const rateSignal = card.readings.find(r => r.metric_key === METRIC_KEYS.INTEREST_RATE);
    expect(rateSignal).toBeDefined();
    // EUR (2.15% → 0) vs USD (3.63% → +1) → pair net = 0 - 1 = -1 (bearish EUR/USD)
    expect(rateSignal!.score).toBe(-1);
  });

  it('yield curve differential correctly scored', () => {
    const snapshot = makeEURUSDSnapshot();
    const card = computeAssetScorecard(snapshot);

    const curveSignal = card.readings.find(r => r.metric_key === METRIC_KEYS.YIELD_CURVE);
    expect(curveSignal).toBeDefined();
    // EU spread: 2.70-2.09 = 0.61% → +1 (positive)
    // US spread: 4.50-4.00 = 0.50% → +1 (positive)
    // Net: +1 - +1 = 0 (neutral — both curves normal)
    expect(curveSignal!.score).toBe(0);
  });

  it('RSI signal is present and correctly scored', () => {
    const snapshot = makeEURUSDSnapshot();
    const card = computeAssetScorecard(snapshot);

    const rsiSignal = card.readings.find(r => r.metric_key === METRIC_KEYS.RSI_14);
    expect(rsiSignal).toBeDefined();
    // RSI 62 → 55-70 range → +1 (mild bullish momentum)
    expect(rsiSignal!.score).toBe(1);
  });

  it('COT signals are present with percentile', () => {
    const snapshot = makeEURUSDSnapshot();
    const card = computeAssetScorecard(snapshot);

    const cotNet = card.readings.find(r => r.metric_key === METRIC_KEYS.COT_NC_NET);
    expect(cotNet).toBeDefined();
    expect(cotNet!.score).toBe(1); // nc_net 30000 > 0 → +1

    const cotPctl = card.readings.find(r => r.metric_key === METRIC_KEYS.COT_PERCENTILE);
    expect(cotPctl).toBeDefined();
  });

  it('retail sentiment contrarian signal correctly scored', () => {
    const snapshot = makeEURUSDSnapshot();
    const card = computeAssetScorecard(snapshot);

    const sentSignal = card.readings.find(r => r.metric_key === METRIC_KEYS.RETAIL_CONTRARIAN);
    expect(sentSignal).toBeDefined();
    // 72% long → above moderate_long_pct (65%) → contrarian bearish (-1)
    // but below extreme_long_pct (75%)
    expect(sentSignal!.score).toBe(-1);
  });

  it('GDP pair-relative scoring: EU miss + US beat = bearish EUR/USD', () => {
    const snapshot = makeEURUSDSnapshot();
    const card = computeAssetScorecard(snapshot);

    const gdpSignal = card.readings.find(r => r.metric_key === METRIC_KEYS.GDP);
    expect(gdpSignal).toBeDefined();
    // EU GDP: 0.1 vs 0.2 forecast → miss → normalized = -0.1/0.3 = -0.33 → score 0 (within -0.5..+0.5)
    // US GDP: 2.3 vs 2.0 forecast → beat → normalized = 0.3/0.3 = +1.0 → score +1 (>= 0.5)
    // Net: 0 - (+1) = -1 (bearish EUR/USD)
    expect(gdpSignal!.score).toBe(-1);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 6. INTEREST RATE SCORING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Interest Rate Scoring', () => {
  it('USD/JPY: strong carry trade (US ~3.6% vs JP ~0.75%)', () => {
    const snapshot: AssetDataSnapshot = {
      asset: makeAsset({ symbol: 'USD/JPY', base_currency: 'USD', quote_currency: 'JPY' }),
      economy_links: makeLinks('US', 'JP'),
      technical: makeTechnical(),
      cot_latest: makeCOTPosition(20000),
      cot_history: makeCOTHistory(52),
      sentiment: makeSentiment(55),
      macro_releases: {},
      interest_rates: {
        'US': makeRate(3.63, 4.00, 4.50), // +1
        'JP': makeRate(0.75, 1.22, 2.10), // -1
      },
      seasonality: makeSeasonality(0),
      data_timestamps: {},
    };

    const card = computeAssetScorecard(snapshot);
    const rateSignal = card.readings.find(r => r.metric_key === METRIC_KEYS.INTEREST_RATE);
    expect(rateSignal).toBeDefined();
    // US +1 - JP -1 = +2 (strong bullish USD/JPY carry)
    expect(rateSignal!.score).toBe(2);
  });

  it('USD/CHF: extreme carry (US ~3.6% vs CH ~0%)', () => {
    const snapshot: AssetDataSnapshot = {
      asset: makeAsset({ symbol: 'USD/CHF', base_currency: 'USD', quote_currency: 'CHF' }),
      economy_links: makeLinks('US', 'CH'),
      technical: makeTechnical(),
      cot_latest: null, cot_history: [],
      sentiment: null,
      macro_releases: {},
      interest_rates: {
        'US': makeRate(3.63, 4.00, 4.50), // +1
        'CH': makeRate(0.00, 0.25, 0.65), // -2
      },
      seasonality: null,
      data_timestamps: {},
    };

    const card = computeAssetScorecard(snapshot);
    const rateSignal = card.readings.find(r => r.metric_key === METRIC_KEYS.INTEREST_RATE);
    expect(rateSignal).toBeDefined();
    // US +1 - CH -2 = +3 → clamped to +2
    expect(rateSignal!.score).toBe(2);
  });

  it('EUR/USD: neutral carry when both economies have similar rates', () => {
    const snapshot: AssetDataSnapshot = {
      asset: makeAsset(),
      economy_links: makeLinks('EU', 'US'),
      technical: makeTechnical(),
      cot_latest: null, cot_history: [],
      sentiment: null,
      macro_releases: {},
      interest_rates: {
        'EU': makeRate(3.50, 3.20, 3.80), // +1 (>= 2.5%)
        'US': makeRate(3.63, 4.00, 4.50), // +1 (>= 2.5%)
      },
      seasonality: null,
      data_timestamps: {},
    };

    const card = computeAssetScorecard(snapshot);
    const rateSignal = card.readings.find(r => r.metric_key === METRIC_KEYS.INTEREST_RATE);
    expect(rateSignal).toBeDefined();
    // Both +1 → net 0 (neutral carry)
    expect(rateSignal!.score).toBe(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 7. NON-FX ASSET SCORING (Gold, Indices)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Non-FX Asset Scoring', () => {
  it('Gold: uses single-economy scoring with inverted weight', () => {
    const snapshot: AssetDataSnapshot = {
      asset: makeAsset({
        id: 16, symbol: 'XAU/USD', name: 'Gold', asset_class: 'metal',
        base_currency: null, quote_currency: null,
        has_cot: true, has_sentiment: true,
        metadata: { economy: 'US' },
      }),
      economy_links: [{ asset_id: 16, economy_id: 1, role: 'primary', weight: -1.0 }],
      technical: makeTechnical({ trend_daily: 'strong_up', rsi_14: 72, price_vs_sma200: 8.0 }),
      cot_latest: makeCOTPosition(100000),
      cot_history: makeCOTHistory(52),
      sentiment: makeSentiment(40), // 40% long → contrarian neutral
      macro_releases: {
        'US:gdp': makeMacroRelease('gdp', 2.5, 2.0, 'eco_growth'), // US GDP beat → bearish Gold (inverted weight)
      },
      interest_rates: {
        'US': makeRate(3.63, 4.00, 4.50),
      },
      seasonality: makeSeasonality(1.5, 65), // Gold bullish in Feb historically
      data_timestamps: {},
    };

    const card = computeAssetScorecard(snapshot);
    expect(card.symbol).toBe('XAU/USD');

    // GDP: US beat (+1), but Gold weight is -1.0 → inverted to -1
    const gdpSignal = card.readings.find(r => r.metric_key === METRIC_KEYS.GDP);
    expect(gdpSignal).toBeDefined();
    // GDP surprise = 0.5/0.3 = 1.67 → score +2 (>= 1.5), weight -1.0 → clampScore(-2) = -2
    expect(gdpSignal!.score).toBe(-2); // Inverted via weight: strong US GDP = bearish Gold

    // RSI at 72 → +2 (strong momentum)
    const rsiSignal = card.readings.find(r => r.metric_key === METRIC_KEYS.RSI_14);
    expect(rsiSignal).toBeDefined();
    expect(rsiSignal!.score).toBe(2);

    // Interest rate for single economy
    const rateSignal = card.readings.find(r => r.metric_key === METRIC_KEYS.INTEREST_RATE);
    expect(rateSignal).toBeDefined();
    // US rate 3.63% → score +1
    expect(rateSignal!.score).toBe(1);

    // Yield curve for single economy
    const curveSignal = card.readings.find(r => r.metric_key === METRIC_KEYS.YIELD_CURVE);
    expect(curveSignal).toBeDefined();
    // US spread: 4.50-4.00 = 0.50% → +1
    expect(curveSignal!.score).toBe(1);
  });

  it('SPX500: index gets standard US economy scoring', () => {
    const snapshot: AssetDataSnapshot = {
      asset: makeAsset({
        id: 18, symbol: 'SPX500', name: 'S&P 500', asset_class: 'index',
        base_currency: null, quote_currency: null,
        has_cot: true, has_sentiment: true,
        metadata: { economy: 'US' },
      }),
      economy_links: [{ asset_id: 18, economy_id: 1, role: 'primary', weight: 1.0 }],
      technical: makeTechnical(),
      cot_latest: null, cot_history: [],
      sentiment: null,
      macro_releases: {
        'US:gdp': makeMacroRelease('gdp', 2.5, 2.0, 'eco_growth'),
      },
      interest_rates: { 'US': makeRate(3.63, 4.00, 4.50) },
      seasonality: null,
      data_timestamps: {},
    };

    const card = computeAssetScorecard(snapshot);
    // GDP beat for US → positive for index (weight +1.0)
    const gdpSignal = card.readings.find(r => r.metric_key === METRIC_KEYS.GDP);
    expect(gdpSignal).toBeDefined();
    expect(gdpSignal!.score).toBeGreaterThan(0);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 8. TOP SETUPS HEATMAP
// ═══════════════════════════════════════════════════════════════════════════════

describe('Top Setups Heatmap', () => {
  it('generates entries with column scores for each asset', () => {
    const snapshot: AssetDataSnapshot = {
      asset: makeAsset(),
      economy_links: makeLinks('EU', 'US'),
      technical: makeTechnical(),
      cot_latest: makeCOTPosition(30000),
      cot_history: makeCOTHistory(52),
      sentiment: makeSentiment(50),
      macro_releases: {},
      interest_rates: {
        'EU': makeRate(2.15, 2.09, 2.70),
        'US': makeRate(3.63, 4.00, 4.50),
      },
      seasonality: makeSeasonality(0.5),
      data_timestamps: {},
    };

    const card = computeAssetScorecard(snapshot);
    const topSetups = computeTopSetups([card]);

    expect(topSetups).toHaveLength(1);
    expect(topSetups[0].symbol).toBe('EUR/USD');
    expect(topSetups[0].total_score).toBe(card.total_score);
    // Trend column should map to trend_daily
    expect(topSetups[0].column_scores['Trend']).toBeDefined();
    // Interest Rates column should map to interest_rate
    expect(topSetups[0].column_scores['Interest Rates']).toBeDefined();
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 9. EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  it('handles snapshot with all null data gracefully', () => {
    const snapshot: AssetDataSnapshot = {
      asset: makeAsset(),
      economy_links: makeLinks('EU', 'US'),
      technical: null,
      cot_latest: null,
      cot_history: [],
      sentiment: null,
      macro_releases: {},
      interest_rates: {},
      seasonality: null,
      data_timestamps: {},
    };

    const card = computeAssetScorecard(snapshot);
    expect(card.total_score).toBe(0);
    expect(card.bias_label).toBe('neutral');
    expect(card.missing_data.length).toBeGreaterThan(0);
    expect(card.readings.length).toBe(0);
  });

  it('handles extreme RSI values', () => {
    const snapshot: AssetDataSnapshot = {
      asset: makeAsset({ has_cot: false, has_sentiment: false }),
      economy_links: makeLinks('EU', 'US'),
      technical: makeTechnical({ rsi_14: 95, trend_daily: 'strong_up', trend_4h: 'strong_up', price_vs_sma200: 10 }),
      cot_latest: null, cot_history: [],
      sentiment: null, macro_releases: {}, interest_rates: {},
      seasonality: null, data_timestamps: {},
    };

    const card = computeAssetScorecard(snapshot);
    const rsiSignal = card.readings.find(r => r.metric_key === METRIC_KEYS.RSI_14);
    expect(rsiSignal).toBeDefined();
    expect(rsiSignal!.score).toBe(2); // RSI 95 → strong momentum
  });

  it('asset exceptions: Gold GDP inversion', () => {
    const goldAsset = makeAsset({
      symbol: 'XAUUSD', name: 'Gold', asset_class: 'metal',
      metadata: { economy: 'US' },
    });

    const signal: SignalInput = makeSignal('eco_growth', 1, METRIC_KEYS.GDP);
    const config = {
      indicator_key: 'gdp',
      display_name: 'GDP',
      category: 'eco_growth' as SignalCategory,
      invert_direction: false,
      typical_surprise_std: 0.3,
      unit: '%',
      special_rules: [
        { asset_pattern: 'XAUUSD', modifier: 'invert' as const, reason: 'Gold inversely correlated to strong USD data' },
      ],
    };

    const result = applyAssetExceptions(signal, goldAsset, config);
    expect(result.score).toBe(-1); // Inverted from +1 to -1
    expect(result.explanation).toContain('INVERTED');
  });
});
