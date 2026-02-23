// ═══════════════════════════════════════════════════════════════════════════════
// TradePilot — Data Provider Interfaces & Mock Adapters
// ═══════════════════════════════════════════════════════════════════════════════
//
// STRATEGY: "Provider Interface" pattern
//
// Each data source has a strongly-typed interface. Implementations can be:
//   - MockProvider:  returns deterministic fake data for development
//   - LiveProvider:  connects to real APIs (CFTC, FRED, Oanda, etc.)
//   - CachedProvider: wraps a LiveProvider with Redis/memory cache
//
// This allows:
//   1. Development without API keys
//   2. Unit testing of scoring engine with known data
//   3. Swapping providers without changing business logic
//   4. Running multiple providers in parallel (e.g., sentiment from 2 sources)
//
// PROVIDER LIFECYCLE:
//   1. Pipeline scheduler triggers a job (e.g., "fetch COT weekly")
//   2. Job calls provider.fetchCOTLatest(symbols)
//   3. Provider returns normalized data
//   4. Pipeline stores data in DB
//   5. Scoring engine reads from DB (not directly from providers)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  COTPosition,
  RetailSentiment,
  MacroRelease,
  InterestRate,
  PriceOHLC,
  SeasonalityStat,
  Timeframe,
  ImpactLevel,
} from '../types/database';


// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * COT Data Provider — CFTC Commitments of Traders
 * Weekly data, typically released Friday for Tuesday report date.
 *
 * Implementations:
 *   - MockCOTProvider (below)
 *   - CFTCProvider (via existing Supabase Edge Function proxy)
 *   - QuandlCOTProvider (alternative commercial source)
 */
export interface ICOTProvider {
  name: string;

  /** Fetch latest COT data for multiple symbols */
  fetchLatest(symbols: string[]): Promise<ProviderResult<Record<string, COTPosition>>>;

  /** Fetch historical COT data for a single symbol */
  fetchHistory(symbol: string, weeks: number): Promise<ProviderResult<COTPosition[]>>;

  /** Check if the provider is healthy and responding */
  healthCheck(): Promise<boolean>;
}

/**
 * Retail Sentiment Provider — Broker positioning data
 *
 * Implementations:
 *   - MockSentimentProvider (below)
 *   - OandaSentimentProvider (Oanda Order Book API)
 *   - IGSentimentProvider (IG Client Sentiment)
 *   - MyfxbookSentimentProvider (Myfxbook Outlook)
 */
export interface ISentimentProvider {
  name: string;

  /** Fetch latest sentiment for all supported symbols */
  fetchLatest(symbols: string[]): Promise<ProviderResult<Record<string, RetailSentiment>>>;

  /** Fetch sentiment history for a single symbol */
  fetchHistory(symbol: string, hours: number): Promise<ProviderResult<RetailSentiment[]>>;

  healthCheck(): Promise<boolean>;
}

/**
 * Macro Data Provider — Economic indicators
 *
 * Implementations:
 *   - MockMacroProvider (below)
 *   - FREDProvider (Federal Reserve Economic Data — US)
 *   - ECBProvider (European Central Bank — EU)
 *   - ONSProvider (UK Office for National Statistics)
 *   - InvestingComProvider (multi-economy, scraping-based)
 *   - TradingEconomicsProvider (commercial API)
 *   - ForexFactoryProvider (calendar scraping)
 */
export interface IMacroProvider {
  name: string;

  /** Fetch recent releases for an economy and category */
  fetchReleases(
    economyCode: string,
    category?: string,
    limit?: number
  ): Promise<ProviderResult<MacroRelease[]>>;

  /** Fetch upcoming economic calendar */
  fetchCalendar(
    economyCodes: string[],
    days: number
  ): Promise<ProviderResult<MacroCalendarEvent[]>>;

  /** Fetch specific indicator's latest release */
  fetchIndicator(
    economyCode: string,
    indicatorKey: string
  ): Promise<ProviderResult<MacroRelease | null>>;

  healthCheck(): Promise<boolean>;
}

/**
 * Price Data Provider — OHLC quotes
 *
 * Implementations:
 *   - MockPriceProvider (below)
 *   - TwelveDataProvider (12data.com API)
 *   - AlphaVantageProvider
 *   - PolygonProvider
 *   - OandaPriceProvider (for FX)
 */
export interface IPriceProvider {
  name: string;

  /** Fetch latest OHLC bars */
  fetchOHLC(
    symbol: string,
    timeframe: Timeframe,
    bars: number
  ): Promise<ProviderResult<PriceOHLC[]>>;

  /** Fetch current quote (bid/ask/last) */
  fetchQuote(symbol: string): Promise<ProviderResult<QuoteData>>;

  healthCheck(): Promise<boolean>;
}

/**
 * Interest Rate Provider — Central bank rates and yields
 *
 * Implementations:
 *   - MockRateProvider (below)
 *   - FREDRateProvider (US rates/yields from FRED)
 *   - ECBRateProvider
 *   - TradingEconomicsRateProvider
 */
export interface IRateProvider {
  name: string;

  /** Fetch latest rates for all economies */
  fetchRates(economyCodes: string[]): Promise<ProviderResult<Record<string, InterestRate>>>;

  /** Fetch rate history for a single economy */
  fetchHistory(economyCode: string, months: number): Promise<ProviderResult<InterestRate[]>>;

  healthCheck(): Promise<boolean>;
}


// ═══════════════════════════════════════════════════════════════════════════════
// COMMON TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Standard wrapper for all provider responses */
export interface ProviderResult<T> {
  ok: boolean;
  data: T;
  source: string;
  fetched_at: string;
  /** Partial success: some items failed */
  warnings?: string[];
  /** Provider-specific metadata */
  meta?: Record<string, unknown>;
}

/** Current quote data */
export interface QuoteData {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  timestamp: string;
}

/** Upcoming economic event */
export interface MacroCalendarEvent {
  economy_code: string;
  indicator_key: string;
  indicator_name: string;
  category: string;
  scheduled_at: string;
  impact: ImpactLevel;
  forecast: number | null;
  previous: number | null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// MOCK PROVIDERS — Deterministic test data
// ═══════════════════════════════════════════════════════════════════════════════

// ─── MOCK COT PROVIDER ──────────────────────────────────────────────────────

export class MockCOTProvider implements ICOTProvider {
  name = 'mock-cot';

  async fetchLatest(symbols: string[]): Promise<ProviderResult<Record<string, COTPosition>>> {
    const results: Record<string, COTPosition> = {};
    const reportDate = getLastTuesday();

    for (const symbol of symbols) {
      const seed = hashString(symbol);
      const ncLong = 100000 + (seed % 200000);
      const ncShort = 80000 + ((seed * 7) % 180000);

      results[symbol] = {
        asset_id: 0,  // Resolved by pipeline
        report_date: reportDate,
        nc_long: ncLong,
        nc_short: ncShort,
        nc_spreading: Math.floor(ncLong * 0.15),
        nc_net: ncLong - ncShort,
        comm_long: Math.floor(ncShort * 1.2),
        comm_short: Math.floor(ncLong * 1.1),
        comm_net: Math.floor(ncShort * 1.2) - Math.floor(ncLong * 1.1),
        nr_long: Math.floor(ncLong * 0.3),
        nr_short: Math.floor(ncShort * 0.35),
        nr_net: Math.floor(ncLong * 0.3) - Math.floor(ncShort * 0.35),
        open_interest: ncLong + ncShort + Math.floor(ncLong * 0.3) + Math.floor(ncShort * 0.35),
        delta_oi: randomInt(seed, -5000, 5000),
        delta_nc_long: randomInt(seed * 3, -10000, 10000),
        delta_nc_short: randomInt(seed * 5, -10000, 10000),
        delta_nc_net: randomInt(seed * 3, -10000, 10000) - randomInt(seed * 5, -10000, 10000),
        delta_comm_long: randomInt(seed * 7, -8000, 8000),
        delta_comm_short: randomInt(seed * 11, -8000, 8000),
        raw_market_name: `MOCK ${symbol} FUTURES`,
        fetched_at: new Date().toISOString(),
      };
    }

    return {
      ok: true,
      data: results,
      source: this.name,
      fetched_at: new Date().toISOString(),
    };
  }

  async fetchHistory(symbol: string, weeks: number): Promise<ProviderResult<COTPosition[]>> {
    const history: COTPosition[] = [];
    const seed = hashString(symbol);
    const baseDate = new Date();

    for (let i = 0; i < weeks; i++) {
      const weekDate = new Date(baseDate);
      weekDate.setDate(weekDate.getDate() - i * 7);
      const dateSeed = seed + i * 1000;

      const ncLong = 100000 + Math.floor(Math.sin(dateSeed * 0.01) * 50000) + 50000;
      const ncShort = 80000 + Math.floor(Math.cos(dateSeed * 0.01) * 40000) + 40000;

      history.push({
        asset_id: 0,
        report_date: weekDate.toISOString().split('T')[0],
        nc_long: ncLong,
        nc_short: ncShort,
        nc_spreading: Math.floor(ncLong * 0.15),
        nc_net: ncLong - ncShort,
        comm_long: Math.floor(ncShort * 1.2),
        comm_short: Math.floor(ncLong * 1.1),
        comm_net: Math.floor(ncShort * 1.2) - Math.floor(ncLong * 1.1),
        nr_long: Math.floor(ncLong * 0.3),
        nr_short: Math.floor(ncShort * 0.35),
        nr_net: Math.floor(ncLong * 0.3) - Math.floor(ncShort * 0.35),
        open_interest: ncLong + ncShort,
        delta_oi: 0,
        delta_nc_long: 0,
        delta_nc_short: 0,
        delta_nc_net: 0,
        delta_comm_long: 0,
        delta_comm_short: 0,
        raw_market_name: null,
        fetched_at: new Date().toISOString(),
      });
    }

    return { ok: true, data: history, source: this.name, fetched_at: new Date().toISOString() };
  }

  async healthCheck(): Promise<boolean> { return true; }
}


// ─── MOCK SENTIMENT PROVIDER ────────────────────────────────────────────────

export class MockSentimentProvider implements ISentimentProvider {
  name = 'mock-sentiment';

  async fetchLatest(symbols: string[]): Promise<ProviderResult<Record<string, RetailSentiment>>> {
    const results: Record<string, RetailSentiment> = {};

    for (const symbol of symbols) {
      const seed = hashString(symbol + 'sent');
      const longPct = 25 + (seed % 50);  // 25% to 75%

      results[symbol] = {
        asset_id: 0,
        timestamp: new Date().toISOString(),
        long_pct: longPct,
        short_pct: 100 - longPct,
        source: this.name,
        long_count: 1000 + (seed % 5000),
        short_count: Math.floor((1000 + (seed % 5000)) * (100 - longPct) / longPct),
      };
    }

    return { ok: true, data: results, source: this.name, fetched_at: new Date().toISOString() };
  }

  async fetchHistory(symbol: string, hours: number): Promise<ProviderResult<RetailSentiment[]>> {
    const data: RetailSentiment[] = [];
    const seed = hashString(symbol + 'sent');
    const now = Date.now();

    for (let i = 0; i < Math.min(hours, 168); i++) {  // Max 1 week
      const variation = Math.sin(seed * 0.01 + i * 0.1) * 10;
      const longPct = Math.max(15, Math.min(85, 50 + variation));

      data.push({
        asset_id: 0,
        timestamp: new Date(now - i * 3600000).toISOString(),
        long_pct: Math.round(longPct * 100) / 100,
        short_pct: Math.round((100 - longPct) * 100) / 100,
        source: this.name,
        long_count: null,
        short_count: null,
      });
    }

    return { ok: true, data, source: this.name, fetched_at: new Date().toISOString() };
  }

  async healthCheck(): Promise<boolean> { return true; }
}


// ─── MOCK MACRO PROVIDER ────────────────────────────────────────────────────

const MOCK_MACRO_DATA: Array<{
  economy: string;
  key: string;
  name: string;
  category: string;
  actual: number;
  forecast: number;
  previous: number;
  unit: string;
  impact: ImpactLevel;
}> = [
  // US
  { economy: 'US', key: 'gdp', name: 'GDP (QoQ)', category: 'growth', actual: 2.8, forecast: 2.5, previous: 2.3, unit: '%', impact: 'high' },
  { economy: 'US', key: 'pmi_manufacturing', name: 'ISM Manufacturing PMI', category: 'growth', actual: 49.3, forecast: 50.1, previous: 50.3, unit: 'index', impact: 'high' },
  { economy: 'US', key: 'pmi_services', name: 'ISM Services PMI', category: 'growth', actual: 52.8, forecast: 52.0, previous: 51.5, unit: 'index', impact: 'high' },
  { economy: 'US', key: 'retail_sales', name: 'Retail Sales (MoM)', category: 'growth', actual: 0.4, forecast: 0.3, previous: 0.1, unit: '%', impact: 'high' },
  { economy: 'US', key: 'consumer_confidence', name: 'Consumer Confidence', category: 'confidence', actual: 104.1, forecast: 106.0, previous: 105.6, unit: 'index', impact: 'medium' },
  { economy: 'US', key: 'cpi', name: 'CPI (YoY)', category: 'inflation', actual: 3.1, forecast: 3.0, previous: 3.2, unit: '%', impact: 'high' },
  { economy: 'US', key: 'ppi', name: 'PPI (MoM)', category: 'inflation', actual: 0.3, forecast: 0.2, previous: 0.1, unit: '%', impact: 'medium' },
  { economy: 'US', key: 'pce', name: 'Core PCE (MoM)', category: 'inflation', actual: 0.3, forecast: 0.2, previous: 0.2, unit: '%', impact: 'high' },
  { economy: 'US', key: 'nfp', name: 'Non-Farm Payrolls', category: 'jobs', actual: 227, forecast: 200, previous: 186, unit: 'K', impact: 'high' },
  { economy: 'US', key: 'unemployment_rate', name: 'Unemployment Rate', category: 'jobs', actual: 4.2, forecast: 4.1, previous: 4.1, unit: '%', impact: 'high' },
  { economy: 'US', key: 'initial_claims', name: 'Initial Jobless Claims', category: 'jobs', actual: 219, forecast: 225, previous: 220, unit: 'K', impact: 'medium' },
  { economy: 'US', key: 'adp', name: 'ADP Employment Change', category: 'jobs', actual: 164, forecast: 150, previous: 143, unit: 'K', impact: 'medium' },
  { economy: 'US', key: 'jolts', name: 'JOLTS Job Openings', category: 'jobs', actual: 8900, forecast: 9100, previous: 9200, unit: 'K', impact: 'medium' },
  { economy: 'US', key: 'interest_rate', name: 'Fed Funds Rate', category: 'rates', actual: 4.50, forecast: 4.50, previous: 4.75, unit: '%', impact: 'high' },

  // EU — Updated Feb 2025 (ECB cut to 2.90%, inflation near target)
  { economy: 'EU', key: 'gdp', name: 'GDP (QoQ)', category: 'growth', actual: 0.4, forecast: 0.3, previous: 0.3, unit: '%', impact: 'high' },
  { economy: 'EU', key: 'pmi_manufacturing', name: 'Manufacturing PMI', category: 'growth', actual: 47.3, forecast: 46.8, previous: 46.6, unit: 'index', impact: 'high' },
  { economy: 'EU', key: 'pmi_services', name: 'Services PMI', category: 'growth', actual: 51.3, forecast: 51.0, previous: 51.6, unit: 'index', impact: 'high' },
  { economy: 'EU', key: 'cpi', name: 'CPI (YoY)', category: 'inflation', actual: 2.5, forecast: 2.4, previous: 2.4, unit: '%', impact: 'high' },
  { economy: 'EU', key: 'interest_rate', name: 'ECB Deposit Rate', category: 'rates', actual: 2.90, forecast: 2.90, previous: 3.15, unit: '%', impact: 'high' },

  // UK — Updated Feb 2025 (BoE cut to 4.50%, CPI sticky)
  { economy: 'UK', key: 'gdp', name: 'GDP (QoQ)', category: 'growth', actual: 0.1, forecast: 0.2, previous: 0.0, unit: '%', impact: 'high' },
  { economy: 'UK', key: 'pmi_composite', name: 'Composite PMI', category: 'growth', actual: 50.5, forecast: 50.8, previous: 50.6, unit: 'index', impact: 'high' },
  { economy: 'UK', key: 'cpi', name: 'CPI (YoY)', category: 'inflation', actual: 2.5, forecast: 2.6, previous: 2.6, unit: '%', impact: 'high' },
  { economy: 'UK', key: 'interest_rate', name: 'BoE Bank Rate', category: 'rates', actual: 4.50, forecast: 4.50, previous: 4.75, unit: '%', impact: 'high' },

  // JP — Updated Feb 2025 (BoJ raised to 0.50% in Jan 2025, CPI elevated)
  { economy: 'JP', key: 'gdp', name: 'GDP (QoQ)', category: 'growth', actual: 0.3, forecast: 0.2, previous: 0.2, unit: '%', impact: 'high' },
  { economy: 'JP', key: 'cpi', name: 'CPI (YoY)', category: 'inflation', actual: 3.6, forecast: 3.4, previous: 3.0, unit: '%', impact: 'high' },
  { economy: 'JP', key: 'interest_rate', name: 'BoJ Policy Rate', category: 'rates', actual: 0.50, forecast: 0.50, previous: 0.25, unit: '%', impact: 'high' },

  // AU — Updated Feb 2025 (RBA cut in Feb 2025 to 4.10%)
  { economy: 'AU', key: 'gdp', name: 'GDP (QoQ)', category: 'growth', actual: 0.3, forecast: 0.3, previous: 0.2, unit: '%', impact: 'high' },
  { economy: 'AU', key: 'cpi', name: 'CPI (QoQ)', category: 'inflation', actual: 0.6, forecast: 0.7, previous: 0.7, unit: '%', impact: 'high' },
  { economy: 'AU', key: 'interest_rate', name: 'RBA Cash Rate', category: 'rates', actual: 4.10, forecast: 4.10, previous: 4.35, unit: '%', impact: 'high' },

  // NZ — Updated Feb 2025 (RBNZ cut to 3.75%, in easing cycle)
  { economy: 'NZ', key: 'gdp', name: 'GDP (QoQ)', category: 'growth', actual: 0.2, forecast: 0.1, previous: -0.2, unit: '%', impact: 'high' },
  { economy: 'NZ', key: 'cpi', name: 'CPI (QoQ)', category: 'inflation', actual: 0.5, forecast: 0.5, previous: 0.6, unit: '%', impact: 'high' },
  { economy: 'NZ', key: 'interest_rate', name: 'RBNZ OCR', category: 'rates', actual: 3.75, forecast: 3.75, previous: 4.25, unit: '%', impact: 'high' },

  // CA — Updated Feb 2025 (BoC cut to 3.00%, tariff uncertainty)
  { economy: 'CA', key: 'gdp', name: 'GDP (MoM)', category: 'growth', actual: 0.2, forecast: 0.1, previous: 0.3, unit: '%', impact: 'high' },
  { economy: 'CA', key: 'cpi', name: 'CPI (YoY)', category: 'inflation', actual: 1.8, forecast: 1.9, previous: 1.8, unit: '%', impact: 'high' },
  { economy: 'CA', key: 'interest_rate', name: 'BoC Rate', category: 'rates', actual: 3.00, forecast: 3.00, previous: 3.25, unit: '%', impact: 'high' },

  // CH — Updated Feb 2025 (SNB cut to 0.50%, deflation risk)
  { economy: 'CH', key: 'gdp', name: 'GDP (QoQ)', category: 'growth', actual: 0.2, forecast: 0.2, previous: 0.3, unit: '%', impact: 'high' },
  { economy: 'CH', key: 'cpi', name: 'CPI (YoY)', category: 'inflation', actual: 0.4, forecast: 0.5, previous: 0.6, unit: '%', impact: 'high' },
  { economy: 'CH', key: 'interest_rate', name: 'SNB Policy Rate', category: 'rates', actual: 0.50, forecast: 0.50, previous: 1.00, unit: '%', impact: 'high' },
];

export class MockMacroProvider implements IMacroProvider {
  name = 'mock-macro';

  async fetchReleases(economyCode: string, category?: string, limit = 20): Promise<ProviderResult<MacroRelease[]>> {
    let data = MOCK_MACRO_DATA.filter(d => d.economy === economyCode);
    if (category) data = data.filter(d => d.category === category);

    const releases: MacroRelease[] = data.slice(0, limit).map((d, i) => ({
      id: i + 1,
      economy_id: 0,
      indicator_key: d.key,
      indicator_name: d.name,
      category: d.category as MacroRelease['category'],
      release_date: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
      actual: d.actual,
      forecast: d.forecast,
      previous: d.previous,
      surprise: d.actual - d.forecast,
      surprise_pct: d.forecast !== 0 ? ((d.actual - d.forecast) / Math.abs(d.forecast)) * 100 : 0,
      beat_miss: d.actual > d.forecast ? 'beat' : d.actual < d.forecast ? 'miss' : 'inline',
      impact: d.impact,
      unit: d.unit,
      revision: null,
      source: this.name,
      fetched_at: new Date().toISOString(),
    }));

    return { ok: true, data: releases, source: this.name, fetched_at: new Date().toISOString() };
  }

  async fetchCalendar(economyCodes: string[], days: number): Promise<ProviderResult<MacroCalendarEvent[]>> {
    return { ok: true, data: [], source: this.name, fetched_at: new Date().toISOString() };
  }

  async fetchIndicator(economyCode: string, indicatorKey: string): Promise<ProviderResult<MacroRelease | null>> {
    const match = MOCK_MACRO_DATA.find(d => d.economy === economyCode && d.key === indicatorKey);
    if (!match) return { ok: true, data: null, source: this.name, fetched_at: new Date().toISOString() };

    const release: MacroRelease = {
      id: 1,
      economy_id: 0,
      indicator_key: match.key,
      indicator_name: match.name,
      category: match.category as MacroRelease['category'],
      release_date: new Date().toISOString(),
      actual: match.actual,
      forecast: match.forecast,
      previous: match.previous,
      surprise: match.actual - match.forecast,
      surprise_pct: match.forecast !== 0 ? ((match.actual - match.forecast) / Math.abs(match.forecast)) * 100 : 0,
      beat_miss: match.actual > match.forecast ? 'beat' : match.actual < match.forecast ? 'miss' : 'inline',
      impact: match.impact,
      unit: match.unit,
      revision: null,
      source: this.name,
      fetched_at: new Date().toISOString(),
    };

    return { ok: true, data: release, source: this.name, fetched_at: new Date().toISOString() };
  }

  async healthCheck(): Promise<boolean> { return true; }
}


// ─── MOCK RATE PROVIDER ─────────────────────────────────────────────────────

// Updated February 2025 — reflects actual central bank rates and yield curves
const MOCK_RATES: Record<string, { policy: number; y2: number; y10: number; y30: number }> = {
  'US': { policy: 4.33, y2: 4.20, y10: 4.50, y30: 4.75 },  // Fed paused (4.25-4.50%)
  'EU': { policy: 2.90, y2: 2.40, y10: 2.70, y30: 2.85 },  // ECB: -100bps in 2024/25
  'UK': { policy: 4.50, y2: 4.15, y10: 4.60, y30: 5.25 },  // BoE cut Feb 2025
  'JP': { policy: 0.50, y2: 0.68, y10: 1.50, y30: 2.55 },  // BoJ hike Jan 2025
  'AU': { policy: 4.10, y2: 3.85, y10: 4.40, y30: 4.70 },  // RBA cut Feb 2025
  'NZ': { policy: 3.75, y2: 3.50, y10: 4.35, y30: 4.60 },  // RBNZ easing cycle
  'CA': { policy: 3.00, y2: 2.85, y10: 3.30, y30: 3.55 },  // BoC: -200bps from peak
  'CH': { policy: 0.50, y2: 0.40, y10: 0.65, y30: 0.85 },  // SNB cut Dec 2024
};

export class MockRateProvider implements IRateProvider {
  name = 'mock-rates';

  async fetchRates(economyCodes: string[]): Promise<ProviderResult<Record<string, InterestRate>>> {
    const results: Record<string, InterestRate> = {};

    for (const code of economyCodes) {
      const mock = MOCK_RATES[code];
      if (!mock) continue;

      results[code] = {
        economy_id: 0,
        timestamp: new Date().toISOString(),
        policy_rate: mock.policy,
        yield_2y: mock.y2,
        yield_5y: (mock.y2 + mock.y10) / 2,
        yield_10y: mock.y10,
        yield_30y: mock.y30,
        spread_2_10: mock.y10 - mock.y2,
        real_rate_10y: null,
        source: this.name,
      };
    }

    return { ok: true, data: results, source: this.name, fetched_at: new Date().toISOString() };
  }

  async fetchHistory(economyCode: string, months: number): Promise<ProviderResult<InterestRate[]>> {
    return { ok: true, data: [], source: this.name, fetched_at: new Date().toISOString() };
  }

  async healthCheck(): Promise<boolean> { return true; }
}


// ─── MOCK PRICE PROVIDER ────────────────────────────────────────────────────

export class MockPriceProvider implements IPriceProvider {
  name = 'mock-price';

  async fetchOHLC(symbol: string, timeframe: Timeframe, bars: number): Promise<ProviderResult<PriceOHLC[]>> {
    const seed = hashString(symbol);
    const data: PriceOHLC[] = [];
    let price = 1.0 + (seed % 100) / 10;  // Starting price varies by symbol

    const intervalMs: Record<Timeframe, number> = {
      '15m': 900000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
      '1w': 604800000,
    };

    const now = Date.now();
    for (let i = bars - 1; i >= 0; i--) {
      const variation = (Math.sin(seed * 0.1 + i * 0.05) * 0.02 + (Math.random() - 0.5) * 0.01);
      price *= (1 + variation);

      const high = price * (1 + Math.random() * 0.005);
      const low = price * (1 - Math.random() * 0.005);
      const open = low + Math.random() * (high - low);
      const close = low + Math.random() * (high - low);

      data.push({
        asset_id: 0,
        timestamp: new Date(now - i * intervalMs[timeframe]).toISOString(),
        timeframe,
        open: Math.round(open * 100000) / 100000,
        high: Math.round(high * 100000) / 100000,
        low: Math.round(low * 100000) / 100000,
        close: Math.round(close * 100000) / 100000,
        volume: Math.floor(Math.random() * 100000),
      });
    }

    return { ok: true, data, source: this.name, fetched_at: new Date().toISOString() };
  }

  async fetchQuote(symbol: string): Promise<ProviderResult<QuoteData>> {
    const seed = hashString(symbol);
    const price = 1.0 + (seed % 100) / 10;
    const spread = price * 0.0002;

    return {
      ok: true,
      data: {
        symbol,
        bid: price,
        ask: price + spread,
        last: price + spread / 2,
        timestamp: new Date().toISOString(),
      },
      source: this.name,
      fetched_at: new Date().toISOString(),
    };
  }

  async healthCheck(): Promise<boolean> { return true; }
}


// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER REGISTRY — Dependency injection container
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Central registry for all data providers.
 * The pipeline/service layer reads from this to get the active provider for each source.
 * Swap between mock/live by changing the registration.
 */
export interface ProviderRegistry {
  cot: ICOTProvider;
  sentiment: ISentimentProvider;
  macro: IMacroProvider;
  price: IPriceProvider;
  rates: IRateProvider;
}

/** Default: all mock providers for development */
export function createMockRegistry(): ProviderRegistry {
  return {
    cot: new MockCOTProvider(),
    sentiment: new MockSentimentProvider(),
    macro: new MockMacroProvider(),
    price: new MockPriceProvider(),
    rates: new MockRateProvider(),
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & 0x7FFFFFFF;  // Keep positive
  }
  return hash;
}

function randomInt(seed: number, min: number, max: number): number {
  return min + Math.abs(seed) % (max - min + 1);
}

function getLastTuesday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = (day >= 2) ? (day - 2) : (day + 5);
  const tuesday = new Date(now);
  tuesday.setDate(now.getDate() - diff);
  return tuesday.toISOString().split('T')[0];
}
