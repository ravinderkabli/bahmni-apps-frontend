const http = require('http');
const https = require('https');

const PORT = 3001;

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, x-api-key, anthropic-version, anthropic-beta',
    });
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const apiKey = req.headers['x-api-key'];
    const anthropicVersion = req.headers['anthropic-version'] || '2023-06-01';
    const anthropicBeta = req.headers['anthropic-beta'];

    const headers = {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': anthropicVersion,
      'content-length': Buffer.byteLength(body),
    };
    if (anthropicBeta) headers['anthropic-beta'] = anthropicBeta;

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers,
    };

    const anthropicReq = https.request(options, (anthropicRes) => {
      res.writeHead(anthropicRes.statusCode, {
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      anthropicRes.pipe(res);
    });

    anthropicReq.on('error', (err) => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { type: 'proxy_error', message: err.message } }));
    });

    anthropicReq.write(body);
    anthropicReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`[anthropic-proxy] listening on http://0.0.0.0:${PORT}`);
});
