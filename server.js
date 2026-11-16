// Local server (no frameworks): serves public/ and the AI endpoints.
// Run: npm install && npm start   (Node 18+). Without an API key it runs in mock mode.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handle } = require('./handlers');
const CFG = require('./config');

const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

// Startup check: report missing files clearly instead of crashing later.
const REQUIRED = ['index.html', 'app.js', 'chart.js', 'reflect.js', 'tarot.js', 'engine.js',
  'vendor/astronomy.js', 'vendor/lunar.js', 'vendor/topojson.js', 'vendor/land.json'];
const missing = REQUIRED.filter(f => !fs.existsSync(path.join(PUBLIC, f)));
if (missing.length) console.error('\nMISSING FILES in public/:\n  ' + missing.join('\n  ') + '\n-> Upload the whole public folder, including public/vendor.\n');

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const api = url.match(/^\/api\/(questions|hint|chat|tarot|reading)$/);
  if (api && req.method === 'POST') {
    let raw = ''; for await (const c of req) raw += c;
    let body; try { body = JSON.parse(raw || '{}'); } catch (e) { body = {}; }
    const out = await handle(api[1], body);
    res.writeHead(out.status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(out.json));
  }
  // static files from public/ (no path tricks allowed)
  const file = path.normalize(path.join(PUBLIC, url === '/' ? 'index.html' : decodeURIComponent(url)));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(CFG.port, () => console.log(`Trine on http://localhost:${CFG.port}  (${CFG.mock ? 'MOCK mode, no API calls' : `fast=${CFG.modelFast}, deep=${CFG.modelDeep}, jev=${CFG.jevOff ? 'off' : CFG.jevKey ? 'TypeSafe direct' : CFG.jevModel + ' via OpenRouter'}`})`));
