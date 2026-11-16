// Cost calculator: measures the app's real prompts and prices them with live OpenRouter rates.
// Run: npm run cost            (models come from .env, or pass: node cost-calculator.js <fast> <deep>)
const E = require('./public/engine');
const { questionsMessages, hintMessages, readingMessages, jevRequest } = require('./prompts');
const CFG = require('./config');

const FAST = process.argv[2] || CFG.modelFast;
const DEEP = process.argv[3] || CFG.modelDeep;
const JEV = CFG.jevModel;
const CREDIT_FEE = 0.055;          // OpenRouter fee on credit purchases (Standard plan)
const OUT_QUESTIONS = 180;         // expected output tokens for the questions call
const OUT_READING = 750;           // expected output tokens for the reading
const OUT_HINT = 130;              // expected output tokens per "Ask the stars" hint
const HINTS = 2;                   // average hints per session (assumption)
const JEV_CALLS = 3;               // decision screen + one own question + reflection-screen check
const CHARS_PER_TOKEN = 3.5;       // conservative estimate for English text
const FALLBACK = CFG.fallbackPrices;

// Build a realistic session from sample birth data
const utc = E.localToUTC(1999, 5, 31, 14, 15, 'Europe/Istanbul');
const chart = E.westernChart(utc, 40.98, 37.88);
const profile = {
  ascendant: `${chart.ascendant.sign} ${chart.ascendant.degree}°`, midheaven: `${chart.midheaven.sign} ${chart.midheaven.degree}°`,
  planets: chart.planets, saju: E.saju(1999, 5, 31, 14, 15), currentYearPillar: '丙午 Yang Fire Horse',
  places: [['Vienna', 48.21, 16.37], ['London', 51.51, -0.13]].map(([label, la, lo]) => ({ label, lines: E.linesNearCity(chart, la, lo) }))
};
const decision = 'Should I stay in Vienna or move to London next year for a new job?';
const answers = [1, 2, 3, 4, 5].map(i => ({ q: 'What are you most afraid of if you go, and what would you miss most about staying?', a: 'Leaving my friends and starting from zero socially. But I also feel I have stopped growing here.', own: i === 5, hint: i > 3 ? 'Your Moon in Sagittarius needs room to feel safe. Try this: finish the sentence twice.' : '' }));
const notes = ['I felt excited imagining a new city', 'Scared of being lonely in winter', 'My mum would be proud either way'];
const cards = [{ position: 'Situation', name: 'The Chariot', upright: 'determination, moving forward' },
  { position: 'Challenge', name: 'Two of Swords', reversed: true, reversed_kw: 'imbalance in thoughts and conflict' },
  { position: 'Guidance', name: 'The Star', upright: 'hope, renewal, healing' }];

const toks = msgs => Math.ceil(msgs.map(m => m.content).join('\n').length / CHARS_PER_TOKEN) + 10 * msgs.length;
const inQ = toks(questionsMessages(profile, decision, 'relocation'));
const inR = toks(readingMessages(profile, decision, 'relocation', answers, cards, notes));
const inH = toks(hintMessages(profile, decision, 'Will I regret not trying?', notes));
const inJ = Math.ceil(JSON.stringify(jevRequest(decision)).length / CHARS_PER_TOKEN);

// Live prices from OpenRouter's public model list (decision models like Jev are listed separately)
async function livePrices(ids) {
  const out = {};
  let live = false;
  for (const q of ['', '?output_modalities=decisions']) {
    try {
      const r = await fetch(`${CFG.orBase}/v1/models${q}`, { signal: AbortSignal.timeout(8000) });
      const data = (await r.json()).data || [];
      for (const id of ids) {
        const m = data.find(x => x.id === id);
        if (m && m.pricing) { out[id] = [parseFloat(m.pricing.prompt || 0) * 1e6, parseFloat(m.pricing.completion || 0) * 1e6]; live = true; }
      }
    } catch (e) { /* offline: fall back to list prices */ }
  }
  return { prices: out, live };
}

(async () => {
  const { prices, live } = await livePrices([FAST, DEEP, JEV]);
  const src = id => prices[id] ? 'live' : 'fallback';
  const price = id => prices[id] || FALLBACK[id];
  for (const id of [FAST, DEEP, JEV]) if (!price(id)) { console.error(`No price for ${id}. Check the model ID on openrouter.ai/models.`); process.exit(1); }
  const cost = (id, inp, out) => (inp * price(id)[0] + out * price(id)[1]) / 1e6;

  const jev = JEV_CALLS * cost(JEV, inJ, 0);
  const hints = m => HINTS * cost(m, inH, OUT_HINT);
  const scenarios = {
    'Recommended: Haiku questions/hints + Sonnet reading': cost(FAST, inQ, OUT_QUESTIONS) + hints(FAST) + cost(DEEP, inR, OUT_READING) + jev,
    'Budget: Haiku for everything': cost(FAST, inQ, OUT_QUESTIONS) + hints(FAST) + cost(FAST, inR, OUT_READING) + jev,
    'Premium: Sonnet for everything': cost(DEEP, inQ, OUT_QUESTIONS) + hints(DEEP) + cost(DEEP, inR, OUT_READING) + jev,
  };

  console.log(`\nPrices: ${live ? 'LIVE from OpenRouter where available' : 'fallback list prices (OpenRouter not reachable)'}`);
  for (const id of [FAST, DEEP, JEV]) console.log(`  ${id}: $${+price(id)[0].toFixed(4)} in / $${+price(id)[1].toFixed(4)} out per 1M tokens (${src(id)})`);
  console.log(`  OpenRouter credit fee: ${CREDIT_FEE * 100}%`);
  console.log(`\nOne decision session (measured from the real prompts):`);
  console.log(`  Jev checks:     ${JEV_CALLS} × ~${inJ} input tokens`);
  console.log(`  Questions call: ~${inQ} input + ${OUT_QUESTIONS} output tokens`);
  console.log(`  Ask the stars:  ${HINTS} × (~${inH} input + ${OUT_HINT} output tokens)`);
  console.log(`  Reading call:   ~${inR} input + ${OUT_READING} output tokens\n`);
  const vols = [1000, 10000, 100000];
  console.log('Scenario'.padEnd(52) + 'Per session'.padStart(13) + vols.map(v => `${v.toLocaleString('en')}/mo`.padStart(14)).join(''));
  for (const [name, c] of Object.entries(scenarios)) {
    const withFee = c * (1 + CREDIT_FEE);
    console.log(name.padEnd(52) + `$${withFee.toFixed(4)}`.padStart(13) + vols.map(v => `$${(withFee * v).toFixed(0)}`.padStart(14)).join(''));
  }
  console.log('\nIncludes the OpenRouter credit fee. Excludes hosting, database, payments and marketing.\n');
})();
