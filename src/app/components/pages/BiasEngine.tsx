import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Target, Calendar, Users, Zap, AlertTriangle, Loader2 } from 'lucide-react';
import { useTradePilotData, biasDisplayName, BIAS_COLORS } from '../../engine/dataService';
import type { AssetScorecard } from '../../types/scoring';
import type { SignalCategory } from '../../types/database';

const C = {
  l1: 'var(--tp-l1)', l2: 'var(--tp-l2)', l3: 'var(--tp-l3)',
  border: 'var(--tp-border)', borderSubtle: 'var(--tp-border-subtle)',
  t1: 'var(--tp-text-1)', t2: 'var(--tp-text-2)', t3: 'var(--tp-text-3)',
  accent: 'var(--tp-accent)', bullish: 'var(--tp-bullish)', bearish: 'var(--tp-bearish)', neutral: 'var(--tp-neutral)',
};

function catLabel(cat: SignalCategory): string {
  const map: Record<string, string> = {
    technical: 'Technical', sentiment: 'Sentiment', cot: 'COT',
    eco_growth: 'Growth', inflation: 'Inflation', jobs: 'Jobs',
    rates: 'Rates', confidence: 'Confidence',
  };
  return map[cat] || cat;
}

function biasType(card: AssetScorecard): string {
  // Find the dominant category
  const cats = Object.entries(card.categories)
    .filter(([_, v]) => v.signal_count > 0)
    .sort((a, b) => Math.abs(b[1].score) - Math.abs(a[1].score));

  if (cats.length === 0) return 'Insufficient Data';
  const top = cats[0][0] as SignalCategory;
  const topLabel = catLabel(top);
  if (Math.abs(cats[0][1].score) > 1.2) return `${topLabel}-Led`;
  if (cats.length > 1 && Math.abs(cats[1][1].score) > 0.8) return `${topLabel} + ${catLabel(cats[1][0] as SignalCategory)}`;
  return `${topLabel}-Driven`;
}

function generateReasons(card: AssetScorecard): string[] {
  return card.readings
    .filter(r => Math.abs(r.score) >= 1 && r.explanation)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 4)
    .map(r => r.explanation);
}

function generateInvalidates(card: AssetScorecard): string[] {
  // Opposite of the strongest signals
  return card.readings
    .filter(r => Math.abs(r.score) >= 1 && r.explanation)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 4)
    .map(r => {
      const opposite = r.score > 0 ? 'reverses bearish' : 'reverses bullish';
      return `${catLabel(r.category)} ${opposite} — would negate current signal`;
    });
}

export default function BiasEngine() {
  const { data, loading } = useTradePilotData();
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');

  const assetSymbols = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.scorecards);
  }, [data]);

  // Set default selection
  const activeSymbol = selectedSymbol || assetSymbols[0] || '';
  const card = data?.scorecards[activeSymbol];

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 style={{ width: 24, height: 24, color: C.accent }} className="animate-spin" />
      </div>
    );
  }

  if (!card) return null;

  const biasLabel = biasDisplayName(card.bias_label);
  const biasColor = BIAS_COLORS[card.bias_label] || C.neutral;
  const totalPct = Math.min(100, Math.max(0, ((card.total_score + 10) / 20) * 100));

  const SCORE_SECTIONS: { key: string; cats: SignalCategory[]; icon: React.ElementType; label: string }[] = [
    { key: 'macro', cats: ['eco_growth', 'inflation', 'jobs', 'rates', 'confidence'], icon: Zap, label: 'Macro' },
    { key: 'cot', cats: ['cot'], icon: Target, label: 'COT' },
    { key: 'technical', cats: ['technical'], icon: Calendar, label: 'Technical' },
    { key: 'sentiment', cats: ['sentiment'], icon: Users, label: 'Sentiment' },
  ];

  function sectionScore(cats: SignalCategory[]): { score: number; maxScore: number; label: string; breakdown?: Record<string, number> } {
    let total = 0;
    let count = 0;
    const breakdown: Record<string, number> = {};
    for (const cat of cats) {
      const c = card!.categories[cat];
      if (c && c.signal_count > 0) {
        total += c.score;
        count++;
        breakdown[catLabel(cat)] = Math.round(c.score * 100) / 100;
      }
    }
    const avg = count > 0 ? total / count : 0;
    const label = avg > 1 ? 'Strong' : avg > 0.3 ? 'Moderate' : avg < -1 ? 'Weak' : avg < -0.3 ? 'Negative' : 'Neutral';
    const maxScore = 2; // Each category max is 2
    return { score: Math.round(avg * 100) / 100, maxScore, label, breakdown: cats.length > 1 ? breakdown : undefined };
  }

  const reasons = generateReasons(card);
  const invalidates = generateInvalidates(card);

  const BiasIcon = card.total_score > 0
    ? TrendingUp
    : card.total_score < 0
    ? TrendingDown
    : Minus;

  return (
    <div className="p-5 md:p-8 lg:p-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="mb-1">Bias Engine</h1>
        <p style={{ fontSize: 13, color: C.t2 }}>Macro-first directional framework &middot; Stacked scoring across all categories</p>
      </div>

      {/* Asset tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {assetSymbols.map(sym => (
          <button
            key={sym}
            onClick={() => setSelectedSymbol(sym)}
            className="px-3.5 py-1.5 rounded-md transition-all"
            style={{
              fontSize: 12, fontWeight: 500,
              background: activeSymbol === sym ? C.accent : C.l2,
              color: activeSymbol === sym ? '#fff' : C.t2,
              border: `1px solid ${activeSymbol === sym ? C.accent : C.borderSubtle}`,
            }}
          >
            {sym}
          </button>
        ))}
      </div>

      {/* Final Bias Hero */}
      <div className="rounded-lg p-5 md:p-7 mb-5" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span style={{ fontSize: 11, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Final Bias</span>
            <div className="flex items-center gap-3 mt-2">
              <BiasIcon style={{ width: 28, height: 28, color: biasColor }} />
              <div>
                <div style={{ fontSize: 28, fontWeight: 700, color: biasColor, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                  {biasLabel}
                </div>
                <span style={{ fontSize: 12, color: C.t3 }}>{biasType(card)}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span style={{ fontSize: 11, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>TP Score</span>
            <div className="mt-1">
              <span className="tabular-nums" style={{ fontSize: 32, fontWeight: 700, color: C.t1, letterSpacing: '-0.03em' }}>{card.total_score.toFixed(1)}</span>
              <span style={{ fontSize: 16, fontWeight: 400, color: C.t3 }}>/10</span>
            </div>
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {SCORE_SECTIONS.map(({ key, cats, icon: Icon, label }) => {
          const s = sectionScore(cats);
          const pct = Math.max(0, Math.min(100, ((s.score + 2) / 4) * 100));
          return (
            <div key={key} className="rounded-lg p-4" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
              <div className="flex items-center gap-1.5 mb-3">
                <Icon style={{ width: 14, height: 14, color: C.t3 }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: C.t3 }}>{label}</span>
              </div>
              <div className="mb-1">
                <span className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>
                  {s.score > 0 ? '+' : ''}{s.score}
                </span>
                <span style={{ fontSize: 13, fontWeight: 400, color: C.t3 }}>/{s.maxScore}</span>
              </div>
              <span style={{ fontSize: 11, color: C.t3 }}>{s.label}</span>
              <div className="mt-3 rounded-full overflow-hidden" style={{ height: 3, background: C.l3 }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.accent, transition: 'width 0.3s ease' }} />
              </div>
              {s.breakdown && (
                <div className="mt-3 pt-3 space-y-1" style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                  {Object.entries(s.breakdown).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span style={{ fontSize: 11, color: C.t3 }}>{k}</span>
                      <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 500, color: v >= 0 ? C.bullish : C.bearish }}>
                        {v >= 0 ? '+' : ''}{v.toFixed(1)}
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
            {reasons.length === 0 ? (
              <li style={{ fontSize: 13, color: C.t3 }}>No strong signals detected for this asset.</li>
            ) : reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ background: `color-mix(in srgb, ${biasColor} 15%, transparent)` }}>
                  <span className="tabular-nums" style={{ fontSize: 10, fontWeight: 600, color: biasColor }}>{i + 1}</span>
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
            {invalidates.length === 0 ? (
              <li style={{ fontSize: 13, color: C.t3 }}>Bias is neutral — no strong conviction to invalidate.</li>
            ) : invalidates.map((r, i) => (
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

      {/* All readings */}
      <div className="rounded-lg p-5" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
        <h3 className="mb-3">Signal Readings ({card.readings.length})</h3>
        <div className="space-y-1">
          {card.readings
            .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
            .map((r, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded" style={{ background: i % 2 === 0 ? C.l1 : 'transparent' }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="rounded px-1.5 py-0.5 flex-shrink-0" style={{ fontSize: 9, fontWeight: 600, color: C.t3, background: C.l3, textTransform: 'uppercase' }}>
                  {catLabel(r.category)}
                </span>
                <span className="truncate" style={{ fontSize: 12, color: C.t2 }}>{r.explanation}</span>
              </div>
              <span className="tabular-nums flex-shrink-0 ml-2 w-7 text-center rounded py-0.5" style={{
                fontSize: 11, fontWeight: 600,
                color: r.score > 0 ? C.bullish : r.score < 0 ? C.bearish : C.neutral,
                background: C.l3,
              }}>
                {r.score > 0 ? '+' : ''}{r.score}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}