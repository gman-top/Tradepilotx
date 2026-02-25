import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { registerCFTCRoutes } from "./cftc_proxy.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-d198f9ee/health", (c) => {
  return c.json({ status: "ok" });
});

// ─── Myfxbook Community Outlook Proxy ──────────────────────────────────────
// Bypasses CORS restrictions when calling Myfxbook from browser in production.
app.get("/make-server-d198f9ee/sentiment/myfxbook", async (c) => {
  try {
    const res = await fetch(
      "https://www.myfxbook.com/api/get-community-outlook.json",
      { headers: { "User-Agent": "TradePilot/1.0" }, signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return c.json({ error: `Myfxbook upstream ${res.status}` }, res.status as 400);
    const data = await res.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: String(err) }, 502);
  }
});

// Register CFTC SODA API proxy routes
registerCFTCRoutes(app);

Deno.serve(app.fetch);
