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
    if (contribution >= 2) return '#3FAE7A';
    if (contribution === 1) return '#3FAE7A';
    if (contribution === -1) return '#D66565';
    if (contribution <= -2) return '#D66565';
    return '#6F7A90';
  };

  const getContributionLabel = (contribution: number) => {
    if (contribution === 2) return '+2';
    if (contribution === 1) return '+1';
    if (contribution === 0) return '0';
    if (contribution === -1) return '-1';
    if (contribution === -2) return '-2';
    return '0';
  };

  const getDirectionColor = (direction: string) => {
    if (direction === 'Bullish') return '#3FAE7A';
    if (direction === 'Bearish') return '#D66565';
    return '#6F7A90';
  };

  const getBiasIcon = (score: number) => {
    if (score > 0) return <TrendingUp className="w-5 h-5" />;
    if (score < 0) return <TrendingDown className="w-5 h-5" />;
    return <Minus className="w-5 h-5" />;
  };

  return (
    <div className="p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl mb-2">Fundamentals</h1>
        <p className="text-[#9AA1B2]">Category-level bias aggregation • Interpret first, data second</p>
      </div>

      {/* Category Bias Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {(Object.keys(categories) as Category[]).map((category) => {
          const data = categories[category];
          return (
            <div key={category} className="bg-[#141823] rounded-lg p-4 border border-[#1E2433]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm">{category}</h3>
                <div style={{ color: data.color }}>{getBiasIcon(data.score)}</div>
              </div>
              <div className="text-lg mb-1" style={{ color: data.color }}>
                {data.bias}
              </div>
              <div className="text-xs text-[#9AA1B2] mb-2">{data.strength}</div>
              <div className="text-sm font-medium">Score: {data.score}</div>
            </div>
          );
        })}
      </div>

      {/* Expandable Categories with NYX-Style Tables */}
      <div className="space-y-4">
        {(Object.keys(categories) as Category[]).map((category) => {
          const isExpanded = expandedCategory === category;
          const data = categories[category];

          return (
            <div key={category} className="bg-[#141823] rounded-lg border border-[#1E2433] overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-5 hover:bg-[#1E2433] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div style={{ color: data.color }}>{getBiasIcon(data.score)}</div>
                  <div className="text-left">
                    <h2 className="text-xl mb-1">{category}</h2>
                    <p className="text-sm" style={{ color: data.color }}>
                      {data.bias} ({data.strength}) • Score: {data.score} • {data.summary}
                    </p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-[#9AA1B2]" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[#9AA1B2]" />
                )}
              </button>

              {/* Category Content - NYX-Style Table */}
              {isExpanded && (
                <div className="border-t border-[#1E2433]">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#0E1116] border-b border-[#1E2433]">
                          <th className="text-left py-3 px-4 text-sm text-[#9AA1B2]">Indicator</th>
                          <th className="text-center py-3 px-4 text-sm text-[#9AA1B2]">Direction</th>
                          <th className="text-center py-3 px-4 text-sm text-[#9AA1B2]">Strength</th>
                          <th className="text-right py-3 px-4 text-sm text-[#9AA1B2]">Actual</th>
                          <th className="text-right py-3 px-4 text-sm text-[#9AA1B2]">Forecast</th>
                          <th className="text-right py-3 px-4 text-sm text-[#9AA1B2]">Previous</th>
                          <th className="text-center py-3 px-4 text-sm text-[#9AA1B2]">Surprise</th>
                          <th className="text-center py-3 px-4 text-sm text-[#9AA1B2]">Category Score</th>
                          <th className="text-right py-3 px-4 text-sm text-[#9AA1B2]">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.indicators.map((indicator, index) => (
                          <tr key={index} className="border-b border-[#1E2433] last:border-b-0 hover:bg-[#0E1116] transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-medium">{indicator.name}</div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className="inline-block px-3 py-1 rounded text-xs font-medium"
                                style={{
                                  color: getDirectionColor(indicator.direction),
                                  backgroundColor: `${getDirectionColor(indicator.direction)}20`,
                                }}
                              >
                                {indicator.direction}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-sm">{indicator.strength}</td>
                            <td className="py-3 px-4 text-right font-medium">{indicator.actual}</td>
                            <td className="py-3 px-4 text-right text-[#9AA1B2]">{indicator.forecast}</td>
                            <td className="py-3 px-4 text-right text-[#9AA1B2]">{indicator.previous}</td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`text-xs ${
                                  indicator.surprise === 'positive'
                                    ? 'text-[#3FAE7A]'
                                    : indicator.surprise === 'negative'
                                    ? 'text-[#D66565]'
                                    : 'text-[#6F7A90]'
                                }`}
                              >
                                {indicator.surprise === 'positive' ? '▲' : indicator.surprise === 'negative' ? '▼' : '—'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className="inline-block w-12 py-1 rounded text-sm font-medium"
                                style={{
                                  color: getContributionColor(indicator.categoryContribution),
                                  backgroundColor: `${getContributionColor(indicator.categoryContribution)}30`,
                                }}
                              >
                                {getContributionLabel(indicator.categoryContribution)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-sm text-[#9AA1B2]">{indicator.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Category Net Score Summary */}
                  <div className="p-4 bg-[#0E1116] border-t border-[#1E2433]">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-[#9AA1B2]">Net Category Score:</div>
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-medium" style={{ color: data.color }}>
                          {data.bias}
                        </div>
                        <div
                          className="px-4 py-2 rounded font-medium text-lg"
                          style={{
                            color: data.color,
                            backgroundColor: `${data.color}20`,
                          }}
                        >
                          {data.score > 0 ? '+' : ''}
                          {data.score}
                        </div>
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
      <div className="mt-8 bg-[#141823] rounded-lg p-6 border border-[#1E2433]">
        <h2 className="text-xl mb-4">Net Macro Interpretation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm text-[#9AA1B2] mb-3">Bullish Drivers</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#3FAE7A] mt-2 flex-shrink-0" />
                <span className="text-sm text-[#E6E9F0]">
                  <span className="text-[#3FAE7A]">Rates (+2):</span> Real yields compressing = bullish gold, bonds
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#3FAE7A] mt-2 flex-shrink-0" />
                <span className="text-sm text-[#E6E9F0]">
                  <span className="text-[#3FAE7A]">Growth (+1):</span> GDP and retail sales holding = not recession yet
                </span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm text-[#9AA1B2] mb-3">Bearish Drivers</h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#D66565] mt-2 flex-shrink-0" />
                <span className="text-sm text-[#E6E9F0]">
                  <span className="text-[#D66565]">Jobs (-2):</span> Labor weakening = earnings risk for equities
                </span>
              </li>
              <li className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#D66565] mt-2 flex-shrink-0" />
                <span className="text-sm text-[#E6E9F0]">
                  <span className="text-[#D66565]">Housing (-1):</span> High rates biting = consumer stress building
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
