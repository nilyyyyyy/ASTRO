// AI clients: OpenRouter chat (Claude) and Jev decisions, plus mock responses for keyless runs.
const { jevRequest } = require('./prompts');
const CFG = require('./config');

// --- OpenRouter (OpenAI-compatible chat completions) ---
function withEstimate(u) {
  if (u.cost != null) return u;
  const p = CFG.fallbackPrices[u.model.replace(' (mock)', '')];
  if (!p) return u;
  return { ...u, cost: (u.input * p[0] + u.output * p[1]) / 1e6, estimated: true };
}

async function callOpenRouter(model, messages, maxTokens) {
  if (CFG.mock) { const m = mockLLM(messages); return { text: m.text, usage: withEstimate({ ...m.usage, model: model + ' (mock)' }) }; }
  const r = await fetch(`${CFG.orBase}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CFG.orKey}`, 'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost', 'X-Title': 'Astro Decision App' },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7, usage: { include: true } })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`OpenRouter ${r.status} (${model}): ${JSON.stringify(j.error || j).slice(0, 300)}`);
  const msg = j.choices && j.choices[0] && j.choices[0].message;
  const text = msg && (typeof msg.content === 'string' ? msg.content : (msg.content || []).map(c => c.text || '').join(''));
  if (!text) throw new Error(`OpenRouter (${model}) returned an empty answer`);
  const u = j.usage || {};
  return { text, usage: withEstimate({ model, input: u.prompt_tokens || 0, output: u.completion_tokens || 0, cost: u.cost ?? null }) };
}

// Ask a model for JSON; retry once if the reply can't be parsed.
async function askJSON(model, messages, maxTokens) {
  const usage = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await callOpenRouter(model, messages, maxTokens);
    usage.push(res.usage);
    try { return { data: parseJSON(res.text), usage }; }
    catch (e) { if (attempt === 1) throw new Error(`${model} did not return valid JSON`); }
  }
}

// --- Jev (TypeSafe System One): typed classification + safety screen ---
// Default route: OpenRouter decisions endpoint with the same OpenRouter key.
// If Jev is unavailable, the app falls back to a keyword check and keeps going (the LLM prompts also carry the safety rule).
async function callJev(decision, { strict = false } = {}) {
  if (!strict && (CFG.mock || CFG.jevOff)) return mockJev(decision);
  try {
    const direct = !!CFG.jevKey;
    const url = direct ? 'https://api.typesafe.ai/v1/systemone' : `${CFG.orBase}/alpha/decisions`;
    const model = direct ? 'jev-latest' : CFG.jevModel;
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${direct ? CFG.jevKey : CFG.orKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(jevRequest(decision, model))
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.answers) throw new Error(`${r.status}: ${JSON.stringify(j.error || j).slice(0, 300)}`);
    const a = j.answers, u = j.usage || {};
    const input = u.input_tokens || u.prompt_tokens || 0;
    return {
      kind: (a.kind && a.kind.choice) || 'other',
      distress: a.distress && typeof a.distress.noul === 'number' ? a.distress.noul : 0,
      professional: a.professional && typeof a.professional.noul === 'number' ? a.professional.noul : 0,
      usage: { model: j.model || model, input, output: u.output_tokens || 0,
        cost: typeof u.cost === 'number' ? u.cost : input * CFG.jevPricePerM / 1e6, estimated: typeof u.cost !== 'number' }
    };
  } catch (e) {
    if (strict) throw new Error(`Jev (${CFG.jevKey ? 'TypeSafe direct' : CFG.jevModel}) ${e.message}`);
    console.warn('Jev unavailable, using keyword fallback:', e.message);
    const f = mockJev(decision);
    return { ...f, usage: { ...f.usage, model: 'keyword fallback (Jev failed)', input: 0, cost: 0 } };
  }
}

function parseJSON(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('Model did not return JSON');
  return JSON.parse(text.slice(s, e + 1));
}

// --- mock mode: lets the whole flow run without keys ---
function mockJev(decision) {
  const t = decision.toLowerCase();
  const kind = /move|city|live|relocat|country/.test(t) ? 'relocation' : /job|career|study|business|work/.test(t) ? 'career'
    : /love|partner|date|relationship/.test(t) ? 'love' : /buy|invest|money/.test(t) ? 'money' : 'other';
  const distress = /kill myself|end it all|suicid|hurt myself/.test(t) ? 0.95 : 0.02;
  const input = Math.ceil(JSON.stringify(jevRequest(decision)).length / 4);
  return { kind, distress, professional: 0.05, usage: { model: CFG.jevModel + ' (mock)', input, output: 0, cost: input * CFG.jevPricePerM / 1e6, estimated: true } };
}
function mockLLM(messages) {
  const input = Math.ceil(messages.map(m => m.content).join('').length / 4);
  const isReading = messages[0].content.includes('three lenses');
  const isHint = messages[0].content.includes('is stuck on one question');
  const isChat = messages[0].content.includes('asks you questions about them');
  if (isChat) {
    const q = messages[messages.length - 1].content;
    const text = `[Mock] Good question about "${q.slice(0, 60)}". Your Day Master is Yin Water: gentle, adaptive, like rain soaking into soil. With five Earth elements around it, you're a deep thinker who needs time to absorb before acting. In your Western chart, Libra rising gives you that diplomatic first impression.`;
    return { text, usage: { model: 'mock', input: Math.ceil(messages.map(m => m.content).join('').length / 4), output: Math.ceil(text.length / 4), cost: null } };
  }
  const text = isHint ? JSON.stringify({ support: false,
    insight: '[Mock] Your Moon in Sagittarius needs room to roam to feel safe, while your heavy Earth in saju craves solid ground. Part of you is asking for adventure, part for roots.',
    prompt: '[Mock] Try this: finish the sentence "I would feel safest if…" twice, once as your adventurous self and once as your grounded self.' })
    : isReading ? JSON.stringify({ support: false,
    headline: '[Mock] This decision is less about the city and more about whether you are ready to be seen.',
    when: '[Mock] Your Yin Water Day Master sits in a chart full of Earth: you build slowly and steadily. This year favours movement over waiting.',
    where: '[Mock] Vienna lies on your Mercury and Sun MC lines (learning and visibility in your career). London is neutral for you: a blank page.',
    now: '[Mock] The cards point to a situation that needs courage, a challenge rooted in overthinking, and guidance to trust your own pace.',
    agree: '[Mock] Your answers and the timing both lean toward trying something new without burning bridges.',
    tension: '[Mock] Security versus growth: Vienna feels earned, London feels like a test of who you could become.',
    next_step: '[Mock] Spend one week in London in the next two months, working remotely, and journal how your body feels each evening.',
    gut_check: '[Mock] Imagine you have already chosen London. Notice your first feeling in the first 3 seconds, before your mind argues.' })
    : JSON.stringify({ support: false, questions: ['[Mock] What would staying for one more year give you that leaving cannot?',
      '[Mock] What are you most afraid of if you go?', '[Mock] If nobody judged you, which would you choose?', '[Mock] What does a good Tuesday look like for you in each option?'] });
  return { text, usage: { model: 'mock', input, output: Math.ceil(text.length / 4), cost: null } };
}

module.exports = { callOpenRouter, askJSON, callJev, parseJSON };
