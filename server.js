// Minimal Node server (no frameworks): serves the app and four AI endpoints.
// Run: npm install && npm start   (Node 18+). Without API keys it runs in mock mode.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { questionsMessages, hintMessages, chatMessages, readingMessages } = require('./prompts');
const { askJSON, callJev, callOpenRouter } = require('./ai');
const CFG = require('./config');

// --- endpoints ---
async function apiQuestions(body) {
  const jev = await callJev(body.decision);
  if (jev.distress > 0.5) return { support: true, message: supportMessage(), usage: [jev.usage] };
  const kind = jev.kind || 'other';
  const res = await askJSON(CFG.modelFast, questionsMessages(body.profile, body.decision, kind), 400);
  if (res.data.support) return { support: true, message: res.data.message || supportMessage(), usage: [jev.usage, ...res.usage] };
  if (!Array.isArray(res.data.questions) || !res.data.questions.length) throw new Error('No questions returned');
  return { questions: res.data.questions.slice(0, 4), kind, professional: jev.professional, usage: [jev.usage, ...res.usage] };
}

// "Ask the stars": a hint for one question. User-written questions are screened by Jev first.
async function apiHint(body) {
  const usage = [];
  if (body.own) {
    const jev = await callJev(body.question);
    usage.push(jev.usage);
    if (jev.distress > 0.5) return { support: true, message: supportMessage(), usage };
  }
  const res = await askJSON(CFG.modelFast, hintMessages(body.profile, body.decision, body.question, body.notes || []), 300);
  usage.push(...res.usage);
  if (res.data.support) return { support: true, message: res.data.message || supportMessage(), usage };
  return { insight: res.data.insight || '', prompt: res.data.prompt || '', usage };
}

// "Ask about your chart": free conversation in the My Chart frame. Every user message is screened by Jev first.
async function apiChat(body) {
  const history = Array.isArray(body.messages) ? body.messages : [];
  const last = [...history].reverse().find(m => m.role === 'user');
  if (!last || !String(last.content).trim()) throw new Error('Empty message');
  const usage = [];
  const jev = await callJev(String(last.content));
  usage.push(jev.usage);
  if (jev.distress > 0.5) return { support: true, message: supportMessage(), usage };
  const res = await callOpenRouter(CFG.modelFast, chatMessages(body.profile, history), 600);
  usage.push(res.usage);
  return { reply: res.text.trim(), usage };
}

async function apiReading(body) {
  const usage = [];
  // Screen everything the user wrote on the reflection screen (answers + notes) before the reading.
  const written = [...(body.answers || []).map(a => a.own ? `${a.q} ${a.a}` : a.a), ...(body.notes || [])].join('\n').trim();
  if (written) {
    const jev = await callJev(written);
    usage.push(jev.usage);
    if (jev.distress > 0.5) return { support: true, message: supportMessage(), usage };
  }
  const res = await askJSON(CFG.modelDeep, readingMessages(body.profile, body.decision, body.kind, body.answers, body.cards, body.notes || []), 1500);
  usage.push(...res.usage);
  return { ...res.data, usage };
}

function supportMessage() {
  return "It sounds like you're carrying something really heavy right now. This isn't a moment for a reading. Please reach out to someone you trust, or a local crisis line. In Austria you can call Telefonseelsorge on 142, any time, free.";
}

// --- static files ---
const STATIC = {
  '/': 'public/index.html', '/app.js': 'public/app.js', '/tarot.js': 'public/tarot.js', '/reflect.js': 'public/reflect.js', '/chart.js': 'public/chart.js', '/engine.js': 'engine.js',
  '/vendor/astronomy.js': 'node_modules/astronomy-engine/astronomy.browser.min.js',
  '/vendor/lunar.js': 'node_modules/lunar-javascript/lunar.js',
  '/vendor/topojson.js': 'node_modules/topojson-client/dist/topojson-client.min.js',
  '/vendor/land.json': 'node_modules/world-atlas/land-110m.json',
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json' };

// Startup check: report missing files clearly instead of crashing later.
const missing = Object.values(STATIC).filter(f => !fs.existsSync(path.join(__dirname, f)));
if (missing.length) {
  console.error('\nMISSING FILES:\n  ' + missing.join('\n  '));
  if (missing.some(f => f.startsWith('node_modules/'))) console.error('-> Libraries missing: the build command must be "npm install".');
  if (missing.some(f => f.startsWith('public/'))) console.error('-> index.html, app.js, chart.js, reflect.js and tarot.js must be inside a folder named "public" in the repo.');
  console.error('');
}

http.createServer(async (req, res) => {
  try {
    const API = { '/api/questions': apiQuestions, '/api/hint': apiHint, '/api/chat': apiChat, '/api/reading': apiReading };
    if (req.method === 'POST' && API[req.url]) {
      let raw = ''; for await (const c of req) raw += c;
      const out = await API[req.url](JSON.parse(raw));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ...out, mock: CFG.mock }));
    }
    const file = STATIC[req.url.split('?')[0]];
    if (!file) { res.writeHead(404); return res.end('Not found'); }
    const full = path.join(__dirname, file);
    if (!fs.existsSync(full)) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end(`Missing file on the server: ${file}\nSee the server log for how to fix it.`);
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(full).on('error', e => { console.error(e.message); res.end(); }).pipe(res);
  } catch (e) {
    console.error(e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(CFG.port, () => console.log(`Astro app on http://localhost:${CFG.port}  (${CFG.mock ? 'MOCK mode, no API calls' : `fast=${CFG.modelFast}, deep=${CFG.modelDeep}, jev=${CFG.jevOff ? 'off' : CFG.jevKey ? 'TypeSafe direct' : CFG.jevModel + ' via OpenRouter'}`})`));
