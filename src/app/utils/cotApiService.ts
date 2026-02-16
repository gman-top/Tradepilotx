// ═══════════════════════════════════════════════════════════════════════════════
// COT API SERVICE — Unified Data Gateway
// ═══════════════════════════════════════════════════════════════════════════════
//
// PURPOSE:
// Single entry point for all COT data operations. This module defines the
// contract that would map 1:1 to a server-side API route (e.g. /api/cot).
// The response shape is normalized, self-describing, and safe for frontend
// consumption — no raw CFTC structures leak through.
//
// CACHING:
// Two-layer cache architecture:
//   Layer 1 (dataCache)  — Raw CFTC data, managed by cotDataService.ts
//   Layer 2 (apiCache)   — Normalized response envelopes, managed here
//   Both use 1-hour TTL, keyed by symbol:traderType:window
//   Manual clear via refreshCOTCache() → clearAllCOTCaches()
//
// ARCHITECTURE:
//   Frontend Component
//        │
//        ▼
//   cotApiService.ts   ← YOU ARE HERE (unified gateway + API-level cache)
//        │
//        ▼
//   cotDataService.ts  (CFTC SODA fetch engine + data-level cache)
//        │
//        ▼
//   percentileEngine.ts (percentile math + interpretation)
//        │
//        ▼
//   CFTC Socrata API   (publicreporting.cftc.gov/resource/6dca-aqww.json)
//
// MIGRATION PATH:
// When a real backend is available, replace the internals of queryCOT() and
// queryCOTBatch() with fetch('/api/cot?...') calls. The response interfaces
// stay identical — zero frontend changes required.
//
// ═══════════════════════════════════════════════════════════════════════════════

import {
  fetchAssetHistory,
  fetchAllAssetsLatest,
  fetchAllAssetsPercentileHistories,
  CFTC_MARKET_PATTERNS,
  COT_AVAILABLE_SYMBOLS,
  type COTWeeklyRowLive,
} from './cotDataService';

import {
  calculatePercentileFromHistory,
  calculatePercentile,
  getPercentileLabel,
  getPercentileLabelColor,
  getPercentileLabelBackgroundColor,
  getPercentileInterpretation,
  type PercentileWindow,
  type PercentileLabel,
} from './percentileEngine';

// All symbol mappings are imported from cotMappings.ts (single source of truth).
// cotDataService re-exports CFTC_MARKET_PATTERNS and COT_AVAILABLE_SYMBOLS from cotMappings.
import {
  getFuturesCode as mappingGetFuturesCode,
  getCFTCMarketName as mappingGetCFTCMarketName,
  isSymbolSupported as mappingIsSymbolSupported,
  COT_AVAILABLE_SYMBOLS as MAPPING_AVAILABLE_SYMBOLS,
} from './cotMappings';

// Shared cache layer — API-level response caching
import {
  apiCache,
  clearAllCOTCaches,
  getCombinedCacheStatus,
  buildApiCacheKey,
  buildApiBatchCacheKey,
  type CacheStatus,
} from './cotCache';

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST / RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Query parameter types — maps to ?symbol=&traderType=&window= */
export type COTTraderTypeParam = 'nonCommercial' | 'commercial' | 'retail' | 'all';
export type COTWindowParam = 52 | 156;

/** Request shape for a single-asset query */
export interface COTApiRequest {
  symbol: string;                        // TradePilot spot symbol (e.g. 'Gold', 'EUR')
  traderType: COTTraderTypeParam;        // Trader category
  window?: COTWindowParam;               // Percentile lookback window (default: 52)
}

/** Request shape for a batch (all assets) query */
export interface COTBatchApiRequest {
  traderType: COTTraderTypeParam;
  window?: COTWindowParam;
}

/** Metadata envelope — identical shape for single and batch responses */
export interface COTApiMeta {
  symbol: string;                        // Queried symbol (or 'ALL' for batch)
  futuresCode: string;                   // CME/ICE contract code
  cftcMarketName: string;                // Full CFTC market_and_exchange_names match
  traderType: COTTraderTypeParam;
  traderTypeDisplay: string;             // Human-readable (e.g. 'Non-Commercials (Hedge Funds)')
  window: COTWindowParam;
  reportDate: string;                    // Most recent CFTC report date
  source: 'live' | 'partial' | 'mock' | 'error';
  fetchedAt: string;                     // ISO timestamp of this response
  cachedUntil: string;                   // ISO timestamp when cache expires
}

/** Latest week positioning snapshot */
export interface COTLatestData {
  longContracts: number;
  shortContracts: number;
  netPosition: number;
  longPct: number;                       // Long / (Long + Short) × 100
  shortPct: number;                      // Short / (Long + Short) × 100
  netChangePct: number;                  // Week-over-week net position change %
  deltaLong: number;                     // Week-over-week change in long contracts
  deltaShort: number;                    // Week-over-week change in short contracts
  openInterest: number;                  // Total open interest (raw number)
  openInterestFormatted: string;         // Formatted (e.g. '534K')
  deltaOI: number;                       // Week-over-week change in open interest
}

/** Percentile computation result */
export interface COTPercentileData {
  value: number;                         // 1-99 percentile
  label: PercentileLabel;                // 'Extreme Long' | 'Crowded Long' | ...
  labelColor: string;                    // Hex color for the label
  labelBackgroundColor: string;          // Rgba background for the label badge
  window: PercentileWindow;              // '52-week' | '156-week'
  interpretation: string;                // Contextual narrative text
  historyDepth: number;                  // Number of weeks used for calculation
  isLive: boolean;                       // true if computed from real CFTC data
}

/** Single week in the history array */
export interface COTHistoryRow {
  date: string;                          // Formatted date (e.g. 'Feb 3, 2026')
  longContracts: number;
  shortContracts: number;
  netPosition: number;
  longPct: number;
  shortPct: number;
  netChangePct: number;
  deltaLong: number;
  deltaShort: number;
}

/** Full response for a single-asset query */
export interface COTApiResponse {
  ok: boolean;
  error?: string;
  meta: COTApiMeta;
  data: {
    latest: COTLatestData;
    percentile: COTPercentileData;
    history: COTHistoryRow[];            // Descending by date (newest first)
  };
}

/** Single asset entry in the batch response */
export interface COTBatchAssetEntry {
  symbol: string;
  futuresCode: string;
  cftcMarketName: string;
  latest: COTLatestData;
  percentile: COTPercentileData;
}

/** Full response for a batch (all assets) query */
export interface COTBatchApiResponse {
  ok: boolean;
  error?: string;
  meta: {
    traderType: COTTraderTypeParam;
    traderTypeDisplay: string;
    window: COTWindowParam;
    reportDate: string;
    source: 'live' | 'partial' | 'mock' | 'error';
    fetchedAt: string;
    cachedUntil: string;
    totalSymbols: number;
    successCount: number;
    failedSymbols: string[];
  };
  data: COTBatchAssetEntry[];
}


// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Map API param to internal data service trader type */
function resolveTraderType(param: COTTraderTypeParam): 'Non-Commercials' | 'Commercials' | 'Retail' | 'All' {
  switch (param) {
    case 'nonCommercial': return 'Non-Commercials';
    case 'commercial':    return 'Commercials';
    case 'retail':        return 'Retail';
    case 'all':           return 'All';
  }
}

/** Human-readable trader type label */
function traderTypeDisplayName(param: COTTraderTypeParam): string {
  switch (param) {
    case 'nonCommercial': return 'Non-Commercials (Hedge Funds)';
    case 'commercial':    return 'Commercials (Producers/Hedgers)';
    case 'retail':        return 'Retail (Small Speculators)';
    case 'all':           return 'All Traders (Aggregated)';
  }
}

/** Check if a symbol has CFTC COT coverage */
export function isSymbolSupported(symbol: string): boolean {
  return mappingIsSymbolSupported(symbol);
}

/** Get the futures code for a spot symbol */
export function getFuturesCode(symbol: string): string {
  return mappingGetFuturesCode(symbol) || 'N/A';
}

/** Get the CFTC market name for a spot symbol */
export function getCFTCMarketName(symbol: string): string {
  return mappingGetCFTCMarketName(symbol) || 'Unknown';
}

/** Get all supported symbols */
export function getSupportedSymbols(): string[] {
  return [...MAPPING_AVAILABLE_SYMBOLS];
}

/** PercentileWindow string from numeric param */
function windowParam(w: COTWindowParam): PercentileWindow {
  return w === 52 ? '52-week' : '156-week';
}

/** Cache expiry timestamp (1 hour from now) */
function cacheExpiry(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

/** Convert COTWeeklyRowLive to normalized COTHistoryRow */
function normalizeHistoryRow(row: COTWeeklyRowLive): COTHistoryRow {
  return {
    date: row.date,
    longContracts: row.longContracts,
    shortContracts: row.shortContracts,
    netPosition: row.netPosition,
    longPct: row.longPct,
    shortPct: row.shortPct,
    netChangePct: row.netChangePct,
    deltaLong: row.deltaLong,
    deltaShort: row.deltaShort,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// CORE API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * QUERY COT — Single Asset
 *
 * Equivalent to: GET /api/cot?symbol=Gold&traderType=nonCommercial&window=52
 *
 * Cache key: api:${symbol}:${traderType}:${window}
 * Checks API-level cache first, then delegates to cotDataService (which has
 * its own data-level cache). Both layers use 1-hour TTL.
 */
export async function queryCOT(request: COTApiRequest): Promise<COTApiResponse> {
  const { symbol, traderType, window: windowParam_ = 52 } = request;
  const internalTraderType = resolveTraderType(traderType);
  const percWindow = windowParam(windowParam_);
  const fetchedAt = new Date().toISOString();

  // ── Check API-level cache ──
  const apiCacheKey = buildApiCacheKey(symbol, traderType, windowParam_);
  const cachedResponse = apiCache.get<COTApiResponse>(apiCacheKey);
  if (cachedResponse) return cachedResponse;

  // ── Validate symbol ──
  if (!isSymbolSupported(symbol)) {
    return {
      ok: false,
      error: `Symbol '${symbol}' is not supported. CFTC does not publish COT data for this asset. Supported symbols: ${COT_AVAILABLE_SYMBOLS.join(', ')}`,
      meta: {
        symbol,
        futuresCode: 'N/A',
        cftcMarketName: 'N/A',
        traderType,
        traderTypeDisplay: traderTypeDisplayName(traderType),
        window: windowParam_,
        reportDate: '',
        source: 'error',
        fetchedAt,
        cachedUntil: fetchedAt,
      },
      data: {
        latest: emptyLatest(),
        percentile: emptyPercentile(percWindow),
        history: [],
      },
    };
  }

  // ── Fetch full history (always 156 weeks — max window optimization) ──
  const historyResult = await fetchAssetHistory(symbol, internalTraderType, 156);

  if (historyResult.source === 'error' || historyResult.data.length === 0) {
    // No live data — calculatePercentile returns 50 (Neutral) as honest fallback
    const fallbackPercentile = calculatePercentile(symbol, 0, percWindow, internalTraderType);
    const label = getPercentileLabel(fallbackPercentile);

    const errorResponse: COTApiResponse = {
      ok: false,
      error: 'Failed to fetch live CFTC data. Percentile unavailable — showing Neutral (50) fallback.',
      meta: {
        symbol,
        futuresCode: getFuturesCode(symbol),
        cftcMarketName: getCFTCMarketName(symbol),
        traderType,
        traderTypeDisplay: traderTypeDisplayName(traderType),
        window: windowParam_,
        reportDate: '',
        source: 'mock',
        fetchedAt,
        cachedUntil: cacheExpiry(),
      },
      data: {
        latest: emptyLatest(),
        percentile: {
          value: fallbackPercentile,
          label,
          labelColor: getPercentileLabelColor(label),
          labelBackgroundColor: getPercentileLabelBackgroundColor(label),
          window: percWindow,
          interpretation: getPercentileInterpretation(fallbackPercentile, internalTraderType, percWindow),
          historyDepth: 0,
          isLive: false,
        },
        history: [],
      },
    };
    // Don't cache error responses
    return errorResponse;
  }

  // ── Extract latest week data ──
  const latestRow = historyResult.data[0];

  const latest: COTLatestData = {
    longContracts: latestRow.longContracts,
    shortContracts: latestRow.shortContracts,
    netPosition: latestRow.netPosition,
    longPct: latestRow.longPct,
    shortPct: latestRow.shortPct,
    netChangePct: latestRow.netChangePct,
    deltaLong: latestRow.deltaLong,
    deltaShort: latestRow.deltaShort,
    openInterest: 0,           // OI not available from history-only fetch
    openInterestFormatted: '-',
    deltaOI: 0,
  };

  // ── Compute percentile from real history ──
  const netPositions = historyResult.data.map(r => r.netPosition);
  const percentileValue = calculatePercentileFromHistory(
    latestRow.netPosition,
    netPositions,
    percWindow
  );
  const label = getPercentileLabel(percentileValue);

  const percentile: COTPercentileData = {
    value: percentileValue,
    label,
    labelColor: getPercentileLabelColor(label),
    labelBackgroundColor: getPercentileLabelBackgroundColor(label),
    window: percWindow,
    interpretation: getPercentileInterpretation(percentileValue, internalTraderType, percWindow),
    historyDepth: netPositions.length,
    isLive: true,
  };

  // ── Normalize history ──
  const history = historyResult.data.map(normalizeHistoryRow);

  const response: COTApiResponse = {
    ok: true,
    meta: {
      symbol,
      futuresCode: getFuturesCode(symbol),
      cftcMarketName: getCFTCMarketName(symbol),
      traderType,
      traderTypeDisplay: traderTypeDisplayName(traderType),
      window: windowParam_,
      reportDate: latestRow.date,
      source: 'live',
      fetchedAt,
      cachedUntil: cacheExpiry(),
    },
    data: {
      latest,
      percentile,
      history,
    },
  };

  // ── Cache successful response ──
  apiCache.set(apiCacheKey, response);

  return response;
}


/**
 * QUERY COT BATCH — All Assets
 *
 * Equivalent to: GET /api/cot?symbol=ALL&traderType=nonCommercial&window=52
 *
 * Cache key: apiBatch:${traderType}:${window}
 * Two-phase fetch with API-level response caching.
 */
export async function queryCOTBatch(request: COTBatchApiRequest): Promise<COTBatchApiResponse> {
  const { traderType, window: windowParam_ = 52 } = request;
  const internalTraderType = resolveTraderType(traderType);
  const percWindow = windowParam(windowParam_);
  const fetchedAt = new Date().toISOString();

  // ── Check API-level cache ──
  const batchCacheKey = buildApiBatchCacheKey(traderType, windowParam_);
  const cachedResponse = apiCache.get<COTBatchApiResponse>(batchCacheKey);
  if (cachedResponse) return cachedResponse;

  // ── Phase 1: Fetch latest data for all symbols ──
  const latestResult = await fetchAllAssetsLatest(internalTraderType);

  if (latestResult.data.length === 0) {
    return {
      ok: false,
      error: 'Failed to fetch any live CFTC data for batch query.',
      meta: {
        traderType,
        traderTypeDisplay: traderTypeDisplayName(traderType),
        window: windowParam_,
        reportDate: '',
        source: 'error',
        fetchedAt,
        cachedUntil: fetchedAt,
        totalSymbols: COT_AVAILABLE_SYMBOLS.length,
        successCount: 0,
        failedSymbols: [...COT_AVAILABLE_SYMBOLS],
      },
      data: [],
    };
  }

  // ── Phase 2: Fetch full histories for percentile computation ──
  const percentileResult = await fetchAllAssetsPercentileHistories(internalTraderType, 156);

  // ── Assemble batch entries ──
  const entries: COTBatchAssetEntry[] = [];
  const succeededSymbols = new Set(latestResult.data.map(r => r.asset));
  const failedSymbols = COT_AVAILABLE_SYMBOLS.filter(s => !succeededSymbols.has(s));

  for (const row of latestResult.data) {
    // Compute percentile: prefer live history, fall back to 50 (Neutral)
    const assetHistory = percentileResult.data.get(row.asset);
    let percentileValue: number;
    let isLive = false;
    let historyDepth = 0;

    if (assetHistory && assetHistory.length > 10) {
      percentileValue = calculatePercentileFromHistory(
        row.netPosition,
        assetHistory,
        percWindow
      );
      isLive = true;
      historyDepth = assetHistory.length;
    } else {
      percentileValue = calculatePercentile(row.asset, row.netPosition, percWindow, internalTraderType);
    }

    const label = getPercentileLabel(percentileValue);

    entries.push({
      symbol: row.asset,
      futuresCode: getFuturesCode(row.asset),
      cftcMarketName: getCFTCMarketName(row.asset),
      latest: {
        longContracts: row.longContracts,
        shortContracts: row.shortContracts,
        netPosition: row.netPosition,
        longPct: row.longPct,
        shortPct: row.shortPct,
        netChangePct: row.netChangePct,
        deltaLong: row.deltaLong,
        deltaShort: row.deltaShort,
        openInterest: parseOIString(row.openInterest),
        openInterestFormatted: row.openInterest,
        deltaOI: row.deltaOI,
      },
      percentile: {
        value: percentileValue,
        label,
        labelColor: getPercentileLabelColor(label),
        labelBackgroundColor: getPercentileLabelBackgroundColor(label),
        window: percWindow,
        interpretation: getPercentileInterpretation(percentileValue, internalTraderType, percWindow),
        historyDepth,
        isLive,
      },
    });
  }

  const response: COTBatchApiResponse = {
    ok: true,
    meta: {
      traderType,
      traderTypeDisplay: traderTypeDisplayName(traderType),
      window: windowParam_,
      reportDate: latestResult.reportDate,
      source: latestResult.source === 'live' && percentileResult.successCount === percentileResult.totalCount
        ? 'live'
        : latestResult.source === 'error'
          ? 'error'
          : 'partial',
      fetchedAt,
      cachedUntil: cacheExpiry(),
      totalSymbols: COT_AVAILABLE_SYMBOLS.length,
      successCount: latestResult.data.length,
      failedSymbols,
    },
    data: entries,
  };

  // ── Cache successful response ──
  apiCache.set(batchCacheKey, response);

  return response;
}


/**
 * REFRESH CACHE — Clear all cached data across both layers
 *
 * Equivalent to: POST /api/cot/refresh
 * Clears both the data-level cache (raw CFTC data) and the API-level cache
 * (normalized response envelopes). Returns count of cleared entries.
 */
export function refreshCOTCache(): { ok: boolean; dataCleared: number; apiCleared: number } {
  const { dataCleared, apiCleared } = clearAllCOTCaches();
  return { ok: true, dataCleared, apiCleared };
}


/**
 * GET CACHE STATUS — Introspect both cache layers
 *
 * Returns comprehensive metadata about all cached entries, including
 * per-entry TTL status, age, and validity. Used by the UI to display
 * cache health indicators.
 */
export function getCOTCacheStatus(): {
  data: CacheStatus;
  api: CacheStatus;
  totalValid: number;
  totalEntries: number;
  lastClearedAt: number | null;
} {
  return getCombinedCacheStatus();
}


/**
 * INTROSPECT — Get service status and symbol mapping info
 *
 * Equivalent to: GET /api/cot/status
 */
export function getCOTServiceStatus(): {
  supportedSymbols: Array<{ symbol: string; futuresCode: string; cftcMarketName: string }>;
  cacheStatus: ReturnType<typeof getCOTCacheStatus>;
  availableTraderTypes: COTTraderTypeParam[];
  availableWindows: COTWindowParam[];
} {
  return {
    supportedSymbols: COT_AVAILABLE_SYMBOLS.map(s => ({
      symbol: s,
      futuresCode: getFuturesCode(s),
      cftcMarketName: getCFTCMarketName(s),
    })),
    cacheStatus: getCOTCacheStatus(),
    availableTraderTypes: ['nonCommercial', 'commercial', 'retail', 'all'],
    availableWindows: [52, 156],
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function emptyLatest(): COTLatestData {
  return {
    longContracts: 0,
    shortContracts: 0,
    netPosition: 0,
    longPct: 50,
    shortPct: 50,
    netChangePct: 0,
    deltaLong: 0,
    deltaShort: 0,
    openInterest: 0,
    openInterestFormatted: '-',
    deltaOI: 0,
  };
}

function emptyPercentile(window: PercentileWindow): COTPercentileData {
  return {
    value: 50,
    label: 'Neutral',
    labelColor: '#6F7A90',
    labelBackgroundColor: 'rgba(111, 122, 144, 0.15)',
    window,
    interpretation: 'No data available for percentile computation.',
    historyDepth: 0,
    isLive: false,
  };
}

/** Parse formatted OI string back to number (e.g. '534K' → 534000) */
function parseOIString(formatted: string): number {
  if (!formatted || formatted === '-') return 0;
  const clean = formatted.trim().toUpperCase();
  if (clean.endsWith('M')) return Math.round(parseFloat(clean) * 1_000_000);
  if (clean.endsWith('K')) return Math.round(parseFloat(clean) * 1_000);
  return parseInt(clean, 10) || 0;
}
