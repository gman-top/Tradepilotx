// ═══════════════════════════════════════════════════════════════════════════════
// TradePilot — API Configuration
// ═══════════════════════════════════════════════════════════════════════════════
//
// All API keys are read from Vite environment variables.
// Copy .env.example → .env and fill in your keys.
//
// Free API keys:
//   FRED:       https://fred.stlouisfed.org/docs/api/api_key.html
//   TwelveData: https://twelvedata.com/pricing (free tier: 800 calls/day)
//
// ═══════════════════════════════════════════════════════════════════════════════

export const API_KEYS = {
  /** Federal Reserve Economic Data API key (free) */
  fred: (import.meta.env.VITE_FRED_API_KEY as string) || '',

  /** TwelveData market data API key (free tier: 800 calls/day) */
  twelveData: (import.meta.env.VITE_TWELVE_DATA_API_KEY as string) || '',
};

/** Cache TTLs in milliseconds */
export const CACHE_TTL = {
  /** COT data updates weekly on Fridays — cache for 7 days */
  cot: 7 * 24 * 60 * 60 * 1000,
  /** Macro data releases monthly — cache for 24 hours */
  macro: 24 * 60 * 60 * 1000,
  /** Interest rates — cache for 24 hours */
  rates: 24 * 60 * 60 * 1000,
  /** Price/technical data — cache for 4 hours */
  price: 4 * 60 * 60 * 1000,
};

/** Which providers are enabled (require API key) */
export const PROVIDERS_ENABLED = {
  /** COT: Always enabled — CFTC API is public, no key required */
  cot: true,
  /** FRED: Enabled when VITE_FRED_API_KEY is set */
  fred: !!API_KEYS.fred,
  /** TwelveData: Enabled when VITE_TWELVE_DATA_API_KEY is set */
  twelveData: !!API_KEYS.twelveData,
};

/** Supabase project configuration */
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL as string,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
};

// ─── LocalStorage Cache Helpers ───────────────────────────────────────────────

const LS_PREFIX = 'tp_v1_';

export function lsGet<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v: T; ts: number };
    if (Date.now() - parsed.ts > ttlMs) {
      localStorage.removeItem(LS_PREFIX + key);
      return null;
    }
    return parsed.v;
  } catch {
    return null;
  }
}

export function lsSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ v: value, ts: Date.now() }));
  } catch {
    // Ignore quota exceeded errors
  }
}
