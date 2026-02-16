// ═══════════════════════════════════════════════════════════════════════════════
// COT CACHE — Observable In-Memory TTL Cache
// ═══════════════════════════════════════════════════════════════════════════════
//
// A generic, observable in-memory caching layer for all COT data.
// Used by both cotDataService.ts (raw CFTC data) and cotApiService.ts
// (normalized response envelopes).
//
// KEY DESIGN:
//   Composite cache key = `${symbol}:${traderType}:${window}`
//   TTL = 1 hour (COT data updates weekly, so 1h is conservative)
//   Auto-invalidation on read (expired entries return null)
//   Manual clear via clearAll() or clearByPrefix()
//
// OBSERVABILITY:
//   getStatus() returns per-entry metadata (cachedAt, expiresAt, age, etc.)
//   Consumers can display cache hit/miss state in the UI
//
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface CacheEntryMeta {
  key: string;
  cachedAt: number;       // Unix timestamp when entry was cached
  expiresAt: number;      // Unix timestamp when TTL expires
  ageMs: number;          // Current age in milliseconds
  remainingMs: number;    // Remaining TTL in milliseconds
  isExpired: boolean;     // Whether TTL has elapsed
  isValid: boolean;       // true if entry exists AND is not expired
}

export interface CacheStatus {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
  entries: CacheEntryMeta[];
  oldestEntry: CacheEntryMeta | null;
  newestEntry: CacheEntryMeta | null;
  lastClearedAt: number | null;   // Timestamp of last manual clearAll()
}

interface InternalEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

/**
 * Generic in-memory TTL cache with observability.
 * Create one instance per cache domain (e.g., one for raw data, one for API responses).
 * Uses method-level generics so a single cache instance can store different value types
 * under different keys (common for multi-symbol data caching).
 */
export class COTCache {
  private store = new Map<string, InternalEntry<any>>();
  private ttlMs: number;
  private _lastClearedAt: number | null = null;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  // ─── CORE OPERATIONS ──────────────────────────────────────────────────────

  /**
   * Get a cached value. Returns null if key doesn't exist or TTL has expired.
   * Expired entries are automatically evicted on read.
   */
  get<T = unknown>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.cachedAt > entry.ttlMs) {
      this.store.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set a cached value with optional custom TTL override.
   */
  set(key: string, data: any, customTtlMs?: number): void {
    this.store.set(key, {
      data,
      cachedAt: Date.now(),
      ttlMs: customTtlMs ?? this.ttlMs,
    });
  }

  /**
   * Check if a valid (non-expired) entry exists for the given key.
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific entry.
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear ALL entries. Returns the count of entries that were cleared.
   */
  clearAll(): number {
    const count = this.store.size;
    this.store.clear();
    this._lastClearedAt = Date.now();
    return count;
  }

  /**
   * Clear entries whose key starts with a given prefix.
   * Useful for invalidating all entries for a specific symbol or trader type.
   */
  clearByPrefix(prefix: string): number {
    let count = 0;
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  // ─── OBSERVABILITY ─────────────────────────────────────────────────────────

  /**
   * Get metadata for a specific cache entry.
   */
  getEntryMeta(key: string): CacheEntryMeta | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    const ageMs = now - entry.cachedAt;
    const remainingMs = Math.max(0, entry.ttlMs - ageMs);
    const isExpired = ageMs > entry.ttlMs;

    return {
      key,
      cachedAt: entry.cachedAt,
      expiresAt: entry.cachedAt + entry.ttlMs,
      ageMs,
      remainingMs,
      isExpired,
      isValid: !isExpired,
    };
  }

  /**
   * Get comprehensive cache status — all entries, valid/expired counts, etc.
   */
  getStatus(): CacheStatus {
    const now = Date.now();
    const entries: CacheEntryMeta[] = [];
    let validCount = 0;
    let expiredCount = 0;

    for (const [key, entry] of this.store.entries()) {
      const ageMs = now - entry.cachedAt;
      const remainingMs = Math.max(0, entry.ttlMs - ageMs);
      const isExpired = ageMs > entry.ttlMs;

      if (isExpired) {
        expiredCount++;
      } else {
        validCount++;
      }

      entries.push({
        key,
        cachedAt: entry.cachedAt,
        expiresAt: entry.cachedAt + entry.ttlMs,
        ageMs,
        remainingMs,
        isExpired,
        isValid: !isExpired,
      });
    }

    // Sort by cachedAt desc (newest first)
    entries.sort((a, b) => b.cachedAt - a.cachedAt);

    return {
      totalEntries: entries.length,
      validEntries: validCount,
      expiredEntries: expiredCount,
      entries,
      newestEntry: entries.length > 0 ? entries[0] : null,
      oldestEntry: entries.length > 0 ? entries[entries.length - 1] : null,
      lastClearedAt: this._lastClearedAt,
    };
  }

  /**
   * Get the number of valid (non-expired) entries.
   */
  get size(): number {
    let count = 0;
    const now = Date.now();
    for (const entry of this.store.values()) {
      if (now - entry.cachedAt <= entry.ttlMs) count++;
    }
    return count;
  }

  /**
   * Get all cache keys (including expired — use getStatus() for filtered view).
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get the timestamp of the last manual clearAll(), or null if never cleared.
   */
  get lastClearedAt(): number | null {
    return this._lastClearedAt;
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSITE KEY BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a composite cache key for a single-asset query.
 * Format: `history:${symbol}:${traderType}:${weeks}`
 */
export function buildHistoryCacheKey(symbol: string, traderType: string, weeks: number): string {
  return `history:${symbol}:${traderType}:${weeks}`;
}

/**
 * Build a composite cache key for all-assets latest query.
 * Format: `allAssets:${traderType}`
 */
export function buildAllAssetsCacheKey(traderType: string): string {
  return `allAssets:${traderType}`;
}

/**
 * Build a composite cache key for percentile histories batch.
 * Format: `percentiles:${traderType}:${weeks}`
 */
export function buildPercentilesCacheKey(traderType: string, weeks: number): string {
  return `percentiles:${traderType}:${weeks}`;
}

/**
 * Build a composite cache key for a single-asset API response.
 * Format: `api:${symbol}:${traderType}:${window}`
 */
export function buildApiCacheKey(symbol: string, traderType: string, window: number): string {
  return `api:${symbol}:${traderType}:${window}`;
}

/**
 * Build a composite cache key for a batch API response.
 * Format: `apiBatch:${traderType}:${window}`
 */
export function buildApiBatchCacheKey(traderType: string, window: number): string {
  return `apiBatch:${traderType}:${window}`;
}


// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCES
// ═══════════════════════════════════════════════════════════════════════════════
// Two cache domains:
//   dataCache  — raw CFTC data (used by cotDataService.ts)
//   apiCache   — normalized API responses (used by cotApiService.ts)

/** Cache for raw CFTC data fetched from the Socrata API */
export const dataCache = new COTCache(DEFAULT_TTL_MS);

/** Cache for normalized COTApiResponse / COTBatchApiResponse envelopes */
export const apiCache = new COTCache(DEFAULT_TTL_MS);

/**
 * Clear ALL COT caches (both data and API layers).
 * Called when user clicks "Refresh COT Data".
 */
export function clearAllCOTCaches(): { dataCleared: number; apiCleared: number } {
  const dataCleared = dataCache.clearAll();
  const apiCleared = apiCache.clearAll();
  return { dataCleared, apiCleared };
}

/**
 * Get combined cache status across both layers.
 */
export function getCombinedCacheStatus(): {
  data: CacheStatus;
  api: CacheStatus;
  totalValid: number;
  totalEntries: number;
  lastClearedAt: number | null;
} {
  const dataStatus = dataCache.getStatus();
  const apiStatus = apiCache.getStatus();
  return {
    data: dataStatus,
    api: apiStatus,
    totalValid: dataStatus.validEntries + apiStatus.validEntries,
    totalEntries: dataStatus.totalEntries + apiStatus.totalEntries,
    lastClearedAt: Math.max(
      dataStatus.lastClearedAt ?? 0,
      apiStatus.lastClearedAt ?? 0
    ) || null,
  };
}