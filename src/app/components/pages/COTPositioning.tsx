import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line } from 'recharts';
import { ArrowUpDown, Wifi, WifiOff, RefreshCw, Loader2, ChevronDown } from 'lucide-react';
import { useIsMobile } from '../ui/use-mobile';
import {
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
  COT_SYMBOL_MAPPINGS,
} from '../../utils/cotMappings';

// ─── DATA SOURCE STATE ─────────────────────────────────────────────────────
type DataSource = 'live' | 'partial' | 'loading' | 'error' | 'empty';

// CFTC releases COT reports every Friday at 3:30 PM ET for the preceding Tuesday
function getLatestCFTCRelease(): { releaseDate: string; releaseTimestamp: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  // Days back to most recent Friday
  const daysBack = day === 5 ? 0 : day === 6 ? 1 : day + 2;
  const lastFriday = new Date(now);
  lastFriday.setDate(now.getDate() - daysBack);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const releaseDate = lastFriday.toLocaleDateString('en-US', opts);
  const releaseTimestamp = releaseDate + ', 3:30 PM';
  return { releaseDate, releaseTimestamp };
}

const { releaseDate: LATEST_COT_RELEASE_DATE, releaseTimestamp: LATEST_COT_UPDATE_TIMESTAMP } = getLatestCFTCRelease();

type TraderType = 'Non-Commercials' | 'Commercials' | 'Retail' | 'All';

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

function getHeatBg(
  value: number,
  absMax: number,
  type: 'diverging' | 'long_abs' | 'short_abs' | 'long_pct' | 'short_pct'
): string {
  if (absMax === 0 || value === 0) return 'transparent';

  if (type === 'long_pct') {
    const deviation = (value - 50) / 50;
    const t = Math.pow(Math.abs(deviation), 0.8) * 0.75;
    if (t < 0.04) return 'transparent';
    if (deviation > 0) return `rgb(${Math.round(19 - 19 * t + 30 * t)}, ${Math.round(23 - 23 * t + 58 * t)}, ${Math.round(34 + 88 * t)})`;
    return `rgb(${Math.round(19 + 103 * t)}, ${Math.round(23 - 14 * t)}, ${Math.round(34 - 4 * t)})`;
  }

  if (type === 'short_pct') {
    const deviation = (value - 50) / 50;
    const t = Math.pow(Math.abs(deviation), 0.8) * 0.75;
    if (t < 0.04) return 'transparent';
    if (deviation > 0) return `rgb(${Math.round(19 + 103 * t)}, ${Math.round(23 - 14 * t)}, ${Math.round(34 - 4 * t)})`;
    return `rgb(${Math.round(19 - 19 * t + 30 * t)}, ${Math.round(23 - 23 * t + 58 * t)}, ${Math.round(34 + 88 * t)})`;
  }

  if (type === 'long_abs') {
    const t = Math.pow(Math.min(value / absMax, 1), 0.7) * 0.65;
    if (t < 0.04) return 'transparent';
    return `rgb(${Math.round(19 - 19 * t + 35 * t)}, ${Math.round(23 - 23 * t + 60 * t)}, ${Math.round(34 + 95 * t)})`;
  }

  if (type === 'short_abs') {
    const t = Math.pow(Math.min(value / absMax, 1), 0.7) * 0.65;
    if (t < 0.04) return 'transparent';
    return `rgb(${Math.round(19 + 103 * t)}, ${Math.round(23 - 14 * t)}, ${Math.round(34 - 4 * t)})`;
  }

  const normalized = Math.min(Math.abs(value) / absMax, 1);
  const t = Math.pow(normalized, 0.7) * 0.75;
  if (t < 0.03) return 'transparent';
  if (value > 0) return `rgb(${Math.round(19 - 19 * t + 35 * t)}, ${Math.round(23 - 23 * t + 60 * t)}, ${Math.round(34 + 100 * t)})`;
  return `rgb(${Math.round(19 + 110 * t)}, ${Math.round(23 - 14 * t)}, ${Math.round(34 - 4 * t)})`;
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

function getAbsMax(data: COTLatestRow[], key: keyof COTLatestRow): number {
  let max = 0;
  data.forEach(row => { const v = Math.abs(Number(row[key]) || 0); if (v > max) max = v; });
  return max;
}

function getAbsMaxWeekly(data: COTWeeklyRow[], key: keyof COTWeeklyRow): number {
  let max = 0;
  data.forEach(row => { const v = Math.abs(Number(row[key]) || 0); if (v > max) max = v; });
  return max;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function COTPositioning() {
  const isMobile = useIsMobile();
  const [selectedAsset, setSelectedAsset] = useState<string>('All');
  const [traderType, setTraderType] = useState<TraderType>('Non-Commercials');
  const [sortColumn, setSortColumn] = useState<string>('netChangePct');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [percentileWindow, setPercentileWindow] = useState<PercentileWindow>('52-week');

  // Live data state
  const [dataSource, setDataSource] = useState<DataSource>('loading');
  const [liveLatestData, setLiveLatestData] = useState<COTLatestRowLive[]>([]);
  const [liveWeeklyData, setLiveWeeklyData] = useState<COTWeeklyRowLive[]>([]);
  const [liveReportDate, setLiveReportDate] = useState<string>('');
  const [liveHistoryNetPositions, setLiveHistoryNetPositions] = useState<number[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [allAssetsPercentileMap, setAllAssetsPercentileMap] = useState<Map<string, number[]>>(new Map());
  const [percentilesSource, setPercentilesSource] = useState<'none' | 'loading' | 'live' | 'partial'>('none');
  const fetchCountRef = useRef(0);

  // ─── FETCH ALL ASSETS ────────────────────────────────────────────────────
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
        setDataSource('empty');
      }
    } catch {
      if (currentFetch === fetchCountRef.current) setDataSource('error');
    }
  }, [traderType]);

  // ─── FETCH SINGLE ASSET HISTORY ──────────────────────────────────────────
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
        setDataSource('empty');
      }
    } catch {
      if (currentFetch === fetchCountRef.current) {
        setLiveWeeklyData([]);
        setLiveHistoryNetPositions([]);
        setDataSource('error');
      }
    }
  }, [traderType]);

  // ─── TRIGGER DATA FETCH ──────────────────────────────────────────────────
  useEffect(() => {
    setDataSource('loading');
    if (selectedAsset === 'All') fetchAllAssets();
    else fetchSymbolHistory(selectedAsset);
  }, [selectedAsset, traderType, fetchAllAssets, fetchSymbolHistory]);

  // ─── BACKGROUND PERCENTILE FETCH ────────────────────────────────────────
  useEffect(() => {
    if (selectedAsset !== 'All') return;
    if (dataSource !== 'live' && dataSource !== 'partial') return;
    let cancelled = false;
    const loadPercentiles = async () => {
      setPercentilesSource('loading');
      try {
        const result = await fetchAllAssetsPercentileHistories(traderType, 156);
        if (cancelled) return;
        setAllAssetsPercentileMap(result.data);
        setPercentilesSource(result.successCount === result.totalCount ? 'live' : 'partial');
      } catch {
        if (!cancelled) setPercentilesSource('none');
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
    if (selectedAsset === 'All') await fetchAllAssets();
    else await fetchSymbolHistory(selectedAsset);
    setIsRefreshing(false);
  };

  const useLiveData = dataSource === 'live' || dataSource === 'partial';

  useEffect(() => {
    if (selectedAsset !== 'All') { setSortColumn('date'); setSortOrder('desc'); }
    else { setSortColumn('netChangePct'); setSortOrder('desc'); }
  }, [selectedAsset]);

  // ─── EFFECTIVE DATA ──────────────────────────────────────────────────────
  const effectiveLatestData = useMemo((): COTLatestRow[] => {
    if (useLiveData && liveLatestData.length > 0) {
      return liveLatestData.map(r => ({
        asset: r.asset, netChangePct: r.netChangePct, longContracts: r.longContracts,
        shortContracts: r.shortContracts, deltaLong: r.deltaLong, deltaShort: r.deltaShort,
        longPct: r.longPct, shortPct: r.shortPct, netPosition: r.netPosition,
        starred: false, openInterest: r.openInterest, deltaOI: r.deltaOI, reportDate: r.reportDate,
      }));
    }
    return [];
  }, [useLiveData, liveLatestData]);

  const effectiveWeeklyData = useMemo((): COTWeeklyRow[] => {
    if (selectedAsset === 'All') return [];
    if (useLiveData && liveWeeklyData.length > 0) {
      return liveWeeklyData.map(r => ({
        date: r.date, netChangePct: r.netChangePct, longContracts: r.longContracts,
        shortContracts: r.shortContracts, deltaLong: r.deltaLong, deltaShort: r.deltaShort,
        longPct: r.longPct, shortPct: r.shortPct, netPosition: r.netPosition,
      }));
    }
    return [];
  }, [selectedAsset, useLiveData, liveWeeklyData]);

  // ─── SORTING ─────────────────────────────────────────────────────────────
  const handleSort = (column: string) => {
    if (sortColumn === column) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(column); setSortOrder(column === 'asset' || column === 'date' ? 'asc' : 'desc'); }
  };

  const sortData = <T extends Record<string, any>>(data: T[]): T[] => {
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn], bVal = b[sortColumn];
      if (typeof aVal === 'number' && typeof bVal === 'number') return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      return sortOrder === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
  };

  // ─── CHART DATA ──────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (selectedAsset === 'All') {
      return sortData(effectiveLatestData).map(r => ({ name: r.asset, longPct: r.longPct, shortPct: r.shortPct }));
    }
    const weekly = effectiveWeeklyData.slice().reverse().slice(-52);
    return weekly.map(r => ({ name: r.date, longPct: r.longPct, shortPct: r.shortPct, longPos: r.longContracts, shortPos: r.shortContracts }));
  }, [selectedAsset, effectiveLatestData, effectiveWeeklyData, sortColumn, sortOrder]);

  const latestGlobalRanges = useMemo(() => ({
    longContracts: getAbsMax(effectiveLatestData, 'longContracts'),
    shortContracts: getAbsMax(effectiveLatestData, 'shortContracts'),
    deltaLong: getAbsMax(effectiveLatestData, 'deltaLong'),
    deltaShort: getAbsMax(effectiveLatestData, 'deltaShort'),
    netChangePct: getAbsMax(effectiveLatestData, 'netChangePct'),
    netPosition: getAbsMax(effectiveLatestData, 'netPosition'),
    deltaOI: getAbsMax(effectiveLatestData, 'deltaOI'),
  }), [effectiveLatestData]);

  const weeklyGlobalRanges = useMemo(() => ({
    longContracts: getAbsMaxWeekly(effectiveWeeklyData, 'longContracts'),
    shortContracts: getAbsMaxWeekly(effectiveWeeklyData, 'shortContracts'),
    deltaLong: getAbsMaxWeekly(effectiveWeeklyData, 'deltaLong'),
    deltaShort: getAbsMaxWeekly(effectiveWeeklyData, 'deltaShort'),
    netChangePct: getAbsMaxWeekly(effectiveWeeklyData, 'netChangePct'),
    netPosition: getAbsMaxWeekly(effectiveWeeklyData, 'netPosition'),
  }), [effectiveWeeklyData]);

  // Format helpers
  const fmtNum = (n: number) => n.toLocaleString('en-US');
  const fmtDelta = (n: number) => (n > 0 ? '+' : '') + n.toLocaleString('en-US');
  const fmtPct = (n: number) => n.toFixed(2) + '%';
  const fmtNetChg = (n: number) => (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  const fmtCompact = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + 'K';
    return n.toString();
  };

  const reportDate = useLiveData && liveReportDate ? liveReportDate : LATEST_COT_RELEASE_DATE;

  // ─── CUSTOM SELECT ──────────────────────────────────────────────────────
  const Select = ({ value, onChange, options, className = '' }: {
    value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[]; className?: string;
  }) => (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none px-2.5 py-1.5 pr-7 text-[11px] rounded-md cursor-pointer focus:outline-none transition-colors"
        style={{ background: 'var(--tp-l2)', border: '1px solid var(--tp-border-subtle)', color: 'var(--tp-text-1)', fontWeight: 500 }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--tp-text-3)' }} />
    </div>
  );

  // ─── STATUS BADGE ────────────────────────────────────────────────────────
  const StatusBadge = () => (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: 'var(--tp-l2)' }}>
      {dataSource === 'loading' ? (
        <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--tp-text-3)' }} />
      ) : useLiveData ? (
        <Wifi className="w-3 h-3" style={{ color: 'var(--tp-bullish)' }} />
      ) : (
        <WifiOff className="w-3 h-3" style={{ color: 'var(--tp-text-3)' }} />
      )}
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', color: useLiveData ? 'var(--tp-bullish)' : 'var(--tp-text-3)' }}>
        {dataSource === 'loading' ? 'LOADING' : useLiveData ? 'LIVE' : dataSource === 'error' ? 'ERROR' : 'NO DATA'}
      </span>
    </div>
  );

  // ─── SORT HEADER ─────────────────────────────────────────────────────────
  const SortHeader = ({ col, label, align = 'center', minW }: { col: string; label: string; align?: 'left' | 'center'; minW?: number }) => (
    <th
      className="px-2 py-2 cursor-pointer select-none whitespace-nowrap"
      style={{ textAlign: align, minWidth: minW }}
      onClick={() => handleSort(col)}
    >
      <div className={`flex items-center gap-0.5 ${align === 'center' ? 'justify-center' : ''}`}>
        <span className="text-[10px] text-[#7A8295] uppercase tracking-wider" style={{ fontWeight: 600 }}>{label}</span>
        {sortColumn === col && <ArrowUpDown className="w-2.5 h-2.5 text-[#4C6FFF] flex-shrink-0" />}
      </div>
    </th>
  );

  // Symbol cell gradient (rank-based)
  const getSymbolBg = (rank: number, count: number): string => {
    const t = count > 1 ? rank / (count - 1) : 0.5;
    if (t < 0.38) {
      const s = (0.38 - t) / 0.38;
      return `rgb(${Math.round(28 + 12 * (1 - s))}, ${Math.round(38 + 18 * (1 - s))}, ${Math.round(72 + 92 * s)})`;
    }
    if (t > 0.62) {
      const s = (t - 0.62) / 0.38;
      return `rgb(${Math.round(60 + 100 * s)}, ${Math.round(28 - 6 * s)}, ${Math.round(38 - 8 * s)})`;
    }
    return '#1E2838';
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MOBILE CARD VIEW (for data rows)
  // ═══════════════════════════════════════════════════════════════════════════

  const MobileAssetCard = ({ row, rank, count }: { row: COTLatestRow; rank: number; count: number }) => {
    const g = latestGlobalRanges;
    const displayName = COT_SYMBOL_MAPPINGS[row.asset]?.displayName || row.asset;
    return (
      <div className="border-b border-[#1C2230]" style={{ backgroundColor: '#14161C' }}>
        {/* Top row: Symbol + Net Change */}
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: getSymbolBg(rank, count) }}>
              <span className="text-[10px] text-[#F0F2F5]" style={{ fontWeight: 700 }}>{row.asset.slice(0, 3)}</span>
            </div>
            <div>
              <div className="text-[12px] text-[#E6E9F0]" style={{ fontWeight: 600 }}>{displayName}</div>
              <div className="text-[10px] text-[#5A6375]">OI: {row.openInterest}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[13px] tabular-nums" style={{ color: row.netChangePct > 0 ? '#5BC4A0' : row.netChangePct < 0 ? '#E06060' : '#9AA1B2', fontWeight: 600 }}>
              {fmtNetChg(row.netChangePct)}
            </div>
            <div className="text-[10px] text-[#5A6375] tabular-nums">Net: {fmtCompact(row.netPosition)}</div>
          </div>
        </div>

        {/* Long/Short bar */}
        <div className="px-3.5 pb-2.5">
          <div className="flex rounded-sm overflow-hidden h-1.5">
            <div style={{ width: `${row.longPct}%`, backgroundColor: '#3858B8' }} />
            <div style={{ width: `${row.shortPct}%`, backgroundColor: '#A83838' }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-[#7088C0]">L: {fmtPct(row.longPct)}</span>
            <span className="text-[9px] text-[#C07070]">S: {fmtPct(row.shortPct)}</span>
          </div>
        </div>
      </div>
    );
  };

  const MobileWeeklyCard = ({ row, rank, count }: { row: COTWeeklyRow; rank: number; count: number }) => {
    return (
      <div className="border-b border-[#1C2230] px-3.5 py-2.5" style={{ backgroundColor: '#14161C' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-[#9AA1B2]" style={{ fontWeight: 500 }}>{row.date}</span>
          <span className="text-[12px] tabular-nums" style={{ color: row.netChangePct > 0 ? '#5BC4A0' : row.netChangePct < 0 ? '#E06060' : '#9AA1B2', fontWeight: 600 }}>
            {fmtNetChg(row.netChangePct)}
          </span>
        </div>
        <div className="flex rounded-sm overflow-hidden h-1.5 mb-1.5">
          <div style={{ width: `${row.longPct}%`, backgroundColor: '#3858B8' }} />
          <div style={{ width: `${row.shortPct}%`, backgroundColor: '#A83838' }} />
        </div>
        <div className="flex justify-between text-[9px]">
          <span className="text-[#7088C0]">L: {fmtCompact(row.longContracts)} ({fmtPct(row.longPct)})</span>
          <span className="text-[#9AA1B2] tabular-nums">Net: {fmtCompact(row.netPosition)}</span>
          <span className="text-[#C07070]">S: {fmtCompact(row.shortContracts)} ({fmtPct(row.shortPct)})</span>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--tp-l1)' }}>
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0" style={{ borderBottom: '1px solid var(--tp-border-subtle)', background: 'var(--tp-l0)' }}>
        {/* Row 1: Title + Status + Refresh */}
        <div className="flex items-center justify-between px-3 md:px-4 py-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[13px] md:text-[15px] text-[#E6E9F0]" style={{ fontWeight: 600 }}>
              {selectedAsset === 'All' ? 'COT Report' : (COT_SYMBOL_MAPPINGS[selectedAsset]?.displayName || selectedAsset)}
            </h2>
            <StatusBadge />
          </div>
          <div className="flex items-center gap-2">
            {!isMobile && (
              <div className="flex items-center gap-3 text-[10px] text-[#5A6375] mr-2">
                <span>Report: {reportDate}</span>
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-md border border-[#2A3040] hover:border-[#3A4560] transition-colors active:scale-95"
              style={{ backgroundColor: '#1A1F2E' }}
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#6F7A90] ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Row 2: Controls */}
        <div className="flex items-center gap-2 px-3 md:px-4 pb-2 overflow-x-auto">
          <Select
            value={selectedAsset}
            onChange={setSelectedAsset}
            options={[
              { value: 'All', label: 'All Assets' },
              ...COT_AVAILABLE_SYMBOLS.map(s => ({ value: s, label: COT_SYMBOL_MAPPINGS[s]?.displayName || s })),
            ]}
            className="min-w-[110px]"
          />
          <Select
            value={traderType}
            onChange={(v) => setTraderType(v as TraderType)}
            options={[
              { value: 'Non-Commercials', label: 'Non-Commercials' },
              { value: 'Commercials', label: 'Commercials' },
              { value: 'Retail', label: 'Retail' },
              { value: 'All', label: 'All Traders' },
            ]}
            className="min-w-[120px]"
          />
          {selectedAsset === 'All' && (
            <Select
              value={percentileWindow}
              onChange={(v) => setPercentileWindow(v as PercentileWindow)}
              options={[
                { value: '52-week', label: '52W %ile' },
                { value: '156-week', label: '3Y %ile' },
              ]}
              className="min-w-[80px]"
            />
          )}
          {isMobile && (
            <span className="text-[9px] text-[#5A6375] whitespace-nowrap ml-auto">{reportDate}</span>
          )}
        </div>
      </div>

      {/* ─── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {/* ─── Chart ──────────────────────────────────────────────────────── */}
        <div className="px-3 md:px-5 pt-3 md:pt-5 pb-3 md:pb-4" style={{ borderBottom: '1px solid var(--tp-border-subtle)' }}>
          {/* Legend */}
          <div className="flex items-center gap-3 md:gap-4 mb-2 md:mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#3858B8' }} />
              <span className="text-[9px] md:text-[10px] text-[#9AA1B2]">Long</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#A83838' }} />
              <span className="text-[9px] md:text-[10px] text-[#9AA1B2]">Short</span>
            </div>
            {selectedAsset !== 'All' && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5" style={{ backgroundColor: '#F0D050' }} />
                <span className="text-[9px] md:text-[10px] text-[#9AA1B2]">Long %</span>
              </div>
            )}
          </div>

          <div style={{ height: isMobile ? 220 : (selectedAsset === 'All' ? 380 : 400) }}>
            <ResponsiveContainer width="100%" height="100%">
              {selectedAsset === 'All' ? (
                <BarChart data={chartData} barGap={0} barCategoryGap={isMobile ? '4%' : '8%'} margin={{ top: 10, right: 5, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: isMobile ? 7 : 9, fill: '#6F7A90' }}
                    axisLine={{ stroke: '#1E2433' }}
                    tickLine={false}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={isMobile ? 40 : 50}
                  />
                  <YAxis tick={{ fontSize: 8, fill: '#6F7A90' }} axisLine={{ stroke: '#1E2433' }} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--tp-l2)', border: '1px solid var(--tp-border)', borderRadius: 6, fontSize: 11, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                    labelStyle={{ color: 'var(--tp-text-1)' }}
                    formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name === 'longPct' ? 'Long %' : 'Short %']}
                  />
                  <Bar dataKey="longPct" stackId="a" fill="#3858B8" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="shortPct" stackId="a" fill="#A83838" radius={[2, 2, 0, 0]} />
                </BarChart>
              ) : (
                <ComposedChart data={chartData} barGap={0} barCategoryGap="4%" margin={{ top: 10, right: 5, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: isMobile ? 7 : 8, fill: '#6F7A90' }}
                    axisLine={{ stroke: '#1E2433' }}
                    tickLine={false}
                    interval={Math.max(0, Math.floor(chartData.length / (isMobile ? 8 : 15)))}
                    angle={-45}
                    textAnchor="end"
                    height={isMobile ? 40 : 55}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 8, fill: '#6F7A90' }} axisLine={{ stroke: '#1E2433' }} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 8, fill: '#6F7A90' }} axisLine={{ stroke: '#1E2433' }} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--tp-l2)', border: '1px solid var(--tp-border)', borderRadius: 6, fontSize: 11, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                    labelStyle={{ color: 'var(--tp-text-1)' }}
                  />
                  <Bar dataKey="longPos" yAxisId="right" stackId="a" fill="#3858B8" name="Long Contracts" />
                  <Bar dataKey="shortPos" yAxisId="right" stackId="a" fill="#A83838" name="Short Contracts" />
                  <Line dataKey="longPct" yAxisId="left" type="monotone" stroke="#F0D050" strokeWidth={2} dot={false} name="Long %" />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* ─── Data ───────────────────────────────────────────────────────── */}
        {dataSource === 'loading' ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-5 h-5 text-[#4C6FFF] animate-spin" />
            <span className="text-[12px] text-[#6F7A90]">Fetching live COT data...</span>
          </div>
        ) : selectedAsset === 'All' ? (
          /* ════ ALL ASSETS ════ */
          (() => {
            const sorted = sortData(effectiveLatestData);
            const count = sorted.length;
            const byNetChange = [...sorted].sort((a, b) => b.netChangePct - a.netChangePct);
            const rankMap = new Map<string, number>();
            byNetChange.forEach((r, i) => rankMap.set(r.asset, i));
            const g = latestGlobalRanges;
            const maxContracts = Math.max(g.longContracts, g.shortContracts);

            if (isMobile) {
              return (
                <div>
                  {sorted.map((row) => (
                    <MobileAssetCard key={row.asset} row={row} rank={rankMap.get(row.asset) ?? 0} count={count} />
                  ))}
                </div>
              );
            }

            return (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 1100 }}>
                  <thead>
                    <tr className="border-b border-[#252B3B]" style={{ backgroundColor: '#15181F' }}>
                      <SortHeader col="asset" label="Symbol" align="left" minW={70} />
                      <SortHeader col="longContracts" label="Long" />
                      <SortHeader col="shortContracts" label="Short" />
                      <SortHeader col="deltaLong" label={'\u0394 Long'} />
                      <SortHeader col="deltaShort" label={'\u0394 Short'} />
                      <SortHeader col="longPct" label="Long %" />
                      <SortHeader col="shortPct" label="Short %" />
                      <SortHeader col="netChangePct" label="Net Chg %" />
                      <SortHeader col="netPosition" label="Net Pos" />
                      <th className="px-2 py-2 text-center">
                        <span className="text-[10px] text-[#7A8295] uppercase tracking-wider" style={{ fontWeight: 600 }}>OI</span>
                      </th>
                      <SortHeader col="deltaOI" label={'\u0394 OI'} />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => {
                      const rank = rankMap.get(row.asset) ?? Math.floor(count / 2);
                      return (
                        <tr key={row.asset} className="border-b border-[#1C2230] transition-colors hover:brightness-125">
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getSymbolBg(rank, count) }}>
                            <span className="text-[12px] text-[#F0F2F5]" style={{ fontWeight: 600 }}>{row.asset}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.longContracts, maxContracts, 'long_abs') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.longContracts, maxContracts, 'long_abs'), fontWeight: 500 }}>{fmtNum(row.longContracts)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.shortContracts, maxContracts, 'short_abs') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.shortContracts, maxContracts, 'short_abs'), fontWeight: 500 }}>{fmtNum(row.shortContracts)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.deltaLong, g.deltaLong, 'diverging') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.deltaLong, g.deltaLong, 'diverging'), fontWeight: 500 }}>{fmtDelta(row.deltaLong)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(-row.deltaShort, g.deltaShort, 'diverging') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(-row.deltaShort, g.deltaShort, 'diverging'), fontWeight: 500 }}>{fmtDelta(row.deltaShort)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.longPct, 100, 'long_pct') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.longPct, 100, 'long_pct'), fontWeight: 500 }}>{fmtPct(row.longPct)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.shortPct, 100, 'short_pct') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.shortPct, 100, 'short_pct'), fontWeight: 500 }}>{fmtPct(row.shortPct)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.netChangePct, g.netChangePct, 'diverging') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.netChangePct, g.netChangePct, 'diverging'), fontWeight: 500 }}>{fmtNetChg(row.netChangePct)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.netPosition, g.netPosition, 'diverging') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.netPosition, g.netPosition, 'diverging'), fontWeight: 500 }}>{fmtDelta(row.netPosition)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center">
                            <span className="text-[12px] text-[#9AA1B2] tabular-nums">{row.openInterest}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.deltaOI, g.deltaOI, 'diverging') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.deltaOI, g.deltaOI, 'diverging'), fontWeight: 500 }}>{fmtDelta(row.deltaOI)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()
        ) : (
          /* ════ SYMBOL HISTORY ════ */
          (() => {
            const sorted = sortData(effectiveWeeklyData);
            const g = weeklyGlobalRanges;
            const maxContracts = Math.max(g.longContracts, g.shortContracts);
            const count = sorted.length;
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

            if (isMobile) {
              return (
                <div>
                  {sorted.map((row, idx) => (
                    <MobileWeeklyCard key={`${row.date}-${idx}`} row={row} rank={rankLookup.get(idx) ?? idx} count={count} />
                  ))}
                </div>
              );
            }

            return (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 900 }}>
                  <thead>
                    <tr className="border-b border-[#252B3B]" style={{ backgroundColor: '#15181F' }}>
                      <SortHeader col="date" label="Date" align="left" />
                      <SortHeader col="netChangePct" label="Net Chg %" />
                      <SortHeader col="longContracts" label="Long" />
                      <SortHeader col="shortContracts" label="Short" />
                      <SortHeader col="deltaLong" label={'\u0394 Long'} />
                      <SortHeader col="deltaShort" label={'\u0394 Short'} />
                      <SortHeader col="longPct" label="Long %" />
                      <SortHeader col="shortPct" label="Short %" />
                      <SortHeader col="netPosition" label="Net Pos" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, idx) => {
                      const ri = rankLookup.get(idx) ?? idx;
                      return (
                        <tr key={`${row.date}-${idx}`} className="border-b border-[#1C2230] transition-colors hover:brightness-125">
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getDateBg(ri) }}>
                            <span className="text-[12px] text-[#F0F2F5]" style={{ fontWeight: 500 }}>{row.date}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.netChangePct, g.netChangePct, 'diverging') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.netChangePct, g.netChangePct, 'diverging'), fontWeight: 500 }}>{fmtNetChg(row.netChangePct)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.longContracts, maxContracts, 'long_abs') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.longContracts, maxContracts, 'long_abs'), fontWeight: 500 }}>{fmtNum(row.longContracts)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.shortContracts, maxContracts, 'short_abs') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.shortContracts, maxContracts, 'short_abs'), fontWeight: 500 }}>{fmtNum(row.shortContracts)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.deltaLong, g.deltaLong, 'diverging') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.deltaLong, g.deltaLong, 'diverging'), fontWeight: 500 }}>{fmtDelta(row.deltaLong)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(-row.deltaShort, g.deltaShort, 'diverging') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(-row.deltaShort, g.deltaShort, 'diverging'), fontWeight: 500 }}>{fmtDelta(row.deltaShort)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.longPct, 100, 'long_pct') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.longPct, 100, 'long_pct'), fontWeight: 500 }}>{fmtPct(row.longPct)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.shortPct, 100, 'short_pct') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.shortPct, 100, 'short_pct'), fontWeight: 500 }}>{fmtPct(row.shortPct)}</span>
                          </td>
                          <td className="px-2 py-[6px] text-center" style={{ backgroundColor: getHeatBg(row.netPosition, g.netPosition, 'diverging') }}>
                            <span className="text-[12px] tabular-nums" style={{ color: getHeatText(row.netPosition, g.netPosition, 'diverging'), fontWeight: 500 }}>{fmtDelta(row.netPosition)}</span>
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

      {/* ─── Footer ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 md:px-4 py-1.5 flex-shrink-0" style={{ borderTop: '1px solid var(--tp-border-subtle)', background: 'var(--tp-l0)' }}>
        <span className="truncate" style={{ fontSize: isMobile ? 9 : 10, color: 'var(--tp-text-3)' }}>
          {selectedAsset === 'All'
            ? `${effectiveLatestData.length} symbols`
            : `${effectiveWeeklyData.length} weeks`}
          {!isMobile && ` \u2022 ${traderType} \u2022 ${reportDate}`}
        </span>
        {!isMobile && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1" style={{ fontSize: 9, color: 'var(--tp-text-3)' }}>
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#3858B8' }} />Long
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: 9, color: 'var(--tp-text-3)' }}>
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#A83838' }} />Short
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
