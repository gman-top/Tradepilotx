// CFTC SODA API DATA SERVICE — via Supabase Edge Function Proxy
// Fetches live Commitments of Traders data from the CFTC's public Socrata Open Data API
// Dataset: Legacy Futures Only (6dca-aqww)
//
// ARCHITECTURE:
// 1. Symbol mappings imported from cotMappings.ts (single source of truth)
// 2. Fetches raw CFTC data via Supabase Edge Function proxy (bypasses CORS)
// 3. Transforms to existing COTLatestRow / COTWeeklyRow interfaces
// 4. Caches in memory (data only updates weekly)
// 5. Falls back gracefully with empty data on failure
//
// PROXY ROUTES (server-side, no CORS issues):
//   POST /make-server-d198f9ee/cftc/batch   — batch all symbols (All Assets view)
//   GET  /make-server-d198f9ee/cftc/history  — single symbol history (Symbol view)

import {
  CFTC_MARKET_PATTERNS,
  COT_AVAILABLE_SYMBOLS,
} from './cotMappings';

import {
  dataCache,
  buildHistoryCacheKey,
  buildAllAssetsCacheKey,
  buildPercentilesCacheKey,
} from './cotCache';

import { projectId, publicAnonKey } from '/utils/supabase/info';

// Re-export so existing consumers don't break
export { CFTC_MARKET_PATTERNS, COT_AVAILABLE_SYMBOLS };

// ─── Proxy Base URL ──────────────────────────────────────────────────────────
const PROXY_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-d198f9ee/cftc`;

// ─── Raw CFTC API Response Type ──────────────────────────────────────────────
export interface CFTCRawRow {
  market_and_exchange_names: string;
  report_date_as_yyyy_mm_dd: string;
  open_interest_all: string;
  noncomm_positions_long_all: string;
  noncomm_positions_short_all: string;
  noncomm_positions_spreading_all: string;
  comm_positions_long_all: string;
  comm_positions_short_all: string;
  nonrept_positions_long_all: string;
  nonrept_positions_short_all: string;
  change_in_open_interest_all: string;
  change_in_noncomm_long_all: string;
  change_in_noncomm_short_all: string;
  change_in_comm_long_all: string;
  change_in_comm_short_all: string;
  change_in_nonrept_long_all: string;
  change_in_nonrept_short_all: string;
  // Percentage of OI fields (useful for validation)
  pct_of_oi_noncomm_long_all?: string;
  pct_of_oi_noncomm_short_all?: string;
  pct_of_oi_comm_long_all?: string;
  pct_of_oi_comm_short_all?: string;
  pct_of_oi_nonrept_long_all?: string;
  pct_of_oi_nonrept_short_all?: string;
}

// ─── Trader Type Extraction ──────────────────────────────────────────────────
type TraderType = 'Non-Commercials' | 'Commercials' | 'Retail' | 'All';

interface TraderPositions {
  longContracts: number;
  shortContracts: number;
  deltaLong: number;
  deltaShort: number;
}

function extractTraderPositions(row: CFTCRawRow, traderType: TraderType): TraderPositions {
  const parse = (val: string | undefined) => parseInt(val || '0', 10) || 0;

  switch (traderType) {
    case 'Non-Commercials':
      return {
        longContracts: parse(row.noncomm_positions_long_all),
        shortContracts: parse(row.noncomm_positions_short_all),
        deltaLong: parse(row.change_in_noncomm_long_all),
        deltaShort: parse(row.change_in_noncomm_short_all),
      };
    case 'Commercials':
      return {
        longContracts: parse(row.comm_positions_long_all),
        shortContracts: parse(row.comm_positions_short_all),
        deltaLong: parse(row.change_in_comm_long_all),
        deltaShort: parse(row.change_in_comm_short_all),
      };
    case 'Retail':
      return {
        longContracts: parse(row.nonrept_positions_long_all),
        shortContracts: parse(row.nonrept_positions_short_all),
        deltaLong: parse(row.change_in_nonrept_long_all),
        deltaShort: parse(row.change_in_nonrept_short_all),
      };
    case 'All': {
      const nc = extractTraderPositions(row, 'Non-Commercials');
      const cm = extractTraderPositions(row, 'Commercials');
      const rt = extractTraderPositions(row, 'Retail');
      return {
        longContracts: nc.longContracts + cm.longContracts + rt.longContracts,
        shortContracts: nc.shortContracts + cm.shortContracts + rt.shortContracts,
        deltaLong: nc.deltaLong + cm.deltaLong + rt.deltaLong,
        deltaShort: nc.deltaShort + cm.deltaShort + rt.deltaShort,
      };
    }
  }
}

// ─── COT Output Interfaces (match existing component) ───────────────────────
export interface COTLatestRowLive {
  asset: string;
  netChangePct: number;
  longContracts: number;
  shortContracts: number;
  deltaLong: number;
  deltaShort: number;
  longPct: number;
  shortPct: number;
  netPosition: number;
  starred: boolean;
  openInterest: string;
  deltaOI: number;
  reportDate: string; // ISO date string from CFTC
}

export interface COTWeeklyRowLive {
  date: string;
  netChangePct: number;
  longContracts: number;
  shortContracts: number;
  deltaLong: number;
  deltaShort: number;
  longPct: number;
  shortPct: number;
  netPosition: number;
}

// ─── Date Formatting ─────────────────────────────────────────────────────────
function formatCFTCDate(isoDate: string): string {
  // CFTC returns "2026-02-03T00:00:00.000" → "Feb 3, 2026"
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatOI(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return value.toString();
}

// ─── PROXY FETCH HELPERS ─────────────────────────────────────────────────────

/** Standard headers for all proxy requests */
function proxyHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
    'apikey': publicAnonKey,
  };
}

// ─── CORE FETCH FUNCTIONS ────────────────────────────────────────────────────

/**
 * Fetch historical COT data for a single asset (Symbol View)
 * Routes through Supabase Edge Function → CFTC SODA API
 * Returns up to 156 weeks (3 years) of weekly data for the given symbol
 */
export async function fetchAssetHistory(
  spotSymbol: string,
  traderType: TraderType,
  weeks: number = 156
): Promise<{ data: COTWeeklyRowLive[]; source: 'live' | 'error' }> {
  const cacheKey = buildHistoryCacheKey(spotSymbol, traderType, weeks);
  const cached = dataCache.get<COTWeeklyRowLive[]>(cacheKey);
  if (cached) return { data: cached, source: 'live' };

  const pattern = CFTC_MARKET_PATTERNS[spotSymbol];
  if (!pattern) return { data: [], source: 'error' };

  try {
    const url = `${PROXY_BASE}/history?symbol=${encodeURIComponent(spotSymbol)}&pattern=${encodeURIComponent(pattern)}&limit=${weeks}`;

    console.log(`[COT Service] Fetching history for ${spotSymbol} via proxy...`);

    const response = await fetch(url, {
      headers: proxyHeaders(),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Proxy returned ${response.status}: ${text}`);
    }

    const json = await response.json();

    if (!json.ok || !json.data || json.data.length === 0) {
      console.warn(`[COT Service] Proxy returned no data for ${spotSymbol}`);
      return { data: [], source: 'error' };
    }

    const rawRows: CFTCRawRow[] = json.data;

    // Transform to COTWeeklyRowLive
    const rows: COTWeeklyRowLive[] = rawRows.map((raw, index) => {
      const pos = extractTraderPositions(raw, traderType);
      const total = pos.longContracts + pos.shortContracts;
      const netPosition = pos.longContracts - pos.shortContracts;

      // Calculate netChangePct using the NEXT row (previous week) as baseline
      let netChangePct = 0;
      if (index < rawRows.length - 1) {
        const prevPos = extractTraderPositions(rawRows[index + 1], traderType);
        const prevNet = prevPos.longContracts - prevPos.shortContracts;
        if (prevNet !== 0) {
          netChangePct = ((netPosition - prevNet) / Math.abs(prevNet)) * 100;
        }
      }

      return {
        date: formatCFTCDate(raw.report_date_as_yyyy_mm_dd),
        netChangePct: Math.round(netChangePct * 100) / 100,
        longContracts: pos.longContracts,
        shortContracts: pos.shortContracts,
        deltaLong: pos.deltaLong,
        deltaShort: pos.deltaShort,
        longPct: total > 0 ? Math.round((pos.longContracts / total) * 10000) / 100 : 50,
        shortPct: total > 0 ? Math.round((pos.shortContracts / total) * 10000) / 100 : 50,
        netPosition,
      };
    });

    console.log(`[COT Service] History for ${spotSymbol}: ${rows.length} weeks fetched LIVE`);

    dataCache.set(cacheKey, rows);
    return { data: rows, source: 'live' };
  } catch (err) {
    console.warn(`[COT Service] Failed to fetch history for ${spotSymbol}:`, err);
    return { data: [], source: 'error' };
  }
}

/**
 * Fetch latest COT data for ALL tracked assets (All Assets View)
 * Uses the batch proxy endpoint — ONE request from browser, 19 from server to CFTC
 */
export async function fetchAllAssetsLatest(
  traderType: TraderType
): Promise<{ data: COTLatestRowLive[]; source: 'live' | 'partial' | 'error'; reportDate: string }> {
  const cacheKey = buildAllAssetsCacheKey(traderType);
  const cached = dataCache.get<{ data: COTLatestRowLive[]; reportDate: string }>(cacheKey);
  if (cached) return { ...cached, source: 'live' };

  try {
    // Build symbols array for batch request
    const symbols = COT_AVAILABLE_SYMBOLS.map(symbol => ({
      symbol,
      pattern: CFTC_MARKET_PATTERNS[symbol],
    })).filter(s => s.pattern);

    console.log(`[COT Service] Batch fetch for ${symbols.length} symbols via proxy...`);

    const response = await fetch(`${PROXY_BASE}/batch`, {
      method: 'POST',
      headers: proxyHeaders(),
      body: JSON.stringify({ symbols, limit: 2 }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Batch proxy returned ${response.status}: ${text}`);
    }

    const json = await response.json();

    if (!json.ok || !json.results) {
      throw new Error(json.error || 'Batch proxy returned invalid response');
    }

    const batchResults: Record<string, CFTCRawRow[]> = json.results;

    const results: COTLatestRowLive[] = [];
    let latestReportDate = '';
    let successCount = 0;

    for (const symbol of COT_AVAILABLE_SYMBOLS) {
      const rawRows = batchResults[symbol];
      if (!rawRows || rawRows.length === 0) continue;

      const currentRaw = rawRows[0];
      const pos = extractTraderPositions(currentRaw, traderType);
      const total = pos.longContracts + pos.shortContracts;
      const netPosition = pos.longContracts - pos.shortContracts;
      const oi = parseInt(currentRaw.open_interest_all || '0', 10);
      const deltaOI = parseInt(currentRaw.change_in_open_interest_all || '0', 10);

      // Calculate netChangePct
      let netChangePct = 0;
      if (rawRows.length > 1) {
        const prevPos = extractTraderPositions(rawRows[1], traderType);
        const prevNet = prevPos.longContracts - prevPos.shortContracts;
        if (prevNet !== 0) {
          netChangePct = ((netPosition - prevNet) / Math.abs(prevNet)) * 100;
        }
      }

      // Track latest report date
      const reportDate = formatCFTCDate(currentRaw.report_date_as_yyyy_mm_dd);
      if (!latestReportDate || new Date(currentRaw.report_date_as_yyyy_mm_dd) > new Date(latestReportDate)) {
        latestReportDate = currentRaw.report_date_as_yyyy_mm_dd;
      }

      successCount++;

      results.push({
        asset: symbol,
        netChangePct: Math.round(netChangePct * 100) / 100,
        longContracts: pos.longContracts,
        shortContracts: pos.shortContracts,
        deltaLong: pos.deltaLong,
        deltaShort: pos.deltaShort,
        longPct: total > 0 ? Math.round((pos.longContracts / total) * 10000) / 100 : 50,
        shortPct: total > 0 ? Math.round((pos.shortContracts / total) * 10000) / 100 : 50,
        netPosition,
        starred: false,
        openInterest: formatOI(oi),
        deltaOI,
        reportDate,
      });
    }

    console.log(`[COT Service] Batch complete: ${successCount}/${COT_AVAILABLE_SYMBOLS.length} symbols fetched LIVE`);

    if (results.length === 0) {
      return { data: [], source: 'error', reportDate: '' };
    }

    const formattedReportDate = latestReportDate ? formatCFTCDate(latestReportDate) : '';
    const cacheData = { data: results, reportDate: formattedReportDate };
    dataCache.set(cacheKey, cacheData);

    return {
      data: results,
      source: successCount === COT_AVAILABLE_SYMBOLS.length ? 'live' : 'partial',
      reportDate: formattedReportDate,
    };
  } catch (err) {
    console.error(`[COT Service] Batch fetch failed:`, err);
    return { data: [], source: 'error', reportDate: '' };
  }
}

/**
 * Fetch net positions history for percentile calculation
 * Returns just the net positions as numbers for the given window
 */
export async function fetchNetPositionsForPercentile(
  spotSymbol: string,
  traderType: TraderType,
  weeks: number = 156
): Promise<number[]> {
  const result = await fetchAssetHistory(spotSymbol, traderType, weeks);
  if (result.source === 'error' || result.data.length === 0) return [];
  return result.data.map((row) => row.netPosition);
}

/**
 * Clear all cached data (useful when user manually refreshes)
 */
export function clearCache(): void {
  dataCache.clearAll();
}

/**
 * Get cache stats for debugging
 */
export function getCacheStats(): { entries: number; symbols: string[] } {
  return {
    entries: dataCache.size,
    symbols: Array.from(dataCache.keys()),
  };
}

// ─── BATCH PERCENTILE HISTORY ────────────────────────────────────────────────
// Fetches historical net positions for ALL tracked assets in parallel.
// Used by the All Assets view to compute LIVE percentiles instead of mock.
// Returns a Map<symbol, number[]> where number[] is desc-sorted net positions.

export async function fetchAllAssetsPercentileHistories(
  traderType: TraderType,
  weeks: number = 156
): Promise<{ data: Map<string, number[]>; successCount: number; totalCount: number }> {
  const cacheKey = buildPercentilesCacheKey(traderType, weeks);
  const cached = dataCache.get<Map<string, number[]>>(cacheKey);
  if (cached) return { data: cached, successCount: cached.size, totalCount: COT_AVAILABLE_SYMBOLS.length };

  const result = new Map<string, number[]>();
  let successCount = 0;

  // Fetch histories in parallel (each goes through the proxy)
  const fetchPromises = COT_AVAILABLE_SYMBOLS.map(async (symbol) => {
    try {
      const histResult = await fetchAssetHistory(symbol, traderType, weeks);
      if (histResult.data.length > 0) {
        const netPositions = histResult.data.map(r => r.netPosition);
        result.set(symbol, netPositions);
        successCount++;
      }
    } catch {
      // Individual failures are fine — we'll use fallback for that symbol
    }
  });

  await Promise.allSettled(fetchPromises);

  if (result.size > 0) {
    dataCache.set(cacheKey, result);
  }

  return { data: result, successCount, totalCount: COT_AVAILABLE_SYMBOLS.length };
}