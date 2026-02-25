// ═══════════════════════════════════════════════════════════════════════════════
// TradePilot — Data Provider Interfaces
// ═══════════════════════════════════════════════════════════════════════════════
//
// STRATEGY: "Provider Interface" pattern
//
// Each data source has a strongly-typed interface. Implementations connect
// to real APIs (CFTC, FRED, TwelveData, Myfxbook, etc.)
//
// PROVIDER LIFECYCLE:
//   1. Pipeline scheduler triggers a job (e.g., "fetch COT weekly")
//   2. Job calls provider.fetchCOTLatest(symbols)
//   3. Provider returns normalized data
//   4. Scoring engine processes the data
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  COTPosition,
  RetailSentiment,
  MacroRelease,
  InterestRate,
  PriceOHLC,
  Timeframe,
  ImpactLevel,
} from '../types/database';


// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * COT Data Provider — CFTC Commitments of Traders
 * Weekly data, typically released Friday for Tuesday report date.
 *
 * Implementations:
 *   - MockCOTProvider (below)
 *   - CFTCProvider (via existing Supabase Edge Function proxy)
 *   - QuandlCOTProvider (alternative commercial source)
 */
export interface ICOTProvider {
  name: string;

  /** Fetch latest COT data for multiple symbols */
  fetchLatest(symbols: string[]): Promise<ProviderResult<Record<string, COTPosition>>>;

  /** Fetch historical COT data for a single symbol */
  fetchHistory(symbol: string, weeks: number): Promise<ProviderResult<COTPosition[]>>;

  /** Check if the provider is healthy and responding */
  healthCheck(): Promise<boolean>;
}

/**
 * Retail Sentiment Provider — Broker positioning data
 *
 * Implementations:
 *   - MockSentimentProvider (below)
 *   - OandaSentimentProvider (Oanda Order Book API)
 *   - IGSentimentProvider (IG Client Sentiment)
 *   - MyfxbookSentimentProvider (Myfxbook Outlook)
 */
export interface ISentimentProvider {
  name: string;

  /** Fetch latest sentiment for all supported symbols */
  fetchLatest(symbols: string[]): Promise<ProviderResult<Record<string, RetailSentiment>>>;

  /** Fetch sentiment history for a single symbol */
  fetchHistory(symbol: string, hours: number): Promise<ProviderResult<RetailSentiment[]>>;

  healthCheck(): Promise<boolean>;
}

/**
 * Macro Data Provider — Economic indicators
 *
 * Implementations:
 *   - MockMacroProvider (below)
 *   - FREDProvider (Federal Reserve Economic Data — US)
 *   - ECBProvider (European Central Bank — EU)
 *   - ONSProvider (UK Office for National Statistics)
 *   - InvestingComProvider (multi-economy, scraping-based)
 *   - TradingEconomicsProvider (commercial API)
 *   - ForexFactoryProvider (calendar scraping)
 */
export interface IMacroProvider {
  name: string;

  /** Fetch recent releases for an economy and category */
  fetchReleases(
    economyCode: string,
    category?: string,
    limit?: number
  ): Promise<ProviderResult<MacroRelease[]>>;

  /** Fetch upcoming economic calendar */
  fetchCalendar(
    economyCodes: string[],
    days: number
  ): Promise<ProviderResult<MacroCalendarEvent[]>>;

  /** Fetch specific indicator's latest release */
  fetchIndicator(
    economyCode: string,
    indicatorKey: string
  ): Promise<ProviderResult<MacroRelease | null>>;

  healthCheck(): Promise<boolean>;
}

/**
 * Price Data Provider — OHLC quotes
 *
 * Implementations:
 *   - MockPriceProvider (below)
 *   - TwelveDataProvider (12data.com API)
 *   - AlphaVantageProvider
 *   - PolygonProvider
 *   - OandaPriceProvider (for FX)
 */
export interface IPriceProvider {
  name: string;

  /** Fetch latest OHLC bars */
  fetchOHLC(
    symbol: string,
    timeframe: Timeframe,
    bars: number
  ): Promise<ProviderResult<PriceOHLC[]>>;

  /** Fetch current quote (bid/ask/last) */
  fetchQuote(symbol: string): Promise<ProviderResult<QuoteData>>;

  healthCheck(): Promise<boolean>;
}

/**
 * Interest Rate Provider — Central bank rates and yields
 *
 * Implementations:
 *   - MockRateProvider (below)
 *   - FREDRateProvider (US rates/yields from FRED)
 *   - ECBRateProvider
 *   - TradingEconomicsRateProvider
 */
export interface IRateProvider {
  name: string;

  /** Fetch latest rates for all economies */
  fetchRates(economyCodes: string[]): Promise<ProviderResult<Record<string, InterestRate>>>;

  /** Fetch rate history for a single economy */
  fetchHistory(economyCode: string, months: number): Promise<ProviderResult<InterestRate[]>>;

  healthCheck(): Promise<boolean>;
}


// ═══════════════════════════════════════════════════════════════════════════════
// COMMON TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Standard wrapper for all provider responses */
export interface ProviderResult<T> {
  ok: boolean;
  data: T;
  source: string;
  fetched_at: string;
  /** Partial success: some items failed */
  warnings?: string[];
  /** Provider-specific metadata */
  meta?: Record<string, unknown>;
}

/** Current quote data */
export interface QuoteData {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  timestamp: string;
}

/** Upcoming economic event */
export interface MacroCalendarEvent {
  economy_code: string;
  indicator_key: string;
  indicator_name: string;
  category: string;
  scheduled_at: string;
  impact: ImpactLevel;
  forecast: number | null;
  previous: number | null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER REGISTRY — Dependency injection container
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Central registry for all data providers.
 * The pipeline/service layer reads from this to get the active provider for each source.
 */
export interface ProviderRegistry {
  cot: ICOTProvider;
  sentiment: ISentimentProvider;
  macro: IMacroProvider;
  price: IPriceProvider;
  rates: IRateProvider;
}
