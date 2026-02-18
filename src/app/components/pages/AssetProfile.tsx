import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, ReferenceLine, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { COT_AVAILABLE_SYMBOLS, COT_SYMBOL_MAPPINGS } from '../../utils/cotMappings';

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
  nyxScore: number;
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
// SYMBOL EDGE-FINDER SCORES (all 19 symbols)
// ═══════════════════════════════════════════════════════════════════════════════
const SCORES: Record<string, number> = {
  Gold: 1, SILVER: -3, PLATINUM: -2, USOIL: 0, SPX: -5,
  NASDAQ: -4, DOW: -1, RUSSELL: 0, NIKKEI: -1, EUR: -2,
  GBP: 1, JPY: -1, AUD: -3, NZD: -2, CAD: 1,
  CHF: 0, USD: 2, COPPER: 1, BTC: -1, US10T: 1,
};

// ═══════════════════════════════════════════════════════════════════════════════
// DETAILED MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════════
const SPX_DATA: SymbolData = {
  nyxScore: -5, technicalScore: -3, sentimentCotScore: -2, fundamentalsScore: 0,
  chartTrend: 'Bearish', seasonality: 'Bearish', technicalOverall: 'Very Bearish',
  crowdSentiment: 'Crowd sentiment is mixed', crowdSentimentBias: 'Neutral',
  cotOverall: 'Bearish', cotNetBias: 'Bearish', cotLatestBias: 'Bearish',
  longPct: 39.56, shortPct: 60.44, weeklyChange: -2.12,
  economicOverall: 'Very Bullish',
  economicMetrics: [
    { metric: 'GDP Growth QoQ', bias: 'Bullish', actual: '4.40%', forecast: '4.30%', surprise: '0.10%' },
    { metric: 'Manufacturing PMIS', bias: 'Bullish', actual: '52.6', forecast: '48.5', surprise: '4.10' },
    { metric: 'Services PMIS', bias: 'Bullish', actual: '53.8', forecast: '53.5', surprise: '0.30' },
    { metric: 'Retail Sales MoM', bias: 'Bullish', actual: '0.60', forecast: '0.50', surprise: '0.10' },
    { metric: 'Consumer Confidence', bias: 'Bearish', actual: '84.5', forecast: '90.6', surprise: '-6' },
  ],
  inflationOverall: 'Neutral',
  inflationMetrics: [
    { metric: 'CPI YoY', bias: 'Neutral', actual: '2.7%', forecast: '2.7%', surprise: '0.0%' },
    { metric: 'PPI YoY', bias: 'Bearish', actual: '3%', forecast: '2.7%', surprise: '0.3%' },
    { metric: 'PCE YoY', bias: 'Neutral', actual: '2.8%', forecast: '2.8%', surprise: '0%' },
    { metric: 'US02Yield (21 day SMA)', bias: 'Bullish', actual: '', forecast: '', surprise: '' },
  ],
  jobsOverall: 'Very Bearish',
  jobsMetrics: [
    { metric: 'Non-Farm Payroll', bias: 'Bearish', actual: '50k', forecast: '66k', surprise: '-16k' },
    { metric: 'Unemployment Rate %', bias: 'Bullish', actual: '4.40%', forecast: '4.50%', surprise: '-0.10%' },
    { metric: 'Weekly Jobless Claims', bias: 'Bearish', actual: '231k', forecast: '212k', surprise: '19k' },
    { metric: 'ADP Employment Change', bias: 'Bearish', actual: '22', forecast: '46', surprise: '-24' },
    { metric: 'JOLTS Job Openings', bias: 'Bearish', actual: '6.54M', forecast: '7.20M', surprise: '-0.66M' },
  ],
  targets: [6875.58, 6824.58, 6773.58],
  sma20: 'Bullish', sma50: 'Bullish', sma100: 'Bullish', sma200: 'Bullish',
  volatility: 'High', avgMove7d: '0.8%', avgMove90d: '0.6%',
  scoreHistory: [
    { date: 'Dec 26', score: -1 }, { date: 'Dec 30', score: -2 },
    { date: 'Jan 3', score: -3 }, { date: 'Jan 7', score: -2 },
    { date: 'Jan 11', score: -4 }, { date: 'Jan 15', score: -3 },
    { date: 'Jan 19', score: -5 }, { date: 'Jan 23', score: -4 },
    { date: 'Jan 27', score: -5 }, { date: 'Jan 31', score: -5 },
    { date: 'Feb 4', score: -5 }, { date: 'Feb 8', score: -5 },
  ],
  newsText: 'US growth slowdown and tumbling confidence underpin broader dollar weakness impacting equities, with Trump presidency uncertainties reinforcing bearish USD sentiment relevant to S&P 500 performance[1]. Federal Reserve\'s 175 bps cuts since September 2024 and unchanged funds rate at 3.75%-4.00% in January signal potential further easing, pressuring yields and supporting index resilience[3]. Recent market data shows mid-table G10 currency strength translating to stable equity sentiment, with forecasts implying upside if dollar debasement persists without sharp volatility[3].',
  newsSources: [{ id: 1, label: 'source 1' }, { id: 3, label: 'source 3' }],
};

const GOLD_DATA: SymbolData = {
  nyxScore: 1, technicalScore: 2, sentimentCotScore: 1, fundamentalsScore: -1,
  chartTrend: 'Bullish', seasonality: 'Bullish', technicalOverall: 'Bullish',
  crowdSentiment: 'Crowd sentiment is bullish', crowdSentimentBias: 'Bullish',
  cotOverall: 'Bullish', cotNetBias: 'Bullish', cotLatestBias: 'Bullish',
  longPct: 68.20, shortPct: 31.80, weeklyChange: 4.50,
  economicOverall: 'Very Bullish',
  economicMetrics: SPX_DATA.economicMetrics,
  inflationOverall: 'Neutral',
  inflationMetrics: [
    { metric: 'CPI YoY', bias: 'Neutral', actual: '2.7%', forecast: '2.7%', surprise: '0.0%' },
    { metric: 'PPI YoY', bias: 'Bullish', actual: '3%', forecast: '2.7%', surprise: '0.3%' },
    { metric: 'PCE YoY', bias: 'Neutral', actual: '2.8%', forecast: '2.8%', surprise: '0%' },
    { metric: 'US02Yield (21 day SMA)', bias: 'Bearish', actual: '', forecast: '', surprise: '' },
  ],
  jobsOverall: 'Very Bearish',
  jobsMetrics: SPX_DATA.jobsMetrics,
  targets: [2920.50, 2895.30, 2870.10],
  sma20: 'Bullish', sma50: 'Bullish', sma100: 'Bullish', sma200: 'Bullish',
  volatility: 'Medium', avgMove7d: '1.2%', avgMove90d: '0.9%',
  scoreHistory: [
    { date: 'Dec 26', score: 2 }, { date: 'Dec 30', score: 1 },
    { date: 'Jan 3', score: 1 }, { date: 'Jan 7', score: 2 },
    { date: 'Jan 11', score: 1 }, { date: 'Jan 15', score: 1 },
    { date: 'Jan 19', score: 0 }, { date: 'Jan 23', score: 1 },
    { date: 'Jan 27', score: 1 }, { date: 'Jan 31', score: 1 },
    { date: 'Feb 4', score: 2 }, { date: 'Feb 8', score: 1 },
  ],
  newsText: 'Gold continues to benefit from safe-haven demand amid global uncertainty, with central bank buying reaching record levels[1]. The Federal Reserve\'s dovish pivot and potential rate cuts support gold prices as real yields decline[2]. Geopolitical tensions and de-dollarization trends provide additional tailwinds[3].',
  newsSources: [{ id: 1, label: 'source 1' }, { id: 2, label: 'source 2' }, { id: 3, label: 'source 3' }],
};

const EUR_DATA: SymbolData = {
  nyxScore: -2, technicalScore: -3, sentimentCotScore: -1, fundamentalsScore: -1,
  chartTrend: 'Bearish', seasonality: 'Neutral', technicalOverall: 'Bearish',
  crowdSentiment: 'Crowd sentiment is bearish', crowdSentimentBias: 'Bearish',
  cotOverall: 'Bearish', cotNetBias: 'Bearish', cotLatestBias: 'Bearish',
  longPct: 32.10, shortPct: 67.90, weeklyChange: -3.80,
  economicOverall: 'Bearish',
  economicMetrics: [
    { metric: 'GDP Growth QoQ', bias: 'Bearish', actual: '0.1%', forecast: '0.2%', surprise: '-0.10%' },
    { metric: 'Manufacturing PMIS', bias: 'Bearish', actual: '46.1', forecast: '46.8', surprise: '-0.70' },
    { metric: 'Services PMIS', bias: 'Bearish', actual: '51.4', forecast: '51.6', surprise: '-0.20' },
    { metric: 'Retail Sales MoM', bias: 'Bearish', actual: '-0.3%', forecast: '0.2%', surprise: '-0.50%' },
    { metric: 'Consumer Confidence', bias: 'Bearish', actual: '-15.4', forecast: '-14.2', surprise: '-1.20' },
  ],
  inflationOverall: 'Neutral',
  inflationMetrics: [
    { metric: 'CPI YoY', bias: 'Neutral', actual: '2.4%', forecast: '2.4%', surprise: '0.0%' },
    { metric: 'PPI YoY', bias: 'Bearish', actual: '-0.3%', forecast: '-0.1%', surprise: '-0.20%' },
    { metric: 'PCE YoY', bias: 'Neutral', actual: '2.6%', forecast: '2.6%', surprise: '0.0%' },
    { metric: 'EU 2Y Yield (SMA)', bias: 'Bearish', actual: '', forecast: '', surprise: '' },
  ],
  jobsOverall: 'Bearish',
  jobsMetrics: [
    { metric: 'Unemployment Rate', bias: 'Bearish', actual: '6.4%', forecast: '6.3%', surprise: '0.10%' },
    { metric: 'Employment Change', bias: 'Bearish', actual: '0.2%', forecast: '0.3%', surprise: '-0.10%' },
    { metric: 'German Unemployment', bias: 'Bearish', actual: '6.1%', forecast: '6.0%', surprise: '0.10%' },
    { metric: 'French Claims', bias: 'Bearish', actual: '2.89M', forecast: '2.85M', surprise: '40k' },
    { metric: 'Job Vacancies', bias: 'Bearish', actual: '2.1M', forecast: '2.3M', surprise: '-0.20M' },
  ],
  targets: [1.0620, 1.0580, 1.0540],
  sma20: 'Bearish', sma50: 'Bearish', sma100: 'Bearish', sma200: 'Bearish',
  volatility: 'Medium', avgMove7d: '0.6%', avgMove90d: '0.5%',
  scoreHistory: [
    { date: 'Dec 26', score: 0 }, { date: 'Dec 30', score: -1 },
    { date: 'Jan 3', score: -1 }, { date: 'Jan 7', score: -2 },
    { date: 'Jan 11', score: -1 }, { date: 'Jan 15', score: -2 },
    { date: 'Jan 19', score: -2 }, { date: 'Jan 23', score: -3 },
    { date: 'Jan 27', score: -2 }, { date: 'Jan 31', score: -2 },
    { date: 'Feb 4', score: -2 }, { date: 'Feb 8', score: -2 },
  ],
  newsText: 'ECB expected to cut rates before Fed, pressuring EUR lower against the dollar[1]. Eurozone manufacturing remains in contraction territory, weighing on growth outlook and EUR sentiment[2]. Technical breakdown below key support reinforces bearish positioning for EURUSD[3].',
  newsSources: [{ id: 1, label: 'source 1' }, { id: 2, label: 'source 2' }, { id: 3, label: 'source 3' }],
};

// Generate default data for symbols without custom data
function generateData(symbol: string, score: number): SymbolData {
  const b = overallBias(score);
  const isBear = score < 0;
  // Simple deterministic hash for stable mock data
  const hash = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const seed = (i: number) => ((hash * 31 + i * 17) % 100) / 100;
  const pickBias = (offset: number): BiasLevel => {
    const s = score + offset;
    if (s >= 3) return 'Very Bullish';
    if (s >= 1) return 'Bullish';
    if (s > -1) return 'Neutral';
    if (s > -3) return 'Bearish';
    return 'Very Bearish';
  };
  const tScore = Math.max(-5, Math.min(5, Math.round(score * 0.8)));
  const sScore = Math.max(-5, Math.min(5, Math.round(score * 0.6)));
  const fScore = Math.max(-5, Math.min(5, Math.round(score * 0.4)));
  const dates = ['Dec 26', 'Dec 30', 'Jan 3', 'Jan 7', 'Jan 11', 'Jan 15', 'Jan 19', 'Jan 23', 'Jan 27', 'Jan 31', 'Feb 4', 'Feb 8'];
  const hist = dates.map((d, i) => ({
    date: d,
    score: Math.max(-5, Math.min(5, score + Math.floor(seed(i) * 3) - 1)),
  }));
  const mapping = COT_SYMBOL_MAPPINGS[symbol];
  const basePrice = symbol === 'BTC' ? 98500 : symbol.includes('US10') ? 112.5 :
    mapping?.assetClass === 'FX' ? 1.25 : mapping?.assetClass === 'Equity Index' ? 5200 : 2500;
  const lp = isBear ? 38 + seed(0) * 10 : 55 + seed(0) * 10;

  return {
    nyxScore: score, technicalScore: tScore, sentimentCotScore: sScore, fundamentalsScore: fScore,
    chartTrend: pickBias(0), seasonality: pickBias(1), technicalOverall: pickBias(0),
    crowdSentiment: isBear ? 'Crowd sentiment is bearish' : score === 0 ? 'Crowd sentiment is mixed' : 'Crowd sentiment is bullish',
    crowdSentimentBias: b,
    cotOverall: pickBias(0), cotNetBias: pickBias(0), cotLatestBias: pickBias(0),
    longPct: Math.round(lp * 100) / 100,
    shortPct: Math.round((100 - lp) * 100) / 100,
    weeklyChange: Math.round((isBear ? -(1 + seed(1) * 3) : (1 + seed(1) * 3)) * 100) / 100,
    economicOverall: 'Very Bullish',
    economicMetrics: SPX_DATA.economicMetrics,
    inflationOverall: 'Neutral',
    inflationMetrics: SPX_DATA.inflationMetrics,
    jobsOverall: 'Very Bearish',
    jobsMetrics: SPX_DATA.jobsMetrics,
    targets: [basePrice * 1.02, basePrice, basePrice * 0.98],
    sma20: pickBias(1), sma50: pickBias(0), sma100: pickBias(-1), sma200: pickBias(-1),
    volatility: Math.abs(score) >= 3 ? 'High' : Math.abs(score) >= 1 ? 'Medium' : 'Low',
    avgMove7d: (0.4 + Math.abs(score) * 0.15).toFixed(1) + '%',
    avgMove90d: (0.3 + Math.abs(score) * 0.1).toFixed(1) + '%',
    scoreHistory: hist,
    newsText: `Latest analysis for ${mapping?.displayName || symbol} indicates ${b.toLowerCase()} conditions based on current macro and technical factors. Institutional positioning aligns with the overall ${b.toLowerCase()} bias.`,
    newsSources: [{ id: 1, label: 'source 1' }],
  };
}

const SYMBOL_DATA_MAP: Record<string, SymbolData> = {
  SPX: SPX_DATA,
  Gold: GOLD_DATA,
  EUR: EUR_DATA,
};

function getSymbolData(sym: string): SymbolData {
  if (SYMBOL_DATA_MAP[sym]) return SYMBOL_DATA_MAP[sym];
  const s = SCORES[sym] ?? 0;
  return generateData(sym, s);
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
      <circle cx={CX} cy={CY} r="2.5" fill="#0E1116" />
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
      className="flex items-center gap-0 border-b border-[#2A3040]"
      style={{ backgroundColor: '#181D28' }}
    >
      <div className="flex items-center gap-3 flex-1 px-3 py-[6px]">
        <span className="text-[12px] text-[#C8CDD8]" style={{ fontWeight: 500 }}>{title}</span>
        <span className="text-[12px]" style={{ color: BIAS_TEXT[bias], fontWeight: 600 }}>{bias}</span>
      </div>
      {columns && columns.length > 0 && (
        <div className="flex">
          {columns.map((col) => (
            <span
              key={col}
              className="text-[11px] text-[#6F7A90] text-right px-2 py-[6px]"
              style={{ width: '76px', fontWeight: 500, fontStyle: 'italic' }}
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
    <div className="flex items-center border-b border-[#1A2030] hover:bg-[#141A24] transition-colors">
      <div className="flex-1 flex items-center gap-2 px-3 py-[4px]">
        <span className="text-[12px] text-[#9AA1B2]" style={{ width: '170px', flexShrink: 0 }}>
          {row.metric}
        </span>
        <BiasPill bias={row.bias} compact />
      </div>
      <div className="flex">
        <span className="text-[12px] text-[#C8CDD8] text-right px-2 py-[4px]" style={{ width: '76px' }}>
          {row.actual}
        </span>
        <span className="text-[12px] text-[#7A8295] text-right px-2 py-[4px]" style={{ width: '76px' }}>
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

  const data = useMemo(() => {
    return getSymbolData(selectedSymbol);
  }, [selectedSymbol]);

  const displayName = COT_SYMBOL_MAPPINGS[selectedSymbol]?.displayName || selectedSymbol;
  const bias = overallBias(data.nyxScore);
  const currentScore = SCORES[selectedSymbol] ?? 0;

  return (
    <div className="h-full overflow-auto bg-[#0E1116]">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1E2433]">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-[15px] text-[#E6E9F0]" style={{ fontWeight: 600 }}>Asset Profile</span>
            <span className="text-[11px] text-[#6F7A90] ml-3">tradepilot.app/edgefinder</span>
          </div>
        </div>
        <span className="text-[10px] text-[#5A6375] max-w-[480px] text-right leading-tight">
          The readings generated by NYX are for informational purposes only, do not constitute financial advice.
        </span>
      </div>

      {/* ─── Main 2-Column Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[370px_1fr] min-h-0">
        {/* ═══ LEFT COLUMN ═══════════════════════════════════════════ */}
        <div className="border-r border-[#1E2433]">
          {/* Symbol Dropdown Selector */}
          <div className="px-3 py-2 border-b border-[#1E2433]" ref={dropdownRef}>
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
                        className="w-full bg-[#0E1116] pl-7 pr-2 py-1.5 text-[12px] text-[#E6E9F0] placeholder-[#5A6375] focus:outline-none border border-[#2A3040] rounded focus:border-[#4C6FFF] transition-colors"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  {/* Column headers */}
                  <div className="grid grid-cols-2 px-3 py-[3px] border-b border-[#1E2433]" style={{ backgroundColor: '#0E1116' }}>
                    <span className="text-[10px] text-[#5A6375]" style={{ fontWeight: 500 }}>SYMBOL</span>
                    <span className="text-[10px] text-[#5A6375] text-right" style={{ fontWeight: 500 }}>SCORE</span>
                  </div>
                  {/* Symbol options */}
                  <div className="max-h-[240px] overflow-y-auto">
                    {sortedSymbols.map((sym) => {
                      const s = SCORES[sym] ?? 0;
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
              <span className="text-[11px] text-[#6F7A90]" style={{ fontWeight: 500 }}>NYX score over time</span>
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
              <Gauge score={data.nyxScore} />
              {/* Score breakdown */}
              <div className="w-full max-w-[260px] mt-1 space-y-0">
                {([
                  ['NYX score', data.nyxScore],
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

          {/* ─── Economic Growth Bias ────────────────────────────────── */}
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