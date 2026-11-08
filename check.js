// Pre-flight check: run `npm run check` after adding your OpenRouter key.
// Verifies the model IDs exist on OpenRouter and makes three tiny real calls (total cost well under $0.01).
const CFG = require('./config');
CFG.mock = false; // the check always makes real calls
const { callOpenRouter, callJev, parseJSON } = require('./ai');

const ok = m => console.log('  ✓ ' + m), bad = m => { console.log('  ✗ ' + m); failed = true; };
let failed = false;

(async () => {
  console.log('\nAstro Decisions: pre-flight check\n');
  if (!CFG.orKey) { console.log('  ✗ OPENROUTER_API_KEY is missing. Copy .env.example to .env and add your key.\n'); process.exit(1); }
  ok(`Key found (…${CFG.orKey.slice(-4)})`);

  // 1. Do the model IDs exist?
  console.log('\n1. Model IDs on OpenRouter');
  const lists = {};
  for (const [name, q] of [['chat', ''], ['decisions', '?output_modalities=decisions']]) {
    try { lists[name] = ((await (await fetch(`${CFG.orBase}/v1/models${q}`)).json()).data || []).map(m => m.id); }
    catch (e) { lists[name] = null; }
  }
  for (const [id, list] of [[CFG.modelFast, 'chat'], [CFG.modelDeep, 'chat'], [CFG.jevModel, 'decisions']]) {
    if (!lists[list]) { console.log(`  ? Could not load the model list to check ${id}`); continue; }
    lists[list].includes(id) ? ok(id) : bad(`${id} not found. Pick the exact ID from openrouter.ai/models and set it in .env`);
  }

  // 2. Real calls
  console.log('\n2. Test calls');
  let total = 0;
  for (const model of [CFG.modelFast, CFG.modelDeep]) {
    try {
      const r = await callOpenRouter(model, [{ role: 'user', content: 'Reply with exactly this JSON and nothing else: {"ok": true}' }], 40);
      const parsed = parseJSON(r.text);
      total += r.usage.cost || 0;
      parsed.ok === true ? ok(`${model} answered (${r.usage.input} in / ${r.usage.output} out tokens, $${(r.usage.cost || 0).toFixed(6)})`)
        : bad(`${model} answered but not with the expected JSON: ${r.text.slice(0, 80)}`);
    } catch (e) { bad(e.message); }
  }
  if (CFG.jevOff) console.log('  - Jev skipped (JEV=off)');
  else {
    try {
      const j = await callJev('Should I move from Vienna to London for a new job next year?', { strict: true });
      total += j.usage.cost || 0;
      ok(`${j.usage.model} answered: kind=${j.kind}, distress=${j.distress.toFixed(3)}, professional=${j.professional.toFixed(3)} ($${(j.usage.cost || 0).toFixed(6)})`);
      if (j.kind !== 'relocation') console.log('    note: expected kind=relocation; the classification may need tuning');
    } catch (e) { bad(e.message); }
  }

  console.log(`\nTotal spent on this check: $${total.toFixed(6)}`);
  console.log(failed ? '\nSome checks failed. Fix the items marked ✗, then run npm run check again.\n'
    : '\nAll good. Start the app with: npm start\n');
  process.exit(failed ? 1 : 0);
})();
