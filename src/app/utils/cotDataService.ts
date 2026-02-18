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

// CLOUDFLARE LIVE TUNNEL (Real Data)
const NYX_API_BASE = "https://associated-awards-entries-asset.trycloudflare.com/api/v1";

export interface CFTCRawRow {
  symbol: string;
  price: number;
  bias: string;
  score: number;
  breakdown: {
    technical: { score: number; status: string };
    institutional: { score: number; net_long: number };
    retail: { score: number; long_pct: number };
  };
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

export async function fetchAllAssetsLatest(
  traderType: TraderType
): Promise<{ data: COTLatestRowLive[]; source: 'live' | 'partial' | 'error'; reportDate: string }> {
  try {
    const response = await fetch(`${NYX_API_BASE}/market`);
    if (!response.ok) throw new Error(`NYX API error: ${response.status}`);
    const data: CFTCRawRow[] = await response.json();

    const results: COTLatestRowLive[] = data.map(asset => ({
      asset: asset.symbol,
      netChangePct: asset.score, // Folosim scorul ca indicator de trend
      longContracts: Math.round(asset.breakdown.institutional.net_long * 1000),
      shortContracts: Math.round((100 - asset.breakdown.institutional.net_long) * 1000),
      deltaLong: 0,
      deltaShort: 0,
      longPct: asset.breakdown.institutional.net_long,
      shortPct: 100 - asset.breakdown.institutional.net_long,
      netPosition: asset.score,
      starred: false,
      openInterest: "LIVE",
      deltaOI: 0,
      reportDate: new Date().toLocaleDateString(),
    }));

    return { data: results, source: 'live', reportDate: new Date().toLocaleDateString() };
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
