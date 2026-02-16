// ═══════════════════════════════════════════════════════════════════════════════
// CFTC SODA API PROXY
// ═══════════════════════════════════════════════════════════════════════════════
//
// Server-side proxy for the CFTC Socrata Open Data API.
// Bypasses CORS restrictions that block direct browser → CFTC requests.
//
// Endpoints:
//   POST /make-server-d198f9ee/cftc/batch
//     Body: { symbols: [{ symbol, pattern }], limit }
//
//   GET /make-server-d198f9ee/cftc/history
//     ?symbol=Gold&pattern=%25GOLD%25COMMODITY EXCHANGE%25&limit=156
//
//   GET /make-server-d198f9ee/cftc/query
//     ?where=<SoQL WHERE clause>&order=<SoQL ORDER>&limit=<n>
//
// All endpoints proxy to:
//   https://publicreporting.cftc.gov/resource/6dca-aqww.json
//
// ═══════════════════════════════════════════════════════════════════════════════

const SODA_BASE_URL = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';

/**
 * Escape single quotes in SoQL string values.
 * CFTC's Socrata API uses single-quoted strings in SoQL — any literal
 * single quote in a pattern must be doubled to avoid injection/breakage.
 */
function escapeSoQL(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Build a CFTC SODA API query URL using URLSearchParams (never string concat).
 */
function buildCFTCUrl(params: Record<string, string>): string {
  const url = new URL(SODA_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Fetch a single SoQL query from the CFTC.
 * Returns the raw JSON array or throws on failure.
 */
async function fetchFromCFTC(where: string, order: string, limit: string): Promise<any[]> {
  const url = buildCFTCUrl({
    '$where': where,
    '$order': order,
    '$limit': limit,
  });

  console.log(`[CFTC Proxy] Fetching: ${url}`);

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`CFTC API returned ${response.status}: ${text}`);
  }

  return await response.json();
}

/**
 * Register CFTC proxy routes on a Hono app instance.
 */
export function registerCFTCRoutes(app: any) {
  // ─── SINGLE QUERY ───────────────────────────────────────────────────────
  app.get('/make-server-d198f9ee/cftc/query', async (c: any) => {
    try {
      const where = c.req.query('where');
      const order = c.req.query('order') || 'report_date_as_yyyy_mm_dd DESC';
      const limit = c.req.query('limit') || '2';

      if (!where) {
        return c.json({ ok: false, error: 'Missing required "where" parameter' }, 400);
      }

      const data = await fetchFromCFTC(where, order, limit);
      return c.json({ ok: true, data, count: data.length });
    } catch (err: any) {
      console.log(`[CFTC Proxy] Single query error: ${err.message}`);
      return c.json({ ok: false, error: err.message }, 502);
    }
  });

  // ─── BATCH QUERY ────────────────────────────────────────────────────────
  // Fetches data for multiple symbols in parallel, server-side.
  // ONE browser request → N server-side CFTC requests (no CORS).
  //
  // Body: { symbols: [{ symbol: "Gold", pattern: "%GOLD%COMMODITY EXCHANGE%" }], limit: 2 }
  app.post('/make-server-d198f9ee/cftc/batch', async (c: any) => {
    try {
      const body = await c.req.json();
      const symbols: Array<{ symbol: string; pattern: string }> = body.symbols || [];
      const limit = String(body.limit || 2);
      const order = body.order || 'report_date_as_yyyy_mm_dd DESC';

      if (symbols.length === 0) {
        return c.json({ ok: false, error: 'No symbols provided' }, 400);
      }

      console.log(`[CFTC Proxy] Batch fetch for ${symbols.length} symbols, limit=${limit}`);

      const results: Record<string, any[]> = {};
      const errors: string[] = [];

      const fetchPromises = symbols.map(async ({ symbol, pattern }) => {
        try {
          // Escape single quotes in the pattern before building SoQL
          const safePattern = escapeSoQL(pattern);
          const where = `market_and_exchange_names like '${safePattern}'`;
          const data = await fetchFromCFTC(where, order, limit);
          results[symbol] = data;
        } catch (err: any) {
          console.log(`[CFTC Proxy] Failed for ${symbol}: ${err.message}`);
          errors.push(symbol);
          results[symbol] = [];
        }
      });

      await Promise.allSettled(fetchPromises);

      const successCount = symbols.length - errors.length;
      console.log(`[CFTC Proxy] Batch complete: ${successCount}/${symbols.length} succeeded`);

      return c.json({
        ok: true,
        results,
        meta: {
          totalSymbols: symbols.length,
          successCount,
          failedSymbols: errors,
          fetchedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.log(`[CFTC Proxy] Batch error: ${err.message}`);
      return c.json({ ok: false, error: err.message }, 502);
    }
  });

  // ─── HISTORY QUERY ──────────────────────────────────────────────────────
  // Fetches extended history for a single symbol (up to 156 weeks).
  // GET /make-server-d198f9ee/cftc/history?symbol=Gold&pattern=...&limit=156
  app.get('/make-server-d198f9ee/cftc/history', async (c: any) => {
    try {
      const symbol = c.req.query('symbol') || 'unknown';
      const pattern = c.req.query('pattern');
      const limit = c.req.query('limit') || '156';

      if (!pattern) {
        return c.json({ ok: false, error: 'Missing required "pattern" parameter' }, 400);
      }

      // Escape single quotes in the pattern before building SoQL
      const safePattern = escapeSoQL(pattern);
      const where = `market_and_exchange_names like '${safePattern}'`;
      const data = await fetchFromCFTC(where, 'report_date_as_yyyy_mm_dd DESC', limit);

      console.log(`[CFTC Proxy] History for ${symbol}: ${data.length} rows`);

      return c.json({ ok: true, symbol, data, count: data.length });
    } catch (err: any) {
      console.log(`[CFTC Proxy] History error: ${err.message}`);
      return c.json({ ok: false, error: err.message }, 502);
    }
  });
}
