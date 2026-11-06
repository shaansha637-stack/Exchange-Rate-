// Vercel serverless function: GET /api/rate
// Calls AllRatesToday (keyed, mid-market) and lets Vercel's CDN cache the answer,
// so many app opens share one upstream request.
// Setup: Vercel -> Settings -> Environment Variables -> RATE_API_KEY (then redeploy).
// Optional: CACHE_HOURS (default 6) controls how long one answer is reused.

module.exports = async (req, res) => {
  const fail = (code, msg) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(code).json({ error: msg });
  };

  const key = process.env.RATE_API_KEY;
  if (!key) return fail(500, 'RATE_API_KEY is not set');

  const hours = Math.max(1, Number(process.env.CACHE_HOURS) || 6);
  const ttl = Math.round(hours * 3600);

  try {
    const r = await fetch(
      'https://allratestoday.com/api/v1/rates?source=SAR&target=INR',
      { headers: { Authorization: 'Bearer ' + key } }
    );
    if (!r.ok) return fail(502, 'upstream ' + r.status);

    const body = await r.json();
    const q = Array.isArray(body) ? body[0] : null;
    if (!q || !(q.rate > 0)) return fail(502, 'unexpected upstream response');

    const num = (h) => {
      const v = r.headers.get(h);
      return v === null ? null : Number(v);
    };

    res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=3600`);
    return res.status(200).json({
      rate: q.rate,
      time: q.time,
      used: num('x-monthly-used'),
      limit: num('x-monthly-limit')
    });
  } catch (e) {
    return fail(502, 'fetch failed');
  }
};
