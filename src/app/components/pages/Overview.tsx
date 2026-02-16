import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function Overview() {
  // Macro Category Biases
  const categoryBiases = [
    { category: 'Growth', bias: 'Bullish', strength: 'Moderate', score: 1, color: '#3FAE7A' },
    { category: 'Inflation', bias: 'Neutral', strength: 'Weak', score: 0, color: '#6F7A90' },
    { category: 'Jobs', bias: 'Bearish', strength: 'Strong', score: -2, color: '#D66565' },
    { category: 'Rates', bias: 'Bullish', strength: 'Strong', score: 2, color: '#3FAE7A' },
  ];

  // Current macro regime determination
  const regime = {
    label: 'Risk-Off / Defensive',
    description: 'Jobs weakening while rates stay elevated. Growth holding but vulnerable.',
  };

  // What this regime favors/hurts
  const favored = [
    { asset: 'Gold (XAU/USD)', reason: 'Safe-haven + inflation hedge', strength: 'Very Strong' },
    { asset: 'Japanese Yen (JPY)', reason: 'Flight to quality + BOJ policy', strength: 'Strong' },
    { asset: 'US Treasuries', reason: 'Defensive positioning', strength: 'Strong' },
  ];

  const hurt = [
    { asset: 'S&P 500 (SPX)', reason: 'Growth concerns + high valuations', strength: 'Strong' },
    { asset: 'Crude Oil (WTI)', reason: 'Demand slowdown evident', strength: 'Moderate' },
    { asset: 'EUR/USD', reason: 'Rate divergence favors USD', strength: 'Moderate' },
  ];

  const getBiasIcon = (score: number) => {
    if (score > 0) return <TrendingUp className="w-5 h-5" />;
    if (score < 0) return <TrendingDown className="w-5 h-5" />;
    return <Minus className="w-5 h-5" />;
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl mb-2">Market Overview</h1>
        <p className="text-[#9AA1B2]">Macro regime snapshot • {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>

      {/* Macro Regime Summary */}
      <div className="bg-[#141823] rounded-lg p-6 border border-[#1E2433] mb-8">
        <div className="mb-2">
          <span className="text-sm text-[#9AA1B2]">Current Regime</span>
        </div>
        <h2 className="text-2xl mb-3">{regime.label}</h2>
        <p className="text-[#9AA1B2]">{regime.description}</p>
      </div>

      {/* Category Bias Stack */}
      <div className="mb-8">
        <h2 className="text-xl mb-4">Macro Category Bias</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {categoryBiases.map((cat) => (
            <div key={cat.category} className="bg-[#141823] rounded-lg p-5 border border-[#1E2433]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg">{cat.category}</h3>
                <div style={{ color: cat.color }}>
                  {getBiasIcon(cat.score)}
                </div>
              </div>
              <div className="mb-3">
                <div className="text-xl mb-1" style={{ color: cat.color }}>
                  {cat.bias}
                </div>
                <div className="text-sm text-[#9AA1B2]">{cat.strength}</div>
              </div>
              {/* Directional bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#1E2433] rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.abs(cat.score) * 50}%`,
                      marginLeft: cat.score < 0 ? 'auto' : '0',
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
                <span className="text-sm text-[#9AA1B2] w-8 text-right">
                  {cat.score > 0 ? '+' : ''}{cat.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What This Regime Favors / Hurts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Favored Assets */}
        <div className="bg-[#141823] rounded-lg p-6 border border-[#1E2433]">
          <h2 className="text-xl mb-4">What This Favors</h2>
          <div className="space-y-4">
            {favored.map((item, index) => (
              <div key={index} className="pb-4 border-b border-[#1E2433] last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-medium mb-1">{item.asset}</div>
                    <div className="text-sm text-[#9AA1B2]">{item.reason}</div>
                  </div>
                  <div className="text-right ml-4">
                    <span className="text-sm text-[#3FAE7A] px-2 py-1 rounded bg-[#3FAE7A]/20">
                      {item.strength}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hurt Assets */}
        <div className="bg-[#141823] rounded-lg p-6 border border-[#1E2433]">
          <h2 className="text-xl mb-4">What This Hurts</h2>
          <div className="space-y-4">
            {hurt.map((item, index) => (
              <div key={index} className="pb-4 border-b border-[#1E2433] last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-medium mb-1">{item.asset}</div>
                    <div className="text-sm text-[#9AA1B2]">{item.reason}</div>
                  </div>
                  <div className="text-right ml-4">
                    <span className="text-sm text-[#D66565] px-2 py-1 rounded bg-[#D66565]/20">
                      {item.strength}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Breakdown Summary */}
      <div className="bg-[#141823] rounded-lg p-6 border border-[#1E2433]">
        <h2 className="text-xl mb-4">Category Drivers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[#0E1116] rounded-lg border border-[#1E2433]">
            <h4 className="mb-2 text-[#3FAE7A]">Growth: Bullish (Moderate)</h4>
            <p className="text-sm text-[#9AA1B2]">Retail sales beat. Services PMI holding above 50. GDP growth steady at 2.8%.</p>
          </div>
          <div className="p-4 bg-[#0E1116] rounded-lg border border-[#1E2433]">
            <h4 className="mb-2 text-[#6F7A90]">Inflation: Neutral (Weak)</h4>
            <p className="text-sm text-[#9AA1B2]">CPI elevated but not accelerating. PCE at 2.8%. PPI up slightly. Not trending clear direction.</p>
          </div>
          <div className="p-4 bg-[#0E1116] rounded-lg border border-[#1E2433]">
            <h4 className="mb-2 text-[#D66565]">Jobs: Bearish (Strong)</h4>
            <p className="text-sm text-[#9AA1B2]">NFP miss at 185K. Unemployment rose to 4.1%. Jobless claims trending higher.</p>
          </div>
          <div className="p-4 bg-[#0E1116] rounded-lg border border-[#1E2433]">
            <h4 className="mb-2 text-[#3FAE7A]">Rates: Bullish (Strong)</h4>
            <p className="text-sm text-[#9AA1B2]">Fed on hold at 4.5%. Real rates compressing. Market pricing cuts later this year.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
