import React, { useState } from 'react';
import { Search, Star, Filter } from 'lucide-react';

type AssetClass = 'All' | 'FX' | 'Commodities' | 'Indices' | 'Crypto';
type FilterMode = 'all' | 'favorites' | 'active' | 'favorites-active';

interface BiasBreakdown {
  category: string;
  impact: number; // +2, +1, 0, -1, -2
  note: string;
}

interface Asset {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  finalBias: string;
  confidence: number;
  price: number;
  change: number;
  starred: boolean;
  breakdown: BiasBreakdown[];
  explanation: string;
  biasColor: string;
}

export default function Assets() {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState<AssetClass>('All');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const assets: Asset[] = [
    {
      symbol: 'XAU/USD',
      name: 'Gold Spot',
      assetClass: 'Commodities',
      finalBias: 'Very Bullish',
      confidence: 88,
      price: 2643.2,
      change: 1.85,
      starred: true,
      biasColor: '#3FAE7A',
      breakdown: [
        { category: 'COT', impact: 2, note: '88th percentile - commercials accumulating' },
        { category: 'Growth', impact: 0, note: 'Neutral - stable GDP not driving gold' },
        { category: 'Inflation', impact: 1, note: 'Sticky inflation supports hedge demand' },
        { category: 'Jobs', impact: 1, note: 'Weakening labor = Fed dovish pivot' },
        { category: 'Rates', impact: 2, note: 'Real rates falling - bullish gold' },
        { category: 'Seasonality', impact: 1, note: 'Q1 historically strong' },
      ],
      explanation: 'Gold benefits from falling real rates and sticky inflation. COT positioning confirms smart money accumulation at extremes. Jobs weakness increases Fed dovish tilt, lowering opportunity cost of holding gold.',
    },
    {
      symbol: 'EUR/USD',
      name: 'Euro / US Dollar',
      assetClass: 'FX',
      finalBias: 'Bearish',
      confidence: 65,
      price: 1.0842,
      change: -0.45,
      starred: true,
      biasColor: '#D66565',
      breakdown: [
        { category: 'COT', impact: -1, note: '32nd percentile - net short building' },
        { category: 'Growth', impact: -1, note: 'US growth outperforming Eurozone' },
        { category: 'Inflation', impact: 0, note: 'Both regions elevated, not a driver' },
        { category: 'Jobs', impact: -1, note: 'US labor cooling less than EU' },
        { category: 'Rates', impact: -2, note: 'Rate divergence strongly favors USD' },
        { category: 'Seasonality', impact: 0, note: 'No clear seasonal pattern' },
      ],
      explanation: 'Rate divergence is the dominant driver. ECB expected to cut well before Fed. Growth differential also favors USD. COT confirms bearish positioning.',
    },
    {
      symbol: 'SPX',
      name: 'S&P 500',
      assetClass: 'Indices',
      finalBias: 'Bearish',
      confidence: 63,
      price: 5924.0,
      change: -0.85,
      starred: true,
      biasColor: '#D66565',
      breakdown: [
        { category: 'COT', impact: -2, note: '28th percentile - contrarian short signal' },
        { category: 'Growth', impact: 1, note: 'GDP stable, retail sales beat' },
        { category: 'Inflation', impact: -1, note: 'Sticky CPI keeps Fed tight' },
        { category: 'Jobs', impact: -2, note: 'Labor weakness = earnings risk' },
        { category: 'Rates', impact: -1, note: 'Higher for longer pressures valuations' },
        { category: 'Seasonality', impact: 0, note: 'No strong pattern' },
      ],
      explanation: 'Jobs weakness threatens earnings while valuations remain extended. COT shows crowded speculative longs (contrarian bearish). Fed staying tight limits multiple expansion.',
    },
    {
      symbol: 'WTI',
      name: 'Crude Oil WTI',
      assetClass: 'Commodities',
      finalBias: 'Bearish',
      confidence: 70,
      price: 68.45,
      change: -2.1,
      starred: false,
      biasColor: '#D66565',
      breakdown: [
        { category: 'COT', impact: -1, note: '35th percentile - longs liquidating' },
        { category: 'Growth', impact: -2, note: 'Demand concerns from weak PMI' },
        { category: 'Inflation', impact: 0, note: 'Not a primary driver for oil currently' },
        { category: 'Jobs', impact: -1, note: 'Economic slowdown = less demand' },
        { category: 'Rates', impact: 0, note: 'Rates not driving oil direction' },
        { category: 'Seasonality', impact: -1, note: 'Winter demand fading' },
      ],
      explanation: 'Demand slowdown is clear from manufacturing contraction. Supply remains high from US production. Seasonality turning against oil as heating demand fades.',
    },
    {
      symbol: 'USD/JPY',
      name: 'US Dollar / Japanese Yen',
      assetClass: 'FX',
      finalBias: 'Bearish',
      confidence: 58,
      price: 149.32,
      change: -0.38,
      starred: true,
      biasColor: '#D66565',
      breakdown: [
        { category: 'COT', impact: 0, note: '52nd percentile - no clear positioning' },
        { category: 'Growth', impact: 0, note: 'Both economies stable' },
        { category: 'Inflation', impact: -1, note: 'Japan inflation finally rising' },
        { category: 'Jobs', impact: 0, note: 'Not a primary JPY driver' },
        { category: 'Rates', impact: -2, note: 'BOJ policy shift expected - JPY bullish' },
        { category: 'Seasonality', impact: 1, note: 'JPY weakness typical Q1' },
      ],
      explanation: 'BOJ policy normalization is the dominant factor. Market pricing rate hikes from BOJ while Fed stays on hold. Seasonality counters but rates divergence wins.',
    },
    {
      symbol: 'GBP/USD',
      name: 'British Pound / US Dollar',
      assetClass: 'FX',
      finalBias: 'Neutral',
      confidence: 48,
      price: 1.2634,
      change: -0.12,
      starred: false,
      biasColor: '#6F7A90',
      breakdown: [
        { category: 'COT', impact: 0, note: '48th percentile - no clear direction' },
        { category: 'Growth', impact: 0, note: 'UK and US growth both moderate' },
        { category: 'Inflation', impact: 0, note: 'Both sticky, offsetting' },
        { category: 'Jobs', impact: 0, note: 'Similar labor dynamics' },
        { category: 'Rates', impact: 0, note: 'BOE and Fed both on hold' },
        { category: 'Seasonality', impact: 0, note: 'No pattern' },
      ],
      explanation: 'No clear macro edge. Both central banks on hold, similar growth and inflation dynamics. Range-bound likely until catalyst emerges.',
    },
    {
      symbol: 'AUD/USD',
      name: 'Australian Dollar / US Dollar',
      assetClass: 'FX',
      finalBias: 'Bullish',
      confidence: 62,
      price: 0.6523,
      change: 0.28,
      starred: false,
      biasColor: '#3FAE7A',
      breakdown: [
        { category: 'COT', impact: 1, note: '68th percentile - moderate positioning' },
        { category: 'Growth', impact: 1, note: 'China stimulus hopes support AUD' },
        { category: 'Inflation', impact: 0, note: 'Not a driver' },
        { category: 'Jobs', impact: 0, note: 'Australia labor stable' },
        { category: 'Rates', impact: 1, note: 'RBA staying tight longer than Fed' },
        { category: 'Seasonality', impact: 0, note: 'Neutral' },
      ],
      explanation: 'RBA hawkish relative to Fed. China stimulus optimism supports commodity currencies. COT positioning moderately bullish.',
    },
    {
      symbol: 'XAG/USD',
      name: 'Silver Spot',
      assetClass: 'Commodities',
      finalBias: 'Bullish',
      confidence: 72,
      price: 30.84,
      change: 1.42,
      starred: true,
      biasColor: '#3FAE7A',
      breakdown: [
        { category: 'COT', impact: 1, note: '72nd percentile - accumulation phase' },
        { category: 'Growth', impact: 1, note: 'Industrial demand stable' },
        { category: 'Inflation', impact: 1, note: 'Follows gold as inflation hedge' },
        { category: 'Jobs', impact: 0, note: 'Not primary driver' },
        { category: 'Rates', impact: 2, note: 'Falling real rates bullish' },
        { category: 'Seasonality', impact: 0, note: 'Neutral' },
      ],
      explanation: 'Silver follows gold on real rates falling. Industrial demand component adds support. COT positioning confirms smart money accumulation.',
    },
    {
      symbol: 'NQ',
      name: 'NASDAQ 100',
      assetClass: 'Indices',
      finalBias: 'Bearish',
      confidence: 68,
      price: 20842.0,
      change: -1.12,
      starred: false,
      biasColor: '#D66565',
      breakdown: [
        { category: 'COT', impact: -2, note: 'Extreme speculative longs - contrarian' },
        { category: 'Growth', impact: 1, note: 'Tech earnings resilient' },
        { category: 'Inflation', impact: -1, note: 'Sticky inflation = Fed tight' },
        { category: 'Jobs', impact: -2, note: 'Weakening labor = recession risk' },
        { category: 'Rates', impact: -2, note: 'Growth stocks suffer in high rate env' },
        { category: 'Seasonality', impact: 0, note: 'Neutral' },
      ],
      explanation: 'High rates pressure tech multiples. Jobs weakness raises recession risk. COT positioning extremely crowded on long side (contrarian bearish signal).',
    },
    {
      symbol: 'BTC/USD',
      name: 'Bitcoin',
      assetClass: 'Crypto',
      finalBias: 'Neutral',
      confidence: 52,
      price: 96420.0,
      change: 0.65,
      starred: false,
      biasColor: '#6F7A90',
      breakdown: [
        { category: 'COT', impact: 0, note: 'No CFTC data - using proxy sentiment' },
        { category: 'Growth', impact: 0, note: 'Crypto less correlated to growth recently' },
        { category: 'Inflation', impact: 1, note: 'Some inflation hedge narrative' },
        { category: 'Jobs', impact: 0, note: 'Not a driver' },
        { category: 'Rates', impact: -1, note: 'High rates pressure risk assets' },
        { category: 'Seasonality', impact: 0, note: 'Neutral' },
      ],
      explanation: 'Mixed signals. Inflation hedge narrative supports but high rates pressure. Low confidence due to crypto-specific factors dominating over macro.',
    },
  ];

  const [assetStarred, setAssetStarred] = useState<Record<string, boolean>>(
    assets.reduce((acc, asset) => ({ ...acc, [asset.symbol]: asset.starred }), {})
  );

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = filterClass === 'All' || asset.assetClass === filterClass;
    
    // Filter mode logic
    const isStarred = assetStarred[asset.symbol];
    const isActive = asset.finalBias !== 'Neutral';
    
    let matchesMode = true;
    if (filterMode === 'favorites') {
      matchesMode = isStarred;
    } else if (filterMode === 'active') {
      matchesMode = isActive;
    } else if (filterMode === 'favorites-active') {
      matchesMode = isStarred && isActive;
    }
    
    return matchesSearch && matchesClass && matchesMode;
  });

  React.useEffect(() => {
    if (!selectedAsset && filteredAssets.length > 0) {
      setSelectedAsset(filteredAssets[0]);
    }
  }, []);

  const toggleStar = (symbol: string) => {
    setAssetStarred((prev) => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  const getImpactColor = (impact: number) => {
    if (impact >= 2) return '#3FAE7A';
    if (impact === 1) return '#3FAE7A';
    if (impact === -1) return '#D66565';
    if (impact <= -2) return '#D66565';
    return '#6F7A90';
  };

  const getImpactLabel = (impact: number) => {
    if (impact === 2) return '+2';
    if (impact === 1) return '+1';
    if (impact === 0) return '0';
    if (impact === -1) return '-1';
    if (impact === -2) return '-2';
    return '0';
  };

  return (
    <div className="flex h-full">
      {/* Left Panel - Asset List */}
      <aside className="w-80 bg-[#0E1116] border-r border-[#1E2433] flex flex-col">
        {/* Search & Filters */}
        <div className="p-4 border-b border-[#1E2433]">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA1B2]" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-[#141823] border border-[#1E2433] rounded-md text-sm focus:outline-none focus:border-[#4C6FFF]"
            />
          </div>
          
          {/* Asset Class Filters */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {(['All', 'FX', 'Commodities', 'Indices', 'Crypto'] as AssetClass[]).map((cls) => (
              <button
                key={cls}
                onClick={() => setFilterClass(cls)}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  filterClass === cls
                    ? 'bg-[#4C6FFF] text-white'
                    : 'bg-[#141823] text-[#9AA1B2] hover:bg-[#1E2433]'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
          
          {/* Filter Mode Toggles */}
          <div className="space-y-2">
            <div className="text-xs text-[#9AA1B2] mb-2">Filter by:</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-2 rounded-md text-xs transition-colors ${
                  filterMode === 'all'
                    ? 'bg-[#4C6FFF] text-white'
                    : 'bg-[#141823] text-[#9AA1B2] hover:bg-[#1E2433] border border-[#1E2433]'
                }`}
              >
                All Assets
              </button>
              <button
                onClick={() => setFilterMode('favorites')}
                className={`px-3 py-2 rounded-md text-xs transition-colors flex items-center justify-center gap-1 ${
                  filterMode === 'favorites'
                    ? 'bg-[#4C6FFF] text-white'
                    : 'bg-[#141823] text-[#9AA1B2] hover:bg-[#1E2433] border border-[#1E2433]'
                }`}
              >
                <Star className="w-3 h-3" />
                Favorites
              </button>
              <button
                onClick={() => setFilterMode('active')}
                className={`px-3 py-2 rounded-md text-xs transition-colors ${
                  filterMode === 'active'
                    ? 'bg-[#4C6FFF] text-white'
                    : 'bg-[#141823] text-[#9AA1B2] hover:bg-[#1E2433] border border-[#1E2433]'
                }`}
              >
                Active Bias
              </button>
              <button
                onClick={() => setFilterMode('favorites-active')}
                className={`px-3 py-2 rounded-md text-xs transition-colors flex items-center justify-center gap-1 ${
                  filterMode === 'favorites-active'
                    ? 'bg-[#4C6FFF] text-white'
                    : 'bg-[#141823] text-[#9AA1B2] hover:bg-[#1E2433] border border-[#1E2433]'
                }`}
              >
                <Star className="w-3 h-3" />
                + Active
              </button>
            </div>
          </div>
        </div>

        {/* Asset List */}
        <div className="flex-1 overflow-y-auto">
          {filteredAssets.map((asset) => (
            <div
              key={asset.symbol}
              onClick={() => setSelectedAsset(asset)}
              className={`p-4 border-b border-[#1E2433] cursor-pointer transition-colors ${
                selectedAsset?.symbol === asset.symbol ? 'bg-[#141823]' : 'hover:bg-[#141823]'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{asset.symbol}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStar(asset.symbol);
                      }}
                    >
                      <Star
                        className={`w-4 h-4 ${
                          assetStarred[asset.symbol] ? 'fill-[#4C6FFF] text-[#4C6FFF]' : 'text-[#6F7A90]'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="text-xs text-[#9AA1B2]">{asset.assetClass}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm">{asset.price.toLocaleString()}</div>
                  <div className={`text-xs ${asset.change >= 0 ? 'text-[#3FAE7A]' : 'text-[#D66565]'}`}>
                    {asset.change >= 0 ? '+' : ''}
                    {asset.change}%
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: asset.biasColor }}>
                  {asset.finalBias}
                </span>
                <span className="text-xs text-[#9AA1B2]">Conf: {asset.confidence}%</span>
              </div>
            </div>
          ))}
          {filteredAssets.length === 0 && (
            <div className="p-8 text-center text-[#9AA1B2] text-sm">
              No assets match your filters
            </div>
          )}
        </div>
      </aside>

      {/* Main Panel - Asset Detail */}
      <main className="flex-1 overflow-auto p-8">
        {selectedAsset ? (
          <div>
            {/* Asset Header */}
            <div className="mb-8">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl mb-2">{selectedAsset.symbol}</h1>
                  <p className="text-[#9AA1B2]">{selectedAsset.name}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl mb-1">{selectedAsset.price.toLocaleString()}</div>
                  <div className={`text-lg ${selectedAsset.change >= 0 ? 'text-[#3FAE7A]' : 'text-[#D66565]'}`}>
                    {selectedAsset.change >= 0 ? '+' : ''}
                    {selectedAsset.change}%
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="inline-block px-3 py-1 bg-[#141823] rounded-md text-sm text-[#9AA1B2] border border-[#1E2433]">
                  {selectedAsset.assetClass}
                </div>
              </div>
            </div>

            {/* Final Bias Summary */}
            <div className="bg-[#141823] rounded-lg p-6 border border-[#1E2433] mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm text-[#9AA1B2] mb-1">Final Bias</div>
                  <div className="text-2xl" style={{ color: selectedAsset.biasColor }}>
                    {selectedAsset.finalBias}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-[#9AA1B2] mb-1">Confidence</div>
                  <div className="text-2xl">{selectedAsset.confidence}%</div>
                </div>
              </div>
              <div className="w-full bg-[#1E2433] rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${selectedAsset.confidence}%`,
                    backgroundColor: selectedAsset.biasColor,
                  }}
                />
              </div>
            </div>

            {/* Bias Breakdown Table (EdgeFinder Style) */}
            <div className="bg-[#141823] rounded-lg p-6 border border-[#1E2433] mb-6">
              <h2 className="text-xl mb-4">Bias Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1E2433]">
                      <th className="text-left py-3 px-4 text-sm text-[#9AA1B2]">Category</th>
                      <th className="text-center py-3 px-4 text-sm text-[#9AA1B2]">Impact</th>
                      <th className="text-left py-3 px-4 text-sm text-[#9AA1B2]">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAsset.breakdown.map((item, index) => (
                      <tr key={index} className="border-b border-[#1E2433] last:border-b-0">
                        <td className="py-3 px-4 font-medium">{item.category}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className="inline-block w-12 py-1 rounded text-sm font-medium"
                            style={{
                              color: getImpactColor(item.impact),
                              backgroundColor: `${getImpactColor(item.impact)}20`,
                            }}
                          >
                            {getImpactLabel(item.impact)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-[#9AA1B2]">{item.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Explanation */}
            <div className="bg-[#141823] rounded-lg p-6 border border-[#1E2433]">
              <h2 className="text-xl mb-4">Why This Bias</h2>
              <p className="text-[#E6E9F0] leading-relaxed">{selectedAsset.explanation}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#9AA1B2]">Select an asset to view details</p>
          </div>
        )}
      </main>
    </div>
  );
}
