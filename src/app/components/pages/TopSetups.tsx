import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Star, Loader2 } from 'lucide-react';
import { useIsMobile } from '../ui/use-mobile';
import { useTradePilotData, type SetupRow } from '../../engine/dataService';
import { useAuth } from '../AuthContext';

const C = {
  l1: 'var(--tp-l1)', l2: 'var(--tp-l2)', l3: 'var(--tp-l3)',
  border: 'var(--tp-border)', borderSubtle: 'var(--tp-border-subtle)',
  t1: 'var(--tp-text-1)', t2: 'var(--tp-text-2)', t3: 'var(--tp-text-3)',
  accent: 'var(--tp-accent)', bullish: 'var(--tp-bullish)', bearish: 'var(--tp-bearish)', neutral: 'var(--tp-neutral)',
};

type SortKey = 'asset' | 'bias' | 'score';
type SortOrder = 'asc' | 'desc';

const scoreColor = (s: number) => s > 0 ? C.bullish : s < 0 ? C.bearish : C.neutral;

export default function TopSetups() {
  const isMobile = useIsMobile();
  const { data, loading } = useTradePilotData();
  const { isFavorite, toggleFavorite } = useAuth();
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [favOnly, setFavOnly] = useState(false);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 style={{ width: 24, height: 24, color: C.accent }} className="animate-spin" />
      </div>
    );
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('desc'); }
  };

  const sorted = [...data.setups]
    .filter(s => !favOnly || isFavorite(s.symbol))
    .sort((a, b) => {
      let c = 0;
      if (sortKey === 'score') c = a.totalScore - b.totalScore;
      else if (sortKey === 'asset') c = a.symbol.localeCompare(b.symbol);
      else c = a.bias.localeCompare(b.bias);
      return sortOrder === 'asc' ? c : -c;
    });

  const cats = ['cot', 'crowd', 'seasonality', 'trend', 'growth', 'inflation', 'jobs', 'rates'] as const;
  const catLabels = ['COT', 'Crowd', 'Season', 'Trend', 'Growth', 'Infl.', 'Jobs', 'Rates'];

  /* ─── Mobile Card Layout ──────────────────────────────────────────── */
  if (isMobile) {
    return (
      <div className="p-4">
        <div className="mb-5">
          <h1 className="mb-1">Top Setups</h1>
          <p style={{ fontSize: 12, color: C.t2 }}>Ranked by TradePilot Score</p>
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
            <div key={s.symbol} className="rounded-lg p-3.5" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleFavorite(s.symbol)}>
                    <Star style={{ width: 14, height: 14, color: isFavorite(s.symbol) ? C.accent : C.t3, fill: isFavorite(s.symbol) ? C.accent : 'none' }} />
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{s.symbol}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="rounded px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, color: s.biasColor, background: `color-mix(in srgb, ${s.biasColor} 12%, transparent)` }}>
                    {s.bias}
                  </span>
                  <span className="tabular-nums" style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>{s.totalScore.toFixed(1)}</span>
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
        <p style={{ fontSize: 13, color: C.t2 }}>Ranked by TradePilot Score &middot; 20 instruments &middot; Sortable</p>
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
                        {k === 'asset' ? 'Asset' : k === 'bias' ? 'Bias' : 'TP Score'}
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
                  key={s.symbol}
                  className="transition-colors"
                  style={{ borderBottom: `1px solid ${C.borderSubtle}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.l3; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td className="py-2.5 px-3" style={{ position: 'sticky', left: 0, zIndex: 5, background: C.l2 }}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleFavorite(s.symbol)}>
                        <Star style={{ width: 13, height: 13, color: isFavorite(s.symbol) ? C.accent : C.t3, fill: isFavorite(s.symbol) ? C.accent : 'none' }} />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>{s.symbol}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="rounded px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, color: s.biasColor, background: `color-mix(in srgb, ${s.biasColor} 12%, transparent)` }}>
                      {s.bias}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{s.totalScore.toFixed(1)}</span>
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
