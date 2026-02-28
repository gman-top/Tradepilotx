// ═══════════════════════════════════════════════════════════════════════════════
// TradePilot — Live Data Provider Implementations
// ═══════════════════════════════════════════════════════════════════════════════
//
// Real data providers — no mocks, no hardcoded data:
//
//  CFTCDirectProvider   — CFTC COT data, no key needed (CORS supported)
//  FREDMacroProvider    — US + international macro indicators via FRED
//  FREDRateProvider     — US + international yields & policy rates via FRED
//  TwelveDataProvider   — FX/metals/crypto OHLC for technical analysis
//  MyfxbookSentiment    — Retail long/short sentiment
//
// All responses are cached in localStorage with per-provider TTLs.
// When APIs are unavailable, providers return empty data (no mock fallback).
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  COTPosition,
  RetailSentiment,
  MacroRelease,
  InterestRate,
  PriceOHLC,
  TrendDirection,
  ImpactLevel,
} from '../types/database';

import type {
  ICOTProvider,
  ISentimentProvider,
  IMacroProvider,
  IRateProvider,
  IPriceProvider,
  ProviderResult,
  QuoteData,
  MacroCalendarEvent,
  ProviderRegistry,
} from './providers';

import { COT_SYMBOL_MAPPINGS } from '../utils/cotMappings';
import { API_KEYS, CACHE_TTL, PROVIDERS_ENABLED, SUPABASE_CONFIG, lsGet, lsSet } from './config';


// ═══════════════════════════════════════════════════════════════════════════════
// CFTC DIRECT PROVIDER — No API key required
// ═══════════════════════════════════════════════════════════════════════════════
// Calls the CFTC Socrata Open Data API directly from the browser.
// CFTC SODA includes CORS headers (Access-Control-Allow-Origin: *).
// Dataset: Legacy Futures Only — https://publicreporting.cftc.gov/resource/6dca-aqww.json
// ═══════════════════════════════════════════════════════════════════════════════

const CFTC_SODA_URL = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';

function buildCFTCUrl(where: string, order: string, limit: number): string {
  const url = new URL(CFTC_SODA_URL);
  url.searchParams.set('$where', where);
  url.searchParams.set('$order', order);
  url.searchParams.set('$limit', String(limit));
  return url.toString();
}

function escapeSoQL(val: string): string {
  return val.replace(/'/g, "''");
}

function parseCFTCInt(val: string | undefined): number {
  return parseInt(val || '0', 10) || 0;
}

function cftcRowToCOTPosition(current: Record<string, string>, previous: Record<string, string> | null): COTPosition {
  const ncLong  = parseCFTCInt(current.noncomm_positions_long_all);
  const ncShort = parseCFTCInt(current.noncomm_positions_short_all);
  const commLong  = parseCFTCInt(current.comm_positions_long_all);
  const commShort = parseCFTCInt(current.comm_positions_short_all);
  const nrLong  = parseCFTCInt(current.nonrept_positions_long_all);
  const nrShort = parseCFTCInt(current.nonrept_positions_short_all);

  // Use CFTC's own delta fields when available, else calc from previous
  const deltaNCLong  = parseCFTCInt(current.change_in_noncomm_long_all);
  const deltaNCShort = parseCFTCInt(current.change_in_noncomm_short_all);
  const deltaCommL   = parseCFTCInt(current.change_in_comm_long_all);
  const deltaCommS   = parseCFTCInt(current.change_in_comm_short_all);
  const deltaOI      = parseCFTCInt(current.change_in_open_interest_all);

  const reportDate = (current.report_date_as_yyyy_mm_dd || '').split('T')[0]
    || new Date().toISOString().split('T')[0];

  return {
    asset_id: 0,
    report_date: reportDate,
    nc_long:     ncLong,
    nc_short:    ncShort,
    nc_spreading: parseCFTCInt(current.noncomm_positions_spreading_all),
    nc_net:      ncLong - ncShort,
    comm_long:   commLong,
    comm_short:  commShort,
    comm_net:    commLong - commShort,
    nr_long:     nrLong,
    nr_short:    nrShort,
    nr_net:      nrLong - nrShort,
    open_interest: parseCFTCInt(current.open_interest_all),
    delta_oi:       deltaOI,
    delta_nc_long:  deltaNCLong,
    delta_nc_short: deltaNCShort,
    delta_nc_net:   deltaNCLong - deltaNCShort,
    delta_comm_long:  deltaCommL,
    delta_comm_short: deltaCommS,
    raw_market_name: current.market_and_exchange_names || null,
    fetched_at: new Date().toISOString(),
  };
}

export class CFTCDirectProvider implements ICOTProvider {
  name = 'cftc-direct';

  async fetchLatest(symbols: string[]): Promise<ProviderResult<Record<string, COTPosition>>> {
    const cacheKey = `cot_latest_${symbols.sort().join(',')}`;
    const cached = lsGet<Record<string, COTPosition>>(cacheKey, CACHE_TTL.cot);
    if (cached) return { ok: true, data: cached, source: this.name, fetched_at: new Date().toISOString() };

    const results: Record<string, COTPosition> = {};
    const errors: string[] = [];

    // Fetch in parallel, limited batches
    const batchSize = 6;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (symbol) => {
          const mapping = COT_SYMBOL_MAPPINGS[symbol];
          if (!mapping) return;

          try {
            const safePattern = escapeSoQL(mapping.soqlPattern);
            const url = buildCFTCUrl(
              `market_and_exchange_names like '${safePattern}'`,
              'report_date_as_yyyy_mm_dd DESC',
              2
            );

            const res = await fetch(url, {
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) throw new Error(`CFTC ${res.status}`);
            const rows: Record<string, string>[] = await res.json();
            if (!rows || rows.length === 0) return;

            results[symbol] = cftcRowToCOTPosition(rows[0], rows[1] || null);
          } catch (err) {
            errors.push(symbol);
            console.warn(`[CFTC] Failed for ${symbol}:`, err);
          }
        })
      );
    }

    const ok = Object.keys(results).length > 0;
    if (ok) lsSet(cacheKey, results);

    return {
      ok,
      data: results,
      source: this.name,
      fetched_at: new Date().toISOString(),
      warnings: errors.length > 0 ? [`Failed: ${errors.join(', ')}`] : undefined,
    };
  }

  async fetchHistory(symbol: string, weeks: number): Promise<ProviderResult<COTPosition[]>> {
    const cacheKey = `cot_hist_${symbol}_${weeks}`;
    const cached = lsGet<COTPosition[]>(cacheKey, CACHE_TTL.cot);
    if (cached) return { ok: true, data: cached, source: this.name, fetched_at: new Date().toISOString() };

    const mapping = COT_SYMBOL_MAPPINGS[symbol];
    if (!mapping) return { ok: false, data: [], source: this.name, fetched_at: new Date().toISOString() };

    try {
      const safePattern = escapeSoQL(mapping.soqlPattern);
      const url = buildCFTCUrl(
        `market_and_exchange_names like '${safePattern}'`,
        'report_date_as_yyyy_mm_dd DESC',
        weeks
      );

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) throw new Error(`CFTC ${res.status}`);
      const rows: Record<string, string>[] = await res.json();
      if (!rows || rows.length === 0) return { ok: false, data: [], source: this.name, fetched_at: new Date().toISOString() };

      const history = rows.map((row, idx) =>
        cftcRowToCOTPosition(row, idx + 1 < rows.length ? rows[idx + 1] : null)
      );

      lsSet(cacheKey, history);
      return { ok: true, data: history, source: this.name, fetched_at: new Date().toISOString() };
    } catch (err) {
      console.warn(`[CFTC] History failed for ${symbol}:`, err);
      return { ok: false, data: [], source: this.name, fetched_at: new Date().toISOString() };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = buildCFTCUrl(
        `market_and_exchange_names like '%EURO FX%CHICAGO MERCANTILE%'`,
        'report_date_as_yyyy_mm_dd DESC',
        1
      );
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// FRED MACRO PROVIDER — Federal Reserve Economic Data
// ═══════════════════════════════════════════════════════════════════════════════
// Free API key: https://fred.stlouisfed.org/docs/api/api_key.html
// Covers: US economy macro indicators (GDP, CPI, NFP, unemployment, etc.)
// Non-US economies fall back to MockMacroProvider (updated 2025 data).
// ═══════════════════════════════════════════════════════════════════════════════

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

interface FredSeries {
  key: string;
  seriesId: string;
  units: string;       // 'lin' | 'pc1' | 'pch' | 'chg' | 'ch1'
  name: string;
  category: string;
  unit: string;
  impact: ImpactLevel;
  scale?: number;      // multiply actual value (e.g. 0.001 to convert units to K)
  invertSurprise?: boolean; // For indicators where lower = better (unemployment)
}

// US indicators mapped to FRED series IDs
// units: lin=level, pc1=YoY%, pch=MoM%, chg=absolute change
const FRED_US_INDICATORS: FredSeries[] = [
  { key: 'gdp',               seriesId: 'A191RL1Q225SBEA', units: 'lin', name: 'GDP (QoQ Annualized)', category: 'growth',     unit: '%',    impact: 'high'   },
  { key: 'cpi',               seriesId: 'CPIAUCSL',         units: 'pc1', name: 'CPI (YoY)',            category: 'inflation',  unit: '%',    impact: 'high'   },
  { key: 'pce',               seriesId: 'PCEPI',            units: 'pch', name: 'Core PCE (MoM)',        category: 'inflation',  unit: '%',    impact: 'high'   },
  { key: 'ppi',               seriesId: 'PPIACO',           units: 'pch', name: 'PPI (MoM)',             category: 'inflation',  unit: '%',    impact: 'medium' },
  { key: 'nfp',               seriesId: 'PAYEMS',           units: 'chg', name: 'Non-Farm Payrolls',     category: 'jobs',       unit: 'K',    impact: 'high',   scale: 0.001 },
  { key: 'unemployment_rate', seriesId: 'UNRATE',           units: 'lin', name: 'Unemployment Rate',     category: 'jobs',       unit: '%',    impact: 'high',   invertSurprise: true },
  { key: 'initial_claims',    seriesId: 'ICSA',             units: 'lin', name: 'Initial Jobless Claims',category: 'jobs',       unit: 'K',    impact: 'medium', scale: 0.001, invertSurprise: true },
  { key: 'retail_sales',      seriesId: 'RSXFS',            units: 'pch', name: 'Retail Sales (MoM)',    category: 'growth',     unit: '%',    impact: 'high'   },
  { key: 'consumer_confidence',seriesId: 'UMCSENT',         units: 'lin', name: 'Consumer Sentiment',    category: 'confidence', unit: 'index',impact: 'medium' },
  { key: 'jolts',             seriesId: 'JTSJOL',           units: 'lin', name: 'JOLTS Job Openings',    category: 'jobs',       unit: 'K',    impact: 'medium', scale: 0.001 },
  { key: 'interest_rate',     seriesId: 'FEDFUNDS',         units: 'lin', name: 'Fed Funds Rate',        category: 'rates',      unit: '%',    impact: 'high'   },
];

// ─── FRED International Macro Indicators (OECD via FRED) ─────────────────────
// FRED hosts OECD Main Economic Indicators with consistent naming patterns.
// Country codes: EA=Euro Area, GB=UK, JP=Japan, AU=Australia, NZ=New Zealand, CA=Canada, CH=Switzerland
const FRED_COUNTRY_CODE: Record<string, string> = {
  'EU': 'EA', 'UK': 'GB', 'JP': 'JP', 'AU': 'AU', 'NZ': 'NZ', 'CA': 'CA', 'CH': 'CH',
};

function buildInternationalIndicators(econCode: string): FredSeries[] {
  const cc = FRED_COUNTRY_CODE[econCode];
  if (!cc) return [];

  const econName: Record<string, string> = {
    'EU': 'Eurozone', 'UK': 'UK', 'JP': 'Japan', 'AU': 'Australia',
    'NZ': 'New Zealand', 'CA': 'Canada', 'CH': 'Switzerland',
  };
  const name = econName[econCode] || econCode;

  // Quarterly CPI for AU/NZ (they publish quarterly), monthly for others
  const cpiFreq = (econCode === 'AU' || econCode === 'NZ') ? 'Q' : 'M';
  const cpiSuffix = cpiFreq === 'Q' ? 'Q659N' : 'M659N';

  return [
    { key: 'gdp', seriesId: `NAEXKP01${cc}Q189S`, units: 'pch', name: `${name} GDP (QoQ)`, category: 'growth', unit: '%', impact: 'high' },
    { key: 'cpi', seriesId: `CPALTT01${cc}${cpiSuffix}`, units: 'lin', name: `${name} CPI (YoY)`, category: 'inflation', unit: '%', impact: 'high' },
    { key: 'unemployment_rate', seriesId: `LRHUTTTT${cc}M156S`, units: 'lin', name: `${name} Unemployment Rate`, category: 'jobs', unit: '%', impact: 'high', invertSurprise: true },
  ];
}

// ─── FRED International Rate/Yield Series ────────────────────────────────────
function buildInternationalRateSeries(econCode: string): Record<string, string> {
  const cc = FRED_COUNTRY_CODE[econCode];
  if (!cc) return {};
  return {
    short_term: `IR3TIB01${cc}M156N`,   // 3-month interbank rate (proxy for policy rate)
    yield_10y:  `IRLTLT01${cc === 'EA' ? 'EZ' : cc}M156N`,  // Long-term govt bond yield (10Y)
  };
}

async function fetchFredSeries(seriesId: string, units: string, apiKey: string, limit = 2): Promise<{ latest: number | null; previous: number | null }> {
  const url = new URL(FRED_BASE);
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('units', units);
  url.searchParams.set('sort_order', 'desc');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('file_type', 'json');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`FRED ${seriesId}: ${res.status}`);

  const json = await res.json() as { observations: { date: string; value: string }[] };
  const obs = (json.observations || []).filter(o => o.value !== '.' && o.value !== 'N/A');

  const latest   = obs[0] ? parseFloat(obs[0].value) : null;
  const previous = obs[1] ? parseFloat(obs[1].value) : null;
  return { latest, previous };
}

export class FREDMacroProvider implements IMacroProvider {
  name = 'fred-macro';

  private async fetchFredIndicators(indicators: FredSeries[]): Promise<MacroRelease[]> {
    const now = new Date().toISOString();
    const releases: MacroRelease[] = [];

    const results = await Promise.allSettled(
      indicators.map(async (ind) => {
        const { latest, previous } = await fetchFredSeries(ind.seriesId, ind.units, API_KEYS.fred);
        if (latest === null) return null;

        const actual   = ind.scale ? Math.round(latest * ind.scale * 10) / 10 : Math.round(latest * 100) / 100;
        const prev     = previous !== null ? (ind.scale ? Math.round(previous * ind.scale * 10) / 10 : Math.round(previous * 100) / 100) : actual;
        const forecast = prev; // Use previous as proxy for forecast
        const surprise = actual - forecast;
        const beatMiss = Math.abs(surprise) < 0.05
          ? 'inline'
          : (ind.invertSurprise ? (surprise < 0 ? 'beat' : 'miss') : (surprise > 0 ? 'beat' : 'miss'));

        return {
          id: 0,
          economy_id: 0,
          indicator_key: ind.key,
          indicator_name: ind.name,
          category: ind.category as MacroRelease['category'],
          release_date: now,
          actual,
          forecast,
          previous: prev,
          surprise: Math.round(surprise * 100) / 100,
          surprise_pct: forecast !== 0 ? Math.round((surprise / Math.abs(forecast)) * 10000) / 100 : 0,
          beat_miss: beatMiss as 'beat' | 'miss' | 'inline',
          impact: ind.impact,
          unit: ind.unit,
          revision: null,
          source: 'FRED',
          fetched_at: now,
        } satisfies MacroRelease;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        releases.push(result.value);
      }
    }

    return releases;
  }

  async fetchReleases(economyCode: string, category?: string, limit = 20): Promise<ProviderResult<MacroRelease[]>> {
    if (!API_KEYS.fred) {
      return { ok: false, data: [], source: this.name, fetched_at: new Date().toISOString(), warnings: ['No FRED API key'] };
    }

    const cacheKey = `fred_releases_${economyCode}`;
    const cached = lsGet<MacroRelease[]>(cacheKey, CACHE_TTL.macro);
    if (cached) {
      let data = cached;
      if (category) data = data.filter(r => r.category === category);
      return { ok: true, data: data.slice(0, limit), source: this.name, fetched_at: new Date().toISOString() };
    }

    try {
      // Select indicators based on economy
      const indicators = economyCode === 'US'
        ? FRED_US_INDICATORS
        : buildInternationalIndicators(economyCode);

      if (indicators.length === 0) {
        return { ok: false, data: [], source: this.name, fetched_at: new Date().toISOString(), warnings: [`No FRED series mapped for ${economyCode}`] };
      }

      const releases = await this.fetchFredIndicators(indicators);

      if (releases.length === 0) {
        console.warn(`[FRED] No data returned for ${economyCode}`);
        return { ok: false, data: [], source: this.name, fetched_at: new Date().toISOString() };
      }

      lsSet(cacheKey, releases);

      let data = releases;
      if (category) data = data.filter(r => r.category === category);
      return { ok: true, data: data.slice(0, limit), source: this.name, fetched_at: new Date().toISOString() };
    } catch (err) {
      console.warn(`[FRED] fetchReleases failed for ${economyCode}:`, err);
      return { ok: false, data: [], source: this.name, fetched_at: new Date().toISOString() };
    }
  }

  async fetchCalendar(economyCodes: string[], _days: number): Promise<ProviderResult<MacroCalendarEvent[]>> {
    return { ok: true, data: [], source: this.name, fetched_at: new Date().toISOString() };
  }

  async fetchIndicator(economyCode: string, indicatorKey: string): Promise<ProviderResult<MacroRelease | null>> {
    const result = await this.fetchReleases(economyCode);
    const match = result.data.find(r => r.indicator_key === indicatorKey) || null;
    return { ok: true, data: match, source: this.name, fetched_at: new Date().toISOString() };
  }

  async healthCheck(): Promise<boolean> {
    if (!API_KEYS.fred) return false;
    try {
      const { latest } = await fetchFredSeries('FEDFUNDS', 'lin', API_KEYS.fred, 1);
      return latest !== null;
    } catch {
      return false;
    }
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// FRED RATE PROVIDER — US + international yields & policy rates via FRED
// ═══════════════════════════════════════════════════════════════════════════════

const FRED_YIELD_SERIES: Record<string, string> = {
  policy_rate: 'FEDFUNDS',
  yield_2y:    'DGS2',
  yield_5y:    'DGS5',
  yield_10y:   'DGS10',
  yield_30y:   'DGS30',
};

export class FREDRateProvider implements IRateProvider {
  name = 'fred-rates';

  async fetchRates(economyCodes: string[]): Promise<ProviderResult<Record<string, InterestRate>>> {
    const cacheKey = `fred_rates_${economyCodes.sort().join(',')}`;
    const cached = lsGet<Record<string, InterestRate>>(cacheKey, CACHE_TTL.rates);
    if (cached) return { ok: true, data: cached, source: this.name, fetched_at: new Date().toISOString() };

    if (!API_KEYS.fred) {
      return { ok: false, data: {}, source: this.name, fetched_at: new Date().toISOString(), warnings: ['No FRED API key'] };
    }

    const results: Record<string, InterestRate> = {};
    const now = new Date().toISOString();

    // Fetch US rates from FRED
    if (economyCodes.includes('US')) {
      try {
        const yieldFetches = await Promise.allSettled(
          Object.entries(FRED_YIELD_SERIES).map(async ([key, seriesId]) => {
            const { latest } = await fetchFredSeries(seriesId, 'lin', API_KEYS.fred, 1);
            return { key, value: latest };
          })
        );

        const usRates: Record<string, number> = {};
        for (const r of yieldFetches) {
          if (r.status === 'fulfilled' && r.value.value !== null) {
            usRates[r.value.key] = r.value.value;
          }
        }

        if (Object.keys(usRates).length > 0) {
          results['US'] = {
            economy_id: 0,
            timestamp: now,
            policy_rate: usRates.policy_rate ?? null,
            yield_2y:    usRates.yield_2y   ?? null,
            yield_5y:    usRates.yield_5y   ?? null,
            yield_10y:   usRates.yield_10y  ?? null,
            yield_30y:   usRates.yield_30y  ?? null,
            spread_2_10: (usRates.yield_10y != null && usRates.yield_2y != null)
              ? usRates.yield_10y - usRates.yield_2y : null,
            real_rate_10y: null,
            source: 'FRED',
          };
        }
      } catch (err) {
        console.warn('[FRED] US rates fetch failed:', err);
      }
    }

    // Non-US economies: fetch from FRED international series (OECD data)
    const nonUS = economyCodes.filter(c => c !== 'US');
    if (nonUS.length > 0) {
      const intlFetches = nonUS.map(async (code) => {
        const series = buildInternationalRateSeries(code);
        if (Object.keys(series).length === 0) return;

        try {
          const [shortTermResult, yield10yResult] = await Promise.allSettled([
            series.short_term ? fetchFredSeries(series.short_term, 'lin', API_KEYS.fred, 1) : Promise.resolve({ latest: null, previous: null }),
            series.yield_10y  ? fetchFredSeries(series.yield_10y,  'lin', API_KEYS.fred, 1) : Promise.resolve({ latest: null, previous: null }),
          ]);

          const shortTerm = shortTermResult.status === 'fulfilled' ? shortTermResult.value.latest : null;
          const yield10y  = yield10yResult.status  === 'fulfilled' ? yield10yResult.value.latest  : null;

          // Only add if we got at least one data point
          if (shortTerm !== null || yield10y !== null) {
            results[code] = {
              economy_id: 0,
              timestamp: now,
              policy_rate: shortTerm,    // 3-month interbank rate ≈ policy rate proxy
              yield_2y:    null,          // FRED doesn't have 2Y for most non-US
              yield_5y:    null,
              yield_10y:   yield10y,
              yield_30y:   null,
              spread_2_10: null,
              real_rate_10y: null,
              source: 'FRED-OECD',
            };
          }
        } catch (err) {
          console.warn(`[FRED] International rates failed for ${code}:`, err);
        }
      });

      await Promise.allSettled(intlFetches);
    }

    if (Object.keys(results).length > 0) {
      lsSet(cacheKey, results);
    }
    return { ok: Object.keys(results).length > 0, data: results, source: this.name, fetched_at: now };
  }

  async fetchHistory(_economyCode: string, _months: number): Promise<ProviderResult<InterestRate[]>> {
    return { ok: true, data: [], source: this.name, fetched_at: new Date().toISOString() };
  }

  async healthCheck(): Promise<boolean> {
    return !!API_KEYS.fred;
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// TWELVEDATA PRICE PROVIDER — Real OHLC for technical analysis
// ═══════════════════════════════════════════════════════════════════════════════
// Free key: https://twelvedata.com (800 calls/day, 8/min)
// Supports batch requests: multiple symbols per call.
// Calculates SMA20/50/100/200, RSI14, and trend from OHLC data.
// ═══════════════════════════════════════════════════════════════════════════════

const TWELVEDATA_BASE = 'https://api.twelvedata.com';

// Map TradePilot symbols → TwelveData symbols
const TD_SYMBOL_MAP: Record<string, string> = {
  'EUR/USD': 'EUR/USD',
  'GBP/USD': 'GBP/USD',
  'USD/JPY': 'USD/JPY',
  'AUD/USD': 'AUD/USD',
  'NZD/USD': 'NZD/USD',
  'USD/CAD': 'USD/CAD',
  'USD/CHF': 'USD/CHF',
  'EUR/JPY': 'EUR/JPY',
  'GBP/JPY': 'GBP/JPY',
  'AUD/JPY': 'AUD/JPY',
  'NZD/JPY': 'NZD/JPY',
  'CAD/JPY': 'CAD/JPY',
  'CHF/JPY': 'CHF/JPY',
  'GBP/AUD': 'GBP/AUD',
  'CAD/CHF': 'CAD/CHF',
  'XAU/USD': 'XAU/USD',
  'XAG/USD': 'XAG/USD',
  'SPX500':  'SPY',       // ETF proxy (SPX index may need premium)
  'NQ':      'QQQ',       // ETF proxy for Nasdaq 100
  'BTC/USD': 'BTC/USD',
};

interface TDBar {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

function calcSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] ?? 0;
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const chg = closes[i] - closes[i - 1];
    if (chg >= 0) avgGain += chg; else avgLoss -= chg;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const chg = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, chg)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -chg)) / period;
  }
  if (avgLoss === 0) return 100;
  return Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;
}

function calcTrend(closes: number[], sma20: number, sma50: number, sma200: number): TrendDirection {
  if (closes.length < 6) return 'neutral';
  const price = closes[closes.length - 1];
  const prev5 = closes[closes.length - 6];
  const momentum = (price - prev5) / prev5;

  const aboveSma200 = price > sma200;
  const aboveSma50  = price > sma50;
  const aboveSma20  = price > sma20;
  const up5 = momentum > 0.003;    // > 0.3% in 5 periods
  const dn5 = momentum < -0.003;

  if (aboveSma200 && aboveSma50 && aboveSma20 && up5)  return 'strong_up';
  if (aboveSma200 && aboveSma50)                         return 'up';
  if (!aboveSma200 && !aboveSma50 && !aboveSma20 && dn5) return 'strong_down';
  if (!aboveSma200 && !aboveSma50)                        return 'down';
  return 'neutral';
}

// Fetch batch of symbols from TwelveData (up to 20 per request)
async function fetchTDBatch(symbols: string[], outputsize: number, apiKey: string): Promise<Record<string, TDBar[]>> {
  const url = new URL(`${TWELVEDATA_BASE}/time_series`);
  url.searchParams.set('symbol', symbols.join(','));
  url.searchParams.set('interval', '1day');
  url.searchParams.set('outputsize', String(outputsize));
  url.searchParams.set('apikey', apiKey);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`TwelveData ${res.status}`);

  const json = await res.json();

  // Single symbol: { meta, values, status }
  // Multiple symbols: { SYM1: { meta, values, status }, SYM2: ... }
  const result: Record<string, TDBar[]> = {};
  if (symbols.length === 1) {
    const sym = symbols[0];
    result[sym] = json?.values || [];
  } else {
    for (const sym of symbols) {
      result[sym] = json[sym]?.values || [];
    }
  }
  return result;
}

export class TwelveDataProvider implements IPriceProvider {
  name = 'twelvedata';

  private emptyOHLC(): ProviderResult<PriceOHLC[]> {
    return { ok: false, data: [], source: this.name, fetched_at: new Date().toISOString(), warnings: ['No data available'] };
  }

  private emptyQuote(symbol: string): ProviderResult<QuoteData> {
    return { ok: false, data: { symbol, bid: 0, ask: 0, last: 0, timestamp: new Date().toISOString() }, source: this.name, fetched_at: new Date().toISOString() };
  }

  async fetchOHLC(symbol: string, _timeframe: string, bars: number): Promise<ProviderResult<PriceOHLC[]>> {
    if (!API_KEYS.twelveData) return this.emptyOHLC();

    const tdSymbol = TD_SYMBOL_MAP[symbol];
    if (!tdSymbol) return this.emptyOHLC();

    const cacheKey = `td_ohlc_${symbol}_${bars}`;
    const cached = lsGet<PriceOHLC[]>(cacheKey, CACHE_TTL.price);
    if (cached) return { ok: true, data: cached, source: this.name, fetched_at: new Date().toISOString() };

    try {
      const batchData = await fetchTDBatch([tdSymbol], Math.min(bars, 500), API_KEYS.twelveData);
      const bars_data = batchData[tdSymbol] || [];

      if (bars_data.length === 0) return this.emptyOHLC();

      // TwelveData returns newest first — reverse to chronological
      const chronological = [...bars_data].reverse();
      const ohlc: PriceOHLC[] = chronological.map(b => ({
        asset_id: 0,
        timestamp: b.datetime,
        timeframe: '1d',
        open:   parseFloat(b.open),
        high:   parseFloat(b.high),
        low:    parseFloat(b.low),
        close:  parseFloat(b.close),
        volume: b.volume ? parseInt(b.volume, 10) : 0,
      }));

      lsSet(cacheKey, ohlc);
      return { ok: true, data: ohlc, source: this.name, fetched_at: new Date().toISOString() };
    } catch (err) {
      console.warn(`[TwelveData] fetchOHLC failed for ${symbol}:`, err);
      return this.emptyOHLC();
    }
  }

  async fetchQuote(symbol: string): Promise<ProviderResult<QuoteData>> {
    if (!API_KEYS.twelveData) return this.emptyQuote(symbol);

    const tdSymbol = TD_SYMBOL_MAP[symbol];
    if (!tdSymbol) return this.emptyQuote(symbol);

    try {
      const url = new URL(`${TWELVEDATA_BASE}/quote`);
      url.searchParams.set('symbol', tdSymbol);
      url.searchParams.set('apikey', API_KEYS.twelveData);

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`TwelveData quote ${res.status}`);

      const json = await res.json();
      const close = parseFloat(json.close);
      const spread = close * 0.0001;

      return {
        ok: true,
        data: {
          symbol,
          bid:  close,
          ask:  close + spread,
          last: close,
          timestamp: new Date().toISOString(),
        },
        source: this.name,
        fetched_at: new Date().toISOString(),
      };
    } catch (err) {
      console.warn(`[TwelveData] fetchQuote failed for ${symbol}:`, err);
      return this.emptyQuote(symbol);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!API_KEYS.twelveData) return false;
    try {
      const url = new URL(`${TWELVEDATA_BASE}/api_usage`);
      url.searchParams.set('apikey', API_KEYS.twelveData);
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Batch-fetch OHLC for multiple symbols in a single API call.
   * More efficient than calling fetchOHLC individually.
   * Returns a map of symbol → TechnicalIndicator data.
   */
  async fetchBatchTechnicals(symbols: string[], bars = 200): Promise<Record<string, {
    sma20: number; sma50: number; sma100: number; sma200: number;
    rsi14: number; trend4h: TrendDirection; trendDaily: TrendDirection;
    priceVsSma200: number; closes: number[];
  }>> {
    if (!API_KEYS.twelveData) return {};

    const result: Record<string, ReturnType<TwelveDataProvider['fetchBatchTechnicals']> extends Promise<infer R> ? R[string] : never> = {};
    const tdSymbols = symbols.map(s => TD_SYMBOL_MAP[s]).filter(Boolean);
    const symMap = Object.fromEntries(symbols.map(s => [TD_SYMBOL_MAP[s], s]).filter(([k]) => k));

    // Check cache first
    const uncached: string[] = [];
    for (const tdSym of tdSymbols) {
      const orig = symMap[tdSym];
      if (!orig) continue;
      const cacheKey = `td_ohlc_${orig}_${bars}`;
      const cached = lsGet<PriceOHLC[]>(cacheKey, CACHE_TTL.price);
      if (cached && cached.length >= 20) {
        const closes = cached.map(b => b.close);
        result[orig] = computeTechnicals(closes);
      } else {
        uncached.push(tdSym);
      }
    }

    if (uncached.length === 0) return result;

    // Batch fetch uncached symbols (TwelveData allows comma-separated)
    const batchSize = 10; // conservative batch size for free tier
    for (let i = 0; i < uncached.length; i += batchSize) {
      const batch = uncached.slice(i, i + batchSize);
      try {
        const batchData = await fetchTDBatch(batch, bars, API_KEYS.twelveData);
        for (const tdSym of batch) {
          const orig = symMap[tdSym];
          if (!orig) continue;
          const bars_data = batchData[tdSym] || [];
          if (bars_data.length < 20) continue;

          const chronological = [...bars_data].reverse();
          const ohlc: PriceOHLC[] = chronological.map(b => ({
            asset_id: 0, timestamp: b.datetime, timeframe: '1d',
            open: parseFloat(b.open), high: parseFloat(b.high),
            low: parseFloat(b.low), close: parseFloat(b.close), volume: 0,
          }));

          lsSet(`td_ohlc_${orig}_${bars}`, ohlc);
          const closes = ohlc.map(b => b.close);
          result[orig] = computeTechnicals(closes);
        }

        // Rate limit: 8 req/min → wait between batches if needed
        if (i + batchSize < uncached.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (err) {
        console.warn(`[TwelveData] Batch failed for ${batch.join(',')}:`, err);
      }
    }

    return result;
  }
}

/** Calculate technical indicators from a close price series (chronological order) */
export function computeTechnicals(closes: number[]): {
  sma20: number; sma50: number; sma100: number; sma200: number;
  rsi14: number; trend4h: TrendDirection; trendDaily: TrendDirection;
  priceVsSma200: number; closes: number[];
} {
  const sma20  = calcSMA(closes, 20);
  const sma50  = calcSMA(closes, 50);
  const sma100 = calcSMA(closes, 100);
  const sma200 = calcSMA(closes, 200);
  const rsi14  = calcRSI(closes);
  const price  = closes[closes.length - 1];

  const trendDaily = calcTrend(closes, sma20, sma50, sma200);
  // 4H trend: use shorter lookback (last 30 bars ≈ recent 4H structure)
  const recent30 = closes.slice(-30);
  const trend4h  = calcTrend(recent30, calcSMA(recent30, 10), calcSMA(recent30, 20), calcSMA(recent30, 30));

  const priceVsSma200 = sma200 > 0 ? Math.round(((price - sma200) / sma200) * 10000) / 100 : 0;

  return { sma20, sma50, sma100, sma200, rsi14, trend4h, trendDaily, priceVsSma200, closes };
}


// ═══════════════════════════════════════════════════════════════════════════════
// MYFXBOOK SENTIMENT PROVIDER — Retail positioning data
// ═══════════════════════════════════════════════════════════════════════════════
// Public endpoint (no auth required for community outlook summary).
// Returns empty data if API is unavailable — no mock fallback.
// ═══════════════════════════════════════════════════════════════════════════════

// Myfxbook symbol mapping (they use different symbol format)
const MYFXBOOK_SYMBOLS: Record<string, string> = {
  'EUR/USD': 'EURUSD', 'GBP/USD': 'GBPUSD', 'USD/JPY': 'USDJPY',
  'AUD/USD': 'AUDUSD', 'NZD/USD': 'NZDUSD', 'USD/CAD': 'USDCAD',
  'USD/CHF': 'USDCHF', 'EUR/JPY': 'EURJPY', 'GBP/JPY': 'GBPJPY',
  'AUD/JPY': 'AUDJPY', 'NZD/JPY': 'NZDJPY', 'CAD/JPY': 'CADJPY',
  'CHF/JPY': 'CHFJPY', 'GBP/AUD': 'GBPAUD', 'CAD/CHF': 'CADCHF',
  'XAU/USD': 'XAUUSD', 'XAG/USD': 'XAGUSD',
};

export class MyfxbookSentimentProvider implements ISentimentProvider {
  name = 'myfxbook-sentiment';

  async fetchLatest(symbols: string[]): Promise<ProviderResult<Record<string, RetailSentiment>>> {
    const cacheKey = `myfxbook_latest`;
    const cached = lsGet<Record<string, RetailSentiment>>(cacheKey, 3600000); // 1 hour TTL
    if (cached) {
      const filtered: Record<string, RetailSentiment> = {};
      for (const sym of symbols) {
        if (cached[sym]) filtered[sym] = cached[sym];
      }
      if (Object.keys(filtered).length > 0) {
        return { ok: true, data: filtered, source: this.name, fetched_at: new Date().toISOString() };
      }
    }

    try {
      // Myfxbook serves Access-Control-Allow-Origin: * so we can call it directly.
      // Dev uses the Vite proxy to avoid cookie/redirect quirks during development.
      const myfxbookUrl = import.meta.env.DEV
        ? '/api/myfxbook/get-community-outlook.json'
        : 'https://www.myfxbook.com/api/get-community-outlook.json';
      const res = await fetch(myfxbookUrl, { signal: AbortSignal.timeout(8000) });

      if (!res.ok) throw new Error(`myfxbook ${res.status}`);
      const json = await res.json();

      if (!json?.symbols) throw new Error('myfxbook: unexpected response format');

      const allResults: Record<string, RetailSentiment> = {};
      const now = new Date().toISOString();

      // Map myfxbook response to RetailSentiment
      for (const entry of json.symbols) {
        const mbSym: string = entry.name || '';
        // Find our internal symbol for this myfxbook symbol
        const internalSym = Object.entries(MYFXBOOK_SYMBOLS)
          .find(([, mb]) => mb === mbSym)?.[0];
        if (!internalSym) continue;

        const shortPct = parseFloat(entry.shortPercentage ?? 50);
        const longPct  = 100 - shortPct;

        allResults[internalSym] = {
          asset_id: 0,
          timestamp: now,
          long_pct:   Math.round(longPct * 100) / 100,
          short_pct:  Math.round(shortPct * 100) / 100,
          source: 'myfxbook',
          long_count:  entry.longVolume  ? parseInt(entry.longVolume,  10) : null,
          short_count: entry.shortVolume ? parseInt(entry.shortVolume, 10) : null,
        };
      }

      if (Object.keys(allResults).length > 0) {
        lsSet(cacheKey, allResults);
        const filtered: Record<string, RetailSentiment> = {};
        for (const sym of symbols) {
          if (allResults[sym]) filtered[sym] = allResults[sym];
        }
        return { ok: true, data: filtered, source: this.name, fetched_at: now };
      }
      throw new Error('myfxbook: no symbols parsed');
    } catch (err) {
      console.warn('[Myfxbook] Sentiment fetch failed:', err);
      return { ok: false, data: {}, source: this.name, fetched_at: new Date().toISOString() };
    }
  }

  async fetchHistory(_symbol: string, _hours: number): Promise<ProviderResult<RetailSentiment[]>> {
    return { ok: false, data: [], source: this.name, fetched_at: new Date().toISOString() };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = import.meta.env.DEV
        ? '/api/myfxbook/get-community-outlook.json'
        : 'https://www.myfxbook.com/api/get-community-outlook.json';
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// LIVE REGISTRY FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates the live provider registry.
 *
 * All providers use real data sources — no mock fallbacks.
 * When API keys aren't set, providers return empty data gracefully.
 *
 *  - COT:       CFTCDirectProvider (no key needed)
 *  - Sentiment: MyfxbookSentimentProvider (no key needed)
 *  - Macro:     FREDMacroProvider — US + international via FRED (requires FRED key)
 *  - Rates:     FREDRateProvider — US + international via FRED (requires FRED key)
 *  - Price:     TwelveDataProvider — OHLC for technicals (requires TwelveData key)
 */
export function createLiveRegistry(): ProviderRegistry {
  console.log('[TradePilot] Initializing live providers:', {
    cot: 'CFTC Direct (no key needed)',
    macro: API_KEYS.fred ? `FRED (key: ${API_KEYS.fred.slice(0, 4)}***)` : 'FRED (no key — macro unavailable)',
    rates: API_KEYS.fred ? `FRED (key: ${API_KEYS.fred.slice(0, 4)}***)` : 'FRED (no key — rates unavailable)',
    price: API_KEYS.twelveData ? `TwelveData (key: ${API_KEYS.twelveData.slice(0, 4)}***)` : 'TwelveData (no key — prices unavailable)',
    sentiment: 'Myfxbook (no key needed)',
  });

  return {
    cot:       new CFTCDirectProvider(),
    sentiment: new MyfxbookSentimentProvider(),
    macro:     new FREDMacroProvider(),
    rates:     new FREDRateProvider(),
    price:     new TwelveDataProvider(),
  };
}
