// The AI endpoints, used by server.js.
const { questionsMessages, hintMessages, chatMessages, tarotMessages, readingMessages } = require('./prompts');
const { askJSON, callJev, callOpenRouter } = require('./ai');
const CFG = require('./config');

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
  // Reflecting is optional, so screen the decision itself plus anything written on the reflect screen.
  const written = [body.decision || '', ...(body.answers || []).map(a => a.own ? `${a.q} ${a.a}` : a.a), ...(body.notes || [])].join('\n').trim();
  const jev = await callJev(written);
  usage.push(jev.usage);
  if (jev.distress > 0.5) return { support: true, message: supportMessage(), usage };
  const kind = body.kind || jev.kind || 'other';
  const res = await askJSON(CFG.modelDeep, readingMessages(body.profile, body.decision, kind, body.answers || [], body.cards, body.notes || []), 1500);
  usage.push(...res.usage);
  return { ...res.data, usage };
}

// Cards tool: quick tarot pull. The question (if any) is screened by Jev first.
async function apiTarot(body) {
  const usage = [];
  if (body.question && body.question.trim()) {
    const jev = await callJev(body.question);
    usage.push(jev.usage);
    if (jev.distress > 0.5) return { support: true, message: supportMessage(), usage };
  }
  const res = await askJSON(CFG.modelFast, tarotMessages(body.profile, body.question, body.cards || []), 600);
  usage.push(...res.usage);
  if (res.data.support) return { support: true, message: res.data.message || supportMessage(), usage };
  return { summary: res.data.summary || '', cards: res.data.cards || [], reflect: res.data.reflect || '', usage };
}

function supportMessage() {
  return "It sounds like you're carrying something really heavy right now. This isn't a moment for a reading. Please reach out to someone you trust, or a local crisis line. In Austria you can call Telefonseelsorge on 142, any time, free.";
}


const HANDLERS = { questions: apiQuestions, hint: apiHint, chat: apiChat, tarot: apiTarot, reading: apiReading };

// Run one endpoint and always answer with JSON (used by both server.js and Vercel).
async function handle(name, body) {
  try {
    const out = await HANDLERS[name](body || {});
    return { status: 200, json: { ...out, mock: CFG.mock } };
  } catch (e) {
    console.error(`[${name}]`, e.message);
    return { status: 500, json: { error: e.message } };
  }
}

module.exports = { handle, HANDLERS, supportMessage };
