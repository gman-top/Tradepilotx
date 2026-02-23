// CFTC SODA API DATA SERVICE — Direct browser → CFTC (no proxy needed)
// Fetches live Commitments of Traders data from the CFTC's public Socrata Open Data API
// Dataset: Legacy Futures Only (6dca-aqww)
//
// ARCHITECTURE:
// 1. Symbol mappings imported from cotMappings.ts (single source of truth)
// 2. Fetches raw CFTC data DIRECTLY from CFTC SODA API (supports CORS)
// 3. Transforms to existing COTLatestRow / COTWeeklyRow interfaces
// 4. Caches in memory (data only updates weekly)
// 5. Falls back gracefully with empty data on failure
//
// NOTE: The Supabase Edge Function proxy was removed — CFTC SODA API
// supports CORS (Access-Control-Allow-Origin: *) so we call it directly.
// Direct URL: https://publicreporting.cftc.gov/resource/6dca-aqww.json

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

// Re-export so existing consumers don't break
export { CFTC_MARKET_PATTERNS, COT_AVAILABLE_SYMBOLS };

// ─── Direct CFTC SODA API URL ────────────────────────────────────────────────
const CFTC_SODA_URL = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';

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

// ─── DIRECT CFTC FETCH HELPERS ───────────────────────────────────────────────

function escapeSoQL(val: string): string {
  return val.replace(/'/g, "''");
}

function buildCFTCUrl(pattern: string, limit: number): string {
  const url = new URL(CFTC_SODA_URL);
  url.searchParams.set('$where', `market_and_exchange_names like '${escapeSoQL(pattern)}'`);
  url.searchParams.set('$order', 'report_date_as_yyyy_mm_dd DESC');
  url.searchParams.set('$limit', String(limit));
  return url.toString();
}

async function fetchCFTCDirect(pattern: string, limit: number): Promise<CFTCRawRow[]> {
  const url = buildCFTCUrl(pattern, limit);
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CFTC ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── CORE FETCH FUNCTIONS ────────────────────────────────────────────────────

/**
 * Fetch historical COT data for a single asset (Symbol View)
 * Calls CFTC SODA API directly — supports CORS, no proxy needed.
 * Returns up to 156 weeks (3 years) of weekly data for the given symbol.
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
    console.log(`[COT Service] Fetching history for ${spotSymbol} direct from CFTC...`);

    const rawRows = await fetchCFTCDirect(pattern, weeks);

    if (!rawRows || rawRows.length === 0) {
      console.warn(`[COT Service] No data from CFTC for ${spotSymbol}`);
      return { data: [], source: 'error' };
    }

    // Transform to COTWeeklyRowLive
    const rows: COTWeeklyRowLive[] = rawRows.map((raw, index) => {
      const pos = extractTraderPositions(raw, traderType);
      const total = pos.longContracts + pos.shortContracts;
      const netPosition = pos.longContracts - pos.shortContracts;

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

    console.log(`[COT Service] History for ${spotSymbol}: ${rows.length} weeks fetched LIVE from CFTC`);

    dataCache.set(cacheKey, rows);
    return { data: rows, source: 'live' };
  } catch (err) {
    console.warn(`[COT Service] Failed to fetch history for ${spotSymbol}:`, err);
    return { data: [], source: 'error' };
  }
}

/**
 * Fetch latest COT data for ALL tracked assets (All Assets View)
 * Calls CFTC API directly in parallel — no proxy needed.
 * CORS is supported by CFTC SODA API (government open data).
 */
export async function fetchAllAssetsLatest(
  traderType: TraderType
): Promise<{ data: COTLatestRowLive[]; source: 'live' | 'partial' | 'error'; reportDate: string }> {
  const cacheKey = buildAllAssetsCacheKey(traderType);
  const cached = dataCache.get<{ data: COTLatestRowLive[]; reportDate: string }>(cacheKey);
  if (cached) return { ...cached, source: 'live' };

  try {
    console.log(`[COT Service] Batch fetch for ${COT_AVAILABLE_SYMBOLS.length} symbols direct from CFTC...`);

    const batchResults: Record<string, CFTCRawRow[]> = {};
    const errors: string[] = [];

    // Fetch all symbols in parallel (6 at a time to be respectful)
    const batchSize = 6;
    const symbols = COT_AVAILABLE_SYMBOLS.filter(s => CFTC_MARKET_PATTERNS[s]);

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (symbol) => {
          try {
            const pattern = CFTC_MARKET_PATTERNS[symbol];
            const rows = await fetchCFTCDirect(pattern, 2);
            batchResults[symbol] = rows || [];
          } catch (err) {
            errors.push(symbol);
            batchResults[symbol] = [];
          }
        })
      );
      // Small delay between batches
      if (i + batchSize < symbols.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

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

      let netChangePct = 0;
      if (rawRows.length > 1) {
        const prevPos = extractTraderPositions(rawRows[1], traderType);
        const prevNet = prevPos.longContracts - prevPos.shortContracts;
        if (prevNet !== 0) {
          netChangePct = ((netPosition - prevNet) / Math.abs(prevNet)) * 100;
        }
      }

      const reportDateRaw = currentRaw.report_date_as_yyyy_mm_dd;
      if (!latestReportDate || new Date(reportDateRaw) > new Date(latestReportDate)) {
        latestReportDate = reportDateRaw;
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
        reportDate: formatCFTCDate(reportDateRaw),
      });
    }

    console.log(`[COT Service] Batch complete: ${successCount}/${COT_AVAILABLE_SYMBOLS.length} symbols fetched LIVE from CFTC`);

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