// ==============================================================================
// Vercel Serverless Function Adapter for ZetaSports API Handlers
// Bridges Vercel (req, res) to event-driven Netlify/AWS serverless handlers
// ==============================================================================

export function createVercelHandler(handler) {
  return async function vercelHandler(req, res) {
    const rawUrl = req.url || '/';
    const [path] = rawUrl.split('?');

    // Parse body if stream or string
    let body = req.body;
    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
    }

    const event = {
      httpMethod: req.method,
      path: path,
      rawUrl: rawUrl,
      headers: req.headers || {},
      queryStringParameters: req.query || {},
      body: body
    };

    try {
      const response = await handler(event);
      if (response.headers) {
        for (const [key, val] of Object.entries(response.headers)) {
          res.setHeader(key, val);
        }
      }
      res.status(response.statusCode || 200);
      if (typeof response.body === 'string') {
        res.send(response.body);
      } else {
        res.json(response.body);
      }
    } catch (err) {
      console.error('[Vercel Handler Exception]:', err);
      res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }
  };
}
