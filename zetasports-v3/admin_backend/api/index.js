// ==============================================================================
// ZetaSports API Gateway Root Health Check
// ==============================================================================

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    service: 'ZetaSports Enterprise API Gateway',
    status: 'healthy',
    version: '3.0.0',
    edge_caching: 'enabled',
    timestamp: new Date().toISOString()
  });
}
