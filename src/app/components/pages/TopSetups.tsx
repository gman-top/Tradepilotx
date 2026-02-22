import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Star } from 'lucide-react';
import { useIsMobile } from '../ui/use-mobile';

const C = {
  l1: 'var(--tp-l1)', l2: 'var(--tp-l2)', l3: 'var(--tp-l3)',
  border: 'var(--tp-border)', borderSubtle: 'var(--tp-border-subtle)',
  t1: 'var(--tp-text-1)', t2: 'var(--tp-text-2)', t3: 'var(--tp-text-3)',
  accent: 'var(--tp-accent)', bullish: 'var(--tp-bullish)', bearish: 'var(--tp-bearish)', neutral: 'var(--tp-neutral)',
};

type SortKey = 'asset' | 'bias' | 'score';
type SortOrder = 'asc' | 'desc';

interface Setup {
  asset: string; bias: string; biasColor: string; totalScore: number; starred: boolean;
  scores: { cot: number; retailPos: number; seasonality: number; trend: number; growth: number; inflation: number; jobs: number; rates: number };
}

const SETUPS: Setup[] = [
  { asset: 'XAU/USD', bias: 'Very Bullish', biasColor: C.bullish, totalScore: 11, starred: true, scores: { cot: 2, retailPos: 2, seasonality: 2, trend: 2, growth: -1, inflation: 1, jobs: 1, rates: 2 } },
  { asset: 'NQ', bias: 'Very Bullish', biasColor: C.bullish, totalScore: 10, starred: false, scores: { cot: 2, retailPos: 2, seasonality: 2, trend: 2, growth: 1, inflation: -1, jobs: -1, rates: 1 } },
  { asset: 'BTC/USD', bias: 'Bullish', biasColor: C.bullish, totalScore: 7, starred: false, scores: { cot: 2, retailPos: 2, seasonality: 2, trend: 2, growth: 1, inflation: -1, jobs: -1, rates: -2 } },
  { asset: 'NZD/JPY', bias: 'Bullish', biasColor: C.bullish, totalScore: 7, starred: false, scores: { cot: 2, retailPos: 0, seasonality: -1, trend: 2, growth: 2, inflation: -2, jobs: 1, rates: 0 } },
  { asset: 'SPX500', bias: 'Bullish', biasColor: C.bullish, totalScore: 7, starred: true, scores: { cot: 0, retailPos: 2, seasonality: 2, trend: 1, growth: 1, inflation: -1, jobs: -1, rates: 1 } },
  { asset: 'CHF/JPY', bias: 'Bullish', biasColor: C.bullish, totalScore: 6, starred: false, scores: { cot: 0, retailPos: 1, seasonality: -1, trend: 2, growth: 2, inflation: 0, jobs: 2, rates: 0 } },
  { asset: 'GBP/JPY', bias: 'Bullish', biasColor: C.bullish, totalScore: 6, starred: false, scores: { cot: 0, retailPos: 0, seasonality: 1, trend: 2, growth: 0, inflation: 2, jobs: 1, rates: 0 } },
  { asset: 'XAG/USD', bias: 'Bullish', biasColor: C.bullish, totalScore: 5, starred: true, scores: { cot: 0, retailPos: 1, seasonality: -1, trend: 2, growth: 2, inflation: 0, jobs: 0, rates: 1 } },
  { asset: 'CAD/JPY', bias: 'Bullish', biasColor: C.bullish, totalScore: 5, starred: false, scores: { cot: 0, retailPos: 0, seasonality: 1, trend: 2, growth: 2, inflation: -1, jobs: 1, rates: 0 } },
  { asset: 'GBP/AUD', bias: 'Bullish', biasColor: C.bullish, totalScore: 5, starred: false, scores: { cot: 0, retailPos: 1, seasonality: 1, trend: 2, growth: 1, inflation: 0, jobs: 0, rates: 0 } },
  { asset: 'CAD/CHF', bias: 'Neutral', biasColor: C.neutral, totalScore: 4, starred: false, scores: { cot: 0, retailPos: -1, seasonality: 1, trend: -1, growth: 2, inflation: 2, jobs: 0, rates: 1 } },
  { asset: 'NZD/USD', bias: 'Neutral', biasColor: C.neutral, totalScore: 4, starred: false, scores: { cot: 2, retailPos: 2, seasonality: -1, trend: -1, growth: -2, inflation: 1, jobs: 2, rates: 0 } },
  { asset: 'EUR/JPY', bias: 'Neutral', biasColor: C.neutral, totalScore: 4, starred: false, scores: { cot: 2, retailPos: 2, seasonality: -1, trend: 2, growth: 2, inflation: -1, jobs: -1, rates: -1 } },
  { asset: 'EUR/USD', bias: 'Neutral', biasColor: C.neutral, totalScore: 4, starred: true, scores: { cot: 2, retailPos: 2, seasonality: -1, trend: -2, growth: -2, inflation: 0, jobs: 0, rates: 0 } },
  { asset: 'AUD/JPY', bias: 'Neutral', biasColor: C.neutral, totalScore: 3, starred: false, scores: { cot: 0, retailPos: -1, seasonality: -1, trend: 2, growth: 2, inflation: -1, jobs: -1, rates: 1 } },
  { asset: 'USD/JPY', bias: 'Neutral', biasColor: C.neutral, totalScore: 2, starred: true, scores: { cot: 0, retailPos: 0, seasonality: 1, trend: 2, growth: 2, inflation: -2, jobs: 0, rates: -1 } },
  { asset: 'GBP/USD', bias: 'Neutral', biasColor: C.neutral, totalScore: 2, starred: false, scores: { cot: 0, retailPos: 1, seasonality: 2, trend: -1, growth: -1, inflation: 0, jobs: 1, rates: 0 } },
  { asset: 'USD/CAD', bias: 'Neutral', biasColor: C.neutral, totalScore: 1, starred: false, scores: { cot: 0, retailPos: 1, seasonality: -2, trend: -2, growth: 2, inflation: 1, jobs: 1, rates: 0 } },
];

const scoreColor = (s: number) => s > 0 ? C.bullish : s < 0 ? C.bearish : C.neutral;

export default function TopSetups() {
  const isMobile = useIsMobile();
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [favOnly, setFavOnly] = useState(false);
  const [starred, setStarred] = useState<Record<string, boolean>>(
    SETUPS.reduce((a, s) => ({ ...a, [s.asset]: s.starred }), {})
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('desc'); }
  };

  const sorted = [...SETUPS]
    .filter(s => !favOnly || starred[s.asset])
    .sort((a, b) => {
      let c = 0;
      if (sortKey === 'score') c = a.totalScore - b.totalScore;
      else if (sortKey === 'asset') c = a.asset.localeCompare(b.asset);
      else c = a.bias.localeCompare(b.bias);
      return sortOrder === 'asc' ? c : -c;
    });

  const cats = ['cot', 'retailPos', 'seasonality', 'trend', 'growth', 'inflation', 'jobs', 'rates'] as const;
  const catLabels = ['COT', 'Retail', 'Season', 'Trend', 'Growth', 'Infl.', 'Jobs', 'Rates'];

  /* ─── Mobile Card Layout ──────────────────────────────────────────── */
  if (isMobile) {
    return (
      <div className="p-4">
        <div className="mb-5">
          <h1 className="mb-1">Top Setups</h1>
          <p style={{ fontSize: 12, color: C.t2 }}>Ranked by total score</p>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setFavOnly(!favOnly)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors"
            style={{ background: favOnly ? 'var(--tp-accent-muted)' : C.l2, border: `1px solid ${favOnly ? 'var(--tp-accent)' : C.borderSubtle}` }}
          >
            <Star style={{ width: 12, height: 12, color: favOnly ? C.accent : C.t3, fill: favOnly ? C.accent : 'none' }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: favOnly ? C.accent : C.t2 }}>Favorites</span>
          </button>
          <span style={{ fontSize: 11, color: C.t3 }}>{sorted.length} setups</span>
        </div>
        <div className="space-y-2">
          {sorted.map(s => (
            <div key={s.asset} className="rounded-lg p-3.5" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <button onClick={() => setStarred(p => ({ ...p, [s.asset]: !p[s.asset] }))}>
                    <Star style={{ width: 14, height: 14, color: starred[s.asset] ? C.accent : C.t3, fill: starred[s.asset] ? C.accent : 'none' }} />
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{s.asset}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="rounded px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, color: s.biasColor, background: `color-mix(in srgb, ${s.biasColor} 12%, transparent)` }}>
                    {s.bias}
                  </span>
                  <span className="tabular-nums" style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>{s.totalScore}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cats.map((c, i) => (
                  <div key={c} className="rounded px-2 py-0.5 tabular-nums" style={{ fontSize: 10, fontWeight: 500, color: scoreColor(s.scores[c]), background: C.l3 }}>
                    {catLabels[i]}: {s.scores[c] > 0 ? '+' : ''}{s.scores[c]}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ─── Desktop Table ───────────────────────────────────────────────── */
  return (
    <div className="p-5 md:p-8 lg:p-10">
      <div className="mb-6">
        <h1 className="mb-1">Top Setups</h1>
        <p style={{ fontSize: 13, color: C.t2 }}>Ranked by total score &middot; Sortable by category</p>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setFavOnly(!favOnly)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors"
          style={{ background: favOnly ? 'var(--tp-accent-muted)' : C.l2, border: `1px solid ${favOnly ? 'var(--tp-accent)' : C.borderSubtle}` }}
        >
          <Star style={{ width: 13, height: 13, color: favOnly ? C.accent : C.t3, fill: favOnly ? C.accent : 'none' }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: favOnly ? C.accent : C.t2 }}>Favorites</span>
        </button>
        <span style={{ fontSize: 12, color: C.t3 }}>{sorted.length} setups</span>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 860 }}>
            <thead>
              <tr style={{ background: C.l1, borderBottom: `1px solid ${C.border}` }}>
                {(['asset', 'bias', 'score'] as SortKey[]).map((k, i) => (
                  <th
                    key={k}
                    className="py-2.5 px-3 cursor-pointer select-none"
                    style={{ textAlign: i === 2 ? 'center' : 'left', ...(k === 'asset' ? { position: 'sticky', left: 0, zIndex: 10, background: C.l1 } : {}) }}
                    onClick={() => handleSort(k)}
                  >
                    <div className="flex items-center gap-1" style={{ justifyContent: i === 2 ? 'center' : 'flex-start' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {k === 'asset' ? 'Asset' : k === 'bias' ? 'Bias' : 'Score'}
                      </span>
                      {sortKey === k && (sortOrder === 'asc' ? <ArrowUp style={{ width: 10, height: 10, color: C.accent }} /> : <ArrowDown style={{ width: 10, height: 10, color: C.accent }} />)}
                    </div>
                  </th>
                ))}
                {catLabels.map(l => (
                  <th key={l} className="py-2.5 px-2 text-center">
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => (
                <tr
                  key={s.asset}
                  className="transition-colors"
                  style={{ borderBottom: `1px solid ${C.borderSubtle}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.l3; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td className="py-2.5 px-3" style={{ position: 'sticky', left: 0, zIndex: 5, background: C.l2 }}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setStarred(p => ({ ...p, [s.asset]: !p[s.asset] }))}>
                        <Star style={{ width: 13, height: 13, color: starred[s.asset] ? C.accent : C.t3, fill: starred[s.asset] ? C.accent : 'none' }} />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>{s.asset}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="rounded px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, color: s.biasColor, background: `color-mix(in srgb, ${s.biasColor} 12%, transparent)` }}>
                      {s.bias}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{s.totalScore}</span>
                  </td>
                  {cats.map(c => (
                    <td key={c} className="py-2.5 px-2 text-center">
                      <span
                        className="inline-block w-8 py-0.5 rounded tabular-nums"
                        style={{ fontSize: 11, fontWeight: 500, color: scoreColor(s.scores[c]), background: C.l3 }}
                      >
                        {s.scores[c] > 0 ? '+' : ''}{s.scores[c]}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}