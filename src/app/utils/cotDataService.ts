// NYX Unified API DATA SERVICE
// Connects the TradePilot frontend directly to the NYX Python Backend (Port 3345)
//
// ARCHITECTURE:
// 1. Replaces Supabase proxy with local FastAPI endpoints
// 2. Maps TradePilot symbols to NYX-supported tickers
// 3. Normalizes NYX responses to fit existing UI components

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

export { CFTC_MARKET_PATTERNS, COT_AVAILABLE_SYMBOLS };

// NYX Backend Base URL (Port 3345)
// Using window.location.hostname to support both local and tunneled access
const NYX_API_BASE = `http://${window.location.hostname}:3345/api`;

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
}

type TraderType = 'Non-Commercials' | 'Commercials' | 'Retail' | 'All';

function extractTraderPositions(row: CFTCRawRow, traderType: TraderType) {
  const parse = (val: string | undefined) => parseInt(val || '0', 10) || 0;
  // Note: NYX Backend current implementation simplifies this to Non-Commercials for the mock batch
  // In a full implementation, the backend should handle the traderType filtering
  return {
    longContracts: parse(row.noncomm_positions_long_all),
    shortContracts: parse(row.noncomm_positions_short_all),
    deltaLong: parse(row.change_in_noncomm_long_all),
    deltaShort: parse(row.change_in_noncomm_short_all),
  };
}

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
  reportDate: string;
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

function formatCFTCDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatOI(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return value.toString();
}

/**
 * NYX BACKEND INTEGRATION: Fetch History
 */
export async function fetchAssetHistory(
  spotSymbol: string,
  traderType: TraderType,
  weeks: number = 156
): Promise<{ data: COTWeeklyRowLive[]; source: 'live' | 'error' }> {
  const cacheKey = buildHistoryCacheKey(spotSymbol, traderType, weeks);
  const cached = dataCache.get<COTWeeklyRowLive[]>(cacheKey);
  if (cached) return { data: cached, source: 'live' };

  try {
    const response = await fetch(`${NYX_API_BASE}/cftc/history?symbol=${encodeURIComponent(spotSymbol)}&limit=${weeks}`);
    if (!response.ok) throw new Error(`NYX API error: ${response.status}`);
    
    const json = await response.json();
    if (!json.ok || !json.data) return { data: [], source: 'error' };

    const rawRows: CFTCRawRow[] = json.data;
    const rows: COTWeeklyRowLive[] = rawRows.map((raw, index) => {
      const pos = extractTraderPositions(raw, traderType);
      const total = pos.longContracts + pos.shortContracts;
      const netPosition = pos.longContracts - pos.shortContracts;

      let netChangePct = 0;
      if (index < rawRows.length - 1) {
        const prevPos = extractTraderPositions(rawRows[index + 1], traderType);
        const prevNet = prevPos.longContracts - prevPos.shortContracts;
        if (prevNet !== 0) netChangePct = ((netPosition - prevNet) / Math.abs(prevNet)) * 100;
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

    dataCache.set(cacheKey, rows);
    return { data: rows, source: 'live' };
  } catch (err) {
    console.error(`[NYX Service] History failed:`, err);
    return { data: [], source: 'error' };
  }
}

/**
 * NYX BACKEND INTEGRATION: Batch Latest
 */
export async function fetchAllAssetsLatest(
  traderType: TraderType
): Promise<{ data: COTLatestRowLive[]; source: 'live' | 'partial' | 'error'; reportDate: string }> {
  const cacheKey = buildAllAssetsCacheKey(traderType);
  const cached = dataCache.get<{ data: COTLatestRowLive[]; reportDate: string }>(cacheKey);
  if (cached) return { ...cached, source: 'live' };

  try {
    const response = await fetch(`${NYX_API_BASE}/cftc/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traderType }),
    });

    if (!response.ok) throw new Error(`NYX API error: ${response.status}`);
    const json = await response.json();
    if (!json.ok || !json.results) throw new Error('Invalid NYX response');

    const batchResults: Record<string, CFTCRawRow[]> = json.results;
    const results: COTLatestRowLive[] = [];
    let latestReportDate = '';

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
        if (prevNet !== 0) netChangePct = ((netPosition - prevNet) / Math.abs(prevNet)) * 100;
      }

      const reportDate = formatCFTCDate(currentRaw.report_date_as_yyyy_mm_dd);
      if (!latestReportDate || new Date(currentRaw.report_date_as_yyyy_mm_dd) > new Date(latestReportDate)) {
        latestReportDate = currentRaw.report_date_as_yyyy_mm_dd;
      }

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

    const formattedReportDate = latestReportDate ? formatCFTCDate(latestReportDate) : '';
    const cacheData = { data: results, reportDate: formattedReportDate };
    dataCache.set(cacheKey, cacheData);

    return { data: results, source: 'live', reportDate: formattedReportDate };
  } catch (err) {
    console.error(`[NYX Service] Batch failed:`, err);
    return { data: [], source: 'error', reportDate: '' };
  }
}

export async function fetchNetPositionsForPercentile(symbol: string, type: TraderType, w: number = 156) {
  const res = await fetchAssetHistory(symbol, type, w);
  return res.data.map(r => r.netPosition);
}

export async function fetchAllAssetsPercentileHistories(traderType: TraderType, weeks: number = 156) {
  const result = new Map<string, number[]>();
  let successCount = 0;
  
  await Promise.allSettled(COT_AVAILABLE_SYMBOLS.map(async (symbol) => {
    const hist = await fetchAssetHistory(symbol, traderType, weeks);
    if (hist.data.length > 0) {
      result.set(symbol, hist.data.map(r => r.netPosition));
      successCount++;
    }
  }));

  return { data: result, successCount, totalCount: COT_AVAILABLE_SYMBOLS.length };
}

export function clearCache() { dataCache.clearAll(); }
