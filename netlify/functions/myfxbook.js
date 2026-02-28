// Netlify serverless function: server-side proxy for Myfxbook community outlook
// Ensures consistent JSON response regardless of client-side CORS/UA differences

exports.handler = async () => {
  const url = 'https://www.myfxbook.com/api/get-community-outlook.json';

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      },
    });

    const text = await res.text();

    // Attempt to parse and re-serialise so we always return clean JSON
    let body = text;
    try {
      const parsed = JSON.parse(text);
      body = JSON.stringify(parsed);
    } catch {
      // If not valid JSON, return raw text — client will handle error
    }

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
