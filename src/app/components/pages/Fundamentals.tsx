import React, { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Category = 'Jobs' | 'Inflation' | 'Growth' | 'Housing' | 'Rates';

interface Indicator {
  name: string;
  direction: 'Bullish' | 'Neutral' | 'Bearish';
  strength: 'Very' | 'Moderate' | 'Weak';
  actual: number | string;
  forecast: number | string;
  previous: number | string;
  surprise: 'positive' | 'negative' | 'neutral';
  categoryContribution: number; // +2, +1, 0, -1, -2
  date: string;
}

interface CategoryData {
  bias: string;
  strength: string;
  score: number;
  color: string;
  summary: string;
  indicators: Indicator[];
}

export default function Fundamentals() {
  const [expandedCategory, setExpandedCategory] = useState<Category>('Jobs');

  const categories: Record<Category, CategoryData> = {
    Jobs: {
      bias: 'Bearish',
      strength: 'Strong',
      score: -2,
      color: '#D66565',
      summary: 'NFP miss + rising jobless claims + falling JOLTS = labor market cooling',
      indicators: [
        {
          name: 'Nonfarm Payrolls',
          direction: 'Bearish',
          strength: 'Very',
          actual: '185K',
          forecast: '200K',
          previous: '216K',
          surprise: 'negative',
          categoryContribution: -2,
          date: 'Feb 7, 2026',
        },
        {
          name: 'Unemployment Rate',
          direction: 'Bearish',
          strength: 'Very',
          actual: '4.1%',
          forecast: '3.9%',
          previous: '3.9%',
          surprise: 'negative',
          categoryContribution: -2,
          date: 'Feb 7, 2026',
        },
        {
          name: 'Average Hourly Earnings',
          direction: 'Bullish',
          strength: 'Weak',
          actual: '0.4%',
          forecast: '0.3%',
          previous: '0.3%',
          surprise: 'positive',
          categoryContribution: 1,
          date: 'Feb 7, 2026',
        },
        {
          name: 'Initial Jobless Claims',
          direction: 'Bearish',
          strength: 'Moderate',
          actual: '228K',
          forecast: '215K',
          previous: '221K',
          surprise: 'negative',
          categoryContribution: -1,
          date: 'Feb 6, 2026',
        },
        {
          name: 'JOLTS Job Openings',
          direction: 'Bearish',
          strength: 'Very',
          actual: '6.52M',
          forecast: '7.20M',
          previous: '7.18M',
          surprise: 'negative',
          categoryContribution: -2,
          date: 'Feb 4, 2026',
        },
        {
          name: 'ADP Employment Change',
          direction: 'Bearish',
          strength: 'Moderate',
          actual: '142K',
          forecast: '165K',
          previous: '158K',
          surprise: 'negative',
          categoryContribution: -1,
          date: 'Feb 5, 2026',
        },
        {
          name: 'Continuing Jobless Claims',
          direction: 'Bearish',
          strength: 'Moderate',
          actual: '1.92M',
          forecast: '1.85M',
          previous: '1.88M',
          surprise: 'negative',
          categoryContribution: -1,
          date: 'Feb 6, 2026',
        },
      ],
    },
    Inflation: {
      bias: 'Neutral',
      strength: 'Weak',
      score: 0,
      color: '#6F7A90',
      summary: 'CPI elevated but not accelerating. No clear trend direction.',
      indicators: [
        {
          name: 'Consumer Price Index (YoY)',
          direction: 'Bullish',
          strength: 'Weak',
          actual: '3.2%',
          forecast: '3.1%',
          previous: '3.1%',
          surprise: 'positive',
          categoryContribution: 1,
          date: 'Feb 5, 2026',
        },
        {
          name: 'Core CPI (YoY)',
          direction: 'Bullish',
          strength: 'Weak',
          actual: '3.8%',
          forecast: '3.7%',
          previous: '3.7%',
          surprise: 'positive',
          categoryContribution: 1,
          date: 'Feb 5, 2026',
        },
        {
          name: 'PCE Price Index (YoY)',
          direction: 'Bullish',
          strength: 'Weak',
          actual: '2.8%',
          forecast: '2.7%',
          previous: '2.6%',
          surprise: 'positive',
          categoryContribution: 1,
          date: 'Jan 31, 2026',
        },
        {
          name: 'Producer Price Index (MoM)',
          direction: 'Neutral',
          strength: 'Weak',
          actual: '0.3%',
          forecast: '0.2%',
          previous: '0.1%',
          surprise: 'positive',
          categoryContribution: 0,
          date: 'Jan 30, 2026',
        },
        {
          name: 'CPI (MoM)',
          direction: 'Neutral',
          strength: 'Weak',
          actual: '0.2%',
          forecast: '0.2%',
          previous: '0.3%',
          surprise: 'neutral',
          categoryContribution: 0,
          date: 'Feb 5, 2026',
        },
        {
          name: 'Core PCE (MoM)',
          direction: 'Bearish',
          strength: 'Weak',
          actual: '0.1%',
          forecast: '0.2%',
          previous: '0.2%',
          surprise: 'negative',
          categoryContribution: -1,
          date: 'Jan 31, 2026',
        },
        {
          name: 'Import Price Index',
          direction: 'Bearish',
          strength: 'Moderate',
          actual: '-0.3%',
          forecast: '0.0%',
          previous: '0.1%',
          surprise: 'negative',
          categoryContribution: -1,
          date: 'Jan 28, 2026',
        },
      ],
    },
    Growth: {
      bias: 'Bullish',
      strength: 'Moderate',
      score: 1,
      color: '#3FAE7A',
      summary: 'Retail sales beat. Services PMI holding. GDP growth steady at 2.8%.',
      indicators: [
        {
          name: 'GDP (QoQ)',
          direction: 'Bullish',
          strength: 'Very',
          actual: '2.8%',
          forecast: '2.5%',
          previous: '3.1%',
          surprise: 'positive',
          categoryContribution: 2,
          date: 'Jan 29, 2026',
        },
        {
          name: 'ISM Manufacturing PMI',
          direction: 'Bearish',
          strength: 'Moderate',
          actual: '48.2',
          forecast: '49.0',
          previous: '49.3',
          surprise: 'negative',
          categoryContribution: -1,
          date: 'Feb 3, 2026',
        },
        {
          name: 'ISM Services PMI',
          direction: 'Neutral',
          strength: 'Weak',
          actual: '52.8',
          forecast: '53.2',
          previous: '53.6',
          surprise: 'negative',
          categoryContribution: 0,
          date: 'Feb 5, 2026',
        },
        {
          name: 'Retail Sales (MoM)',
          direction: 'Bullish',
          strength: 'Very',
          actual: '0.6%',
          forecast: '0.4%',
          previous: '0.4%',
          surprise: 'positive',
          categoryContribution: 2,
          date: 'Feb 2, 2026',
        },
        {
          name: 'Industrial Production',
          direction: 'Bearish',
          strength: 'Moderate',
          actual: '0.1%',
          forecast: '0.3%',
          previous: '0.2%',
          surprise: 'negative',
          categoryContribution: -1,
          date: 'Jan 27, 2026',
        },
        {
          name: 'Consumer Confidence',
          direction: 'Bearish',
          strength: 'Weak',
          actual: '84.5',
          forecast: '90.6',
          previous: '93.8',
          surprise: 'negative',
          categoryContribution: -1,
          date: 'Jan 30, 2026',
        },
        {
          name: 'Durable Goods Orders',
          direction: 'Bullish',
          strength: 'Moderate',
          actual: '1.2%',
          forecast: '0.8%',
          previous: '0.5%',
          surprise: 'positive',
          categoryContribution: 1,
          date: 'Jan 26, 2026',
        },
      ],
    },
    Housing: {
      bias: 'Bearish',
      strength: 'Moderate',
      score: -1,
      color: '#D66565',
      summary: 'Housing starts declining. Sales weak. High rates biting.',
      indicators: [
        {
          name: 'Housing Starts',
          direction: 'Bearish',
          strength: 'Moderate',
          actual: '1.42M',
          forecast: '1.45M',
          previous: '1.48M',
          surprise: 'negative',
          categoryContribution: -1,
          date: 'Jan 28, 2026',
        },
        {
          name: 'Building Permits',
          direction: 'Bearish',
          strength: 'Moderate',
          actual: '1.48M',
          forecast: '1.52M',
          previous: '1.54M',
          surprise: 'negative',
          categoryContribution: -1,
          date: 'Jan 28, 2026',
        },
        {
          name: 'Existing Home Sales',
          direction: 'Bearish',
          strength: 'Very',
          actual: '3.92M',
          forecast: '4.00M',
          previous: '4.08M',
          surprise: 'negative',
          categoryContribution: -2,
          date: 'Jan 24, 2026',
        },
        {
          name: 'New Home Sales',
          direction: 'Bearish',
          strength: 'Moderate',
          actual: '665K',
          forecast: '680K',
          previous: '698K',
          surprise: 'negative',
          categoryContribution: -1,
          date: 'Jan 26, 2026',
        },
        {
          name: 'Pending Home Sales',
          direction: 'Bearish',
          strength: 'Moderate',
          actual: '-2.1%',
          forecast: '-1.0%',
          previous: '-0.8%',
          surprise: 'negative',
          categoryContribution: -1,
          date: 'Jan 30, 2026',
        },
        {
          name: 'Case-Shiller Home Price Index',
          direction: 'Neutral',
          strength: 'Weak',
          actual: '3.8%',
          forecast: '4.0%',
          previous: '4.2%',
          surprise: 'negative',
          categoryContribution: 0,
          date: 'Jan 25, 2026',
        },
        {
          name: 'Mortgage Applications',
          direction: 'Bullish',
          strength: 'Weak',
          actual: '2.4%',
          forecast: '1.0%',
          previous: '0.8%',
          surprise: 'positive',
          categoryContribution: 1,
          date: 'Feb 7, 2026',
        },
      ],
    },
    Rates: {
      bias: 'Bullish',
      strength: 'Strong',
      score: 2,
      color: '#3FAE7A',
      summary: 'Fed on hold. Real rates compressing. Market pricing cuts later.',
      indicators: [
        {
          name: 'Federal Funds Rate',
          direction: 'Neutral',
          strength: 'Weak',
          actual: '4.50%',
          forecast: '4.50%',
          previous: '4.50%',
          surprise: 'neutral',
          categoryContribution: 0,
          date: 'Jan 29, 2026',
        },
        {
          name: '10-Year Treasury Yield',
          direction: 'Bullish',
          strength: 'Moderate',
          actual: '4.28%',
          forecast: '-',
          previous: '4.32%',
          surprise: 'neutral',
          categoryContribution: 1,
          date: 'Feb 7, 2026',
        },
        {
          name: '2-Year Treasury Yield',
          direction: 'Bullish',
          strength: 'Moderate',
          actual: '4.42%',
          forecast: '-',
          previous: '4.45%',
          surprise: 'neutral',
          categoryContribution: 1,
          date: 'Feb 7, 2026',
        },
        {
          name: 'Real Yields (10Y TIPS)',
          direction: 'Bullish',
          strength: 'Very',
          actual: '1.85%',
          forecast: '-',
          previous: '1.95%',
          surprise: 'neutral',
          categoryContribution: 2,
          date: 'Feb 7, 2026',
        },
        {
          name: 'USD 2Y-10Y Yield (21d SMA)',
          direction: 'Bullish',
          strength: 'Moderate',
          actual: '-0.14%',
          forecast: '-',
          previous: '-0.13%',
          surprise: 'neutral',
          categoryContribution: 1,
          date: 'Feb 7, 2026',
        },
      ],
    },
  };

  const toggleCategory = (category: Category) => {
    setExpandedCategory(expandedCategory === category ? ('Jobs' as Category) : category);
  };

  const getContributionColor = (contribution: number) => {
    if (contribution >= 1) return 'var(--tp-bullish)';
    if (contribution <= -1) return 'var(--tp-bearish)';
    return 'var(--tp-neutral)';
  };

  const getContributionLabel = (contribution: number) => {
    if (contribution > 0) return `+${contribution}`;
    return `${contribution}`;
  };

  const getDirectionColor = (direction: string) => {
    if (direction === 'Bullish') return 'var(--tp-bullish)';
    if (direction === 'Bearish') return 'var(--tp-bearish)';
    return 'var(--tp-neutral)';
  };

  const getBiasIcon = (score: number) => {
    if (score > 0) return <TrendingUp className="w-4 h-4" />;
    if (score < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  return (
    <div className="p-5 md:p-8 lg:p-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="mb-1">Fundamentals</h1>
        <p style={{ fontSize: 13, color: 'var(--tp-text-2)' }}>Category-level bias aggregation &middot; Interpret first, data second</p>
      </div>

      {/* Category Bias Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {(Object.keys(categories) as Category[]).map((category) => {
          const data = categories[category];
          return (
            <div key={category} className="rounded-lg p-4" style={{ background: 'var(--tp-l2)', border: '1px solid var(--tp-border-subtle)' }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--tp-text-1)' }}>{category}</span>
                <span style={{ color: data.color }}>{getBiasIcon(data.score)}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: data.color, marginBottom: 2 }}>{data.bias}</div>
              <span style={{ fontSize: 11, color: 'var(--tp-text-3)' }}>{data.strength} &middot; Score: {data.score}</span>
            </div>
          );
        })}
      </div>

      {/* Expandable Categories */}
      <div className="space-y-3">
        {(Object.keys(categories) as Category[]).map((category) => {
          const isExpanded = expandedCategory === category;
          const data = categories[category];

          return (
            <div key={category} className="rounded-lg overflow-hidden" style={{ background: 'var(--tp-l2)', border: '1px solid var(--tp-border-subtle)' }}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-4 transition-colors"
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tp-l3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ color: data.color }}>{getBiasIcon(data.score)}</span>
                  <div className="text-left">
                    <h3>{category}</h3>
                    <p style={{ fontSize: 12, color: data.color, marginTop: 2 }}>
                      {data.bias} ({data.strength}) &middot; Score: {data.score}
                    </p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp style={{ width: 16, height: 16, color: 'var(--tp-text-3)' }} />
                ) : (
                  <ChevronDown style={{ width: 16, height: 16, color: 'var(--tp-text-3)' }} />
                )}
              </button>

              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--tp-border-subtle)' }}>
                  <div className="overflow-x-auto">
                    <table className="w-full" style={{ minWidth: 780 }}>
                      <thead>
                        <tr style={{ background: 'var(--tp-l1)', borderBottom: '1px solid var(--tp-border)' }}>
                          <th className="text-left py-2.5 px-3" style={{ fontSize: 10, fontWeight: 600, color: 'var(--tp-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Indicator</th>
                          <th className="text-center py-2.5 px-3" style={{ fontSize: 10, fontWeight: 600, color: 'var(--tp-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Direction</th>
                          <th className="text-center py-2.5 px-3" style={{ fontSize: 10, fontWeight: 600, color: 'var(--tp-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Strength</th>
                          <th className="text-right py-2.5 px-3" style={{ fontSize: 10, fontWeight: 600, color: 'var(--tp-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actual</th>
                          <th className="text-right py-2.5 px-3" style={{ fontSize: 10, fontWeight: 600, color: 'var(--tp-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Forecast</th>
                          <th className="text-right py-2.5 px-3" style={{ fontSize: 10, fontWeight: 600, color: 'var(--tp-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Previous</th>
                          <th className="text-center py-2.5 px-3" style={{ fontSize: 10, fontWeight: 600, color: 'var(--tp-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Surprise</th>
                          <th className="text-center py-2.5 px-3" style={{ fontSize: 10, fontWeight: 600, color: 'var(--tp-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score</th>
                          <th className="text-right py-2.5 px-3" style={{ fontSize: 10, fontWeight: 600, color: 'var(--tp-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.indicators.map((indicator, index) => (
                          <tr
                            key={index}
                            className="transition-colors"
                            style={{ borderBottom: `1px solid var(--tp-border-subtle)` }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--tp-l3)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <td className="py-2.5 px-3" style={{ fontSize: 13, fontWeight: 500, color: 'var(--tp-text-1)' }}>{indicator.name}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="rounded px-2 py-0.5" style={{ fontSize: 11, fontWeight: 500, color: getDirectionColor(indicator.direction), background: `color-mix(in srgb, ${getDirectionColor(indicator.direction)} 12%, transparent)` }}>
                                {indicator.direction}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center" style={{ fontSize: 12, color: 'var(--tp-text-2)' }}>{indicator.strength}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums" style={{ fontSize: 13, fontWeight: 500, color: 'var(--tp-text-1)' }}>{indicator.actual}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums" style={{ fontSize: 12, color: 'var(--tp-text-3)' }}>{indicator.forecast}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums" style={{ fontSize: 12, color: 'var(--tp-text-3)' }}>{indicator.previous}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span style={{ fontSize: 12, color: indicator.surprise === 'positive' ? 'var(--tp-bullish)' : indicator.surprise === 'negative' ? 'var(--tp-bearish)' : 'var(--tp-neutral)' }}>
                                {indicator.surprise === 'positive' ? '\u25B2' : indicator.surprise === 'negative' ? '\u25BC' : '\u2014'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-block w-8 py-0.5 rounded tabular-nums" style={{ fontSize: 11, fontWeight: 500, color: getContributionColor(indicator.categoryContribution), background: 'var(--tp-l3)' }}>
                                {getContributionLabel(indicator.categoryContribution)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right" style={{ fontSize: 11, color: 'var(--tp-text-3)' }}>{indicator.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Category Net Score */}
                  <div className="p-4" style={{ background: 'var(--tp-l1)', borderTop: '1px solid var(--tp-border-subtle)' }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 12, color: 'var(--tp-text-2)' }}>Net Category Score</span>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 14, fontWeight: 600, color: data.color }}>{data.bias}</span>
                        <span className="rounded px-2.5 py-1 tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: data.color, background: `color-mix(in srgb, ${data.color} 12%, transparent)` }}>
                          {data.score > 0 ? '+' : ''}{data.score}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Net Macro Interpretation */}
      <div className="mt-6 rounded-lg p-5" style={{ background: 'var(--tp-l2)', border: '1px solid var(--tp-border-subtle)' }}>
        <h3 className="mb-4">Net Macro Interpretation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--tp-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bullish Drivers</span>
            <ul className="mt-2 space-y-2">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--tp-bullish)' }} />
                <span style={{ fontSize: 13, color: 'var(--tp-text-1)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--tp-bullish)' }}>Rates (+2):</span> Real yields compressing = bullish gold, bonds
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--tp-bullish)' }} />
                <span style={{ fontSize: 13, color: 'var(--tp-text-1)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--tp-bullish)' }}>Growth (+1):</span> GDP and retail sales holding = not recession yet
                </span>
              </li>
            </ul>
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--tp-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Bearish Drivers</span>
            <ul className="mt-2 space-y-2">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--tp-bearish)' }} />
                <span style={{ fontSize: 13, color: 'var(--tp-text-1)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--tp-bearish)' }}>Jobs (-2):</span> Labor weakening = earnings risk for equities
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--tp-bearish)' }} />
                <span style={{ fontSize: 13, color: 'var(--tp-text-1)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--tp-bearish)' }}>Housing (-1):</span> High rates biting = consumer stress building
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}