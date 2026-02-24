// ═══════════════════════════════════════════════════════════════════════════════
// TradePilot — Central Data Service
// ═══════════════════════════════════════════════════════════════════════════════
//
// This is the SINGLE DATA SOURCE for ALL UI pages.
// It wires together: Asset Catalog + Mock Providers + Scoring Engine.
//
// ARCHITECTURE:
//   1. Define 20 tradeable assets with metadata & economy links
//   2. Use mock providers to generate consistent data per asset
//   3. Run the scoring engine to produce scorecards
//   4. Export a React hook: useTradePilotData()
//
// Every page imports from here — zero hardcoded data in UI components.
//
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';

import type {
  Asset,
  AssetEconomyLink,
  TechnicalIndicator,
  SeasonalityStat,
  MacroRelease,
  InterestRate,
  SignalCategory,
  BiasLabel,
  TrendDirection,
} from '../types/database';

import type {
  AssetScorecard,
  SignalInput,
  CategoryScore,
} from '../types/scoring';

import { scoreToBiasLabel } from '../types/scoring';

import {
  computeAssetScorecard,
  computeTopSetups,
  type AssetDataSnapshot,
} from './scoringEngine';

import type { IPriceProvider } from './providers';
import { createLiveRegistry } from './liveProviders';
import { computeTechnicals } from './liveProviders';


// ═══════════════════════════════════════════════════════════════════════════════
// ECONOMY CATALOG
// ═══════════════════════════════════════════════════════════════════════════════

interface EconomyDef { id: number; code: string; name: string; currency: string; }

const ECONOMIES: EconomyDef[] = [
  { id: 1, code: 'US', name: 'United States', currency: 'USD' },
  { id: 2, code: 'EU', name: 'Eurozone',      currency: 'EUR' },
  { id: 3, code: 'UK', name: 'United Kingdom', currency: 'GBP' },
  { id: 4, code: 'JP', name: 'Japan',          currency: 'JPY' },
  { id: 5, code: 'AU', name: 'Australia',      currency: 'AUD' },
  { id: 6, code: 'NZ', name: 'New Zealand',    currency: 'NZD' },
  { id: 7, code: 'CA', name: 'Canada',         currency: 'CAD' },
  { id: 8, code: 'CH', name: 'Switzerland',    currency: 'CHF' },
];

const ECON_BY_CCY: Record<string, EconomyDef> = {};
for (const e of ECONOMIES) ECON_BY_CCY[e.currency] = e;

const ECON_BY_CODE: Record<string, EconomyDef> = {};
for (const e of ECONOMIES) ECON_BY_CODE[e.code] = e;


// ═══════════════════════════════════════════════════════════════════════════════
// ASSET CATALOG — 20 tradeable instruments
// ═══════════════════════════════════════════════════════════════════════════════

interface AssetDef {
  asset: Asset;
  links: AssetEconomyLink[];
  cotSymbol: string | null;   // Maps to COT_AVAILABLE_SYMBOLS for COT data
}

function fxAsset(id: number, symbol: string, name: string, baseCcy: string, quoteCcy: string, cotSym: string): AssetDef {
  const base = ECON_BY_CCY[baseCcy];
  const quote = ECON_BY_CCY[quoteCcy];
  return {
    asset: {
      id, symbol, name, asset_class: 'fx',
      base_currency: baseCcy, quote_currency: quoteCcy,
      economy_id: base?.id ?? null, cot_symbol: cotSym, cot_pattern: null,
      has_cot: true, has_sentiment: true, display_order: id, active: true,
      metadata: { economy: base?.code ?? 'US' },
      created_at: '', updated_at: '',
    },
    links: [
      ...(base ? [{ asset_id: id, economy_id: base.id, role: 'base' as const, weight: 1.0 }] : []),
      ...(quote ? [{ asset_id: id, economy_id: quote.id, role: 'quote' as const, weight: -1.0 }] : []),
    ],
    cotSymbol: cotSym,
  };
}

function nonFxAsset(
  id: number, symbol: string, name: string, cls: Asset['asset_class'],
  econCode: string, weight: number, cotSym: string,
  hasCot = true, hasSent = true,
): AssetDef {
  const econ = ECON_BY_CODE[econCode];
  return {
    asset: {
      id, symbol, name, asset_class: cls,
      base_currency: null, quote_currency: null,
      economy_id: econ?.id ?? null, cot_symbol: cotSym, cot_pattern: null,
      has_cot: hasCot, has_sentiment: hasSent, display_order: id, active: true,
      metadata: { economy: econCode },
      created_at: '', updated_at: '',
    },
    links: econ ? [{ asset_id: id, economy_id: econ.id, role: 'primary' as const, weight }] : [],
    cotSymbol: cotSym,
  };
}

const ASSET_CATALOG: AssetDef[] = [
  // FX Majors
  fxAsset(1,  'EUR/USD',  'Euro / US Dollar',          'EUR', 'USD', 'EUR'),
  fxAsset(2,  'GBP/USD',  'British Pound / US Dollar',  'GBP', 'USD', 'GBP'),
  fxAsset(3,  'USD/JPY',  'US Dollar / Japanese Yen',   'USD', 'JPY', 'JPY'),
  fxAsset(4,  'AUD/USD',  'Australian Dollar / USD',    'AUD', 'USD', 'AUD'),
  fxAsset(5,  'NZD/USD',  'New Zealand Dollar / USD',   'NZD', 'USD', 'NZD'),
  fxAsset(6,  'USD/CAD',  'US Dollar / Canadian Dollar','USD', 'CAD', 'CAD'),
  fxAsset(7,  'USD/CHF',  'US Dollar / Swiss Franc',    'USD', 'CHF', 'CHF'),
  // FX Crosses
  fxAsset(8,  'EUR/JPY',  'Euro / Japanese Yen',        'EUR', 'JPY', 'EUR'),
  fxAsset(9,  'GBP/JPY',  'British Pound / Yen',        'GBP', 'JPY', 'GBP'),
  fxAsset(10, 'AUD/JPY',  'Australian Dollar / Yen',    'AUD', 'JPY', 'AUD'),
  fxAsset(11, 'NZD/JPY',  'New Zealand Dollar / Yen',   'NZD', 'JPY', 'NZD'),
  fxAsset(12, 'CAD/JPY',  'Canadian Dollar / Yen',      'CAD', 'JPY', 'CAD'),
  fxAsset(13, 'CHF/JPY',  'Swiss Franc / Yen',          'CHF', 'JPY', 'CHF'),
  fxAsset(14, 'GBP/AUD',  'British Pound / AUD',        'GBP', 'AUD', 'GBP'),
  fxAsset(15, 'CAD/CHF',  'Canadian Dollar / Franc',    'CAD', 'CHF', 'CAD'),
  // Metals
  nonFxAsset(16, 'XAU/USD', 'Gold',          'metal', 'US', -1.0, 'Gold'),
  nonFxAsset(17, 'XAG/USD', 'Silver',        'metal', 'US', -1.0, 'SILVER'),
  // Indices
  nonFxAsset(18, 'SPX500',  'S&P 500',       'index', 'US',  1.0, 'SPX'),
  nonFxAsset(19, 'NQ',      'Nasdaq 100',    'index', 'US',  1.0, 'NASDAQ'),
  // Crypto
  nonFxAsset(20, 'BTC/USD', 'Bitcoin',       'crypto','US', -0.5, 'BTC', true, true),
];


// ═══════════════════════════════════════════════════════════════════════════════
// DETERMINISTIC SEED HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
    h = h & 0x7FFFFFFF;
  }
  return h;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}


// ═══════════════════════════════════════════════════════════════════════════════
// MOCK DATA GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

function buildTechnical(symbol: string): TechnicalIndicator {
  const s = hash(symbol + 'tech');
  const trends: TrendDirection[] = ['strong_up', 'up', 'neutral', 'down', 'strong_down'];
  const trend4h = trends[s % 5];
  const trendDaily = trends[(s * 3) % 5];
  const priceVsSma = -15 + (s % 30); // -15 to +15

  return {
    asset_id: 0,
    timestamp: new Date().toISOString(),
    timeframe: '1d',
    sma_20: 100 + seededRandom(s) * 50,
    sma_50: 98 + seededRandom(s + 1) * 50,
    sma_100: 95 + seededRandom(s + 2) * 50,
    sma_200: 90 + seededRandom(s + 3) * 50,
    rsi_14: 30 + seededRandom(s + 4) * 40,
    atr_14: seededRandom(s + 5) * 2,
    volatility: 5 + seededRandom(s + 6) * 30,
    trend_4h: trend4h,
    trend_daily: trendDaily,
    price_vs_sma200: priceVsSma,
  };
}

function buildSeasonality(symbol: string): SeasonalityStat {
  const s = hash(symbol + 'season');
  const month = new Date().getMonth() + 1;
  const avgReturn = -2 + seededRandom(s + month) * 4;      // -2% to +2%
  const winRate = 30 + seededRandom(s + month + 100) * 40;  // 30% to 70%

  return {
    asset_id: 0,
    month,
    day_of_year: null,
    avg_return_10y: Math.round(avgReturn * 100) / 100,
    win_rate_10y: Math.round(winRate * 10) / 10,
    median_return_10y: avgReturn * 0.8,
    avg_return_5y: avgReturn * 1.1,
    win_rate_5y: winRate - 2,
    cumulative_avg: null,
    lookback_years: 10,
    computed_at: new Date().toISOString(),
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// SNAPSHOT BUILDER — Assembles data for one asset
// ═══════════════════════════════════════════════════════════════════════════════

// Initialize live registry (CFTC direct + FRED + TwelveData + Myfxbook)
const _registry = createLiveRegistry();
const cotProvider = _registry.cot;
const sentimentProvider = _registry.sentiment;
const macroProvider = _registry.macro;
const rateProvider = _registry.rates;
const priceProvider: IPriceProvider = _registry.price;

async function buildSnapshot(def: AssetDef): Promise<AssetDataSnapshot> {
  const { asset, links, cotSymbol } = def;

  // COT data
  let cotLatest = null;
  let cotHistory: any[] = [];
  if (cotSymbol && asset.has_cot) {
    const latestResult = await cotProvider.fetchLatest([cotSymbol]);
    cotLatest = latestResult.data[cotSymbol] ?? null;
    const histResult = await cotProvider.fetchHistory(cotSymbol, 156);
    cotHistory = histResult.data;
  }

  // Sentiment data
  let sentiment = null;
  if (asset.has_sentiment) {
    const sentResult = await sentimentProvider.fetchLatest([asset.symbol]);
    sentiment = sentResult.data[asset.symbol] ?? null;
  }

  // Macro releases — fetch for all linked economies
  const macroReleases: Record<string, MacroRelease> = {};
  const econCodes = new Set<string>();
  for (const link of links) {
    const econ = ECONOMIES.find(e => e.id === link.economy_id);
    if (econ) econCodes.add(econ.code);
  }

  for (const code of econCodes) {
    const releases = await macroProvider.fetchReleases(code);
    for (const r of releases.data) {
      macroReleases[`${code}:${r.indicator_key}`] = r;
    }
  }

  // Interest rates
  const interestRates: Record<string, InterestRate> = {};
  if (econCodes.size > 0) {
    const rateResult = await rateProvider.fetchRates(Array.from(econCodes));
    Object.assign(interestRates, rateResult.data);
  }

  // Real price data for technical indicators
  let technical = buildTechnical(asset.symbol); // fallback to mock
  try {
    const ohlcResult = await priceProvider.fetchOHLC(asset.symbol, '1d', 200);
    if (ohlcResult.ok && ohlcResult.data.length >= 20) {
      const closes = ohlcResult.data.map(b => b.close);
      const t = computeTechnicals(closes);
      const latestPrice = closes[closes.length - 1];
      technical = {
        asset_id: 0,
        timestamp: new Date().toISOString(),
        timeframe: '1d',
        sma_20:   t.sma20,
        sma_50:   t.sma50,
        sma_100:  t.sma100,
        sma_200:  t.sma200,
        rsi_14:   t.rsi14,
        atr_14:   null as any,
        volatility: null as any,
        trend_4h:       t.trend4h,
        trend_daily:    t.trendDaily,
        price_vs_sma200: t.priceVsSma200,
      };
    }
  } catch {
    // Keep mock technical on failure
  }

  return {
    asset,
    economy_links: links,
    technical,
    cot_latest: cotLatest,
    cot_history: cotHistory,
    sentiment,
    macro_releases: macroReleases,
    interest_rates: interestRates,
    seasonality: buildSeasonality(asset.symbol),
    data_timestamps: {},
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MacroRegime {
  label: string;
  description: string;
  categoryBiases: {
    category: string;
    bias: string;
    strength: string;
    score: number;
    color: string;
    summary: string;
  }[];
  favoredAssets: { asset: string; symbol: string; reason: string; strength: string }[];
  hurtAssets: { asset: string; symbol: string; reason: string; strength: string }[];
}

export interface SetupRow {
  asset: string;
  symbol: string;
  bias: string;
  biasColor: string;
  totalScore: number;
  starred: boolean;
  scores: {
    cot: number;
    crowd: number;
    seasonality: number;
    trend: number;
    growth: number;
    inflation: number;
    jobs: number;
    rates: number;
  };
}

export interface TradePilotData {
  scorecards: Record<string, AssetScorecard>;
  setups: SetupRow[];
  regime: MacroRegime;
  macroReleases: Record<string, MacroRelease[]>;
  rates: Record<string, InterestRate>;
  technicals: Record<string, TechnicalIndicator>;
  assets: AssetDef[];
  computedAt: string;
}


// ═══════════════════════════════════════════════════════════════════════════════
// DERIVATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const BIAS_COLORS: Record<string, string> = {
  very_bullish: 'var(--tp-bullish)',
  bullish:      'var(--tp-bullish)',
  neutral:      'var(--tp-neutral)',
  bearish:      'var(--tp-bearish)',
  very_bearish: 'var(--tp-bearish)',
};

function biasDisplayName(label: BiasLabel): string {
  const map: Record<BiasLabel, string> = {
    very_bullish: 'Very Bullish',
    bullish: 'Bullish',
    neutral: 'Neutral',
    bearish: 'Bearish',
    very_bearish: 'Very Bearish',
  };
  return map[label];
}

function strengthFromScore(score: number): string {
  const abs = Math.abs(score);
  if (abs >= 1.5) return 'Strong';
  if (abs >= 0.8) return 'Moderate';
  return 'Weak';
}

function getSignalScore(readings: SignalInput[], metricKey: string): number {
  const sig = readings.find(r => r.metric_key === metricKey);
  return sig ? sig.score : 0;
}

function getCategoryAvg(card: AssetScorecard, cat: SignalCategory): number {
  const c = card.categories[cat];
  if (!c || c.signal_count === 0) return 0;
  return Math.round(Math.max(-2, Math.min(2, c.score)));
}

function deriveSetups(scorecards: Record<string, AssetScorecard>): SetupRow[] {
  const rows: SetupRow[] = [];

  for (const [symbol, card] of Object.entries(scorecards)) {
    const biasLabel = biasDisplayName(card.bias_label);
    rows.push({
      asset: card.name,
      symbol,
      bias: biasLabel,
      biasColor: BIAS_COLORS[card.bias_label] || 'var(--tp-neutral)',
      totalScore: card.total_score,
      starred: false,
      scores: {
        cot:          getSignalScore(card.readings, 'cot_nc_net'),
        crowd:        getSignalScore(card.readings, 'retail_contrarian'),
        seasonality:  getSignalScore(card.readings, 'seasonality'),
        trend:        getSignalScore(card.readings, 'trend_daily'),
        growth:       getCategoryAvg(card, 'eco_growth'),
        inflation:    getCategoryAvg(card, 'inflation'),
        jobs:         getCategoryAvg(card, 'jobs'),
        rates:        getCategoryAvg(card, 'rates'),
      },
    });
  }

  // Sort by total score descending
  rows.sort((a, b) => b.totalScore - a.totalScore);
  return rows;
}

function deriveRegime(
  scorecards: Record<string, AssetScorecard>,
  macroReleases: Record<string, MacroRelease[]>,
): MacroRegime {
  // Use US-linked assets to derive macro regime
  // Average category scores across all scorecards
  const categories: SignalCategory[] = ['eco_growth', 'inflation', 'jobs', 'rates'];
  const catLabels: Record<string, string> = {
    eco_growth: 'Growth', inflation: 'Inflation', jobs: 'Jobs', rates: 'Rates',
  };

  const categoryBiases = categories.map(cat => {
    let totalScore = 0;
    let count = 0;
    for (const card of Object.values(scorecards)) {
      const c = card.categories[cat];
      if (c && c.signal_count > 0) {
        totalScore += c.score;
        count++;
      }
    }
    const avg = count > 0 ? totalScore / count : 0;
    const label = avg > 0.3 ? 'Bullish' : avg < -0.3 ? 'Bearish' : 'Neutral';
    const strength = strengthFromScore(avg);

    // Generate summary from US macro data
    const usReleases = macroReleases['US'] || [];
    const catReleases = usReleases.filter(r => r.category === (cat === 'eco_growth' ? 'growth' : cat));
    const summaryParts = catReleases.slice(0, 3).map(r => {
      const beatMiss = r.surprise && r.surprise > 0 ? 'beat' : r.surprise && r.surprise < 0 ? 'miss' : 'inline';
      return `${r.indicator_name}: ${r.actual}${r.unit || ''} (${beatMiss})`;
    });
    const summary = summaryParts.join('. ') || `${catLabels[cat]} data mixed.`;

    return {
      category: catLabels[cat],
      bias: label,
      strength,
      score: Math.round(avg * 100) / 100,
      color: label === 'Bullish' ? 'var(--tp-bullish)' : label === 'Bearish' ? 'var(--tp-bearish)' : 'var(--tp-neutral)',
      summary,
    };
  });

  // Derive regime label
  const growthBias = categoryBiases[0];
  const jobsBias = categoryBiases[2];
  const ratesBias = categoryBiases[3];
  let regimeLabel = 'Mixed Macro';
  let regimeDesc = 'Economic signals are mixed across categories.';

  if (growthBias.bias === 'Bullish' && jobsBias.bias === 'Bullish') {
    regimeLabel = 'Risk-On / Expansionary';
    regimeDesc = 'Growth and jobs data support risk-on positioning. Equities and risk FX favored.';
  } else if (growthBias.bias === 'Bearish' || jobsBias.bias === 'Bearish') {
    if (ratesBias.bias === 'Bullish') {
      regimeLabel = 'Risk-Off / Defensive';
      regimeDesc = 'Weakening fundamentals while rates stay elevated. Safe havens and defensive positioning favored.';
    } else {
      regimeLabel = 'Dovish Pivot / Transition';
      regimeDesc = 'Weak data combined with dovish rate expectations. Gold and bonds historically benefit.';
    }
  } else if (ratesBias.bias === 'Bullish' && growthBias.bias === 'Neutral') {
    regimeLabel = 'Hawkish Hold';
    regimeDesc = 'Rates elevated with neutral growth. USD typically strengthens in this regime.';
  }

  // Favored / hurt assets based on scores
  const sorted = Object.entries(scorecards).sort((a, b) => b[1].total_score - a[1].total_score);
  const favoredAssets = sorted.slice(0, 3).map(([sym, card]) => {
    const topCat = Object.values(card.categories)
      .filter(c => c.signal_count > 0)
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
    return {
      asset: card.name,
      symbol: sym,
      reason: topCat ? `${topCat.category} signals align ${topCat.direction}` : 'Multiple signals bullish',
      strength: strengthFromScore(card.total_score),
    };
  });

  const hurtAssets = sorted.slice(-3).reverse().map(([sym, card]) => {
    const topCat = Object.values(card.categories)
      .filter(c => c.signal_count > 0)
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
    return {
      asset: card.name,
      symbol: sym,
      reason: topCat ? `${topCat.category} signals align ${topCat.direction}` : 'Multiple signals bearish',
      strength: strengthFromScore(Math.abs(card.total_score)),
    };
  });

  return { label: regimeLabel, description: regimeDesc, categoryBiases, favoredAssets, hurtAssets };
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPUTATION
// ═══════════════════════════════════════════════════════════════════════════════

async function computeAll(): Promise<TradePilotData> {
  const scorecards: Record<string, AssetScorecard> = {};
  const allMacroReleases: Record<string, MacroRelease[]> = {};
  const allRates: Record<string, InterestRate> = {};
  const allTechnicals: Record<string, TechnicalIndicator> = {};

  // Fetch macro releases per economy (for Fundamentals page)
  for (const econ of ECONOMIES) {
    const result = await macroProvider.fetchReleases(econ.code);
    allMacroReleases[econ.code] = result.data;
  }

  // Fetch rates
  const rateResult = await rateProvider.fetchRates(ECONOMIES.map(e => e.code));
  Object.assign(allRates, rateResult.data);

  // Compute scorecard for each asset
  for (const def of ASSET_CATALOG) {
    const snapshot = await buildSnapshot(def);
    const scorecard = computeAssetScorecard(snapshot);
    scorecards[def.asset.symbol] = scorecard;
    if (snapshot.technical) {
      allTechnicals[def.asset.symbol] = snapshot.technical;
    }
  }

  // Derive page-specific data
  const setups = deriveSetups(scorecards);
  const regime = deriveRegime(scorecards, allMacroReleases);

  return {
    scorecards,
    setups,
    regime,
    macroReleases: allMacroReleases,
    rates: allRates,
    technicals: allTechnicals,
    assets: ASSET_CATALOG,
    computedAt: new Date().toISOString(),
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON CACHE + REACT HOOK
// ═══════════════════════════════════════════════════════════════════════════════

let _cache: TradePilotData | null = null;
let _promise: Promise<TradePilotData> | null = null;

export function getTradePilotData(): Promise<TradePilotData> {
  if (_cache) return Promise.resolve(_cache);
  if (_promise) return _promise;
  _promise = computeAll().then(data => {
    _cache = data;
    return data;
  });
  return _promise;
}

/** Force recomputation (e.g., when user refreshes) */
export function invalidateCache(): void {
  _cache = null;
  _promise = null;
}

/** React hook — lazy loads & caches TradePilot data */
export function useTradePilotData() {
  const [data, setData] = useState<TradePilotData | null>(_cache);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) {
      setData(_cache);
      setLoading(false);
      return;
    }
    let cancelled = false;
    getTradePilotData().then(d => {
      if (!cancelled) {
        setData(d);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}

// Re-export utilities for pages
export { biasDisplayName, BIAS_COLORS, strengthFromScore, ASSET_CATALOG, ECONOMIES };
export type { AssetDef };
