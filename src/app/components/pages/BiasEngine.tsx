import React, { useState } from 'react';
import { TrendingUp, Target, Calendar, Users, Zap, AlertTriangle } from 'lucide-react';

const C = {
  l1: 'var(--tp-l1)', l2: 'var(--tp-l2)', l3: 'var(--tp-l3)',
  border: 'var(--tp-border)', borderSubtle: 'var(--tp-border-subtle)',
  t1: 'var(--tp-text-1)', t2: 'var(--tp-text-2)', t3: 'var(--tp-text-3)',
  accent: 'var(--tp-accent)', bullish: 'var(--tp-bullish)', bearish: 'var(--tp-bearish)', neutral: 'var(--tp-neutral)',
};

type Asset = 'Gold (XAU/USD)' | 'EUR/USD' | 'S&P 500' | 'Crude Oil';

interface BiasData {
  finalBias: string; biasType: string; totalScore: number; color: string;
  scores: {
    macro: { score: number; max: number; label: string; breakdown?: { growth: number; inflation: number; jobs: number; rates: number } };
    cot: { score: number; max: number; label: string };
    seasonality: { score: number; max: number; label: string };
    sentiment: { score: number; max: number; label: string };
  };
  whyExists: string[];
  whatInvalidates: string[];
}

const DATA: Record<Asset, BiasData> = {
  'Gold (XAU/USD)': {
    finalBias: 'Very Bullish', biasType: 'Macro-Led', totalScore: 85, color: C.bullish,
    scores: {
      macro: { score: 32, max: 40, label: 'Strong', breakdown: { growth: 0, inflation: 4, jobs: 6, rates: 22 } },
      cot: { score: 28, max: 30, label: 'Extreme' },
      seasonality: { score: 15, max: 20, label: 'Favorable' },
      sentiment: { score: 10, max: 10, label: 'Bullish' },
    },
    whyExists: [
      'Real rates compressing as nominal yields fall while inflation stays elevated',
      'Commercials accumulating at 88th percentile — smart money positioning extreme',
      'Jobs weakness increases Fed dovish tilt, lowering opportunity cost of gold',
      'Seasonal tailwinds historically support Q1 strength',
    ],
    whatInvalidates: [
      'Fed turns hawkish — unexpected rate hikes',
      'Inflation collapses below 2% — removes hedge narrative',
      'Jobs data strengthens significantly — delays rate cuts',
      'Real yields spike above 2.5%',
    ],
  },
  'EUR/USD': {
    finalBias: 'Bearish', biasType: 'Rates-Driven', totalScore: 35, color: C.bearish,
    scores: {
      macro: { score: 12, max: 40, label: 'Weak' },
      cot: { score: 8, max: 30, label: 'Weak' },
      seasonality: { score: 8, max: 20, label: 'Neutral' },
      sentiment: { score: 7, max: 10, label: 'Bearish' },
    },
    whyExists: [
      'Rate divergence dominant — ECB expected to cut well before Fed',
      'Eurozone growth significantly weaker than US',
      'COT positioning shows net short building at 32nd percentile',
      'Technical breakdown confirmed below key support at 1.09',
    ],
    whatInvalidates: [
      'Fed cuts rates before ECB',
      'Eurozone growth surprises positively — PMI back above 52',
      'ECB turns unexpectedly hawkish',
      'USD macro regime shifts to bearish',
    ],
  },
  'S&P 500': {
    finalBias: 'Bearish', biasType: 'COT + Macro Conflict', totalScore: 37, color: C.bearish,
    scores: {
      macro: { score: 14, max: 40, label: 'Mixed' },
      cot: { score: 6, max: 30, label: 'Contrarian Short' },
      seasonality: { score: 10, max: 20, label: 'Neutral' },
      sentiment: { score: 7, max: 10, label: 'Cautious' },
    },
    whyExists: [
      'COT shows extreme speculative long crowding — contrarian bearish',
      'Jobs weakness threatens earnings while valuations remain extended',
      'Market breadth deteriorating — fewer stocks participating',
      'Credit spreads beginning to widen',
    ],
    whatInvalidates: [
      'Jobs data stabilizes — NFP back above 200K',
      'Fed pivots dovish and cuts rates 50bps',
      'Earnings surprise massively to upside',
      'Breadth improves with new highs expanding',
    ],
  },
  'Crude Oil': {
    finalBias: 'Bearish', biasType: 'Demand-Led', totalScore: 30, color: C.bearish,
    scores: {
      macro: { score: 8, max: 40, label: 'Weak' },
      cot: { score: 8, max: 30, label: 'Weak' },
      seasonality: { score: 6, max: 20, label: 'Unfavorable' },
      sentiment: { score: 8, max: 10, label: 'Bearish' },
    },
    whyExists: [
      'Demand slowdown from manufacturing PMI contraction',
      'China growth concerns escalating',
      'US production at record highs — supply abundant',
      'OPEC+ struggling with quota compliance',
    ],
    whatInvalidates: [
      'China announces major stimulus',
      'OPEC+ implements deep production cuts',
      'Geopolitical supply disruption',
      'US production unexpectedly declines',
    ],
  },
};

const ASSETS: Asset[] = ['Gold (XAU/USD)', 'EUR/USD', 'S&P 500', 'Crude Oil'];
const SCORE_ICONS = [
  { key: 'macro' as const, icon: Zap, label: 'Macro' },
  { key: 'cot' as const, icon: Target, label: 'COT' },
  { key: 'seasonality' as const, icon: Calendar, label: 'Seasonality' },
  { key: 'sentiment' as const, icon: Users, label: 'Sentiment' },
];

export default function BiasEngine() {
  const [selected, setSelected] = useState<Asset>('Gold (XAU/USD)');
  const d = DATA[selected];

  return (
    <div className="p-5 md:p-8 lg:p-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="mb-1">Bias Engine</h1>
        <p style={{ fontSize: 13, color: C.t2 }}>Macro-first directional framework &middot; Stacked decision, not single indicator</p>
      </div>

      {/* Asset tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {ASSETS.map(a => (
          <button
            key={a}
            onClick={() => setSelected(a)}
            className="px-3.5 py-1.5 rounded-md transition-all"
            style={{
              fontSize: 12, fontWeight: 500,
              background: selected === a ? C.accent : C.l2,
              color: selected === a ? '#fff' : C.t2,
              border: `1px solid ${selected === a ? C.accent : C.borderSubtle}`,
            }}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Final Bias Hero */}
      <div className="rounded-lg p-5 md:p-7 mb-5" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span style={{ fontSize: 11, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Final Bias</span>
            <div className="flex items-center gap-3 mt-2">
              <TrendingUp style={{ width: 28, height: 28, color: d.color }} />
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: d.color, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                  {d.finalBias}
                </div>
                <span style={{ fontSize: 12, color: C.t3 }}>{d.biasType}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span style={{ fontSize: 11, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score</span>
            <div className="mt-1">
              <span className="tabular-nums" style={{ fontSize: 32, fontWeight: 700, color: C.t1, letterSpacing: '-0.03em' }}>{d.totalScore}</span>
              <span style={{ fontSize: 16, fontWeight: 400, color: C.t3 }}>/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {SCORE_ICONS.map(({ key, icon: Icon, label }) => {
          const s = d.scores[key];
          const pct = (s.score / s.max) * 100;
          return (
            <div key={key} className="rounded-lg p-4" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
              <div className="flex items-center gap-1.5 mb-3">
                <Icon style={{ width: 14, height: 14, color: C.t3 }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: C.t3 }}>{label}</span>
              </div>
              <div className="mb-1">
                <span className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>{s.score}</span>
                <span style={{ fontSize: 13, fontWeight: 400, color: C.t3 }}>/{s.max}</span>
              </div>
              <span style={{ fontSize: 11, color: C.t3 }}>{s.label}</span>
              <div className="mt-3 rounded-full overflow-hidden" style={{ height: 3, background: C.l3 }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.accent, transition: 'width 0.3s ease' }} />
              </div>
              {'breakdown' in s && s.breakdown && (
                <div className="mt-3 pt-3 space-y-1" style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                  {Object.entries(s.breakdown).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span style={{ fontSize: 11, color: C.t3, textTransform: 'capitalize' }}>{k}</span>
                      <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 500, color: (v as number) >= 0 ? C.bullish : C.bearish }}>
                        {(v as number) >= 0 ? '+' : ''}{v as number}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Why + Invalidates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
        <div className="rounded-lg p-5" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
          <h3 className="mb-3">Why This Bias Exists</h3>
          <ul className="space-y-2.5">
            {d.whyExists.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ background: `color-mix(in srgb, ${d.color} 15%, transparent)` }}>
                  <span className="tabular-nums" style={{ fontSize: 10, fontWeight: 600, color: d.color }}>{i + 1}</span>
                </span>
                <span style={{ fontSize: 13, color: C.t1, lineHeight: 1.55 }}>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg p-5" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle style={{ width: 14, height: 14, color: C.bearish }} />
            <h3>What Invalidates</h3>
          </div>
          <ul className="space-y-2.5">
            {d.whatInvalidates.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ background: 'rgba(248,113,113,0.1)' }}>
                  <span className="tabular-nums" style={{ fontSize: 10, fontWeight: 600, color: C.bearish }}>{i + 1}</span>
                </span>
                <span style={{ fontSize: 13, color: C.t2, lineHeight: 1.55 }}>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Methodology */}
      <div className="rounded-lg p-4" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
        <p style={{ fontSize: 12, color: C.t3, lineHeight: 1.6 }}>
          <span style={{ color: C.t2, fontWeight: 500 }}>About the Bias Engine:</span> Macro-first framework. Regime determines direction, categories (Growth/Inflation/Jobs/Rates)
          produce bias, asset-level impact mapped from dominant categories. COT confirms or contradicts. Scores are weighted but subordinate to interpretation.
        </p>
      </div>
    </div>
  );
}