import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Loader2, Wifi } from 'lucide-react';
import { BarChart, Bar, XAxis, ReferenceLine, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { COT_AVAILABLE_SYMBOLS, COT_SYMBOL_MAPPINGS } from '../../utils/cotMappings';
import { useTradePilotData, ASSET_CATALOG, type AssetDef } from '../../engine/dataService';
import type { AssetScorecard, SignalInput } from '../../types/scoring';
import type { MacroRelease, TechnicalIndicator } from '../../types/database';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════
type BiasLevel = 'Very Bearish' | 'Bearish' | 'Neutral' | 'Bullish' | 'Very Bullish';

interface MetricRow {
  metric: string;
  bias: BiasLevel;
  actual: string;
  forecast: string;
  surprise: string;
}

interface SymbolData {
  tpScore: number;
  technicalScore: number;
  sentimentCotScore: number;
  fundamentalsScore: number;
  chartTrend: BiasLevel;
  seasonality: BiasLevel;
  technicalOverall: BiasLevel;
  crowdSentiment: string;
  crowdSentimentBias: BiasLevel;
  cotOverall: BiasLevel;
  cotNetBias: BiasLevel;
  cotLatestBias: BiasLevel;
  longPct: number;
  shortPct: number;
  weeklyChange: number;
  economicOverall: BiasLevel;
  economicMetrics: MetricRow[];
  inflationOverall: BiasLevel;
  inflationMetrics: MetricRow[];
  jobsOverall: BiasLevel;
  jobsMetrics: MetricRow[];
  targets: [number, number, number];
  sma20: BiasLevel;
  sma50: BiasLevel;
  sma100: BiasLevel;
  sma200: BiasLevel;
  volatility: string;
  avgMove7d: string;
  avgMove90d: string;
  scoreHistory: Array<{ date: string; score: number }>;
  newsText: string;
  newsSources: Array<{ id: number; label: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLORS & UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════
const PILL_BG: Record<BiasLevel, string> = {
  'Very Bearish': '#C74B4B',
  'Bearish': '#C74B4B',
  'Neutral': '#5A6375',
  'Bullish': '#4466CC',
  'Very Bullish': '#3B5BDB',
};

const BIAS_TEXT: Record<BiasLevel, string> = {
  'Very Bearish': '#E87070',
  'Bearish': '#D66565',
  'Neutral': '#9AA1B2',
  'Bullish': '#6B94E8',
  'Very Bullish': '#6B94E8',
};

const getScoreBoxBg = (s: number) =>
  s >= 1 ? 'rgba(68,102,204,0.18)' : s <= -1 ? 'rgba(199,75,75,0.18)' : 'rgba(111,122,144,0.12)';
const getScoreBoxColor = (s: number) =>
  s >= 1 ? '#6B94E8' : s <= -1 ? '#D66565' : '#9AA1B2';

const surpriseColor = (v: string) => {
  if (!v || v === '-' || v === '') return '#9AA1B2';
  const n = parseFloat(v.replace(/[^0-9.\-]/g, ''));
  if (isNaN(n)) return '#9AA1B2';
  return n > 0 ? '#6B94E8' : n < 0 ? '#D66565' : '#9AA1B2';
};

const overallBias = (s: number): BiasLevel => {
  if (s >= 3) return 'Very Bullish';
  if (s >= 1) return 'Bullish';
  if (s > -1) return 'Neutral';
  if (s > -3) return 'Bearish';
  return 'Very Bearish';
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT EMPTY DATA (shown while live data loads)
// ═══════════════════════════════════════════════════════════════════════════════
function emptySymbolData(): SymbolData {
  return {
    tpScore: 0, technicalScore: 0, sentimentCotScore: 0, fundamentalsScore: 0,
    chartTrend: 'Neutral', seasonality: 'Neutral', technicalOverall: 'Neutral',
    crowdSentiment: 'Awaiting data...', crowdSentimentBias: 'Neutral',
    cotOverall: 'Neutral', cotNetBias: 'Neutral', cotLatestBias: 'Neutral',
    longPct: 50, shortPct: 50, weeklyChange: 0,
    economicOverall: 'Neutral', economicMetrics: [],
    inflationOverall: 'Neutral', inflationMetrics: [],
    jobsOverall: 'Neutral', jobsMetrics: [],
    targets: [0, 0, 0],
    sma20: 'Neutral', sma50: 'Neutral', sma100: 'Neutral', sma200: 'Neutral',
    volatility: '-', avgMove7d: '-', avgMove90d: '-',
    scoreHistory: [],
    newsText: 'Loading live data...',
    newsSources: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE DATA BRIDGE — Maps scoring engine output → SymbolData
// ═══════════════════════════════════════════════════════════════════════════════

// Reverse map: COT symbol → dataService asset symbol
const COT_TO_DS_SYMBOL: Record<string, string> = {};
for (const def of ASSET_CATALOG) {
  if (def.cotSymbol) COT_TO_DS_SYMBOL[def.cotSymbol] = def.asset.symbol;
}

function directionToBias(direction: string): BiasLevel {
  switch (direction) {
    case 'bullish': return 'Bullish';
    case 'bearish': return 'Bearish';
    default: return 'Neutral';
  }
}

function biasLabelToBias(label: string): BiasLevel {
  switch (label) {
    case 'very_bullish': return 'Very Bullish';
    case 'bullish': return 'Bullish';
    case 'very_bearish': return 'Very Bearish';
    case 'bearish': return 'Bearish';
    default: return 'Neutral';
  }
}

function findReading(readings: SignalInput[], key: string): SignalInput | undefined {
  return readings.find(r => r.metric_key === key);
}

function fmtMacroVal(val: number | null | undefined, unit: string | null | undefined): string {
  if (val === null || val === undefined) return '-';
  const u = unit || '';
  if (u === '%') return `${val}%`;
  if (u === 'index') return val.toFixed(1);
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
  return val.toString();
}

function fmtSurprise(surprise: number | null | undefined, unit: string | null | undefined): string {
  if (surprise === null || surprise === undefined) return '-';
  const sign = surprise > 0 ? '+' : '';
  const u = unit || '';
  if (u === '%') return `${sign}${surprise}%`;
  if (u === 'index') return `${sign}${surprise.toFixed(1)}`;
  if (Math.abs(surprise) >= 1_000_000) return `${sign}${(surprise / 1_000_000).toFixed(2)}M`;
  if (Math.abs(surprise) >= 1_000) return `${sign}${(surprise / 1_000).toFixed(0)}k`;
  return `${sign}${surprise}`;
}

function buildMetricRows(
  readings: SignalInput[],
  macroReleases: MacroRelease[],
  category: string,
): MetricRow[] {
  const filtered = macroReleases.filter(r => r.category === category);
  return filtered.map(r => {
    // Find matching signal to get bias
    const signal = readings.find(s => s.metric_key === r.indicator_key);
    const bias: BiasLevel = signal ? directionToBias(signal.direction) : 'Neutral';
    return {
      metric: r.indicator_name,
      bias,
      actual: fmtMacroVal(r.actual, r.unit),
      forecast: fmtMacroVal(r.forecast, r.unit),
      surprise: fmtSurprise(r.surprise, r.unit),
    };
  });
}

function smaBias(price: number, sma: number | null): BiasLevel {
  if (sma === null || sma === 0) return 'Neutral';
  const pct = ((price - sma) / sma) * 100;
  if (pct > 3) return 'Very Bullish';
  if (pct > 0) return 'Bullish';
  if (pct < -3) return 'Very Bearish';
  if (pct < 0) return 'Bearish';
  return 'Neutral';
}

function deriveSMAs(
  tech: TechnicalIndicator | null | undefined,
  mock: SymbolData,
): { sma20: BiasLevel; sma50: BiasLevel; sma100: BiasLevel; sma200: BiasLevel } {
  if (!tech || tech.sma_200 === null || tech.price_vs_sma200 === null) {
    return { sma20: mock.sma20, sma50: mock.sma50, sma100: mock.sma100, sma200: mock.sma200 };
  }
  const price = tech.sma_200 * (1 + tech.price_vs_sma200 / 100);
  return {
    sma20:  smaBias(price, tech.sma_20),
    sma50:  smaBias(price, tech.sma_50),
    sma100: smaBias(price, tech.sma_100),
    sma200: smaBias(price, tech.sma_200),
  };
}

function scorecardToSymbolData(
  card: AssetScorecard,
  mock: SymbolData,
  macroReleases: Record<string, MacroRelease[]>,
  assetDef: AssetDef,
  technical?: TechnicalIndicator | null,
): SymbolData {
  const { categories, readings } = card;

  // Scale total_score (-10..+10) → tpScore (-5..+5)
  const tpScore = Math.round(card.total_score / 2);

  // Scale category scores (-2..+2) → sub-scores (-5..+5)
  const techCat = categories['technical'];
  const cotCat = categories['cot'];
  const sentCat = categories['sentiment'];
  const growthCat = categories['eco_growth'];
  const inflCat = categories['inflation'];
  const jobsCat = categories['jobs'];
  const ratesCat = categories['rates'];

  const technicalScore = Math.round((techCat?.score ?? 0) * 2.5);
  const cotAvg = ((cotCat?.score ?? 0) + (sentCat?.score ?? 0)) / 2;
  const sentimentCotScore = Math.round(cotAvg * 2.5);
  const fundAvg = ((growthCat?.score ?? 0) + (inflCat?.score ?? 0) + (jobsCat?.score ?? 0) + (ratesCat?.score ?? 0)) / 4;
  const fundamentalsScore = Math.round(fundAvg * 2.5);

  // BiasLevel from directions
  const technicalOverall = directionToBias(techCat?.direction ?? 'neutral');
  const cotOverall = directionToBias(cotCat?.direction ?? 'neutral');
  const crowdSentimentBias = directionToBias(sentCat?.direction ?? 'neutral');
  const economicOverall = directionToBias(growthCat?.direction ?? 'neutral');
  const inflationOverall = directionToBias(inflCat?.direction ?? 'neutral');
  const jobsOverall = directionToBias(jobsCat?.direction ?? 'neutral');

  // Individual signal readings
  const trendDaily = findReading(readings, 'trend_daily');
  const seasonalitySignal = findReading(readings, 'seasonality');
  const cotNetSignal = findReading(readings, 'cot_nc_net');
  const cotPctlSignal = findReading(readings, 'cot_percentile');
  const cotChangeSignal = findReading(readings, 'cot_nc_change');
  const sentimentSignal = findReading(readings, 'retail_sentiment');

  // COT long/short from retail sentiment raw data
  const longPct = sentimentSignal?.raw_value ?? mock.longPct;
  const shortPct = sentimentSignal ? (100 - (sentimentSignal.raw_value ?? 50)) : mock.shortPct;
  const weeklyChange = cotChangeSignal?.raw_value ?? mock.weeklyChange;

  // Crowd sentiment text
  const crowdText = crowdSentimentBias === 'Bullish' || crowdSentimentBias === 'Very Bullish'
    ? 'Crowd sentiment is bullish'
    : crowdSentimentBias === 'Bearish' || crowdSentimentBias === 'Very Bearish'
    ? 'Crowd sentiment is bearish'
    : 'Crowd sentiment is mixed';

  // Macro metrics — determine primary economy
  let econCode = 'US';
  const { asset, links } = assetDef;
  if (asset.asset_class === 'fx' && asset.base_currency) {
    const ccyToEcon: Record<string, string> = {
      EUR: 'EU', GBP: 'UK', USD: 'US', JPY: 'JP',
      AUD: 'AU', NZD: 'NZ', CAD: 'CA', CHF: 'CH',
    };
    econCode = ccyToEcon[asset.base_currency] ?? 'US';
  } else {
    econCode = (asset.metadata as Record<string, string>)?.economy ?? 'US';
  }

  const econReleases = macroReleases[econCode] || [];
  const ecoMetrics = buildMetricRows(readings, econReleases, 'growth');
  const inflMetrics = buildMetricRows(readings, econReleases, 'inflation');
  const jobMetrics = buildMetricRows(readings, econReleases, 'jobs');

  return {
    tpScore,
    technicalScore,
    sentimentCotScore,
    fundamentalsScore,
    chartTrend: trendDaily ? directionToBias(trendDaily.direction) : mock.chartTrend,
    seasonality: seasonalitySignal ? directionToBias(seasonalitySignal.direction) : mock.seasonality,
    technicalOverall,
    crowdSentiment: crowdText,
    crowdSentimentBias,
    cotOverall,
    cotNetBias: cotNetSignal ? directionToBias(cotNetSignal.direction) : mock.cotNetBias,
    cotLatestBias: cotPctlSignal ? directionToBias(cotPctlSignal.direction) : mock.cotLatestBias,
    longPct,
    shortPct,
    weeklyChange,
    economicOverall,
    economicMetrics: ecoMetrics.length > 0 ? ecoMetrics : mock.economicMetrics,
    inflationOverall,
    inflationMetrics: inflMetrics.length > 0 ? inflMetrics : mock.inflationMetrics,
    jobsOverall,
    jobsMetrics: jobMetrics.length > 0 ? jobMetrics : mock.jobsMetrics,
    // Technical snapshot — derive SMA biases from live price data
    targets: mock.targets,
    ...deriveSMAs(technical, mock),
    volatility: technical?.volatility != null
      ? (technical.volatility > 25 ? 'High' : technical.volatility > 12 ? 'Medium' : 'Low')
      : mock.volatility,
    avgMove7d: mock.avgMove7d,
    avgMove90d: mock.avgMove90d,
    scoreHistory: mock.scoreHistory,
    newsText: mock.newsText,
    newsSources: mock.newsSources,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// GAUGE COMPONENT (SVG)
// ═══════════════════════════════════════════════════════════════════════════════
const CX = 120, CY = 120, R = 90;
const ptc = (angle: number, r: number) => ({
  x: CX + r * Math.cos((angle * Math.PI) / 180),
  y: CY - r * Math.sin((angle * Math.PI) / 180),
});
const arcPath = (start: number, end: number, r: number) => {
  const s = ptc(start, r), e = ptc(end, r);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 0 0 ${e.x} ${e.y}`;
};

const ZONE_COLORS = ['#C74B4B', '#D68A6A', '#6F7A90', '#6B94C8', '#4466CC'];
const ZONE_LABELS = ['+ Bear', 'Bear', 'Neutral', 'Bull', '+ Bull'];
const ZONE_ANGLES = [180, 144, 108, 72, 36, 0];

function Gauge({ score }: { score: number }) {
  const needleAngle = 180 - ((score + 5) / 10) * 180;
  const tip = ptc(needleAngle, 70);
  const color = getScoreBoxColor(score);

  return (
    <svg viewBox="0 0 240 160" className="w-full max-w-[260px] m-[0px]">
      {/* Zone arcs */}
      {ZONE_COLORS.map((c, i) => (
        <path
          key={i}
          d={arcPath(ZONE_ANGLES[i], ZONE_ANGLES[i + 1], R)}
          fill="none"
          stroke={c}
          strokeWidth="14"
          opacity="0.35"
          strokeLinecap="butt"
        />
      ))}
      {/* Tick marks */}
      {Array.from({ length: 11 }).map((_, i) => {
        const angle = 180 - i * 18;
        const inner = ptc(angle, 78);
        const outer = ptc(angle, R - 1);
        return (
          <line
            key={i}
            x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
            stroke="#4A5568" strokeWidth="1.5"
          />
        );
      })}
      {/* Zone labels */}
      {ZONE_LABELS.map((label, i) => {
        const midAngle = (ZONE_ANGLES[i] + ZONE_ANGLES[i + 1]) / 2;
        const p = ptc(midAngle, R + 14);
        return (
          <text
            key={i} x={p.x} y={p.y}
            fill={ZONE_COLORS[i]} fontSize="8" fontWeight="600"
            textAnchor="middle" dominantBaseline="middle"
          >
            {label}
          </text>
        );
      })}
      {/* Needle */}
      <line
        x1={CX} y1={CY} x2={tip.x} y2={tip.y}
        stroke={color} strokeWidth="2.5" strokeLinecap="round"
      />
      <circle cx={CX} cy={CY} r="5" fill={color} />
      <circle cx={CX} cy={CY} r="2.5" fill="#14161C" />
      {/* Score display */}
      <text
        x={CX} y={CY + 22}
        fill={color} fontSize="28" fontWeight="700"
        textAnchor="middle" dominantBaseline="middle"
      >
        {score}
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BIAS PILL
// ═══════════════════════════════════════════════════════════════════════════════
function BiasPill({ bias, compact }: { bias: BiasLevel; compact?: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center text-white"
      style={{
        backgroundColor: PILL_BG[bias],
        padding: compact ? '1px 8px' : '2px 12px',
        fontSize: compact ? '11px' : '12px',
        fontWeight: 600,
        minWidth: compact ? '70px' : '85px',
        borderRadius: '2px',
        lineHeight: '18px',
      }}
    >
      {bias}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TABLE SECTION COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Category header row
function SectionHeader({
  title,
  bias,
  columns,
}: {
  title: string;
  bias: BiasLevel;
  columns?: string[];
}) {
  return (
    <div
      className="flex items-center gap-0"
      style={{ backgroundColor: 'var(--tp-l0)', borderBottom: '1px solid var(--tp-border)' }}
    >
      <div className="flex items-center gap-3 flex-1 px-3 py-[6px]">
        <span className="text-[12px]" style={{ color: 'var(--tp-text-1)', fontWeight: 500 }}>{title}</span>
        <span className="text-[12px]" style={{ color: BIAS_TEXT[bias], fontWeight: 600 }}>{bias}</span>
      </div>
      {columns && columns.length > 0 && (
        <div className="flex">
          {columns.map((col) => (
            <span
              key={col}
              className="text-[11px] text-right px-2 py-[6px]"
              style={{ width: '76px', fontWeight: 500, fontStyle: 'italic', color: 'var(--tp-text-3)' }}
            >
              {col}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Data row for metric tables (Economic, Inflation, Jobs)
function DataRow({ row }: { row: MetricRow }) {
  return (
    <div className="flex items-center transition-colors" style={{ borderBottom: '1px solid var(--tp-border-subtle)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tp-l3)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div className="flex-1 flex items-center gap-2 px-3 py-[4px]">
        <span className="text-[12px]" style={{ width: '170px', flexShrink: 0, color: 'var(--tp-text-2)' }}>
          {row.metric}
        </span>
        <BiasPill bias={row.bias} compact />
      </div>
      <div className="flex">
        <span className="text-[12px] text-right px-2 py-[4px]" style={{ width: '76px', color: 'var(--tp-text-1)' }}>
          {row.actual}
        </span>
        <span className="text-[12px] text-right px-2 py-[4px]" style={{ width: '76px', color: 'var(--tp-text-3)' }}>
          {row.forecast}
        </span>
        <span
          className="text-[12px] text-right px-2 py-[4px]"
          style={{ width: '76px', color: surpriseColor(row.surprise), fontWeight: 500 }}
        >
          {row.surprise || '-'}
        </span>
      </div>
    </div>
  );
}

// COT rows
function CotSection({ data }: { data: SymbolData }) {
  return (
    <div>
      <SectionHeader title="Institutional activity bias" bias={data.cotOverall} />
      {/* Net Positioning */}
      <div className="flex items-center border-b border-[#1A2030] hover:bg-[#141A24] transition-colors">
        <div className="flex-1 flex items-center gap-2 px-3 py-[4px]">
          <span className="text-[12px] text-[#9AA1B2]" style={{ width: '170px', flexShrink: 0 }}>
            COT - Net Positioning
          </span>
          <BiasPill bias={data.cotNetBias} compact />
        </div>
        <div className="flex">
          <span className="text-[11px] text-[#6F7A90] text-right px-2 py-[4px] italic" style={{ width: '76px' }}>Long %</span>
          <span className="text-[11px] text-[#6F7A90] text-right px-2 py-[4px] italic" style={{ width: '76px' }}>Short %</span>
          <span className="text-[11px] text-[#6F7A90] text-right px-2 py-[4px] italic" style={{ width: '76px' }}>Change %</span>
        </div>
      </div>
      {/* Latest Buys/Sells */}
      <div className="flex items-center border-b border-[#1A2030] hover:bg-[#141A24] transition-colors">
        <div className="flex-1 flex items-center gap-2 px-3 py-[4px]">
          <span className="text-[12px] text-[#9AA1B2]" style={{ width: '170px', flexShrink: 0 }}>
            COT - Latest Buys/Sells
          </span>
          <BiasPill bias={data.cotLatestBias} compact />
        </div>
        <div className="flex">
          <span className="text-[12px] text-[#C8CDD8] text-right px-2 py-[4px]" style={{ width: '76px' }}>
            {data.longPct.toFixed(2)}%
          </span>
          <span
            className="text-[12px] text-right px-2 py-[4px]"
            style={{ width: '76px', color: data.shortPct > 50 ? '#D66565' : '#C8CDD8', fontWeight: data.shortPct > 50 ? 600 : 400 }}
          >
            {data.shortPct.toFixed(2)}
          </span>
          <span
            className="text-[12px] text-right px-2 py-[4px]"
            style={{ width: '76px', color: data.weeklyChange < 0 ? '#D66565' : '#6B94E8', fontWeight: 500 }}
          >
            {data.weeklyChange > 0 ? '+' : ''}{data.weeklyChange.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// Technical bias section + crowd sentiment (side by side)
function TechnicalSection({ data }: { data: SymbolData }) {
  return (
    <div className="grid grid-cols-[1fr_auto]">
      {/* Technical bias */}
      <div className="border-r border-[#1A2030]">
        <SectionHeader title="Technical bias" bias={data.technicalOverall} />
        <div className="flex items-center border-b border-[#1A2030] hover:bg-[#141A24] transition-colors px-3 py-[4px]">
          <span className="text-[12px] text-[#9AA1B2] flex-1">4H / Daily Chart Trend</span>
          <BiasPill bias={data.chartTrend} compact />
        </div>
        <div className="flex items-center border-b border-[#1A2030] hover:bg-[#141A24] transition-colors px-3 py-[4px]">
          <span className="text-[12px] text-[#9AA1B2] flex-1">Current Month&apos;s Seasonality</span>
          <BiasPill bias={data.seasonality} compact />
        </div>
      </div>
      {/* Crowd sentiment */}
      <div style={{ width: '220px' }}>
        <div
          className="flex items-center gap-2 px-3 py-[6px] border-b border-[#2A3040]"
          style={{ backgroundColor: '#181D28' }}
        >
          <span className="text-[12px] text-[#C8CDD8]" style={{ fontWeight: 500 }}>Crowd sentiment signal</span>
          <span className="text-[12px]" style={{ color: BIAS_TEXT[data.crowdSentimentBias], fontWeight: 600 }}>
            {data.crowdSentimentBias}
          </span>
        </div>
        <div className="px-3 py-[6px] border-b border-[#1A2030]">
          <span className="text-[12px] text-[#7A8295]">{data.crowdSentiment}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AssetProfile() {
  const [selectedSymbol, setSelectedSymbol] = useState('SPX');
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: tpData, loading: tpLoading } = useTradePilotData();

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sortedSymbols = useMemo(() => {
    const filtered = COT_AVAILABLE_SYMBOLS.filter((s) =>
      s.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (COT_SYMBOL_MAPPINGS[s]?.displayName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
    return filtered.sort((a, b) => a.localeCompare(b));
  }, [searchQuery]);

  // Live scores from scoring engine (keyed by COT symbol)
  const liveScores = useMemo((): Record<string, number> => {
    if (!tpData) return {};
    const result: Record<string, number> = {};
    for (const def of ASSET_CATALOG) {
      if (!def.cotSymbol) continue;
      const card = tpData.scorecards[def.asset.symbol];
      if (card) {
        result[def.cotSymbol] = Math.round(card.total_score / 2);
      }
    }
    return result;
  }, [tpData]);

  const data = useMemo(() => {
    const empty = emptySymbolData();
    if (!tpData) return empty;

    // Map COT symbol → dataService symbol
    const dsSymbol = COT_TO_DS_SYMBOL[selectedSymbol];
    if (!dsSymbol) return empty;

    const card = tpData.scorecards[dsSymbol];
    if (!card) return empty;

    const assetDef = ASSET_CATALOG.find(d => d.asset.symbol === dsSymbol);
    if (!assetDef) return empty;

    const technical = tpData.technicals?.[dsSymbol] ?? null;
    return scorecardToSymbolData(card, empty, tpData.macroReleases, assetDef, technical);
  }, [selectedSymbol, tpData]);

  const displayName = COT_SYMBOL_MAPPINGS[selectedSymbol]?.displayName || selectedSymbol;
  const bias = overallBias(data.tpScore);
  const currentScore = liveScores[selectedSymbol] ?? 0;

  return (
    <div className="h-full overflow-auto" style={{ background: 'var(--tp-l1)' }}>
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--tp-border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-[15px]" style={{ fontWeight: 600, color: 'var(--tp-text-1)' }}>Asset Profile</span>
            <span className="text-[11px]" style={{ color: 'var(--tp-text-3)' }}>tradepilot.app</span>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md" style={{ background: 'var(--tp-l2)' }}>
              {tpLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--tp-text-3)' }} />
              ) : (
                <Wifi className="w-3 h-3" style={{ color: 'var(--tp-bullish)' }} />
              )}
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', color: tpLoading ? 'var(--tp-text-3)' : 'var(--tp-bullish)' }}>
                {tpLoading ? 'LOADING' : 'LIVE'}
              </span>
            </div>
          </div>
        </div>
        <span className="text-[10px] max-w-[480px] text-right leading-tight" style={{ color: 'var(--tp-text-3)' }}>
          The readings generated by TradePilot are for informational purposes only, do not constitute financial advice.
        </span>
      </div>

      {/* ─── Main 2-Column Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[370px_1fr] min-h-0">
        {/* ═══ LEFT COLUMN ═══════════════════════════════════════════ */}
        <div style={{ borderRight: '1px solid var(--tp-border-subtle)' }}>
          {/* Symbol Dropdown Selector */}
          <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--tp-border-subtle)' }} ref={dropdownRef}>
            <div className="relative">
              <button
                onClick={() => { setDropdownOpen(!dropdownOpen); setSearchQuery(''); }}
                className="w-full flex items-center justify-between px-3 py-[6px] rounded border border-[#2A3040] hover:border-[#3A4560] transition-colors"
                style={{ backgroundColor: '#141823' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#C8CDD8]" style={{ fontWeight: 600 }}>
                    {displayName.toUpperCase()}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: getScoreBoxColor(currentScore), fontWeight: 600 }}
                  >
                    ({currentScore > 0 ? '+' : ''}{currentScore})
                  </span>
                </div>
                <ChevronDown
                  className="w-3.5 h-3.5 text-[#6F7A90] transition-transform"
                  style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>

              {/* Dropdown panel */}
              {dropdownOpen && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 rounded border border-[#2A3040] overflow-hidden z-50"
                  style={{ backgroundColor: '#141823', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                >
                  {/* Search input */}
                  <div className="px-2 py-1.5 border-b border-[#1E2433]">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5A6375]" />
                      <input
                        type="text"
                        placeholder="Search symbols..."
                        className="w-full bg-[#14161C] pl-7 pr-2 py-1.5 text-[12px] text-[#E6E9F0] placeholder-[#5A6375] focus:outline-none border border-[#2A3040] rounded focus:border-[#4C6FFF] transition-colors"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  {/* Column headers */}
                  <div className="grid grid-cols-2 px-3 py-[3px] border-b border-[#1E2433]" style={{ backgroundColor: '#14161C' }}>
                    <span className="text-[10px] text-[#5A6375]" style={{ fontWeight: 500 }}>SYMBOL</span>
                    <span className="text-[10px] text-[#5A6375] text-right" style={{ fontWeight: 500 }}>SCORE</span>
                  </div>
                  {/* Symbol options */}
                  <div className="max-h-[240px] overflow-y-auto">
                    {sortedSymbols.map((sym) => {
                      const s = liveScores[sym] ?? 0;
                      const isSelected = sym === selectedSymbol;
                      return (
                        <div
                          key={sym}
                          className="grid grid-cols-2 px-3 py-[5px] cursor-pointer transition-colors hover:bg-[#1A2235]"
                          style={{
                            backgroundColor: isSelected ? '#1A2235' : 'transparent',
                            borderLeft: isSelected ? '2px solid #4C6FFF' : '2px solid transparent',
                          }}
                          onClick={() => {
                            setSelectedSymbol(sym);
                            setDropdownOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <span
                            className="text-[12px]"
                            style={{ color: isSelected ? '#E6E9F0' : '#9AA1B2', fontWeight: isSelected ? 600 : 400 }}
                          >
                            {COT_SYMBOL_MAPPINGS[sym]?.displayName?.toUpperCase() || sym}
                          </span>
                          <span
                            className="text-[12px] text-right"
                            style={{ color: getScoreBoxColor(s), fontWeight: 600 }}
                          >
                            {s}
                          </span>
                        </div>
                      );
                    })}
                    {sortedSymbols.length === 0 && (
                      <div className="px-3 py-3 text-center text-[11px] text-[#5A6375]">No symbols found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── Score Over Time Chart ───────────────────────────────── */}
          <div className="px-3 pt-2 pb-1 border-b border-[#1E2433]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-[#6F7A90]" style={{ fontWeight: 500 }}>TradePilot score over time</span>
            </div>
            <div className="relative">
              {/* Bullish / Bearish labels */}
              <div className="absolute right-0 top-0 flex flex-col justify-between h-full z-10 pointer-events-none">
                <span className="text-[9px] text-[#4466CC] opacity-60">Bullish</span>
                <span className="text-[9px] text-[#C74B4B] opacity-60">Bearish</span>
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={data.scoreHistory} margin={{ top: 8, right: 36, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: '#5A6375' }}
                    axisLine={{ stroke: '#1E2433' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <ReferenceLine y={0} stroke="#2A3040" strokeWidth={1} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1A2030', border: '1px solid #2A3040', borderRadius: '4px', fontSize: '11px' }}
                    labelStyle={{ color: '#9AA1B2' }}
                    itemStyle={{ color: '#E6E9F0' }}
                  />
                  <Bar dataKey="score" radius={[2, 2, 0, 0]} maxBarSize={18}>
                    {data.scoreHistory.map((entry, i) => (
                      <Cell key={i} fill={entry.score >= 0 ? '#4466CC' : '#C74B4B'} opacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ─── Targets ────────────────────────────────────────────── */}
          <div className="border-b border-[#1E2433]">
            {data.targets.map((t, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-[3px] hover:bg-[#141A24] transition-colors">
                <span className="text-[12px] text-[#9AA1B2]">Target {i + 1}</span>
                <span className="text-[12px] text-[#C8CDD8]" style={{ fontWeight: 500 }}>{t.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* ─── SMA & Volatility ───────────────────────────────────── */}
          <div>
            {([
              ['20 day SMA', data.sma20],
              ['50 day SMA', data.sma50],
              ['100 day SMA', data.sma100],
              ['200 day SMA', data.sma200],
            ] as [string, BiasLevel][]).map(([label, b]) => (
              <div key={label} className="flex items-center justify-between px-3 py-[3px] hover:bg-[#141A24] transition-colors">
                <span className="text-[12px] text-[#9AA1B2]">{label}</span>
                <span className="text-[12px]" style={{ color: BIAS_TEXT[b], fontWeight: 600, fontStyle: 'italic' }}>{b}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-[3px]">
              <span className="text-[12px] text-[#9AA1B2]">Recent realized volatility</span>
              <span className="text-[12px] text-[#C8CDD8]" style={{ fontWeight: 500 }}>{data.volatility}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-[3px]">
              <span className="text-[12px] text-[#9AA1B2]">Avg. daily move (7 days)</span>
              <span className="text-[12px] text-[#6B94E8]" style={{ fontWeight: 500 }}>{data.avgMove7d}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-[3px]">
              <span className="text-[12px] text-[#9AA1B2]">Avg. daily move (90 days)</span>
              <span className="text-[12px] text-[#6B94E8]" style={{ fontWeight: 500 }}>{data.avgMove90d}</span>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN ══════════════════════════════════════════ */}
        <div className="min-w-0">
          {/* ─── Selected Symbol + Gauge Row ─────────────────────────── */}
          <div className="grid grid-cols-[1fr_1fr] border-b border-[#1E2433]">
            {/* Gauge panel */}
            <div className="flex flex-col items-center justify-center py-3 px-4 border-r border-[#1E2433]">
              {/* Symbol + Bias label */}
              <div className="text-center mb-1">
                <div className="text-[14px] text-[#C8CDD8]" style={{ fontWeight: 500 }}>
                  Symbol: {displayName.toUpperCase()}
                </div>
                <div
                  className="text-[18px] mt-0.5"
                  style={{ color: BIAS_TEXT[bias], fontWeight: 700 }}
                >
                  {bias}
                </div>
              </div>
              <Gauge score={data.tpScore} />
              {/* Score breakdown */}
              <div className="w-full max-w-[260px] mt-1 space-y-0">
                {([
                  ['TradePilot score', data.tpScore],
                  ['Technical score', data.technicalScore],
                  ['Sentiment + COT score', data.sentimentCotScore],
                  ['Fundamentals score', data.fundamentalsScore],
                ] as [string, number][]).map(([label, score]) => (
                  <div key={label} className="flex items-center justify-between py-[3px]">
                    <span className="text-[12px] text-[#9AA1B2]">{label}</span>
                    <span
                      className="text-[13px] text-right"
                      style={{
                        color: getScoreBoxColor(score),
                        fontWeight: 700,
                        backgroundColor: getScoreBoxBg(score),
                        padding: '1px 10px',
                        borderRadius: '2px',
                        minWidth: '40px',
                        textAlign: 'center',
                      }}
                    >
                      {score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right side: Technical + Crowd + COT */}
            <div>
              <TechnicalSection data={data} />
              <CotSection data={data} />
            </div>
          </div>

          {/* ─── Economic Growth Bias ──────────────────────────���─────── */}
          <div>
            <SectionHeader
              title="Economic growth bias"
              bias={data.economicOverall}
              columns={['Actual', 'Forecast', 'Surprise']}
            />
            {data.economicMetrics.map((row, i) => (
              <DataRow key={i} row={row} />
            ))}
          </div>

          {/* ─── Inflation Bias ──────────────────────────────────────── */}
          <div>
            <SectionHeader
              title="Inflation bias"
              bias={data.inflationOverall}
              columns={['Actual', 'Forecast', 'Surprise']}
            />
            {data.inflationMetrics.map((row, i) => (
              <DataRow key={i} row={row} />
            ))}
          </div>

          {/* ─── Jobs Market Bias ────────────────────────────────────── */}
          <div>
            <SectionHeader
              title="Jobs market bias"
              bias={data.jobsOverall}
              columns={['Actual', 'Forecast', 'Surprise']}
            />
            {data.jobsMetrics.map((row, i) => (
              <DataRow key={i} row={row} />
            ))}
          </div>

          {/* ─── News Section ────────────────────────────────────────── */}
          <div className="border-t border-[#1E2433]">
            <div className="px-4 py-2 border-b border-[#1E2433]" style={{ backgroundColor: '#141823' }}>
              <span className="text-[14px] text-[#E6E9F0]" style={{ fontWeight: 600 }}>
                {displayName.toUpperCase()} NEWS
              </span>
            </div>
            <div className="px-4 py-3">
              <p className="text-[12px] text-[#C8CDD8] leading-[1.7]" style={{ fontWeight: 500 }}>
                {data.newsText}
              </p>
              {data.newsSources.length > 0 && (
                <div className="flex gap-3 mt-2">
                  {data.newsSources.map((src) => (
                    <span key={src.id} className="text-[11px] text-[#6B94E8] cursor-pointer hover:underline">
                      {src.id}. [{src.label}]
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}