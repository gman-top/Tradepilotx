import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { useTradePilotData, ECONOMIES } from '../../engine/dataService';
import type { MacroRelease } from '../../types/database';

const C = {
  l1: 'var(--tp-l1)', l2: 'var(--tp-l2)', l3: 'var(--tp-l3)',
  border: 'var(--tp-border)', borderSubtle: 'var(--tp-border-subtle)',
  t1: 'var(--tp-text-1)', t2: 'var(--tp-text-2)', t3: 'var(--tp-text-3)',
  accent: 'var(--tp-accent)', bullish: 'var(--tp-bullish)', bearish: 'var(--tp-bearish)', neutral: 'var(--tp-neutral)',
};

type Category = 'growth' | 'inflation' | 'jobs' | 'rates' | 'confidence';

const CAT_DISPLAY: Record<Category, string> = {
  growth: 'Growth', inflation: 'Inflation', jobs: 'Jobs', rates: 'Rates', confidence: 'Confidence',
};

function directionFromSurprise(r: MacroRelease, invertDir: boolean): 'Bullish' | 'Neutral' | 'Bearish' {
  if (r.actual === null || r.forecast === null) return 'Neutral';
  const s = r.actual - r.forecast;
  if (Math.abs(s) < 0.01) return 'Neutral';
  const positive = invertDir ? s < 0 : s > 0;
  return positive ? 'Bullish' : 'Bearish';
}

const INVERTED_INDICATORS = new Set(['unemployment_rate', 'initial_claims']);

export default function Fundamentals() {
  const { data, loading } = useTradePilotData();
  const [selectedEconomy, setSelectedEconomy] = useState('US');
  const [expandedCategory, setExpandedCategory] = useState<Category>('growth');

  const releases = useMemo(() => {
    if (!data) return [];
    return data.macroReleases[selectedEconomy] || [];
  }, [data, selectedEconomy]);

  const byCategory = useMemo(() => {
    const result: Record<Category, MacroRelease[]> = {
      growth: [], inflation: [], jobs: [], rates: [], confidence: [],
    };
    for (const r of releases) {
      const cat = r.category as Category;
      if (result[cat]) result[cat].push(r);
    }
    return result;
  }, [releases]);

  // Compute category bias from releases
  function categoryBias(cat: Category): { bias: string; color: string; score: number; summary: string } {
    const items = byCategory[cat];
    if (items.length === 0) return { bias: 'No Data', color: C.neutral, score: 0, summary: 'No releases available.' };

    let totalScore = 0;
    const parts: string[] = [];
    for (const r of items) {
      const inv = INVERTED_INDICATORS.has(r.indicator_key);
      const dir = directionFromSurprise(r, inv);
      const s = dir === 'Bullish' ? 1 : dir === 'Bearish' ? -1 : 0;
      totalScore += s;
      if (s !== 0) {
        parts.push(`${r.indicator_name}: ${r.actual}${r.unit || ''} (${r.beat_miss || 'inline'})`);
      }
    }

    const avg = totalScore / items.length;
    const bias = avg > 0.3 ? 'Bullish' : avg < -0.3 ? 'Bearish' : 'Neutral';
    const color = bias === 'Bullish' ? C.bullish : bias === 'Bearish' ? C.bearish : C.neutral;
    const summary = parts.slice(0, 3).join('. ') || 'Data inline with expectations.';

    return { bias, color, score: Math.round(avg * 100) / 100, summary };
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 style={{ width: 24, height: 24, color: C.accent }} className="animate-spin" />
      </div>
    );
  }

  const categories: Category[] = ['growth', 'inflation', 'jobs', 'rates', 'confidence'];

  const BiasIcon = ({ dir }: { dir: string }) => {
    if (dir === 'Bullish') return <TrendingUp style={{ width: 14, height: 14 }} />;
    if (dir === 'Bearish') return <TrendingDown style={{ width: 14, height: 14 }} />;
    return <Minus style={{ width: 14, height: 14 }} />;
  };

  return (
    <div className="p-5 md:p-8 lg:p-10">
      <div className="mb-6">
        <h1 className="mb-1">Fundamentals</h1>
        <p style={{ fontSize: 13, color: C.t2 }}>
          Economic releases by category &middot; Beat/miss analysis
        </p>
      </div>

      {/* Economy selector */}
      <div className="flex gap-2 flex-wrap mb-6">
        {ECONOMIES.map(e => (
          <button
            key={e.code}
            onClick={() => setSelectedEconomy(e.code)}
            className="px-3.5 py-1.5 rounded-md transition-all"
            style={{
              fontSize: 12, fontWeight: 500,
              background: selectedEconomy === e.code ? C.accent : C.l2,
              color: selectedEconomy === e.code ? '#fff' : C.t2,
              border: `1px solid ${selectedEconomy === e.code ? C.accent : C.borderSubtle}`,
            }}
          >
            {e.code} ({e.currency})
          </button>
        ))}
      </div>

      {/* Category cards */}
      <div className="space-y-3">
        {categories.map(cat => {
          const bias = categoryBias(cat);
          const items = byCategory[cat];
          const isExpanded = expandedCategory === cat;

          return (
            <div key={cat} className="rounded-lg overflow-hidden" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
              {/* Category header */}
              <button
                onClick={() => setExpandedCategory(isExpanded ? '' as Category : cat)}
                className="w-full flex items-center justify-between p-4 transition-colors"
                onMouseEnter={e => { e.currentTarget.style.background = C.l3; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ color: bias.color }}>
                    <BiasIcon dir={bias.bias} />
                  </span>
                  <div className="text-left">
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{CAT_DISPLAY[cat]}</div>
                    <div style={{ fontSize: 12, color: C.t3 }}>{items.length} indicators</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, color: bias.color, background: `color-mix(in srgb, ${bias.color} 12%, transparent)` }}>
                    {bias.bias}
                  </span>
                  {isExpanded
                    ? <ChevronUp style={{ width: 14, height: 14, color: C.t3 }} />
                    : <ChevronDown style={{ width: 14, height: 14, color: C.t3 }} />
                  }
                </div>
              </button>

              {/* Category summary */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                  <div className="px-4 py-3" style={{ background: C.l1 }}>
                    <p style={{ fontSize: 12, color: C.t2, lineHeight: 1.55 }}>{bias.summary}</p>
                  </div>

                  {/* Indicators table */}
                  <div className="px-4 pb-3">
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
                          {['Indicator', 'Direction', 'Actual', 'Forecast', 'Previous', 'Surprise'].map(h => (
                            <th key={h} className="py-2 text-left">
                              <span style={{ fontSize: 10, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((r, i) => {
                          const inv = INVERTED_INDICATORS.has(r.indicator_key);
                          const dir = directionFromSurprise(r, inv);
                          const dirColor = dir === 'Bullish' ? C.bullish : dir === 'Bearish' ? C.bearish : C.neutral;
                          const surprise = r.actual !== null && r.forecast !== null ? r.actual - r.forecast : null;

                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
                              <td className="py-2.5">
                                <span style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>{r.indicator_name}</span>
                              </td>
                              <td className="py-2.5">
                                <span className="rounded px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, color: dirColor, background: `color-mix(in srgb, ${dirColor} 12%, transparent)` }}>
                                  {dir}
                                </span>
                              </td>
                              <td className="py-2.5">
                                <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>
                                  {r.actual !== null ? `${r.actual}${r.unit || ''}` : '—'}
                                </span>
                              </td>
                              <td className="py-2.5">
                                <span className="tabular-nums" style={{ fontSize: 13, color: C.t2 }}>
                                  {r.forecast !== null ? `${r.forecast}${r.unit || ''}` : '—'}
                                </span>
                              </td>
                              <td className="py-2.5">
                                <span className="tabular-nums" style={{ fontSize: 13, color: C.t3 }}>
                                  {r.previous !== null ? `${r.previous}${r.unit || ''}` : '—'}
                                </span>
                              </td>
                              <td className="py-2.5">
                                {surprise !== null ? (
                                  <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 500, color: surprise > 0 ? C.bullish : surprise < 0 ? C.bearish : C.neutral }}>
                                    {surprise > 0 ? '+' : ''}{surprise.toFixed(1)}{r.unit || ''}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 13, color: C.t3 }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Interest Rates */}
      <div className="mt-6 rounded-lg p-5" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
        <h3 className="mb-4">Interest Rates</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ECONOMIES.map(e => {
            const rate = data.rates[e.code];
            if (!rate) return null;
            return (
              <div key={e.code} className="rounded-md p-3" style={{ background: C.l1, border: `1px solid ${C.borderSubtle}` }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: C.t3, marginBottom: 4 }}>{e.code} ({e.currency})</div>
                <div className="tabular-nums" style={{ fontSize: 18, fontWeight: 700, color: C.t1 }}>
                  {rate.policy_rate !== null ? `${rate.policy_rate.toFixed(2)}%` : '—'}
                </div>
                {rate.yield_10y !== null && (
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>10Y: {rate.yield_10y.toFixed(2)}%</div>
                )}
                {rate.spread_2_10 !== null && (
                  <div style={{
                    fontSize: 11, marginTop: 2,
                    color: rate.spread_2_10 < 0 ? C.bearish : C.t3,
                  }}>
                    2-10 spread: {rate.spread_2_10 > 0 ? '+' : ''}{rate.spread_2_10.toFixed(2)}%
                    {rate.spread_2_10 < 0 && ' (inverted)'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
