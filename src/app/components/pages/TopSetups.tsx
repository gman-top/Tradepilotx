import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Star } from 'lucide-react';

type SortKey = 'asset' | 'bias' | 'score';
type SortOrder = 'asc' | 'desc';

interface Setup {
  asset: string;
  bias: string;
  biasColor: string;
  totalScore: number;
  starred: boolean;
  scores: {
    cot: number;
    retailPos: number;
    seasonality: number;
    trend: number;
    growth: number;
    inflation: number;
    jobs: number;
    rates: number;
  };
}

export default function TopSetups() {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const setups: Setup[] = [
    {
      asset: 'XAU/USD',
      bias: 'Very Bullish',
      biasColor: '#3FAE7A',
      totalScore: 11,
      starred: true,
      scores: { cot: 2, retailPos: 2, seasonality: 2, trend: 2, growth: -1, inflation: 1, jobs: 1, rates: 2 },
    },
    {
      asset: 'NQ',
      bias: 'Very Bullish',
      biasColor: '#3FAE7A',
      totalScore: 10,
      starred: false,
      scores: { cot: 2, retailPos: 2, seasonality: 2, trend: 2, growth: 1, inflation: -1, jobs: -1, rates: 1 },
    },
    {
      asset: 'BTC/USD',
      bias: 'Bullish',
      biasColor: '#3FAE7A',
      totalScore: 7,
      starred: false,
      scores: { cot: 2, retailPos: 2, seasonality: 2, trend: 2, growth: 1, inflation: -1, jobs: -1, rates: -2 },
    },
    {
      asset: 'NZD/JPY',
      bias: 'Bullish',
      biasColor: '#3FAE7A',
      totalScore: 7,
      starred: false,
      scores: { cot: 2, retailPos: 0, seasonality: -1, trend: 2, growth: 2, inflation: -2, jobs: 1, rates: 0 },
    },
    {
      asset: 'SPX500',
      bias: 'Bullish',
      biasColor: '#3FAE7A',
      totalScore: 7,
      starred: true,
      scores: { cot: 0, retailPos: 2, seasonality: 2, trend: 1, growth: 1, inflation: -1, jobs: -1, rates: 1 },
    },
    {
      asset: 'CHF/JPY',
      bias: 'Bullish',
      biasColor: '#3FAE7A',
      totalScore: 6,
      starred: false,
      scores: { cot: 0, retailPos: 1, seasonality: -1, trend: 2, growth: 2, inflation: 0, jobs: 2, rates: 0 },
    },
    {
      asset: 'GBP/JPY',
      bias: 'Bullish',
      biasColor: '#3FAE7A',
      totalScore: 6,
      starred: false,
      scores: { cot: 0, retailPos: 0, seasonality: 1, trend: 2, growth: 0, inflation: 2, jobs: 1, rates: 0 },
    },
    {
      asset: 'XAG/USD',
      bias: 'Bullish',
      biasColor: '#3FAE7A',
      totalScore: 5,
      starred: true,
      scores: { cot: 0, retailPos: 1, seasonality: -1, trend: 2, growth: 2, inflation: 0, jobs: 0, rates: 1 },
    },
    {
      asset: 'CAD/JPY',
      bias: 'Bullish',
      biasColor: '#3FAE7A',
      totalScore: 5,
      starred: false,
      scores: { cot: 0, retailPos: 0, seasonality: 1, trend: 2, growth: 2, inflation: -1, jobs: 1, rates: 0 },
    },
    {
      asset: 'GBP/AUD',
      bias: 'Bullish',
      biasColor: '#3FAE7A',
      totalScore: 5,
      starred: false,
      scores: { cot: 0, retailPos: 1, seasonality: 1, trend: 2, growth: 1, inflation: 0, jobs: 0, rates: 0 },
    },
    {
      asset: 'CAD/CHF',
      bias: 'Neutral',
      biasColor: '#6F7A90',
      totalScore: 4,
      starred: false,
      scores: { cot: 0, retailPos: -1, seasonality: 1, trend: -1, growth: 2, inflation: 2, jobs: 0, rates: 1 },
    },
    {
      asset: 'NZD/USD',
      bias: 'Neutral',
      biasColor: '#6F7A90',
      totalScore: 4,
      starred: false,
      scores: { cot: 2, retailPos: 2, seasonality: -1, trend: -1, growth: -2, inflation: 1, jobs: 2, rates: 0 },
    },
    {
      asset: 'EUR/JPY',
      bias: 'Neutral',
      biasColor: '#6F7A90',
      totalScore: 4,
      starred: false,
      scores: { cot: 2, retailPos: 2, seasonality: -1, trend: 2, growth: 2, inflation: -1, jobs: -1, rates: -1 },
    },
    {
      asset: 'EUR/USD',
      bias: 'Neutral',
      biasColor: '#6F7A90',
      totalScore: 4,
      starred: true,
      scores: { cot: 2, retailPos: 2, seasonality: -1, trend: -2, growth: -2, inflation: 0, jobs: 0, rates: 0 },
    },
    {
      asset: 'AUD/JPY',
      bias: 'Neutral',
      biasColor: '#6F7A90',
      totalScore: 3,
      starred: false,
      scores: { cot: 0, retailPos: -1, seasonality: -1, trend: 2, growth: 2, inflation: -1, jobs: -1, rates: 1 },
    },
    {
      asset: 'USD/JPY',
      bias: 'Neutral',
      biasColor: '#6F7A90',
      totalScore: 2,
      starred: true,
      scores: { cot: 0, retailPos: 0, seasonality: 1, trend: 2, growth: 2, inflation: -2, jobs: 0, rates: -1 },
    },
    {
      asset: 'GBP/USD',
      bias: 'Neutral',
      biasColor: '#6F7A90',
      totalScore: 2,
      starred: false,
      scores: { cot: 0, retailPos: 1, seasonality: 2, trend: -1, growth: -1, inflation: 0, jobs: 1, rates: 0 },
    },
    {
      asset: 'USD/CAD',
      bias: 'Neutral',
      biasColor: '#6F7A90',
      totalScore: 1,
      starred: false,
      scores: { cot: 0, retailPos: 1, seasonality: -2, trend: -2, growth: 2, inflation: 1, jobs: 1, rates: 0 },
    },
  ];

  const [setupStarred, setSetupStarred] = useState<Record<string, boolean>>(
    setups.reduce((acc, setup) => ({ ...acc, [setup.asset]: setup.starred }), {})
  );

  const toggleStar = (asset: string) => {
    setSetupStarred((prev) => ({ ...prev, [asset]: !prev[asset] }));
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const sortedSetups = [...setups]
    .filter((setup) => !showFavoritesOnly || setupStarred[setup.asset])
    .sort((a, b) => {
      let compareValue = 0;
      if (sortKey === 'score') {
        compareValue = a.totalScore - b.totalScore;
      } else if (sortKey === 'asset') {
        compareValue = a.asset.localeCompare(b.asset);
      } else if (sortKey === 'bias') {
        compareValue = a.bias.localeCompare(b.bias);
      }
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

  const getScoreColor = (score: number) => {
    if (score === 2) return '#3FAE7A';
    if (score === 1) return '#3FAE7A';
    if (score === -1) return '#D66565';
    if (score === -2) return '#D66565';
    return '#6F7A90';
  };

  const getScoreLabel = (score: number) => {
    if (score === 2) return '2';
    if (score === 1) return '1';
    if (score === 0) return '0';
    if (score === -1) return '-1';
    if (score === -2) return '-2';
    return '0';
  };

  return (
    <div className="p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl mb-2">Top Setups</h1>
        <p className="text-[#9AA1B2]">Ranked by total score • Sortable by category</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showFavoritesOnly}
            onChange={(e) => setShowFavoritesOnly(e.target.checked)}
            className="w-4 h-4 rounded border-[#1E2433] bg-[#141823]"
          />
          <Star className="w-4 h-4 text-[#9AA1B2]" />
          <span className="text-[#9AA1B2]">Favorites Only</span>
        </label>
        <div className="text-sm text-[#9AA1B2]">
          Showing {sortedSetups.length} setup{sortedSetups.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#141823] rounded-lg border border-[#1E2433] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E2433] bg-[#0E1116]">
                <th className="text-left py-3 px-4 text-sm text-[#9AA1B2] sticky left-0 bg-[#0E1116] z-10">
                  <button
                    onClick={() => handleSort('asset')}
                    className="flex items-center gap-1 hover:text-[#E6E9F0]"
                  >
                    Asset
                    {sortKey === 'asset' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm text-[#9AA1B2]">
                  <button
                    onClick={() => handleSort('bias')}
                    className="flex items-center gap-1 hover:text-[#E6E9F0]"
                  >
                    Bias
                    {sortKey === 'bias' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </button>
                </th>
                <th className="text-center py-3 px-4 text-sm text-[#9AA1B2]">
                  <button
                    onClick={() => handleSort('score')}
                    className="flex items-center gap-1 hover:text-[#E6E9F0] mx-auto"
                  >
                    Score
                    {sortKey === 'score' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </button>
                </th>
                <th className="text-center py-3 px-3 text-sm text-[#9AA1B2]">COT</th>
                <th className="text-center py-3 px-3 text-sm text-[#9AA1B2]">Retail</th>
                <th className="text-center py-3 px-3 text-sm text-[#9AA1B2]">Season</th>
                <th className="text-center py-3 px-3 text-sm text-[#9AA1B2]">Trend</th>
                <th className="text-center py-3 px-3 text-sm text-[#9AA1B2]">Growth</th>
                <th className="text-center py-3 px-3 text-sm text-[#9AA1B2]">Inflation</th>
                <th className="text-center py-3 px-3 text-sm text-[#9AA1B2]">Jobs</th>
                <th className="text-center py-3 px-3 text-sm text-[#9AA1B2]">Rates</th>
              </tr>
            </thead>
            <tbody>
              {sortedSetups.map((setup) => (
                <tr key={setup.asset} className="border-b border-[#1E2433] last:border-b-0 hover:bg-[#0E1116] transition-colors">
                  <td className="py-3 px-4 sticky left-0 bg-[#141823] hover:bg-[#0E1116]">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleStar(setup.asset)}>
                        <Star
                          className={`w-4 h-4 ${
                            setupStarred[setup.asset] ? 'fill-[#4C6FFF] text-[#4C6FFF]' : 'text-[#6F7A90]'
                          }`}
                        />
                      </button>
                      <span className="font-medium">{setup.asset}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="inline-block px-2 py-1 rounded text-sm"
                      style={{
                        color: setup.biasColor,
                        backgroundColor: `${setup.biasColor}20`,
                      }}
                    >
                      {setup.bias}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-medium text-lg">{setup.totalScore}</td>
                  <td className="py-3 px-3 text-center">
                    <div
                      className="inline-block w-10 py-1 rounded text-sm font-medium"
                      style={{
                        color: getScoreColor(setup.scores.cot),
                        backgroundColor: `${getScoreColor(setup.scores.cot)}30`,
                      }}
                    >
                      {getScoreLabel(setup.scores.cot)}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div
                      className="inline-block w-10 py-1 rounded text-sm font-medium"
                      style={{
                        color: getScoreColor(setup.scores.retailPos),
                        backgroundColor: `${getScoreColor(setup.scores.retailPos)}30`,
                      }}
                    >
                      {getScoreLabel(setup.scores.retailPos)}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div
                      className="inline-block w-10 py-1 rounded text-sm font-medium"
                      style={{
                        color: getScoreColor(setup.scores.seasonality),
                        backgroundColor: `${getScoreColor(setup.scores.seasonality)}30`,
                      }}
                    >
                      {getScoreLabel(setup.scores.seasonality)}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div
                      className="inline-block w-10 py-1 rounded text-sm font-medium"
                      style={{
                        color: getScoreColor(setup.scores.trend),
                        backgroundColor: `${getScoreColor(setup.scores.trend)}30`,
                      }}
                    >
                      {getScoreLabel(setup.scores.trend)}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div
                      className="inline-block w-10 py-1 rounded text-sm font-medium"
                      style={{
                        color: getScoreColor(setup.scores.growth),
                        backgroundColor: `${getScoreColor(setup.scores.growth)}30`,
                      }}
                    >
                      {getScoreLabel(setup.scores.growth)}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div
                      className="inline-block w-10 py-1 rounded text-sm font-medium"
                      style={{
                        color: getScoreColor(setup.scores.inflation),
                        backgroundColor: `${getScoreColor(setup.scores.inflation)}30`,
                      }}
                    >
                      {getScoreLabel(setup.scores.inflation)}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div
                      className="inline-block w-10 py-1 rounded text-sm font-medium"
                      style={{
                        color: getScoreColor(setup.scores.jobs),
                        backgroundColor: `${getScoreColor(setup.scores.jobs)}30`,
                      }}
                    >
                      {getScoreLabel(setup.scores.jobs)}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div
                      className="inline-block w-10 py-1 rounded text-sm font-medium"
                      style={{
                        color: getScoreColor(setup.scores.rates),
                        backgroundColor: `${getScoreColor(setup.scores.rates)}30`,
                      }}
                    >
                      {getScoreLabel(setup.scores.rates)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-[#141823] rounded-lg border border-[#1E2433]">
        <h3 className="text-sm mb-3">Scoring Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-6 rounded bg-[#3FAE7A]/30 flex items-center justify-center text-[#3FAE7A] text-xs font-medium">
              2
            </div>
            <span className="text-[#9AA1B2]">Very Bullish</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-6 rounded bg-[#3FAE7A]/30 flex items-center justify-center text-[#3FAE7A] text-xs font-medium">
              1
            </div>
            <span className="text-[#9AA1B2]">Bullish</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-6 rounded bg-[#6F7A90]/30 flex items-center justify-center text-[#6F7A90] text-xs font-medium">
              0
            </div>
            <span className="text-[#9AA1B2]">Neutral</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-6 rounded bg-[#D66565]/30 flex items-center justify-center text-[#D66565] text-xs font-medium">
              -1
            </div>
            <span className="text-[#9AA1B2]">Bearish</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-6 rounded bg-[#D66565]/30 flex items-center justify-center text-[#D66565] text-xs font-medium">
              -2
            </div>
            <span className="text-[#9AA1B2]">Very Bearish</span>
          </div>
        </div>
      </div>
    </div>
  );
}
