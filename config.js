// Shared configuration: reads .env (if present) and environment variables.
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] !== '' && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const ENV = process.env;

const CFG = {
  port: +(ENV.PORT || 3000),
  orKey: ENV.OPENROUTER_API_KEY || '',
  orBase: (ENV.OPENROUTER_BASE_URL || 'https://openrouter.ai/api').replace(/\/$/, ''),
  modelFast: ENV.MODEL_FAST || 'anthropic/claude-haiku-5.5',
  modelDeep: ENV.MODEL_DEEP || 'anthropic/claude-sonnet-5.5',
  jevModel: ENV.MODEL_JEV || 'typesafe/jev-1.14',
  jevKey: ENV.TYPESAFE_API_KEY || '',   // optional: call TypeSafe directly instead of via OpenRouter
  jevOff: ENV.JEV === 'off',
  jevPricePerM: 0.042,
};
CFG.mock = ENV.MOCK === '1' || process.argv.includes('--mock') || !CFG.orKey;

// List prices (USD per million tokens, input / output). Used only as a fallback when live prices
// or OpenRouter's reported cost are unavailable. Run `npm run cost` for live prices.
CFG.fallbackPrices = {
  'anthropic/claude-haiku-5.5': [0.10, 0.50],
  'anthropic/claude-sonnet-5.5': [2.00, 10.00],
  'typesafe/jev-1.14': [0.042, 0],
  'typesafe/jev-1.13': [0.042, 0],
};

module.exports = CFG;
