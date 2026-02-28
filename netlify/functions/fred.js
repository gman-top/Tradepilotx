// Netlify serverless function: server-side proxy for FRED API
// Bypasses CORS restrictions — FRED blocks browser fetch from external origins

const FRED_API_KEY =
  process.env.VITE_FRED_API_KEY || '4b06e4f0318a33951b64578fab25a8c8';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const { series_id, units = 'lin', sort_order = 'desc', limit = '2', file_type = 'json' } = params;

  if (!series_id) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'series_id is required' }),
    };
  }

  const url = new URL(FRED_BASE);
  url.searchParams.set('series_id', series_id);
  url.searchParams.set('api_key', FRED_API_KEY);
  url.searchParams.set('units', units);
  url.searchParams.set('sort_order', sort_order);
  url.searchParams.set('limit', limit);
  url.searchParams.set('file_type', file_type);

  try {
    const res = await fetch(url.toString());
    const body = await res.text();
    return {
      statusCode: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: String(err) }),
    };
  }
};
