// ═══════════════════════════════════════════════════════════════════════════════
// COT SYMBOL MAPPINGS — Single Source of Truth
// ═══════════════════════════════════════════════════════════════════════════════
//
// This module is the CANONICAL mapping layer between TradePilot's spot symbols
// and CFTC Commitments of Traders (COT) futures contracts. Every other COT
// module imports from here — no duplicate mapping tables exist anywhere.
//
// USAGE:
//   import { getMapping, CFTC_MARKET_PATTERNS, COT_AVAILABLE_SYMBOLS } from './cotMappings';
//
//   const m = getMapping('Gold');
//   m.spotSymbol       // 'Gold'
//   m.futuresCode      // 'GC'
//   m.cftcMarketName   // 'GOLD — COMMODITY EXCHANGE INC.'
//   m.soqlPattern      // '%GOLD%COMMODITY EXCHANGE%'
//   m.exchange         // 'COMEX'
//   m.assetClass       // 'Metals'
//   m.displayName      // 'Gold'
//   m.contractName     // 'Gold Futures'
//
// CONSUMERS:
//   cotDataService.ts  — uses soqlPattern + COT_AVAILABLE_SYMBOLS for CFTC queries
//   cotApiService.ts   — uses futuresCode + cftcMarketName for response envelopes
//   COTPositioning.tsx — uses all fields for UI display + tooltips
//
// TO ADD A NEW SYMBOL:
//   1. Add an entry to COT_SYMBOL_MAPPINGS below
//   2. That's it — all downstream modules pick it up automatically
//
// ═══════════════════════════════════════════════════════════════════════════════


// ─── CORE TYPES ──────────────────────────────────────────────────────────────

/** Complete mapping record for a single TradePilot symbol */
export interface COTSymbolMapping {
  /** TradePilot spot symbol key (e.g. 'Gold', 'EUR', 'SPX') */
  spotSymbol: string;

  /** CME/ICE/CBOT futures ticker code (e.g. 'GC', '6E', 'ES') */
  futuresCode: string;

  /** Full futures contract name for display (e.g. 'Gold Futures') */
  contractName: string;

  /** Human-readable CFTC market name (e.g. 'GOLD — COMMODITY EXCHANGE INC.') */
  cftcMarketName: string;

  /** SoQL LIKE pattern for querying market_and_exchange_names in the CFTC SODA API */
  soqlPattern: string;

  /** Exchange where the futures contract trades */
  exchange: string;

  /** Asset class grouping for UI categorization */
  assetClass: 'Metals' | 'Energy' | 'Equity Index' | 'FX' | 'Commodity' | 'Crypto' | 'Fixed Income';

  /** Friendly display name (may differ from spotSymbol — e.g. 'S&P 500' vs 'SPX') */
  displayName: string;
}

/** Asset class type re-export for consumers */
export type AssetClass = COTSymbolMapping['assetClass'];


// ─── SYMBOL MAPPING TABLE ────────────────────────────────────────────────────
// Master table: 19 symbols across 7 asset classes.
// Each entry contains everything needed by any COT module.

export const COT_SYMBOL_MAPPINGS: Record<string, COTSymbolMapping> = {
  // ── Precious Metals ──────────────────────────────────────────────────────
  'Gold': {
    spotSymbol:     'Gold',
    futuresCode:    'GC',
    contractName:   'Gold Futures',
    cftcMarketName: 'GOLD — COMMODITY EXCHANGE INC.',
    soqlPattern:    '%GOLD%COMMODITY EXCHANGE%',
    exchange:       'COMEX',
    assetClass:     'Metals',
    displayName:    'Gold',
  },
  'SILVER': {
    spotSymbol:     'SILVER',
    futuresCode:    'SI',
    contractName:   'Silver Futures',
    cftcMarketName: 'SILVER — COMMODITY EXCHANGE INC.',
    soqlPattern:    '%SILVER%COMMODITY EXCHANGE%',
    exchange:       'COMEX',
    assetClass:     'Metals',
    displayName:    'Silver',
  },
  'PLATINUM': {
    spotSymbol:     'PLATINUM',
    futuresCode:    'PL',
    contractName:   'Platinum Futures',
    cftcMarketName: 'PLATINUM — NEW YORK MERCANTILE EXCHANGE',
    soqlPattern:    '%PLATINUM%NEW YORK MERCANTILE%',
    exchange:       'NYMEX',
    assetClass:     'Metals',
    displayName:    'Platinum',
  },

  // ── Energy ───────────────────────────────────────────────────────────────
  'USOIL': {
    spotSymbol:     'USOIL',
    futuresCode:    'CL',
    contractName:   'Crude Oil WTI Futures',
    cftcMarketName: 'CRUDE OIL, LIGHT SWEET — NEW YORK MERCANTILE EXCHANGE',
    soqlPattern:    '%CRUDE OIL, LIGHT SWEET%NEW YORK MERCANTILE%',
    exchange:       'NYMEX',
    assetClass:     'Energy',
    displayName:    'Crude Oil',
  },

  // ── Equity Indices ───────────────────────────────────────────────────────
  'SPX': {
    spotSymbol:     'SPX',
    futuresCode:    'ES',
    contractName:   'E-mini S&P 500 Futures',
    cftcMarketName: 'E-MINI S&P 500 — CHICAGO MERCANTILE EXCHANGE',
    soqlPattern:    '%E-MINI S&P 500%CHICAGO MERCANTILE%',
    exchange:       'CME',
    assetClass:     'Equity Index',
    displayName:    'S&P 500',
  },
  'NASDAQ': {
    spotSymbol:     'NASDAQ',
    futuresCode:    'NQ',
    contractName:   'E-mini NASDAQ-100 Futures',
    cftcMarketName: 'NASDAQ MINI — CHICAGO MERCANTILE EXCHANGE',
    soqlPattern:    '%NASDAQ%MINI%CHICAGO MERCANTILE%',
    exchange:       'CME',
    assetClass:     'Equity Index',
    displayName:    'Nasdaq 100',
  },
  'DOW': {
    spotSymbol:     'DOW',
    futuresCode:    'YM',
    contractName:   'E-mini Dow Futures',
    cftcMarketName: 'DJIA x $5 — CHICAGO BOARD OF TRADE',
    soqlPattern:    '%DJIA%$5%CHICAGO BOARD%',
    exchange:       'CBOT',
    assetClass:     'Equity Index',
    displayName:    'Dow Jones',
  },
  'RUSSELL': {
    spotSymbol:     'RUSSELL',
    futuresCode:    'RTY',
    contractName:   'E-mini Russell 2000 Futures',
    cftcMarketName: 'E-MINI RUSSELL 2000 INDEX - CHICAGO MERCANTILE EXCHANGE',
    soqlPattern:    '%RUSSELL 2000%CHICAGO MERCANTILE%',
    exchange:       'CME',
    assetClass:     'Equity Index',
    displayName:    'Russell 2000',
  },
  'NIKKEI': {
    spotSymbol:     'NIKKEI',
    futuresCode:    'NIY',
    contractName:   'Nikkei 225 Futures',
    cftcMarketName: 'NIKKEI STOCK AVERAGE — CHICAGO MERCANTILE EXCHANGE',
    soqlPattern:    '%NIKKEI%CHICAGO MERCANTILE%',
    exchange:       'CME',
    assetClass:     'Equity Index',
    displayName:    'Nikkei 225',
  },

  // ── FX Majors ────────────────────────────────────────────────────────────
  'EUR': {
    spotSymbol:     'EUR',
    futuresCode:    '6E',
    contractName:   'Euro FX Futures',
    cftcMarketName: 'EURO FX — CHICAGO MERCANTILE EXCHANGE',
    soqlPattern:    '%EURO FX%CHICAGO MERCANTILE%',
    exchange:       'CME',
    assetClass:     'FX',
    displayName:    'EURUSD',
  },
  'GBP': {
    spotSymbol:     'GBP',
    futuresCode:    '6B',
    contractName:   'British Pound Futures',
    cftcMarketName: 'BRITISH POUND — CHICAGO MERCANTILE EXCHANGE',
    soqlPattern:    '%BRITISH POUND%CHICAGO MERCANTILE%',
    exchange:       'CME',
    assetClass:     'FX',
    displayName:    'GBPUSD',
  },
  'JPY': {
    spotSymbol:     'JPY',
    futuresCode:    '6J',
    contractName:   'Japanese Yen Futures',
    cftcMarketName: 'JAPANESE YEN — CHICAGO MERCANTILE EXCHANGE',
    soqlPattern:    '%JAPANESE YEN%CHICAGO MERCANTILE%',
    exchange:       'CME',
    assetClass:     'FX',
    displayName:    'USDJPY',
  },
  'AUD': {
    spotSymbol:     'AUD',
    futuresCode:    '6A',
    contractName:   'Australian Dollar Futures',
    cftcMarketName: 'AUSTRALIAN DOLLAR — CHICAGO MERCANTILE EXCHANGE',
    soqlPattern:    '%AUSTRALIAN DOLLAR%CHICAGO MERCANTILE%',
    exchange:       'CME',
    assetClass:     'FX',
    displayName:    'AUDUSD',
  },
  'NZD': {
    spotSymbol:     'NZD',
    futuresCode:    '6N',
    contractName:   'New Zealand Dollar Futures',
    cftcMarketName: 'NEW ZEALAND DOLLAR — CHICAGO MERCANTILE EXCHANGE',
    soqlPattern:    '%NEW ZEALAND DOLLAR%CHICAGO MERCANTILE%',
    exchange:       'CME',
    assetClass:     'FX',
    displayName:    'NZDUSD',
  },
  'CAD': {
    spotSymbol:     'CAD',
    futuresCode:    '6C',
    contractName:   'Canadian Dollar Futures',
    cftcMarketName: 'CANADIAN DOLLAR — CHICAGO MERCANTILE EXCHANGE',
    soqlPattern:    '%CANADIAN DOLLAR%CHICAGO MERCANTILE%',
    exchange:       'CME',
    assetClass:     'FX',
    displayName:    'USDCAD',
  },
  'CHF': {
    spotSymbol:     'CHF',
    futuresCode:    '6S',
    contractName:   'Swiss Franc Futures',
    cftcMarketName: 'SWISS FRANC — CHICAGO MERCANTILE EXCHANGE',
    soqlPattern:    '%SWISS FRANC%CHICAGO MERCANTILE%',
    exchange:       'CME',
    assetClass:     'FX',
    displayName:    'USDCHF',
  },
  'USD': {
    spotSymbol:     'USD',
    futuresCode:    'DX',
    contractName:   'U.S. Dollar Index Futures',
    cftcMarketName: 'U.S. DOLLAR INDEX — ICE FUTURES U.S.',
    soqlPattern:    '%U.S. DOLLAR INDEX%ICE FUTURES%',
    exchange:       'ICE',
    assetClass:     'FX',
    displayName:    'Dollar Index',
  },

  // ── Industrial Commodities ───────────────────────────────────────────────
  'COPPER': {
    spotSymbol:     'COPPER',
    futuresCode:    'HG',
    contractName:   'Copper Futures',
    cftcMarketName: 'COPPER — COMMODITY EXCHANGE INC.',
    soqlPattern:    '%COPPER%COMMODITY EXCHANGE%',
    exchange:       'COMEX',
    assetClass:     'Commodity',
    displayName:    'Copper',
  },

  // ── Crypto ───────────────────────────────────────────────────────────────
  'BTC': {
    spotSymbol:     'BTC',
    futuresCode:    'BTC',
    contractName:   'Bitcoin Futures',
    cftcMarketName: 'BITCOIN — CHICAGO MERCANTILE EXCHANGE',
    soqlPattern:    '%BITCOIN%CHICAGO MERCANTILE%',
    exchange:       'CME',
    assetClass:     'Crypto',
    displayName:    'Bitcoin',
  },

  // ── Fixed Income ─────────────────────────────────────────────────────────
  'US10T': {
    spotSymbol:     'US10T',
    futuresCode:    'ZN',
    contractName:   '10-Year Treasury Note Futures',
    cftcMarketName: '10-YEAR U.S. TREASURY NOTES — CHICAGO BOARD OF TRADE',
    soqlPattern:    '%10-YEAR%TREASURY%CHICAGO BOARD%',
    exchange:       'CBOT',
    assetClass:     'Fixed Income',
    displayName:    '10Y Treasury',
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// DERIVED CONSTANTS — These stay in sync automatically when you add symbols
// ═══════════════════════════════════════════════════════════════════════════════

/** All TradePilot spot symbols that have CFTC COT coverage */
export const COT_AVAILABLE_SYMBOLS: string[] = Object.keys(COT_SYMBOL_MAPPINGS);

/** SoQL LIKE patterns keyed by spot symbol — consumed by cotDataService */
export const CFTC_MARKET_PATTERNS: Record<string, string> = Object.fromEntries(
  COT_AVAILABLE_SYMBOLS.map(s => [s, COT_SYMBOL_MAPPINGS[s].soqlPattern])
);

/** Futures codes keyed by spot symbol — consumed by cotApiService */
export const FUTURES_CODES: Record<string, string> = Object.fromEntries(
  COT_AVAILABLE_SYMBOLS.map(s => [s, COT_SYMBOL_MAPPINGS[s].futuresCode])
);

/** CFTC market names keyed by spot symbol — consumed by cotApiService */
export const CFTC_MARKET_NAMES: Record<string, string> = Object.fromEntries(
  COT_AVAILABLE_SYMBOLS.map(s => [s, COT_SYMBOL_MAPPINGS[s].cftcMarketName])
);

/** Asset class groupings */
export const SYMBOLS_BY_ASSET_CLASS: Record<AssetClass, string[]> = COT_AVAILABLE_SYMBOLS.reduce(
  (acc, sym) => {
    const cls = COT_SYMBOL_MAPPINGS[sym].assetClass;
    if (!acc[cls]) acc[cls] = [];
    acc[cls].push(sym);
    return acc;
  },
  {} as Record<AssetClass, string[]>
);


// ═══════════════════════════════════════════════════════════════════════════════
// ACCESSOR FUNCTIONS — Convenient getters used across the codebase
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the full mapping record for a spot symbol.
 * Returns `null` if the symbol has no CFTC COT coverage.
 */
export function getMapping(spotSymbol: string): COTSymbolMapping | null {
  return COT_SYMBOL_MAPPINGS[spotSymbol] ?? null;
}

/**
 * Check if a symbol has CFTC COT coverage.
 */
export function isSymbolSupported(spotSymbol: string): boolean {
  return spotSymbol in COT_SYMBOL_MAPPINGS;
}

/**
 * Get the CME/ICE futures ticker code for a spot symbol.
 * Returns 'N/A' if not found.
 */
export function getFuturesCode(spotSymbol: string): string {
  return COT_SYMBOL_MAPPINGS[spotSymbol]?.futuresCode ?? 'N/A';
}

/**
 * Get the full CFTC market name for a spot symbol.
 * Returns 'Unknown' if not found.
 */
export function getCFTCMarketName(spotSymbol: string): string {
  return COT_SYMBOL_MAPPINGS[spotSymbol]?.cftcMarketName ?? 'Unknown';
}

/**
 * Get the SoQL LIKE pattern for CFTC API queries.
 * Returns `null` if not found.
 */
export function getSoqlPattern(spotSymbol: string): string | null {
  return COT_SYMBOL_MAPPINGS[spotSymbol]?.soqlPattern ?? null;
}

/**
 * Get the exchange name for a spot symbol.
 * Returns 'Unknown' if not found.
 */
export function getExchange(spotSymbol: string): string {
  return COT_SYMBOL_MAPPINGS[spotSymbol]?.exchange ?? 'Unknown';
}

/**
 * Get the asset class for a spot symbol.
 * Returns 'Commodity' as fallback.
 */
export function getAssetClass(spotSymbol: string): AssetClass {
  return COT_SYMBOL_MAPPINGS[spotSymbol]?.assetClass ?? 'Commodity';
}

/**
 * Get the friendly display name for a spot symbol.
 * Returns the spotSymbol itself if not found.
 */
export function getDisplayName(spotSymbol: string): string {
  return COT_SYMBOL_MAPPINGS[spotSymbol]?.displayName ?? spotSymbol;
}

/**
 * Get the full contract name for a spot symbol.
 * Returns 'Unknown Futures' if not found.
 */
export function getContractName(spotSymbol: string): string {
  return COT_SYMBOL_MAPPINGS[spotSymbol]?.contractName ?? 'Unknown Futures';
}

/**
 * Get all supported symbols as mapping objects.
 */
export function getAllMappings(): COTSymbolMapping[] {
  return COT_AVAILABLE_SYMBOLS.map(s => COT_SYMBOL_MAPPINGS[s]);
}