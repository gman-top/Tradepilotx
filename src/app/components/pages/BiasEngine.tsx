import React, { useState } from 'react';
import { TrendingUp, Target, Calendar, Users, Zap, AlertTriangle } from 'lucide-react';

type Asset = 'Gold (XAU/USD)' | 'EUR/USD' | 'S&P 500' | 'Crude Oil';

export default function BiasEngine() {
  const [selectedAsset, setSelectedAsset] = useState<Asset>('Gold (XAU/USD)');

  const biasData: Record<
    Asset,
    {
      finalBias: string;
      biasType: string;
      totalScore: number;
      color: string;
      scores: {
        macro: { score: number; max: number; label: string; breakdown: { growth: number; inflation: number; jobs: number; rates: number } };
        cot: { score: number; max: number; label: string };
        seasonality: { score: number; max: number; label: string };
        sentiment: { score: number; max: number; label: string };
      };
      whyExists: string[];
      whatInvalidates: string[];
    }
  > = {
    'Gold (XAU/USD)': {
      finalBias: 'Very Bullish',
      biasType: 'Macro-Led',
      totalScore: 85,
      color: '#3FAE7A',
      scores: {
        macro: { score: 32, max: 40, label: 'Strong', breakdown: { growth: 0, inflation: 4, jobs: 6, rates: 22 } },
        cot: { score: 28, max: 30, label: 'Extreme' },
        seasonality: { score: 15, max: 20, label: 'Favorable' },
        sentiment: { score: 10, max: 10, label: 'Bullish' },
      },
      whyExists: [
        'Real rates compressing as nominal yields fall while inflation stays elevated',
        'Commercials accumulating at 88th percentile - smart money positioning extreme',
        'Jobs weakness increases Fed dovish tilt, lowering opportunity cost of gold',
        'Seasonal tailwinds historically support Q1 strength',
        'Safe-haven demand active as growth concerns emerge',
      ],
      whatInvalidates: [
        'Fed turns hawkish - unexpected rate hikes',
        'Inflation collapses below 2% - removes hedge narrative',
        'Jobs data strengthens significantly - delays rate cuts',
        'Real yields spike above 2.5% - increases opportunity cost',
      ],
    },
    'EUR/USD': {
      finalBias: 'Bearish',
      biasType: 'Rates-Driven',
      totalScore: 35,
      color: '#D66565',
      scores: {
        macro: { score: 12, max: 40, label: 'Weak' },
        cot: { score: 8, max: 30, label: 'Weak' },
        seasonality: { score: 8, max: 20, label: 'Neutral' },
        sentiment: { score: 7, max: 10, label: 'Bearish' },
      },
      whyExists: [
        'Rate divergence is dominant - ECB expected to cut well before Fed',
        'Eurozone growth significantly weaker than US (PMI gap widening)',
        'COT positioning shows net short building at 32nd percentile',
        'Technical breakdown confirmed below key support at 1.09',
      ],
      whatInvalidates: [
        'Fed cuts rates before ECB - unlikely but would reverse divergence',
        'Eurozone growth surprises positively - PMI back above 52',
        'ECB turns unexpectedly hawkish on inflation',
        'USD macro regime shifts to bearish (jobs collapse)',
      ],
    },
    'S&P 500': {
      finalBias: 'Bearish',
      biasType: 'COT + Macro Conflict',
      totalScore: 37,
      color: '#D66565',
      scores: {
        macro: { score: 14, max: 40, label: 'Mixed' },
        cot: { score: 6, max: 30, label: 'Contrarian Short' },
        seasonality: { score: 10, max: 20, label: 'Neutral' },
        sentiment: { score: 7, max: 10, label: 'Cautious' },
      },
      whyExists: [
        'COT shows extreme speculative long crowding (28th percentile) - contrarian bearish',
        'Jobs weakness threatens earnings while valuations remain extended',
        'Fed staying higher for longer pressures equity multiples',
        'Market breadth deteriorating - fewer stocks participating in rallies',
        'Credit spreads beginning to widen - risk appetite fading',
      ],
      whatInvalidates: [
        'Jobs data stabilizes - NFP back above 200K consistently',
        'Fed pivots dovish and cuts rates 50bps - liquidity boost',
        'Earnings surprise massively to upside - margin expansion',
        'Breadth improves with new highs expanding',
      ],
    },
    'Crude Oil': {
      finalBias: 'Bearish',
      biasType: 'Demand-Led',
      totalScore: 30,
      color: '#D66565',
      scores: {
        macro: { score: 8, max: 40, label: 'Weak' },
        cot: { score: 8, max: 30, label: 'Weak' },
        seasonality: { score: 6, max: 20, label: 'Unfavorable' },
        sentiment: { score: 8, max: 10, label: 'Bearish' },
      },
      whyExists: [
        'Demand slowdown clear from manufacturing PMI contraction',
        'China growth concerns escalating - weak stimulus response',
        'US production at record highs - supply abundant',
        'Winter heating demand fading as seasonality turns',
        'OPEC+ struggling with quota compliance',
      ],
      whatInvalidates: [
        'China announces major stimulus package - commodity demand surges',
        'OPEC+ implements deep production cuts and follows through',
        'Geopolitical supply disruption (Middle East escalation)',
        'US production unexpectedly declines',
      ],
    },
  };

  const currentData = biasData[selectedAsset];
  const assets: Asset[] = ['Gold (XAU/USD)', 'EUR/USD', 'S&P 500', 'Crude Oil'];

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl mb-2">Bias Engine</h1>
        <p className="text-[#9AA1B2]">Macro-first directional framework • Stacked decision, not single indicator</p>
      </div>

      {/* Asset Selector */}
      <div className="mb-8">
        <div className="flex gap-3 flex-wrap">
          {assets.map((asset) => (
            <button
              key={asset}
              onClick={() => setSelectedAsset(asset)}
              className={`px-4 py-2 rounded-lg transition-all ${
                selectedAsset === asset
                  ? 'bg-[#4C6FFF] text-white'
                  : 'bg-[#141823] text-[#9AA1B2] border border-[#1E2433] hover:bg-[#1E2433]'
              }`}
            >
              {asset}
            </button>
          ))}
        </div>
      </div>

      {/* Final Bias Statement */}
      <div className="bg-[#141823] rounded-lg p-8 border border-[#1E2433] mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-[#9AA1B2] mb-2">Final Bias</div>
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8" style={{ color: currentData.color }} />
              <div>
                <h2 className="text-4xl" style={{ color: currentData.color }}>
                  {currentData.finalBias}
                </h2>
                <p className="text-sm text-[#9AA1B2] mt-1">({currentData.biasType})</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-[#9AA1B2] mb-2">Score</div>
            <div className="text-4xl">{currentData.totalScore}/100</div>
          </div>
        </div>
      </div>

      {/* Score Breakdown - Visually Subordinate */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#141823] rounded-lg p-5 border border-[#1E2433]">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[#9AA1B2]" />
            <h3 className="text-sm text-[#9AA1B2]">Macro Score</h3>
          </div>
          <div className="text-2xl mb-1">
            {currentData.scores.macro.score}
            <span className="text-lg text-[#9AA1B2]">/{currentData.scores.macro.max}</span>
          </div>
          <div className="text-xs text-[#9AA1B2]">{currentData.scores.macro.label}</div>
          <div className="w-full bg-[#1E2433] rounded-full h-1.5 mt-3">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${(currentData.scores.macro.score / currentData.scores.macro.max) * 100}%`,
                backgroundColor: '#4C6FFF',
              }}
            />
          </div>
          
          {/* Macro Category Breakdown */}
          {currentData.scores.macro.breakdown && (
            <div className="mt-3 pt-3 border-t border-[#1E2433] space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#9AA1B2]">Growth:</span>
                <span className={currentData.scores.macro.breakdown.growth >= 0 ? 'text-[#3FAE7A]' : 'text-[#D66565]'}>
                  {currentData.scores.macro.breakdown.growth >= 0 ? '+' : ''}{currentData.scores.macro.breakdown.growth}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9AA1B2]">Inflation:</span>
                <span className={currentData.scores.macro.breakdown.inflation >= 0 ? 'text-[#3FAE7A]' : 'text-[#D66565]'}>
                  {currentData.scores.macro.breakdown.inflation >= 0 ? '+' : ''}{currentData.scores.macro.breakdown.inflation}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9AA1B2]">Jobs:</span>
                <span className={currentData.scores.macro.breakdown.jobs >= 0 ? 'text-[#3FAE7A]' : 'text-[#D66565]'}>
                  {currentData.scores.macro.breakdown.jobs >= 0 ? '+' : ''}{currentData.scores.macro.breakdown.jobs}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9AA1B2]">Rates:</span>
                <span className={currentData.scores.macro.breakdown.rates >= 0 ? 'text-[#3FAE7A]' : 'text-[#D66565]'}>
                  {currentData.scores.macro.breakdown.rates >= 0 ? '+' : ''}{currentData.scores.macro.breakdown.rates}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#141823] rounded-lg p-5 border border-[#1E2433]">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-[#9AA1B2]" />
            <h3 className="text-sm text-[#9AA1B2]">COT Score</h3>
          </div>
          <div className="text-2xl mb-1">
            {currentData.scores.cot.score}
            <span className="text-lg text-[#9AA1B2]">/{currentData.scores.cot.max}</span>
          </div>
          <div className="text-xs text-[#9AA1B2]">{currentData.scores.cot.label}</div>
          <div className="w-full bg-[#1E2433] rounded-full h-1.5 mt-3">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${(currentData.scores.cot.score / currentData.scores.cot.max) * 100}%`,
                backgroundColor: '#4C6FFF',
              }}
            />
          </div>
        </div>

        <div className="bg-[#141823] rounded-lg p-5 border border-[#1E2433]">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-[#9AA1B2]" />
            <h3 className="text-sm text-[#9AA1B2]">Seasonality</h3>
          </div>
          <div className="text-2xl mb-1">
            {currentData.scores.seasonality.score}
            <span className="text-lg text-[#9AA1B2]">/{currentData.scores.seasonality.max}</span>
          </div>
          <div className="text-xs text-[#9AA1B2]">{currentData.scores.seasonality.label}</div>
          <div className="w-full bg-[#1E2433] rounded-full h-1.5 mt-3">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${(currentData.scores.seasonality.score / currentData.scores.seasonality.max) * 100}%`,
                backgroundColor: '#4C6FFF',
              }}
            />
          </div>
        </div>

        <div className="bg-[#141823] rounded-lg p-5 border border-[#1E2433]">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-[#9AA1B2]" />
            <h3 className="text-sm text-[#9AA1B2]">Sentiment</h3>
          </div>
          <div className="text-2xl mb-1">
            {currentData.scores.sentiment.score}
            <span className="text-lg text-[#9AA1B2]">/{currentData.scores.sentiment.max}</span>
          </div>
          <div className="text-xs text-[#9AA1B2]">{currentData.scores.sentiment.label}</div>
          <div className="w-full bg-[#1E2433] rounded-full h-1.5 mt-3">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${(currentData.scores.sentiment.score / currentData.scores.sentiment.max) * 100}%`,
                backgroundColor: '#4C6FFF',
              }}
            />
          </div>
        </div>
      </div>

      {/* Why This Bias Exists */}
      <div className="bg-[#141823] rounded-lg p-6 border border-[#1E2433] mb-6">
        <h2 className="text-xl mb-4">Why This Bias Exists</h2>
        <ul className="space-y-3">
          {currentData.whyExists.map((reason, index) => (
            <li key={index} className="flex items-start gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: `${currentData.color}30` }}
              >
                <span className="text-xs" style={{ color: currentData.color }}>
                  {index + 1}
                </span>
              </div>
              <span className="text-[#E6E9F0] leading-relaxed">{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* What Would Invalidate This Bias */}
      <div className="bg-[#141823] rounded-lg p-6 border border-[#1E2433]">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-[#D66565]" />
          <h2 className="text-xl">What Would Invalidate This Bias</h2>
        </div>
        <ul className="space-y-3">
          {currentData.whatInvalidates.map((invalidator, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-[#D66565]/20">
                <span className="text-xs text-[#D66565]">{index + 1}</span>
              </div>
              <span className="text-[#9AA1B2] leading-relaxed">{invalidator}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Methodology Note */}
      <div className="mt-6 p-4 bg-[#141823] rounded-lg border border-[#1E2433]">
        <p className="text-sm text-[#9AA1B2] leading-relaxed">
          <span className="text-[#E6E9F0]">About the Bias Engine:</span> This is a macro-first framework. Bias is built
          top-down: macro environment determines regime, categories (Growth/Inflation/Jobs/Rates) produce directional bias,
          asset-level impact mapped from dominant categories. COT confirms or contradicts. Scores are weighted but subordinate
          to interpretation.
        </p>
      </div>
    </div>
  );
}