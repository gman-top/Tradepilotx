import React from 'react';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { useTradePilotData } from '../../engine/dataService';

const C = {
  l1: 'var(--tp-l1)', l2: 'var(--tp-l2)', l3: 'var(--tp-l3)',
  border: 'var(--tp-border)', borderSubtle: 'var(--tp-border-subtle)',
  t1: 'var(--tp-text-1)', t2: 'var(--tp-text-2)', t3: 'var(--tp-text-3)',
  accent: 'var(--tp-accent)', bullish: 'var(--tp-bullish)', bearish: 'var(--tp-bearish)', neutral: 'var(--tp-neutral)',
};

export default function Overview() {
  const { data, loading } = useTradePilotData();

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 style={{ width: 24, height: 24, color: C.accent }} className="animate-spin" />
      </div>
    );
  }

  const { regime } = data;

  const BiasIcon = ({ score }: { score: number }) => {
    if (score > 0) return <TrendingUp style={{ width: 18, height: 18 }} />;
    if (score < 0) return <TrendingDown style={{ width: 18, height: 18 }} />;
    return <Minus style={{ width: 18, height: 18 }} />;
  };

  // Build drivers from regime category biases
  const drivers = regime.categoryBiases.map(cat => ({
    label: `${cat.category}: ${cat.bias} (${cat.strength})`,
    color: cat.color,
    text: cat.summary,
  }));

  return (
    <div className="p-5 md:p-8 lg:p-10">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="mb-1">Market Overview</h1>
        <p style={{ fontSize: 13, color: C.t2 }}>
          Macro regime snapshot &middot; {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Regime card */}
      <div className="rounded-lg p-5 md:p-6 mb-6" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current Regime</span>
        <h2 className="mt-1.5 mb-2">{regime.label}</h2>
        <p style={{ fontSize: 13, color: C.t2, lineHeight: 1.6 }}>{regime.description}</p>
      </div>

      {/* Category Biases */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {regime.categoryBiases.map((cat) => (
          <div key={cat.category} className="rounded-lg p-4" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 13, fontWeight: 500, color: C.t1 }}>{cat.category}</span>
              <span style={{ color: cat.color }}><BiasIcon score={cat.score} /></span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: cat.color, marginBottom: 2 }}>{cat.bias}</div>
            <span style={{ fontSize: 11, color: C.t3 }}>{cat.strength}</span>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 rounded-full overflow-hidden" style={{ height: 3, background: C.l3 }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.abs(cat.score) * 50)}%`, marginLeft: cat.score < 0 ? 'auto' : 0, background: cat.color }}
                />
              </div>
              <span className="tabular-nums" style={{ fontSize: 11, color: C.t3, width: 30, textAlign: 'right' }}>
                {cat.score > 0 ? '+' : ''}{cat.score.toFixed(1)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Favored / Hurt */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
        {/* Favored */}
        <div className="rounded-lg p-5" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpRight style={{ width: 16, height: 16, color: C.bullish }} />
            <h3>Regime Favors</h3>
          </div>
          <div className="space-y-3">
            {regime.favoredAssets.map((item, i) => (
              <div key={i} className="flex items-start justify-between pb-3" style={{ borderBottom: i < regime.favoredAssets.length - 1 ? `1px solid ${C.borderSubtle}` : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.t1, marginBottom: 2 }}>{item.asset} ({item.symbol})</div>
                  <div style={{ fontSize: 12, color: C.t2 }}>{item.reason}</div>
                </div>
                <span className="ml-3 flex-shrink-0 rounded px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, color: C.bullish, background: 'rgba(52,211,153,0.1)' }}>
                  {item.strength}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Hurt */}
        <div className="rounded-lg p-5" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
          <div className="flex items-center gap-2 mb-4">
            <ArrowDownRight style={{ width: 16, height: 16, color: C.bearish }} />
            <h3>Regime Hurts</h3>
          </div>
          <div className="space-y-3">
            {regime.hurtAssets.map((item, i) => (
              <div key={i} className="flex items-start justify-between pb-3" style={{ borderBottom: i < regime.hurtAssets.length - 1 ? `1px solid ${C.borderSubtle}` : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.t1, marginBottom: 2 }}>{item.asset} ({item.symbol})</div>
                  <div style={{ fontSize: 12, color: C.t2 }}>{item.reason}</div>
                </div>
                <span className="ml-3 flex-shrink-0 rounded px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, color: C.bearish, background: 'rgba(248,113,113,0.1)' }}>
                  {item.strength}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Drivers */}
      <div className="rounded-lg p-5" style={{ background: C.l2, border: `1px solid ${C.borderSubtle}` }}>
        <h3 className="mb-4">Category Drivers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {drivers.map((d, i) => (
            <div key={i} className="rounded-md p-3.5" style={{ background: C.l1, border: `1px solid ${C.borderSubtle}` }}>
              <h4 style={{ color: d.color, marginBottom: 4 }}>{d.label}</h4>
              <p style={{ fontSize: 12, color: C.t2, lineHeight: 1.55 }}>{d.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
