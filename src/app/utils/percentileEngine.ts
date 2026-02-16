// ═══════════════════════════════════════════════════════════════════════════════
// COT PERCENTILE ENGINE — Production Edge Logic Layer
// ═══════════════════════════════════════════════════════════════════════════════
//
// FORMULA (rank-based percentile):
//   percentile = (count of historical net positions BELOW current) / (N − 1) × 100
//
// This is a standard empirical percentile ranking. It is:
//   - Trader-type AGNOSTIC: the same formula applies to Non-Commercials,
//     Commercials, Retail, and All. The net positions themselves already
//     encode trader behavior — no inversion or adjustment needed.
//   - Symbol AGNOSTIC: works identically for Gold, EUR, SPX, etc.
//   - Window AWARE: callers specify 52-week or 156-week; this module slices
//     the provided history accordingly.
//
// FIVE-TIER LABELING:
//   ≥85  → Extreme Long
//   70–84 → Crowded Long
//   30–69 → Neutral
//   15–29 → Crowded Short
//   <15  → Extreme Short
//
// CONSUMERS:
//   COTPositioning.tsx  — getEffectivePercentile, Percentile Engine section
//   cotApiService.ts    — queryCOT, queryCOTBatch response envelopes
//
// ═══════════════════════════════════════════════════════════════════════════════

export type PercentileWindow = '52-week' | '156-week';
export type PercentileLabel = 'Extreme Long' | 'Crowded Long' | 'Neutral' | 'Crowded Short' | 'Extreme Short';
export type COTAlignmentState = 'Crowded but Justified' | 'Crowded and Risky' | 'Contrarian Opportunity' | 'Neutral / No Edge';

// ─── MINIMUM DATASET SIZES ──────────────────────────────────────────────────
// Below these thresholds the percentile is not statistically meaningful.
// The engine still computes a value but callers can check `isLive` to decide
// whether to display a confidence disclaimer.
const MIN_DATASET_SIZE = 2;   // Absolute minimum (need at least 2 data points)
const RELIABLE_DATASET_SIZE = 10;  // Recommended minimum for stable percentiles


// ═══════════════════════════════════════════════════════════════════════════════
// CORE PERCENTILE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pure rank-based percentile calculation.
 * No windowing, no clamping — just the raw math.
 *
 *   result = (count of values in `dataset` that are strictly < `current`) / (N − 1) × 100
 *
 * Returns NaN if dataset has fewer than MIN_DATASET_SIZE elements.
 * This is exported for unit-testability and reuse.
 */
export function rankPercentile(current: number, dataset: number[]): number {
  if (dataset.length < MIN_DATASET_SIZE) return NaN;
  const countBelow = dataset.filter(v => v < current).length;
  return (countBelow / (dataset.length - 1)) * 100;
}

/**
 * PRODUCTION PERCENTILE — from real historical net positions
 *
 * This is the PRIMARY entry point. All live-data paths use this function.
 * The formula is identical for every trader type and every symbol.
 *
 * @param currentNetPosition  - The most recent week's net position (long − short contracts)
 * @param historicalNetPositions - Descending array of net positions (newest first),
 *                                 typically 156 weeks fetched from CFTC SODA API
 * @param window              - '52-week' or '156-week' rolling window
 * @returns Percentile clamped to [1, 99], or 50 if insufficient data
 */
export function calculatePercentileFromHistory(
  currentNetPosition: number,
  historicalNetPositions: number[],
  window: PercentileWindow
): number {
  // Slice to the requested window (data arrives newest-first)
  const windowSize = window === '52-week' ? 52 : 156;
  const dataset = historicalNetPositions.slice(0, Math.min(windowSize, historicalNetPositions.length));

  if (dataset.length < MIN_DATASET_SIZE) return 50; // Not enough data

  const raw = rankPercentile(currentNetPosition, dataset);
  if (isNaN(raw)) return 50;

  // Clamp to [1, 99] — avoid displaying 0th or 100th which are misleading
  return Math.round(Math.min(99, Math.max(1, raw)));
}

/**
 * FALLBACK PERCENTILE — when live historical data is unavailable
 *
 * Called when the CFTC API fails or returns too few rows. Returns 50 (Neutral)
 * because without a real historical dataset, any percentile value would be
 * fabricated. The UI shows a "data unavailable" indicator in this case.
 *
 * IMPORTANT: This function is trader-type AGNOSTIC and symbol AGNOSTIC.
 * It applies the same logic regardless of inputs — the formula does not
 * change based on who is trading or what asset is being viewed.
 *
 * @param _asset              - Spot symbol (unused — kept for backward compatibility)
 * @param _currentNetPosition - Current net position (unused without history)
 * @param _window             - Percentile window (unused without history)
 * @param _traderType         - Trader category (unused — formula is universal)
 * @returns 50 (Neutral) — honest "no data" indicator
 */
export function calculatePercentile(
  _asset: string,
  _currentNetPosition: number,
  _window: PercentileWindow,
  _traderType: string
): number {
  // Without historical data, we cannot compute a meaningful percentile.
  // Returning 50 (Neutral) is the honest representation — the UI can
  // check `isLive: false` to display an appropriate disclaimer.
  return 50;
}


// ═══════════════════════════════════════════════════════════════════════════════
// FIVE-TIER LABELING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get qualitative label for percentile bucket.
 * Uses exact institutional thresholds for crowding analysis.
 *
 *   ≥85  → Extreme Long
 *   70–84 → Crowded Long
 *   30–69 → Neutral
 *   15–29 → Crowded Short
 *   <15  → Extreme Short
 */
export function getPercentileLabel(percentile: number): PercentileLabel {
  if (percentile >= 85) return 'Extreme Long';
  if (percentile >= 70) return 'Crowded Long';
  if (percentile >= 30) return 'Neutral';
  if (percentile >= 15) return 'Crowded Short';
  return 'Extreme Short';
}

/**
 * Get color for percentile label (green/gray/red tones)
 */
export function getPercentileLabelColor(label: PercentileLabel): string {
  switch (label) {
    case 'Extreme Long': return '#3FAE7A';
    case 'Crowded Long': return '#5FC08D';
    case 'Neutral': return '#6F7A90';
    case 'Crowded Short': return '#D68575';
    case 'Extreme Short': return '#D66565';
  }
}

/**
 * Get background color for percentile label
 */
export function getPercentileLabelBackgroundColor(label: PercentileLabel): string {
  switch (label) {
    case 'Extreme Long': return 'rgba(63, 174, 122, 0.15)';
    case 'Crowded Long': return 'rgba(95, 192, 141, 0.15)';
    case 'Neutral': return 'rgba(111, 122, 144, 0.15)';
    case 'Crowded Short': return 'rgba(214, 133, 117, 0.15)';
    case 'Extreme Short': return 'rgba(214, 101, 101, 0.15)';
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXTUAL INTERPRETATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determine COT alignment state based on percentile + macro bias.
 * This is CONTEXTUAL interpretation, not a standalone signal.
 *
 * NOTE: The percentile itself is computed identically for all trader types.
 * The INTERPRETATION of that percentile varies by trader type because
 * different participant classes have different behavioral signatures
 * (e.g., Commercials are natural contrarians).
 */
export function getCOTAlignmentState(
  percentile: number,
  macroBias: 'Bullish' | 'Bearish' | 'Neutral',
  traderType: string
): {
  state: COTAlignmentState;
  description: string;
  color: string;
} {
  const isExtreme = percentile >= 85 || percentile <= 14;
  const isCrowded = percentile >= 70 || percentile <= 29;

  // Non-Commercials (Hedge Funds) - Directional confirmation
  if (traderType === 'Non-Commercials') {
    if (isExtreme && macroBias === 'Bullish' && percentile >= 85) {
      return {
        state: 'Crowded but Justified',
        description: 'Extreme long positioning aligns with bullish macro. Momentum strong but watch for exhaustion.',
        color: '#5FC08D',
      };
    }
    if (isExtreme && macroBias === 'Bearish' && percentile >= 85) {
      return {
        state: 'Crowded and Risky',
        description: 'Extreme long positioning conflicts with bearish macro. High risk of reversal.',
        color: '#D66565',
      };
    }
    if (isExtreme && macroBias === 'Bearish' && percentile <= 14) {
      return {
        state: 'Crowded but Justified',
        description: 'Extreme short positioning aligns with bearish macro. Downtrend confirmed.',
        color: '#5FC08D',
      };
    }
    if (isExtreme && macroBias === 'Bullish' && percentile <= 14) {
      return {
        state: 'Contrarian Opportunity',
        description: 'Extreme short positioning with improving macro. Potential reversal setup.',
        color: '#3FAE7A',
      };
    }
  }

  // Commercials (Hedgers) - Contrarian signals
  if (traderType === 'Commercials') {
    if (isExtreme && macroBias === 'Bullish' && percentile >= 85) {
      return {
        state: 'Crowded and Risky',
        description: 'Commercials building extreme longs often signals top. Contrarian warning.',
        color: '#D66565',
      };
    }
    if (isExtreme && macroBias === 'Bearish' && percentile <= 14) {
      return {
        state: 'Crowded and Risky',
        description: 'Commercials building extreme shorts often signals bottom. Contrarian warning.',
        color: '#D66565',
      };
    }
    if (isExtreme && macroBias === 'Bullish' && percentile <= 14) {
      return {
        state: 'Crowded but Justified',
        description: 'Commercial shorts at extremes with bullish macro. Classic reversal setup.',
        color: '#3FAE7A',
      };
    }
  }

  // Retail (Small Traders) - Late positioning / crowd risk
  if (traderType === 'Retail') {
    if (isExtreme) {
      return {
        state: 'Crowded and Risky',
        description: 'Retail at extremes typically signals late positioning. Fade signal.',
        color: '#D66565',
      };
    }
  }

  // Default: Neutral / No Clear Edge
  if (!isCrowded) {
    return {
      state: 'Neutral / No Edge',
      description: 'Positioning not at extremes. No clear COT signal in current context.',
      color: '#6F7A90',
    };
  }

  return {
    state: 'Neutral / No Edge',
    description: 'Moderate positioning. Monitor for developing edge.',
    color: '#6F7A90',
  };
}

/**
 * Get detailed interpretation text for a percentile reading.
 * Contextual to trader type — the percentile FORMULA is universal,
 * but the narrative MEANING differs by participant class.
 */
export function getPercentileInterpretation(
  percentile: number,
  traderType: string,
  window: PercentileWindow
): string {
  const label = getPercentileLabel(percentile);
  const windowText = window === '52-week' ? '1-year' : '3-year';

  if (traderType === 'Non-Commercials') {
    switch (label) {
      case 'Extreme Long':
        return `At ${percentile}th percentile (${windowText}), hedge funds show extreme bullish conviction. Momentum strong but watch for exhaustion.`;
      case 'Crowded Long':
        return `At ${percentile}th percentile (${windowText}), positioning is crowded long. Trend intact but vulnerable to shock.`;
      case 'Neutral':
        return `At ${percentile}th percentile (${windowText}), positioning is balanced. No clear directional bias from hedge funds.`;
      case 'Crowded Short':
        return `At ${percentile}th percentile (${windowText}), positioning is crowded short. Bearish sentiment building.`;
      case 'Extreme Short':
        return `At ${percentile}th percentile (${windowText}), hedge funds show extreme bearish conviction. Strong downtrend or potential capitulation.`;
    }
  }

  if (traderType === 'Commercials') {
    switch (label) {
      case 'Extreme Long':
        return `At ${percentile}th percentile (${windowText}), commercials at extreme long hedges. Often signals potential top (contrarian).`;
      case 'Crowded Long':
        return `At ${percentile}th percentile (${windowText}), commercial longs elevated. Watch for reversal signals.`;
      case 'Neutral':
        return `At ${percentile}th percentile (${windowText}), commercial positioning balanced. No clear contrarian signal.`;
      case 'Crowded Short':
        return `At ${percentile}th percentile (${windowText}), commercial shorts building. Watch for reversal signals.`;
      case 'Extreme Short':
        return `At ${percentile}th percentile (${windowText}), commercials at extreme short hedges. Often signals potential bottom (contrarian).`;
    }
  }

  if (traderType === 'Retail') {
    switch (label) {
      case 'Extreme Long':
        return `At ${percentile}th percentile (${windowText}), retail is extremely long. Typically late positioning - fade signal.`;
      case 'Crowded Long':
        return `At ${percentile}th percentile (${windowText}), retail crowding into longs. Late-cycle behavior.`;
      case 'Neutral':
        return `At ${percentile}th percentile (${windowText}), retail positioning neutral. No clear crowd signal.`;
      case 'Crowded Short':
        return `At ${percentile}th percentile (${windowText}), retail building shorts. Often premature or late.`;
      case 'Extreme Short':
        return `At ${percentile}th percentile (${windowText}), retail extremely short. Potential capitulation or late positioning.`;
    }
  }

  return `Current positioning at ${percentile}th percentile over ${windowText} window.`;
}

/**
 * Format percentile for display
 */
export function formatPercentile(percentile: number): string {
  return `${percentile}th`;
}

/**
 * Check if a dataset is large enough for reliable percentile computation.
 * Callers can use this to decide whether to show a confidence disclaimer.
 */
export function isPercentileReliable(datasetSize: number): boolean {
  return datasetSize >= RELIABLE_DATASET_SIZE;
}
