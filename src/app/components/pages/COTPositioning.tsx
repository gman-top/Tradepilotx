import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Legend } from 'recharts';
import { AlertCircle, CheckCircle, Star, Filter, ArrowUpDown, ChevronDown, HelpCircle, Bell, Wifi, WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import {
  calculatePercentile,
  calculatePercentileFromHistory,
  getPercentileLabel,
  getPercentileLabelColor,
  getPercentileLabelBackgroundColor,
  getCOTAlignmentState,
  getPercentileInterpretation,
  formatPercentile,
  type PercentileWindow,
} from '../../utils/percentileEngine';
import {
  fetchAllAssetsLatest,
  fetchAssetHistory,
  fetchAllAssetsPercentileHistories,
  COT_AVAILABLE_SYMBOLS,
  type COTLatestRowLive,
  type COTWeeklyRowLive,
} from '../../utils/cotDataService';
import {
  refreshCOTCache,
} from '../../utils/cotApiService';
import {
  getFuturesCode as mappingGetFuturesCode,
  getCFTCMarketName as mappingGetCFTCMarketName,
  getContractName,
  getExchange,
  getAssetClass,
  isSymbolSupported as mappingIsSymbolSupported,
  COT_SYMBOL_MAPPINGS,
} from '../../utils/cotMappings';

// ─── DATA SOURCE STATE ─────────────────────────────────────────────────────
type DataSource = 'live' | 'partial' | 'mock' | 'loading' | 'error';

// GLOBAL COT DATA TIMING RULES
const LATEST_COT_RELEASE_DATE = 'Feb 3, 2026';
const LATEST_COT_UPDATE_TIMESTAMP = 'Feb 3, 2026, 3:30:47 PM';
const COT_UPDATE_INTERVAL = 'Weekly (CFTC, checks every 12h)';

const getFuturesSource = (spotSymbol: string): string => {
  const code = mappingGetFuturesCode(spotSymbol);
  return code === 'N/A' ? 'Not Available' : code;
};

const hasCOTData = (spotSymbol: string): boolean => {
  return mappingIsSymbolSupported(spotSymbol);
};

type TraderType = 'Non-Commercials' | 'Commercials' | 'Retail' | 'All';

interface COTAssetData {
  asset: string;
  longPct: number;
  shortPct: number;
  starred: boolean;
  percentile: number;
  macroBias: 'Bullish' | 'Bearish' | 'Neutral';
  cotAlignment: 'Confirms' | 'Conflicts' | 'Neutral';
  positioningExtreme: boolean;
  crowdedJustified: boolean;
}

interface COTWeeklyRow {
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

interface COTLatestRow {
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
  reportDate?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEATMAP GRADIENT ENGINE
// ═══════════════════════════════════════════════════════════════════════════════
// Vivid institutional gradients matching Bloomberg/hedge-fund style
// Blue → Long/Bullish | Red → Short/Bearish | Neutral → transparent
//
// The key difference: use saturated, vivid colors that pop against #131722 bg.
// Reference palette:
//   Deep blue:  #1E3A7A → #2D52A8 → #4070D0
//   Deep red:   #7A1E1E → #A82D2D → #D04848
//   Background: #131722 (neutral charcoal, no blue bias)

function getHeatBg(
  value: number,
  absMax: number,
  type: 'diverging' | 'long_abs' | 'short_abs' | 'long_pct' | 'short_pct'
): string {
  if (absMax === 0 || value === 0) return 'transparent';

  if (type === 'long_pct') {
    // 0–100 scale: >50 = blue, <50 = towards red
    const deviation = (value - 50) / 50; // -1 to 1
    const t = Math.pow(Math.abs(deviation), 0.8) * 0.75;
    if (t < 0.04) return 'transparent';
    if (deviation > 0) {
      // Blue
      const r = Math.round(19 - 19 * t + 30 * t);
      const g = Math.round(23 - 23 * t + 58 * t);
      const b = Math.round(34 + 88 * t);
      return `rgb(${r}, ${g}, ${b})`;
    }
    // Red
    const r = Math.round(19 + 103 * t);
    const g = Math.round(23 - 14 * t);
    const b = Math.round(34 - 4 * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  if (type === 'short_pct') {
    // Inverse: >50 = red, <50 = blue
    const deviation = (value - 50) / 50;
    const t = Math.pow(Math.abs(deviation), 0.8) * 0.75;
    if (t < 0.04) return 'transparent';
    if (deviation > 0) {
      // Red (high short %)
      const r = Math.round(19 + 103 * t);
      const g = Math.round(23 - 14 * t);
      const b = Math.round(34 - 4 * t);
      return `rgb(${r}, ${g}, ${b})`;
    }
    // Blue (low short %)
    const r = Math.round(19 - 19 * t + 30 * t);
    const g = Math.round(23 - 23 * t + 58 * t);
    const b = Math.round(34 + 88 * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  if (type === 'long_abs') {
    const t = Math.pow(Math.min(value / absMax, 1), 0.7) * 0.65;
    if (t < 0.04) return 'transparent';
    const r = Math.round(19 - 19 * t + 35 * t);
    const g = Math.round(23 - 23 * t + 60 * t);
    const b = Math.round(34 + 95 * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  if (type === 'short_abs') {
    const t = Math.pow(Math.min(value / absMax, 1), 0.7) * 0.65;
    if (t < 0.04) return 'transparent';
    const r = Math.round(19 + 103 * t);
    const g = Math.round(23 - 14 * t);
    const b = Math.round(34 - 4 * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Diverging: positive → blue, negative → red
  const normalized = Math.min(Math.abs(value) / absMax, 1);
  const t = Math.pow(normalized, 0.7) * 0.75;
  if (t < 0.03) return 'transparent';

  if (value > 0) {
    const r = Math.round(19 - 19 * t + 35 * t);
    const g = Math.round(23 - 23 * t + 60 * t);
    const b = Math.round(34 + 100 * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const r = Math.round(19 + 110 * t);
  const g = Math.round(23 - 14 * t);
  const b = Math.round(34 - 4 * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function getHeatText(value: number, absMax: number, type: 'diverging' | 'long_abs' | 'short_abs' | 'long_pct' | 'short_pct'): string {
  if (type === 'long_pct' || type === 'short_pct') {
    const deviation = Math.abs((value - 50) / 50);
    if (deviation < 0.1) return '#9AA1B2';
    if (type === 'long_pct') return value > 50 ? '#A0C4F0' : '#F0A0A0';
    return value > 50 ? '#F0A0A0' : '#A0C4F0';
  }
  if (type === 'long_abs' || type === 'short_abs') return '#D8DCE6';
  if (absMax === 0 || value === 0) return '#9AA1B2';
  const normalized = Math.min(Math.abs(value) / absMax, 1);
  if (normalized < 0.08) return '#9AA1B2';
  return value > 0 ? '#A0C4F0' : '#F0A0A0';
}

// Compute global max for a specific column across dataset
function getAbsMax(data: COTLatestRow[], key: keyof COTLatestRow): number {
  let max = 0;
  data.forEach(row => {
    const v = Math.abs(Number(row[key]) || 0);
    if (v > max) max = v;
  });
  return max;
}

function getAbsMaxWeekly(data: COTWeeklyRow[], key: keyof COTWeeklyRow): number {
  let max = 0;
  data.forEach(row => {
    const v = Math.abs(Number(row[key]) || 0);
    if (v > max) max = v;
  });
  return max;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function COTPositioning() {
  const [selectedAsset, setSelectedAsset] = useState<string>('All');
  const [traderType, setTraderType] = useState<TraderType>('Non-Commercials');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('netChangePct');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [percentileWindow, setPercentileWindow] = useState<PercentileWindow>('52-week');

  // ─── LIVE DATA STATE ──────────────────────────────────────────────────────
  const [dataSource, setDataSource] = useState<DataSource>('loading');
  const [liveLatestData, setLiveLatestData] = useState<COTLatestRowLive[]>([]);
  const [liveWeeklyData, setLiveWeeklyData] = useState<COTWeeklyRowLive[]>([]);
  const [liveReportDate, setLiveReportDate] = useState<string>('');
  const [liveHistoryNetPositions, setLiveHistoryNetPositions] = useState<number[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allAssetsPercentileMap, setAllAssetsPercentileMap] = useState<Map<string, number[]>>(new Map());
  const [percentilesLoading, setPercentilesLoading] = useState(false);
  const [percentilesSource, setPercentilesSource] = useState<'none' | 'loading' | 'live' | 'partial'>('none');
  const fetchCountRef = useRef(0);

  // ─── FETCH ALL ASSETS (for All Assets View) ──────────────────────────────
  const fetchAllAssets = useCallback(async () => {
    fetchCountRef.current++;
    const currentFetch = fetchCountRef.current;
    try {
      const result = await fetchAllAssetsLatest(traderType);
      if (currentFetch !== fetchCountRef.current) return;
      if (result.data.length > 0) {
        setLiveLatestData(result.data);
        setLiveReportDate(result.reportDate);
        setDataSource(result.source);
      } else {
        setDataSource('mock');
      }
    } catch {
      if (currentFetch === fetchCountRef.current) {
        setDataSource('mock');
      }
    }
  }, [traderType]);

  // ─── FETCH SINGLE ASSET HISTORY (for Symbol View) ────────────────────────
  const fetchSymbolHistory = useCallback(async (symbol: string) => {
    fetchCountRef.current++;
    const currentFetch = fetchCountRef.current;
    try {
      const result = await fetchAssetHistory(symbol, traderType, 156);
      if (currentFetch !== fetchCountRef.current) return;
      if (result.data.length > 0) {
        setLiveWeeklyData(result.data);
        setLiveHistoryNetPositions(result.data.map(r => r.netPosition));
        if (result.data[0]?.date) setLiveReportDate(result.data[0].date);
        setDataSource('live');
      } else {
        setLiveWeeklyData([]);
        setLiveHistoryNetPositions([]);
        setDataSource('mock');
      }
    } catch {
      if (currentFetch === fetchCountRef.current) {
        setLiveWeeklyData([]);
        setLiveHistoryNetPositions([]);
        setDataSource('mock');
      }
    }
  }, [traderType]);

  // ─── TRIGGER DATA FETCH ON VIEW/TRADER CHANGE ────────────────────────────
  useEffect(() => {
    setDataSource('loading');
    if (selectedAsset === 'All') {
      fetchAllAssets();
    } else {
      fetchSymbolHistory(selectedAsset);
    }
  }, [selectedAsset, traderType, fetchAllAssets, fetchSymbolHistory]);

  // ─── BACKGROUND PERCENTILE FETCH (All Assets View) ─────────────────────
  useEffect(() => {
    if (selectedAsset !== 'All') return;
    if (dataSource !== 'live' && dataSource !== 'partial') return;
    let cancelled = false;
    const loadPercentiles = async () => {
      setPercentilesLoading(true);
      setPercentilesSource('loading');
      try {
        const result = await fetchAllAssetsPercentileHistories(traderType, 156);
        if (cancelled) return;
        setAllAssetsPercentileMap(result.data);
        setPercentilesSource(result.successCount === result.totalCount ? 'live' : 'partial');
      } catch {
        if (!cancelled) setPercentilesSource('none');
      } finally {
        if (!cancelled) setPercentilesLoading(false);
      }
    };
    loadPercentiles();
    return () => { cancelled = true; };
  }, [selectedAsset, traderType, dataSource]);

  // ─── MANUAL REFRESH ──────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    refreshCOTCache();
    setDataSource('loading');
    setAllAssetsPercentileMap(new Map());
    setPercentilesSource('none');
    if (selectedAsset === 'All') {
      await fetchAllAssets();
    } else {
      await fetchSymbolHistory(selectedAsset);
    }
    setIsRefreshing(false);
  };

  const useLiveData = dataSource === 'live' || dataSource === 'partial';

  // AUTO-ADJUST SORTING BASED ON VIEW MODE
  useEffect(() => {
    if (selectedAsset !== 'All') {
      setSortColumn('date');
      setSortOrder('desc');
    } else {
      setSortColumn('netChangePct');
      setSortOrder('desc');
    }
  }, [selectedAsset]);

  // TRADER TYPE HELPERS
  const getTraderTypeLabel = (): string => {
    switch (traderType) {
      case 'Non-Commercials': return 'Non-Commercials (Hedge Funds)';
      case 'Commercials': return 'Commercials (Producers/Hedgers)';
      case 'Retail': return 'Retail (Small Specs)';
      case 'All': return 'All Traders';
      default: return traderType;
    }
  };

  const getTraderTypeContext = (): string => {
    switch (traderType) {
      case 'Non-Commercials': return 'Directional, trend-following positioning • Long build-up confirms bullish bias';
      case 'Commercials': return 'Contrarian hedgers • Extreme positioning often signals reversals';
      case 'Retail': return 'Late, reactive positioning • Extremes indicate crowded trades';
      case 'All': return 'Aggregate positioning across all trader categories';
      default: return '';
    }
  };

  const allAssets = COT_AVAILABLE_SYMBOLS;

  // ═══════════════════════════════════════════════════════════════════════════
  // MOCK DATA
  // ═══════════════════════════════════════════════════════════════════════════
  const netPositioningDataByTrader: Record<TraderType, Record<string, COTAssetData[]>> = {
    'Non-Commercials': {
      All: [
        { asset: 'CHF', longPct: 15, shortPct: 85, starred: false, percentile: 22, macroBias: 'Bearish', cotAlignment: 'Confirms', positioningExtreme: false, crowdedJustified: false },
        { asset: 'CAD', longPct: 28, shortPct: 72, starred: false, percentile: 35, macroBias: 'Bearish', cotAlignment: 'Conflicts', positioningExtreme: false, crowdedJustified: false },
        { asset: 'AUD', longPct: 42, shortPct: 58, starred: false, percentile: 48, macroBias: 'Neutral', cotAlignment: 'Neutral', positioningExtreme: false, crowdedJustified: false },
        { asset: 'NZD', longPct: 38, shortPct: 62, starred: false, percentile: 42, macroBias: 'Bearish', cotAlignment: 'Conflicts', positioningExtreme: false, crowdedJustified: false },
        { asset: 'SPX', longPct: 78, shortPct: 22, starred: false, percentile: 88, macroBias: 'Bearish', cotAlignment: 'Conflicts', positioningExtreme: true, crowdedJustified: false },
        { asset: 'NASDAQ', longPct: 82, shortPct: 18, starred: true, percentile: 92, macroBias: 'Bearish', cotAlignment: 'Conflicts', positioningExtreme: true, crowdedJustified: false },
        { asset: 'COPPER', longPct: 55, shortPct: 45, starred: false, percentile: 58, macroBias: 'Bullish', cotAlignment: 'Neutral', positioningExtreme: false, crowdedJustified: false },
        { asset: 'USD', longPct: 62, shortPct: 38, starred: false, percentile: 68, macroBias: 'Bullish', cotAlignment: 'Confirms', positioningExtreme: false, crowdedJustified: true },
        { asset: 'EUR', longPct: 48, shortPct: 52, starred: true, percentile: 52, macroBias: 'Bullish', cotAlignment: 'Conflicts', positioningExtreme: false, crowdedJustified: false },
        { asset: 'Gold', longPct: 72, shortPct: 28, starred: true, percentile: 78, macroBias: 'Bullish', cotAlignment: 'Confirms', positioningExtreme: true, crowdedJustified: true },
        { asset: 'SILVER', longPct: 68, shortPct: 32, starred: false, percentile: 72, macroBias: 'Bullish', cotAlignment: 'Confirms', positioningExtreme: false, crowdedJustified: true },
      ],
    },
    'Commercials': {
      All: [
        { asset: 'CHF', longPct: 10, shortPct: 90, starred: false, percentile: 15, macroBias: 'Bearish', cotAlignment: 'Confirms', positioningExtreme: true, crowdedJustified: false },
        { asset: 'CAD', longPct: 15, shortPct: 85, starred: false, percentile: 22, macroBias: 'Bearish', cotAlignment: 'Confirms', positioningExtreme: false, crowdedJustified: false },
        { asset: 'SPX', longPct: 28, shortPct: 72, starred: false, percentile: 18, macroBias: 'Bearish', cotAlignment: 'Confirms', positioningExtreme: true, crowdedJustified: true },
        { asset: 'NASDAQ', longPct: 25, shortPct: 75, starred: true, percentile: 15, macroBias: 'Bearish', cotAlignment: 'Confirms', positioningExtreme: true, crowdedJustified: true },
        { asset: 'Gold', longPct: 92, shortPct: 8, starred: true, percentile: 88, macroBias: 'Bullish', cotAlignment: 'Confirms', positioningExtreme: true, crowdedJustified: true },
      ],
    },
    'Retail': {
      All: [
        { asset: 'CHF', longPct: 68, shortPct: 32, starred: false, percentile: 72, macroBias: 'Bearish', cotAlignment: 'Conflicts', positioningExtreme: false, crowdedJustified: false },
        { asset: 'SPX', longPct: 88, shortPct: 12, starred: false, percentile: 95, macroBias: 'Bearish', cotAlignment: 'Conflicts', positioningExtreme: true, crowdedJustified: false },
        { asset: 'NASDAQ', longPct: 92, shortPct: 8, starred: true, percentile: 98, macroBias: 'Bearish', cotAlignment: 'Conflicts', positioningExtreme: true, crowdedJustified: false },
        { asset: 'Gold', longPct: 32, shortPct: 68, starred: true, percentile: 28, macroBias: 'Bullish', cotAlignment: 'Conflicts', positioningExtreme: true, crowdedJustified: false },
      ],
    },
    'All': {
      All: [
        { asset: 'CHF', longPct: 31, shortPct: 69, starred: false, percentile: 36, macroBias: 'Bearish', cotAlignment: 'Neutral', positioningExtreme: false, crowdedJustified: false },
        { asset: 'SPX', longPct: 64, shortPct: 36, starred: false, percentile: 68, macroBias: 'Bearish', cotAlignment: 'Conflicts', positioningExtreme: false, crowdedJustified: false },
        { asset: 'Gold', longPct: 65, shortPct: 35, starred: true, percentile: 65, macroBias: 'Bullish', cotAlignment: 'Confirms', positioningExtreme: false, crowdedJustified: true },
      ],
    },
  };

  // Latest COT data for all assets
  const latestCOTDataByTrader: Record<TraderType, COTLatestRow[]> = {
    'Non-Commercials': [
      { asset: 'SILVER', netChangePct: 6.20, longContracts: 38883, shortContracts: 13006, deltaLong: -4592, deltaShort: -6766, longPct: 74.93, shortPct: 25.07, netPosition: 25877, starred: false, openInterest: '143K', deltaOI: -13457 },
      { asset: 'CAD', netChangePct: 5.41, longContracts: 77397, shortContracts: 75267, deltaLong: 228, deltaShort: -17948, longPct: 50.70, shortPct: 49.30, netPosition: 2130, starred: false, openInterest: '216K', deltaOI: -10952 },
      { asset: 'AUD', netChangePct: 4.50, longContracts: 118751, shortContracts: 92633, deltaLong: 8945, deltaShort: -10027, longPct: 56.18, shortPct: 43.82, netPosition: 26118, starred: false, openInterest: '254K', deltaOI: 2185 },
      { asset: 'USD', netChangePct: 4.22, longContracts: 16610, shortContracts: 17462, deltaLong: -1335, deltaShort: -4888, longPct: 48.75, shortPct: 51.25, netPosition: -852, starred: false, openInterest: '28K', deltaOI: -3556 },
      { asset: 'ZAR', netChangePct: 3.90, longContracts: 15993, shortContracts: 6313, deltaLong: -1306, deltaShort: -1904, longPct: 71.70, shortPct: 28.30, netPosition: 9680, starred: false, openInterest: '31K', deltaOI: 1533 },
      { asset: 'EUR', netChangePct: 3.78, longContracts: 302301, shortContracts: 138940, deltaLong: 11965, deltaShort: -19262, longPct: 68.51, shortPct: 31.49, netPosition: 163361, starred: true, openInterest: '910K', deltaOI: -8820 },
      { asset: 'NZD', netChangePct: 3.67, longContracts: 11883, shortContracts: 46177, deltaLong: -191, deltaShort: -13642, longPct: 20.47, shortPct: 79.53, netPosition: -34294, starred: false, openInterest: '71K', deltaOI: -14248 },
      { asset: 'JPY', netChangePct: 3.11, longContracts: 114428, shortContracts: 133650, deltaLong: 9968, deltaShort: -4743, longPct: 46.13, shortPct: 53.87, netPosition: -19222, starred: false, openInterest: '304K', deltaOI: 2947 },
      { asset: 'USOIL', netChangePct: 2.47, longContracts: 315529, shortContracts: 190964, deltaLong: 20282, deltaShort: -7301, longPct: 62.30, shortPct: 37.70, netPosition: 124565, starred: false, openInterest: '2091K', deltaOI: 55665 },
      { asset: 'PLATINUM', netChangePct: 1.34, longContracts: 31468, shortContracts: 18362, deltaLong: -4951, deltaShort: -4135, longPct: 63.15, shortPct: 36.85, netPosition: 13106, starred: false, openInterest: '74K', deltaOI: -5851 },
      { asset: 'NIKKEI', netChangePct: 1.09, longContracts: 8999, shortContracts: 4789, deltaLong: 2332, deltaShort: 1068, longPct: 65.27, shortPct: 34.73, netPosition: 4210, starred: false, openInterest: '32K', deltaOI: -122 },
      { asset: 'GBP', netChangePct: 0.80, longContracts: 94893, shortContracts: 108804, deltaLong: 7107, deltaShort: 4856, longPct: 46.59, shortPct: 53.41, netPosition: -13911, starred: false, openInterest: '228K', deltaOI: 3429 },
      { asset: 'COPPER', netChangePct: 0.59, longContracts: 97407, shortContracts: 49593, deltaLong: -3993, deltaShort: -3417, longPct: 66.26, shortPct: 33.74, netPosition: 47814, starred: false, openInterest: '279K', deltaOI: 626 },
      { asset: 'CHF', netChangePct: 0.52, longContracts: 9687, shortContracts: 50404, deltaLong: -37, deltaShort: -2213, longPct: 16.12, shortPct: 83.88, netPosition: -40717, starred: false, openInterest: '94K', deltaOI: -2556 },
      { asset: 'US10T', netChangePct: 0.44, longContracts: 698068, shortContracts: 1427482, deltaLong: 29322, deltaShort: 32585, longPct: 32.84, shortPct: 67.16, netPosition: -729414, starred: false, openInterest: '5495K', deltaOI: -195724 },
      { asset: 'BTC', netChangePct: 0.39, longContracts: 18939, shortContracts: 17931, deltaLong: 885, deltaShort: 567, longPct: 51.37, shortPct: 48.63, netPosition: 1008, starred: false, openInterest: '23K', deltaOI: -1232 },
      { asset: 'DOW', netChangePct: -0.13, longContracts: 20011, shortContracts: 18964, deltaLong: -33, deltaShort: 64, longPct: 51.34, shortPct: 48.66, netPosition: 1047, starred: false, openInterest: '70K', deltaOI: -895 },
      { asset: 'RUSSELL', netChangePct: -2.05, longContracts: 92836, shortContracts: 88538, deltaLong: -8727, deltaShort: -698, longPct: 51.18, shortPct: 48.82, netPosition: 4298, starred: false, openInterest: '407K', deltaOI: -9364 },
      { asset: 'SPX', netChangePct: -2.12, longContracts: 244946, shortContracts: 374275, deltaLong: 223, deltaShort: 31805, longPct: 39.56, shortPct: 60.44, netPosition: -129329, starred: false, openInterest: '1950K', deltaOI: 33549 },
      { asset: 'Gold', netChangePct: -2.94, longContracts: 214508, shortContracts: 48904, deltaLong: -37592, deltaShort: 2200, longPct: 81.43, shortPct: 18.57, netPosition: 165604, starred: true, openInterest: '410K', deltaOI: -78769 },
      { asset: 'NASDAQ', netChangePct: -4.72, longContracts: 83886, shortContracts: 69699, deltaLong: -5593, deltaShort: 8375, longPct: 54.62, shortPct: 45.38, netPosition: 14187, starred: true, openInterest: '269K', deltaOI: 8064 },
    ],
    'Commercials': [
      { asset: 'EUR', netChangePct: -3.78, longContracts: 188952, shortContracts: 329527, deltaLong: -305, deltaShort: 46030, longPct: 36.44, shortPct: 63.56, netPosition: -140575, starred: true, openInterest: '910K', deltaOI: -8820 },
      { asset: 'Gold', netChangePct: 2.94, longContracts: 321654, shortContracts: 63722, deltaLong: 25482, deltaShort: 3650, longPct: 83.46, shortPct: 16.54, netPosition: 257932, starred: true, openInterest: '410K', deltaOI: -78769 },
      { asset: 'SPX', netChangePct: 2.12, longContracts: 374275, shortContracts: 244946, deltaLong: 31805, deltaShort: 223, longPct: 60.44, shortPct: 39.56, netPosition: 129329, starred: false, openInterest: '1950K', deltaOI: 33549 },
      { asset: 'SILVER', netChangePct: -6.20, longContracts: 13006, shortContracts: 38883, deltaLong: 6766, deltaShort: 4592, longPct: 25.07, shortPct: 74.93, netPosition: -25877, starred: false, openInterest: '143K', deltaOI: -13457 },
      { asset: 'JPY', netChangePct: -3.11, longContracts: 133650, shortContracts: 114428, deltaLong: 4743, deltaShort: -9968, longPct: 53.87, shortPct: 46.13, netPosition: 19222, starred: false, openInterest: '304K', deltaOI: 2947 },
      { asset: 'USOIL', netChangePct: -2.47, longContracts: 190964, shortContracts: 315529, deltaLong: 7301, deltaShort: -20282, longPct: 37.70, shortPct: 62.30, netPosition: -124565, starred: false, openInterest: '2091K', deltaOI: 55665 },
      { asset: 'COPPER', netChangePct: -0.59, longContracts: 49593, shortContracts: 97407, deltaLong: 3417, deltaShort: 3993, longPct: 33.74, shortPct: 66.26, netPosition: -47814, starred: false, openInterest: '279K', deltaOI: 626 },
      { asset: 'NASDAQ', netChangePct: 4.72, longContracts: 69699, shortContracts: 83886, deltaLong: 8375, deltaShort: 5593, longPct: 45.38, shortPct: 54.62, netPosition: -14187, starred: true, openInterest: '269K', deltaOI: 8064 },
      { asset: 'US10T', netChangePct: -0.44, longContracts: 1427482, shortContracts: 698068, deltaLong: -32585, deltaShort: -29322, longPct: 67.16, shortPct: 32.84, netPosition: 729414, starred: false, openInterest: '5495K', deltaOI: -195724 },
      { asset: 'AUD', netChangePct: -4.50, longContracts: 92633, shortContracts: 118751, deltaLong: 10027, deltaShort: -8945, longPct: 43.82, shortPct: 56.18, netPosition: -26118, starred: false, openInterest: '254K', deltaOI: 2185 },
    ],
    'Retail': [
      { asset: 'NZD', netChangePct: 5.67, longContracts: 28000, shortContracts: 12000, deltaLong: 8000, deltaShort: -2000, longPct: 70.00, shortPct: 30.00, netPosition: 16000, starred: false, openInterest: '85K', deltaOI: -3308 },
      { asset: 'NASDAQ', netChangePct: -6.78, longContracts: 98000, shortContracts: 12000, deltaLong: -28000, deltaShort: 8000, longPct: 89.09, shortPct: 10.91, netPosition: 86000, starred: true, openInterest: '302K', deltaOI: -156 },
      { asset: 'Gold', netChangePct: -2.15, longContracts: 42384, shortContracts: 88225, deltaLong: -8482, deltaShort: 12650, longPct: 32.45, shortPct: 67.55, netPosition: -45841, starred: true, openInterest: '534K', deltaOI: 1820 },
      { asset: 'SPX', netChangePct: -8.45, longContracts: 98000, shortContracts: 12000, deltaLong: -28000, deltaShort: 8000, longPct: 89.09, shortPct: 10.91, netPosition: 86000, starred: false, openInterest: '428K', deltaOI: -2483 },
      { asset: 'SILVER', netChangePct: 3.12, longContracts: 35000, shortContracts: 18000, deltaLong: 4500, deltaShort: -1200, longPct: 66.04, shortPct: 33.96, netPosition: 17000, starred: false, openInterest: '215K', deltaOI: 1238 },
      { asset: 'JPY', netChangePct: 4.23, longContracts: 28000, shortContracts: 15000, deltaLong: 3200, deltaShort: -1500, longPct: 65.12, shortPct: 34.88, netPosition: 13000, starred: false, openInterest: '178K', deltaOI: 845 },
    ],
    'All': [
      { asset: 'EUR', netChangePct: -1.15, longContracts: 319904, shortContracts: 347054, deltaLong: -17995, deltaShort: 22000, longPct: 47.97, shortPct: 52.03, netPosition: -27150, starred: true, openInterest: '653K', deltaOI: -77140 },
      { asset: 'Gold', netChangePct: 1.02, longContracts: 528790, shortContracts: 193735, deltaLong: 4962, deltaShort: 15200, longPct: 73.18, shortPct: 26.82, netPosition: 335055, starred: true, openInterest: '534K', deltaOI: 18204 },
      { asset: 'SPX', netChangePct: -2.48, longContracts: 482768, shortContracts: 268450, deltaLong: -28000, deltaShort: 8000, longPct: 64.28, shortPct: 35.72, netPosition: 214318, starred: false, openInterest: '428K', deltaOI: -24832 },
      { asset: 'NASDAQ', netChangePct: -2.26, longContracts: 227986, shortContracts: 141986, deltaLong: -27733, deltaShort: 7733, longPct: 61.62, shortPct: 38.38, netPosition: 86000, starred: true, openInterest: '302K', deltaOI: -1567 },
      { asset: 'SILVER', netChangePct: 1.04, longContracts: 158761, shortContracts: 141761, deltaLong: 14879, deltaShort: -11579, longPct: 52.83, shortPct: 47.17, netPosition: 17000, starred: false, openInterest: '215K', deltaOI: 12389 },
      { asset: 'JPY', netChangePct: 1.41, longContracts: 130965, shortContracts: 117965, deltaLong: 10257, deltaShort: -8557, longPct: 52.62, shortPct: 47.38, netPosition: 13000, starred: false, openInterest: '178K', deltaOI: 8457 },
    ],
  };

  // Weekly COT history mock data generator
  const generateHistoricalData = (baseData: COTWeeklyRow[], weeksToGenerate: number = 50): COTWeeklyRow[] => {
    const extended = [...baseData];
    const lastRow = baseData[baseData.length - 1];
    const lastDate = new Date(lastRow.date);
    for (let i = 1; i <= weeksToGenerate; i++) {
      const newDate = new Date(lastDate);
      newDate.setDate(newDate.getDate() - (7 * i));
      const variance = (Math.random() - 0.5) * 0.3;
      const trend = 1 - (i / weeksToGenerate) * 0.2;
      extended.push({
        date: newDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        netChangePct: (Math.random() - 0.5) * 15,
        longContracts: Math.floor(lastRow.longContracts * trend * (1 + variance)),
        shortContracts: Math.floor(lastRow.shortContracts * trend * (1 - variance)),
        deltaLong: Math.floor((Math.random() - 0.5) * 40000),
        deltaShort: Math.floor((Math.random() - 0.5) * 30000),
        longPct: Math.max(20, Math.min(85, lastRow.longPct + (Math.random() - 0.5) * 10)),
        shortPct: Math.max(15, Math.min(80, lastRow.shortPct + (Math.random() - 0.5) * 10)),
        netPosition: Math.floor((Math.random() - 0.3) * 300000),
      });
    }
    return extended;
  };

  const weeklyCoTDataByAsset: Record<string, Record<TraderType, COTWeeklyRow[]>> = {
    Gold: {
      'Non-Commercials': generateHistoricalData([
        { date: 'Feb 3, 2026', netChangePct: -0.71, longContracts: 164752, shortContracts: 41788, deltaLong: -12038, deltaShort: -1100, longPct: 79.77, shortPct: 20.23, netPosition: 122964 },
        { date: 'Jan 27, 2026', netChangePct: 1.95, longContracts: 176790, shortContracts: 42888, deltaLong: -7165, deltaShort: -7416, longPct: 80.48, shortPct: 19.52, netPosition: 133902 },
        { date: 'Jan 20, 2026', netChangePct: 9.14, longContracts: 183955, shortContracts: 50304, deltaLong: 12204, deltaShort: -25467, longPct: 78.53, shortPct: 21.47, netPosition: 133651 },
        { date: 'Feb 28, 2025', netChangePct: 6.48, longContracts: 171751, shortContracts: 75771, deltaLong: -24185, deltaShort: -11226, longPct: 69.39, shortPct: 30.61, netPosition: 95980 },
        { date: 'Feb 21, 2025', netChangePct: 1.23, longContracts: 195936, shortContracts: 86997, deltaLong: 3408, deltaShort: -2546, longPct: 69.25, shortPct: 30.75, netPosition: 108939 },
        { date: 'Feb 14, 2025', netChangePct: 6.76, longContracts: 192528, shortContracts: 89543, deltaLong: -39474, deltaShort: -9627, longPct: 68.25, shortPct: 31.75, netPosition: 102985 },
      ], 60),
      'Commercials': generateHistoricalData([
        { date: 'Feb 3, 2026', netChangePct: 2.45, longContracts: 321654, shortContracts: 63722, deltaLong: 25482, deltaShort: 3650, longPct: 83.46, shortPct: 16.54, netPosition: 257932 },
        { date: 'Jan 27, 2026', netChangePct: 1.23, longContracts: 296172, shortContracts: 60072, deltaLong: 18234, deltaShort: -2145, longPct: 83.14, shortPct: 16.86, netPosition: 236100 },
        { date: 'Jan 20, 2026', netChangePct: 3.67, longContracts: 277938, shortContracts: 62217, deltaLong: 32145, deltaShort: -8234, longPct: 81.71, shortPct: 18.29, netPosition: 215721 },
      ], 60),
      'Retail': generateHistoricalData([
        { date: 'Feb 3, 2026', netChangePct: -3.45, longContracts: 42384, shortContracts: 88225, deltaLong: -8482, deltaShort: 12650, longPct: 32.45, shortPct: 67.55, netPosition: -45841 },
        { date: 'Jan 27, 2026', netChangePct: -2.14, longContracts: 50866, shortContracts: 75575, deltaLong: -6234, deltaShort: 8345, longPct: 40.24, shortPct: 59.76, netPosition: -24709 },
      ], 60),
      'All': generateHistoricalData([
        { date: 'Feb 3, 2026', netChangePct: 1.02, longContracts: 528790, shortContracts: 193735, deltaLong: 4962, deltaShort: 15200, longPct: 73.18, shortPct: 26.82, netPosition: 335055 },
        { date: 'Jan 27, 2026', netChangePct: 1.56, longContracts: 523828, shortContracts: 178535, deltaLong: 4835, deltaShort: -1216, longPct: 74.59, shortPct: 25.41, netPosition: 345293 },
      ], 60),
    },
    USD: {
      'Non-Commercials': generateHistoricalData([
        { date: 'Feb 6, 2026', netChangePct: 4.22, longContracts: 16610, shortContracts: 17462, deltaLong: -1335, deltaShort: -4888, longPct: 48.75, shortPct: 51.25, netPosition: -852 },
        { date: 'Jan 30, 2026', netChangePct: 2.89, longContracts: 17945, shortContracts: 22350, deltaLong: 1942, deltaShort: -71, longPct: 44.53, shortPct: 55.47, netPosition: -4405 },
        { date: 'Jan 23, 2026', netChangePct: -3.64, longContracts: 16003, shortContracts: 22421, deltaLong: -1926, deltaShort: 762, longPct: 41.65, shortPct: 58.35, netPosition: -6418 },
        { date: 'Jan 16, 2026', netChangePct: 0.18, longContracts: 17929, shortContracts: 21659, deltaLong: 258, deltaShort: 157, longPct: 45.29, shortPct: 54.71, netPosition: -3730 },
        { date: 'Jan 9, 2026', netChangePct: 0.42, longContracts: 17671, shortContracts: 21502, deltaLong: 1019, deltaShort: 890, longPct: 45.11, shortPct: 54.89, netPosition: -3831 },
        { date: 'Jan 5, 2026', netChangePct: 0.06, longContracts: 16652, shortContracts: 20612, deltaLong: -36, deltaShort: -97, longPct: 44.69, shortPct: 55.31, netPosition: -3960 },
      ], 60),
      'Commercials': generateHistoricalData([
        { date: 'Feb 6, 2026', netChangePct: -4.22, longContracts: 17462, shortContracts: 16610, deltaLong: 4888, deltaShort: 1335, longPct: 51.25, shortPct: 48.75, netPosition: 852 },
      ], 60),
      'Retail': generateHistoricalData([
        { date: 'Feb 6, 2026', netChangePct: 1.50, longContracts: 8200, shortContracts: 6400, deltaLong: 1200, deltaShort: -800, longPct: 56.16, shortPct: 43.84, netPosition: 1800 },
      ], 60),
      'All': generateHistoricalData([
        { date: 'Feb 6, 2026', netChangePct: 0.50, longContracts: 42272, shortContracts: 44472, deltaLong: 4753, deltaShort: -3553, longPct: 48.73, shortPct: 51.27, netPosition: -2200 },
      ], 60),
    },
  };

  // Generate mock weekly data for any symbol missing from weeklyCoTDataByAsset
  const getWeeklyData = (symbol: string): COTWeeklyRow[] => {
    if (weeklyCoTDataByAsset[symbol]?.[traderType]) {
      return weeklyCoTDataByAsset[symbol][traderType];
    }
    // Generate deterministic mock data for missing symbols
    const hash = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const seed = (i: number) => ((hash * 31 + i * 17) % 100) / 100;
    const baseLong = 50000 + Math.floor(seed(0) * 200000);
    const baseShort = 30000 + Math.floor(seed(1) * 150000);
    const data: COTWeeklyRow[] = [];
    const startDate = new Date('2026-02-03');
    for (let w = 0; w < 66; w++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() - 7 * w);
      const variance = Math.sin(w * 0.3 + seed(2) * 10) * 0.2;
      const lc = Math.max(5000, Math.floor(baseLong * (1 + variance)));
      const sc = Math.max(5000, Math.floor(baseShort * (1 - variance * 0.8)));
      const total = lc + sc;
      data.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        netChangePct: Math.round((Math.sin(w * 0.5 + seed(3) * 6) * 5 + (seed(w % 10) - 0.5) * 4) * 100) / 100,
        longContracts: lc,
        shortContracts: sc,
        deltaLong: Math.floor((Math.sin(w * 0.7 + 1) * 0.5 + seed(w % 7) - 0.5) * 15000),
        deltaShort: Math.floor((Math.cos(w * 0.6 + 2) * 0.5 + seed(w % 8) - 0.5) * 12000),
        longPct: Math.round((lc / total) * 10000) / 100,
        shortPct: Math.round((sc / total) * 10000) / 100,
        netPosition: lc - sc,
      });
    }
    return data;
  };

  // ─── EFFECTIVE DATA SELECTION ─────────────────────────────────────────────
  // Latest COT: live data if available, else mock
  const effectiveLatestData = useMemo((): COTLatestRow[] => {
    if (useLiveData && liveLatestData.length > 0) {
      return liveLatestData.map(r => ({
        asset: r.asset,
        netChangePct: r.netChangePct,
        longContracts: r.longContracts,
        shortContracts: r.shortContracts,
        deltaLong: r.deltaLong,
        deltaShort: r.deltaShort,
        longPct: r.longPct,
        shortPct: r.shortPct,
        netPosition: r.netPosition,
        starred: false,
        openInterest: r.openInterest,
        deltaOI: r.deltaOI,
        reportDate: r.reportDate,
      }));
    }
    return latestCOTDataByTrader[traderType] || [];
  }, [useLiveData, liveLatestData, traderType]);

  // Weekly history data (for Symbol View)
  const effectiveWeeklyData = useMemo((): COTWeeklyRow[] => {
    if (selectedAsset === 'All') return [];
    if (useLiveData && liveWeeklyData.length > 0) {
      return liveWeeklyData.map(r => ({
        date: r.date,
        netChangePct: r.netChangePct,
        longContracts: r.longContracts,
        shortContracts: r.shortContracts,
        deltaLong: r.deltaLong,
        deltaShort: r.deltaShort,
        longPct: r.longPct,
        shortPct: r.shortPct,
        netPosition: r.netPosition,
      }));
    }
    return getWeeklyData(selectedAsset);
  }, [selectedAsset, useLiveData, liveWeeklyData, traderType]);

  // ─── SORTING ─────────────────────────────────────────────────────────────
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder(column === 'asset' || column === 'date' ? 'asc' : 'desc');
    }
  };

  const sortData = <T extends Record<string, any>>(data: T[]): T[] => {
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortOrder === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  };

  // ─── BAR CHART DATA ─────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (selectedAsset === 'All') {
      return sortData(effectiveLatestData).map(r => ({
        name: r.asset,
        longPct: r.longPct,
        shortPct: r.shortPct,
      }));
    }
    // Symbol view: show historical long/short %
    const weekly = effectiveWeeklyData.slice().reverse().slice(-52);
    return weekly.map(r => ({
      name: r.date,
      longPct: r.longPct,
      shortPct: r.shortPct,
      longPos: r.longContracts,
      shortPos: r.shortContracts,
    }));
  }, [selectedAsset, effectiveLatestData, effectiveWeeklyData, sortColumn, sortOrder]);

  // ─── GLOBAL GRADIENT RANGES (computed across all rows) ────────────────────
  const latestGlobalRanges = useMemo(() => {
    const data = effectiveLatestData;
    return {
      longContracts: getAbsMax(data, 'longContracts'),
      shortContracts: getAbsMax(data, 'shortContracts'),
      deltaLong: getAbsMax(data, 'deltaLong'),
      deltaShort: getAbsMax(data, 'deltaShort'),
      netChangePct: getAbsMax(data, 'netChangePct'),
      netPosition: getAbsMax(data, 'netPosition'),
      deltaOI: getAbsMax(data, 'deltaOI'),
    };
  }, [effectiveLatestData]);

  const weeklyGlobalRanges = useMemo(() => {
    const data = effectiveWeeklyData;
    return {
      longContracts: getAbsMaxWeekly(data, 'longContracts'),
      shortContracts: getAbsMaxWeekly(data, 'shortContracts'),
      deltaLong: getAbsMaxWeekly(data, 'deltaLong'),
      deltaShort: getAbsMaxWeekly(data, 'deltaShort'),
      netChangePct: getAbsMaxWeekly(data, 'netChangePct'),
      netPosition: getAbsMaxWeekly(data, 'netPosition'),
    };
  }, [effectiveWeeklyData]);

  // ─── PERCENTILE HELPERS ────────────────────────────────────────────────────
  const getEffectivePercentile = (asset: string): number | null => {
    const historyArray = allAssetsPercentileMap.get(asset);
    if (historyArray && historyArray.length >= 2) {
      const latestRow = effectiveLatestData.find(r => r.asset === asset);
      if (latestRow) {
        return calculatePercentileFromHistory(latestRow.netPosition, historyArray, percentileWindow);
      }
    }
    const mockData = netPositioningDataByTrader[traderType]?.All;
    const mockRow = mockData?.find((r: COTAssetData) => r.asset === asset);
    return mockRow?.percentile ?? null;
  };

  // Format helpers
  const fmtNum = (n: number) => n.toLocaleString('en-US');
  const fmtDelta = (n: number) => (n > 0 ? '+' : '') + n.toLocaleString('en-US');
  const fmtPct = (n: number) => n.toFixed(2) + '%';
  const fmtNetChg = (n: number) => (n > 0 ? '+' : '') + n.toFixed(2) + '%';

  const reportDate = useLiveData && liveReportDate ? liveReportDate : LATEST_COT_RELEASE_DATE;

  // ─── RENDER SORTABLE HEADER ─────────────────────────────────────────────
  const SortHeader = ({ col, label, align = 'center' }: { col: string; label: string; align?: 'left' | 'center' }) => (
    <th
      className="px-3 py-2 cursor-pointer select-none whitespace-nowrap"
      style={{ textAlign: align }}
      onClick={() => handleSort(col)}
    >
      <div className={`flex items-center gap-1 ${align === 'center' ? 'justify-center' : ''}`}>
        <span className="text-[11px] text-[#7A8295] uppercase tracking-wider" style={{ fontWeight: 600 }}>
          {label}
        </span>
        {sortColumn === col && (
          <ArrowUpDown className="w-2.5 h-2.5 text-[#4C6FFF] flex-shrink-0" />
        )}
      </div>
    </th>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#181B22' }}>
      {/* ─── Header Bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1E2433] flex-shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-[15px] text-[#E6E9F0]" style={{ fontWeight: 600 }}>
            {selectedAsset === 'All' ? 'Latest COT Report' : 'COT Data History'}
            <span className="text-[11px] text-[#6F7A90] ml-2">({traderType})</span>
          </h2>

          {/* Data source badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded" style={{ backgroundColor: '#1A1F2E' }}>
            {dataSource === 'loading' ? (
              <Loader2 className="w-3 h-3 text-[#6F7A90] animate-spin" />
            ) : useLiveData ? (
              <Wifi className="w-3 h-3 text-[#3FAE7A]" />
            ) : (
              <WifiOff className="w-3 h-3 text-[#D66565]" />
            )}
            <span className="text-[10px] text-[#6F7A90]">
              {dataSource === 'loading' ? 'Fetching...' : useLiveData ? 'LIVE' : 'MOCK'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Timestamp info */}
          <div className="flex items-center gap-4 text-[10px] text-[#5A6375]">
            <div className="flex flex-col items-center">
              <span style={{ fontWeight: 500 }}>Last Update</span>
              <span>{useLiveData && liveReportDate ? liveReportDate : LATEST_COT_UPDATE_TIMESTAMP}</span>
            </div>
            <div className="flex flex-col items-center">
              <span style={{ fontWeight: 500 }}>Update interval</span>
              <span>{COT_UPDATE_INTERVAL}</span>
            </div>
          </div>

          {/* Symbol selector */}
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="px-2 py-1 text-[11px] rounded border border-[#2A3040] text-[#C8CDD8] cursor-pointer"
            style={{ backgroundColor: '#1A1F2E', fontWeight: 500 }}
          >
            <option value="All">All Assets</option>
            {allAssets.map(s => (
              <option key={s} value={s}>{COT_SYMBOL_MAPPINGS[s]?.displayName || s}</option>
            ))}
          </select>

          {/* Trader type selector */}
          <select
            value={traderType}
            onChange={(e) => setTraderType(e.target.value as TraderType)}
            className="px-2 py-1 text-[11px] rounded border border-[#2A3040] text-[#C8CDD8] cursor-pointer"
            style={{ backgroundColor: '#1A1F2E', fontWeight: 500 }}
          >
            <option value="Non-Commercials">Non-Commercials</option>
            <option value="Commercials">Commercials</option>
            <option value="Retail">Retail</option>
            <option value="All">All</option>
          </select>

          {/* Percentile window (All Assets only) */}
          {selectedAsset === 'All' && (
            <select
              value={percentileWindow}
              onChange={(e) => setPercentileWindow(e.target.value as PercentileWindow)}
              className="px-2 py-1 text-[10px] rounded border border-[#2A3040] text-[#C8CDD8] cursor-pointer"
              style={{ backgroundColor: '#1A1F2E', fontWeight: 500 }}
            >
              <option value="52-week">52-Week %ile</option>
              <option value="156-week">3-Year %ile</option>
            </select>
          )}

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded border border-[#2A3040] hover:border-[#3A4560] transition-colors"
            style={{ backgroundColor: '#1A1F2E' }}
            title="Refresh COT data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6F7A90] ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── Scrollable Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {/* ─── BAR CHART ────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-4 border-b border-[#1E2433]">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#3858B8' }} />
              <span className="text-[10px] text-[#9AA1B2]">
                {selectedAsset === 'All' ? 'Long' : 'Long Positions'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#A83838' }} />
              <span className="text-[10px] text-[#9AA1B2]">
                {selectedAsset === 'All' ? 'Short' : 'Short Positions'}
              </span>
            </div>
            {selectedAsset !== 'All' && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5" style={{ backgroundColor: '#F0D050' }} />
                <span className="text-[10px] text-[#9AA1B2]">Long %</span>
              </div>
            )}
          </div>

          <div style={{ height: selectedAsset === 'All' ? 380 : 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              {selectedAsset === 'All' ? (
                <BarChart data={chartData} barGap={0} barCategoryGap="8%" margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: '#6F7A90' }}
                    axisLine={{ stroke: '#1E2433' }}
                    tickLine={false}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#6F7A90' }}
                    axisLine={{ stroke: '#1E2433' }}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={v => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1A1F2E', border: '1px solid #2A3040', borderRadius: 4, fontSize: 11 }}
                    labelStyle={{ color: '#C8CDD8' }}
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(2)}%`,
                      name === 'longPct' ? 'Long %' : 'Short %'
                    ]}
                  />
                  <Bar dataKey="longPct" stackId="a" fill="#3858B8" />
                  <Bar dataKey="shortPct" stackId="a" fill="#A83838" />
                </BarChart>
              ) : (
                <ComposedChart data={chartData} barGap={0} barCategoryGap="4%" margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 8, fill: '#6F7A90' }}
                    axisLine={{ stroke: '#1E2433' }}
                    tickLine={false}
                    interval={Math.max(0, Math.floor(chartData.length / 15))}
                    angle={-45}
                    textAnchor="end"
                    height={55}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 9, fill: '#6F7A90' }}
                    axisLine={{ stroke: '#1E2433' }}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={v => `${v}%`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 9, fill: '#6F7A90' }}
                    axisLine={{ stroke: '#1E2433' }}
                    tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1A1F2E', border: '1px solid #2A3040', borderRadius: 4, fontSize: 11 }}
                    labelStyle={{ color: '#C8CDD8' }}
                  />
                  <Bar dataKey="longPos" yAxisId="right" stackId="a" fill="#3858B8" name="Long Contracts" />
                  <Bar dataKey="shortPos" yAxisId="right" stackId="a" fill="#A83838" name="Short Contracts" />
                  <Line
                    dataKey="longPct"
                    yAxisId="left"
                    type="monotone"
                    stroke="#F0D050"
                    strokeWidth={2}
                    dot={false}
                    name="Long %"
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* ─── DATA TABLE ─────────────────────────────────────────────── */}
        {dataSource === 'loading' ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 className="w-4 h-4 text-[#6F7A90] animate-spin" />
            <span className="text-[12px] text-[#6F7A90]">Loading COT data from CFTC SODA API...</span>
          </div>
        ) : selectedAsset === 'All' ? (
          /* ════ ALL ASSETS TABLE (Latest COT) — Row-rank gradient ════ */
          (() => {
            const sorted = sortData(effectiveLatestData);
            const count = sorted.length;
            // Rank every row by netChangePct descending for the Symbol column gradient
            const byNetChange = [...sorted].sort((a, b) => b.netChangePct - a.netChangePct);
            const rankMap = new Map<string, number>();
            byNetChange.forEach((r, i) => rankMap.set(r.asset, i));

            // Symbol cell: vivid blue-to-red based on rank
            const getSymbolBg = (asset: string): string => {
              const rank = rankMap.get(asset) ?? Math.floor(count / 2);
              const t = count > 1 ? rank / (count - 1) : 0.5; // 0=bullish, 1=bearish
              if (t < 0.38) {
                const s = (0.38 - t) / 0.38; // 1 at top, 0 at boundary
                return `rgb(${Math.round(28 + 12 * (1 - s))}, ${Math.round(38 + 18 * (1 - s))}, ${Math.round(72 + 92 * s)})`;
              }
              if (t > 0.62) {
                const s = (t - 0.62) / 0.38; // 0 at boundary, 1 at bottom
                return `rgb(${Math.round(60 + 100 * s)}, ${Math.round(28 - 6 * s)}, ${Math.round(38 - 8 * s)})`;
              }
              return '#1E2838';
            };

            const g = latestGlobalRanges;
            const maxContracts = Math.max(g.longContracts, g.shortContracts);

            return (
              <div className="px-0">
                <table className="w-full border-collapse" style={{ minWidth: '1100px' }}>
                  <thead>
                    <tr className="border-b border-[#252B3B]" style={{ backgroundColor: '#171C28' }}>
                      <SortHeader col="asset" label="Symbol" align="left" />
                      <SortHeader col="longContracts" label="Long Contracts" />
                      <SortHeader col="shortContracts" label="Short Contracts" />
                      <SortHeader col="deltaLong" label={'\u0394 Long Contracts'} />
                      <SortHeader col="deltaShort" label={'\u0394 Short Contracts'} />
                      <SortHeader col="longPct" label="Long %" />
                      <SortHeader col="shortPct" label="Short %" />
                      <SortHeader col="netChangePct" label="Net % Change" />
                      <SortHeader col="netPosition" label="Net Position" />
                      <th className="px-3 py-2 text-center">
                        <span className="text-[11px] text-[#7A8295] uppercase tracking-wider" style={{ fontWeight: 600 }}>Open Interest</span>
                      </th>
                      <SortHeader col="deltaOI" label={'\u0394 Open Interest'} />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => (
                      <tr
                        key={row.asset}
                        className="border-b border-[#1C2230] transition-colors hover:brightness-125"
                      >
                        <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getSymbolBg(row.asset) }}>
                          <span className="text-[13px] text-[#F0F2F5]" style={{ fontWeight: 600 }}>{row.asset}</span>
                        </td>
                        <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.longContracts, maxContracts, 'long_abs') }}>
                          <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.longContracts, maxContracts, 'long_abs'), fontWeight: 500 }}>{fmtNum(row.longContracts)}</span>
                        </td>
                        <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.shortContracts, maxContracts, 'short_abs') }}>
                          <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.shortContracts, maxContracts, 'short_abs'), fontWeight: 500 }}>{fmtNum(row.shortContracts)}</span>
                        </td>
                        <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.deltaLong, g.deltaLong, 'diverging') }}>
                          <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.deltaLong, g.deltaLong, 'diverging'), fontWeight: 500 }}>{fmtDelta(row.deltaLong)}</span>
                        </td>
                        <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(-row.deltaShort, g.deltaShort, 'diverging') }}>
                          <span className="text-[13px] tabular-nums" style={{ color: getHeatText(-row.deltaShort, g.deltaShort, 'diverging'), fontWeight: 500 }}>{fmtDelta(row.deltaShort)}</span>
                        </td>
                        <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.longPct, 100, 'long_pct') }}>
                          <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.longPct, 100, 'long_pct'), fontWeight: 500 }}>{fmtPct(row.longPct)}</span>
                        </td>
                        <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.shortPct, 100, 'short_pct') }}>
                          <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.shortPct, 100, 'short_pct'), fontWeight: 500 }}>{fmtPct(row.shortPct)}</span>
                        </td>
                        <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.netChangePct, g.netChangePct, 'diverging') }}>
                          <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.netChangePct, g.netChangePct, 'diverging'), fontWeight: 500 }}>{fmtNetChg(row.netChangePct)}</span>
                        </td>
                        <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.netPosition, g.netPosition, 'diverging') }}>
                          <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.netPosition, g.netPosition, 'diverging'), fontWeight: 500 }}>{fmtDelta(row.netPosition)}</span>
                        </td>
                        <td className="px-3 py-[7px] text-center">
                          <span className="text-[13px] text-[#9AA1B2] tabular-nums">{row.openInterest}</span>
                        </td>
                        <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.deltaOI, g.deltaOI, 'diverging') }}>
                          <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.deltaOI, g.deltaOI, 'diverging'), fontWeight: 500 }}>{fmtDelta(row.deltaOI)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()
        ) : (
          /* ════ SYMBOL HISTORY TABLE — Row-rank gradient ════ */
          (() => {
            const sorted = sortData(effectiveWeeklyData);
            const g = weeklyGlobalRanges;
            const maxContracts = Math.max(g.longContracts, g.shortContracts);
            const count = sorted.length;
            // Rank by netChangePct desc for date-cell gradient
            const byNetChange = [...sorted].sort((a, b) => b.netChangePct - a.netChangePct);
            const rankLookup = new Map<number, number>();
            sorted.forEach((r, si) => {
              const ri = byNetChange.findIndex(br => br === r);
              rankLookup.set(si, ri >= 0 ? ri : si);
            });
            const getDateBg = (ri: number): string => {
              const t = count > 1 ? ri / (count - 1) : 0.5;
              if (t < 0.30) {
                const s = (0.30 - t) / 0.30;
                return `rgb(${Math.round(28 + 12 * (1 - s))}, ${Math.round(38 + 18 * (1 - s))}, ${Math.round(72 + 92 * s)})`;
              }
              if (t > 0.70) {
                const s = (t - 0.70) / 0.30;
                return `rgb(${Math.round(60 + 100 * s)}, ${Math.round(28 - 6 * s)}, ${Math.round(38 - 8 * s)})`;
              }
              return '#1E2838';
            };
            return (
              <div className="px-0">
                <table className="w-full border-collapse" style={{ minWidth: '900px' }}>
                  <thead>
                    <tr className="border-b border-[#252B3B]" style={{ backgroundColor: '#171C28' }}>
                      <SortHeader col="date" label="Date" align="left" />
                      <SortHeader col="netChangePct" label="Net Change %" />
                      <SortHeader col="longContracts" label="Long Contracts" />
                      <SortHeader col="shortContracts" label="Short Contracts" />
                      <SortHeader col="deltaLong" label={'\u0394 Long Contracts'} />
                      <SortHeader col="deltaShort" label={'\u0394 Short Contracts'} />
                      <SortHeader col="longPct" label="Long %" />
                      <SortHeader col="shortPct" label="Short %" />
                      <SortHeader col="netPosition" label="Net Position" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, idx) => {
                      const ri = rankLookup.get(idx) ?? idx;
                      return (
                        <tr key={`${row.date}-${idx}`} className="border-b border-[#1C2230] transition-colors hover:brightness-125">
                          <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getDateBg(ri) }}>
                            <span className="text-[13px] text-[#F0F2F5]" style={{ fontWeight: 500 }}>{row.date}</span>
                          </td>
                          <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.netChangePct, g.netChangePct, 'diverging') }}>
                            <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.netChangePct, g.netChangePct, 'diverging'), fontWeight: 500 }}>{fmtNetChg(row.netChangePct)}</span>
                          </td>
                          <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.longContracts, maxContracts, 'long_abs') }}>
                            <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.longContracts, maxContracts, 'long_abs'), fontWeight: 500 }}>{fmtNum(row.longContracts)}</span>
                          </td>
                          <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.shortContracts, maxContracts, 'short_abs') }}>
                            <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.shortContracts, maxContracts, 'short_abs'), fontWeight: 500 }}>{fmtNum(row.shortContracts)}</span>
                          </td>
                          <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.deltaLong, g.deltaLong, 'diverging') }}>
                            <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.deltaLong, g.deltaLong, 'diverging'), fontWeight: 500 }}>{fmtDelta(row.deltaLong)}</span>
                          </td>
                          <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(-row.deltaShort, g.deltaShort, 'diverging') }}>
                            <span className="text-[13px] tabular-nums" style={{ color: getHeatText(-row.deltaShort, g.deltaShort, 'diverging'), fontWeight: 500 }}>{fmtDelta(row.deltaShort)}</span>
                          </td>
                          <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.longPct, 100, 'long_pct') }}>
                            <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.longPct, 100, 'long_pct'), fontWeight: 500 }}>{fmtPct(row.longPct)}</span>
                          </td>
                          <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.shortPct, 100, 'short_pct') }}>
                            <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.shortPct, 100, 'short_pct'), fontWeight: 500 }}>{fmtPct(row.shortPct)}</span>
                          </td>
                          <td className="px-3 py-[7px] text-center" style={{ backgroundColor: getHeatBg(row.netPosition, g.netPosition, 'diverging') }}>
                            <span className="text-[13px] tabular-nums" style={{ color: getHeatText(row.netPosition, g.netPosition, 'diverging'), fontWeight: 500 }}>{fmtDelta(row.netPosition)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()
        )}
      </div>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-[#1E2433] flex-shrink-0" style={{ backgroundColor: '#171C28' }}>
        <span className="text-[10px] text-[#5A6375]">
          {selectedAsset === 'All'
            ? `${effectiveLatestData.length} symbols • ${getTraderTypeLabel()} • Report: ${reportDate}`
            : `${COT_SYMBOL_MAPPINGS[selectedAsset]?.displayName || selectedAsset} • ${getTraderTypeLabel()} • ${effectiveWeeklyData.length} weeks`}
        </span>
        <div className="flex items-center gap-4">
          <span className="text-[9px] text-[#4A5568] flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#2D52A8' }} />
            Long / Bullish
          </span>
          <span className="text-[9px] text-[#4A5568] flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#A82D2D' }} />
            Short / Bearish
          </span>
          <span className="text-[9px] text-[#4A5568] flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#1E2433' }} />
            Neutral
          </span>
          <span className="text-[10px] text-[#5A6375]">
            {getTraderTypeContext()}
          </span>
        </div>
      </div>
    </div>
  );
}
