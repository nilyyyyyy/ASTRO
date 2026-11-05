// Prompt builders shared by the server and the cost calculator.
// Principle: the app helps the user think; it never decides for them.

function profileSummary(p) {
  const pl = p.planets.map(x => `${x.name} ${x.sign} ${x.degree}° (house ${x.house})`).join('; ');
  const pillars = p.saju.pillars.map(x => `${x.pillar}: ${x.hanja} ${x.polarity} ${x.stemElement} / ${x.animal} ${x.branchElement}`).join('; ');
  const bal = Object.entries(p.saju.elementBalance).map(([k, v]) => `${k} ${v}`).join(', ');
  let s = `WESTERN CHART (tropical, whole-sign houses)\nRising ${p.ascendant}; MC ${p.midheaven}\n${pl}\n\n` +
    `SAJU (Four Pillars)\n${pillars}\nDay Master: ${p.saju.dayMaster}. Element balance: ${bal}.`;
  if (p.currentYearPillar) s += `\nCurrent year pillar: ${p.currentYearPillar}.`;
  if (p.places && p.places.length) {
    s += `\n\nASTROCARTOGRAPHY (planet lines within 700 km of each place)\n` +
      p.places.map(pl => `${pl.label}: ${pl.lines.length ? pl.lines.map(l => `${l.planet} ${l.angle} ${l.km} km`).join(', ') : 'no lines (neutral)'}`).join('\n');
  }
  return s;
}

const SAFETY = `If the user's words suggest they may be in crisis or thinking about harming themselves, do not give a reading: set "support" to true and write a short, warm message encouraging them to reach out to someone they trust or a local crisis line. Never give medical, legal or financial instructions; for those, suggest a qualified professional.`;

function questionsMessages(profile, decision, kind) {
  return [
    { role: 'system', content:
`You are the guide in a reflective astrology app that helps people make decisions. You never decide for the user.
Write 3 or 4 short clarifying questions that help the person see what they actually want. Always include one about what they fear and one along the lines of "what would you choose if nobody judged you?". Make the questions specific to their decision and lightly informed by their chart (no jargon).
${SAFETY}
Reply with JSON only: {"support": false, "questions": ["...", "..."]} or {"support": true, "message": "..."}` },
    { role: 'user', content: `Decision type: ${kind}\nDecision: ${decision}\n\n${profileSummary(profile)}` }
  ];
}

// "Ask the stars": help with one question the user can't answer (theirs or ours). Short, reflective, never a verdict.
function hintMessages(profile, decision, question, notes = []) {
  return [
    { role: 'system', content:
`You are the guide in a reflective astrology app. The user is stuck on one question about their decision. Help them find THEIR answer; do not answer it for them.
Use at most two lenses that genuinely fit (Western chart, Saju, astrocartography). Name the placement in plain words (e.g. "your Moon in Sagittarius, the part of you that needs freedom to feel safe").
Then give one reflective prompt that makes the question easier to answer, starting with "Try this:".
Keep it under 90 words total, warm and specific.
${SAFETY}
Reply with JSON only: {"support": false, "insight": "...", "prompt": "Try this: ..."} or {"support": true, "message": "..."}` },
    { role: 'user', content: `Decision: ${decision}\nQuestion they're stuck on: ${question}` +
      (notes.length ? `\nTheir notes so far: ${notes.join(' | ')}` : '') + `\n\n${profileSummary(profile)}` }
  ];
}

// "Ask about your chart": open conversation about the user's own Western chart, saju and map.
// history: [{role:'user'|'assistant', content}] — only the last 12 turns are sent.
function chatMessages(profile, history) {
  return [
    { role: 'system', content:
`You are the astrologer inside a reflective astrology app. The user is exploring their own birth chart, Korean saju and astrocartography, and asks you questions about them.
Explain in plain, warm language, with jargon only when you explain it right away. Refer to their actual placements and pillars from the data below; never invent placements that are not listed. If something is not in the data (for example a minor asteroid), say so.
Present astrology as a lens for self-reflection, not as fact or certain prediction. Never make medical, legal or financial calls; suggest a qualified professional for those.
If the user seems to be in crisis or thinking about harming themselves, set the chart aside, respond with care, and encourage them to reach out to someone they trust or a local crisis line.
Keep answers under 150 words unless they ask for more. Plain text, no markdown headings.

THEIR DATA
${profileSummary(profile)}` },
    ...history.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 2000) }))
  ];
}

function readingMessages(profile, decision, kind, answers, cards, notes = []) {
  const qa = answers.map(a => `Q${a.own ? ' (their own question)' : ''}: ${a.q}\nA: ${a.a}${a.hint ? `\n(Astro hint they received: ${a.hint})` : ''}`).join('\n\n') +
    (notes.length ? `\n\nThoughts they noted down:\n- ${notes.join('\n- ')}` : '');
  const tarot = cards.map(c => `${c.position}: ${c.name}${c.reversed ? ' (reversed)' : ''} — ${c.reversed ? c.reversed_kw : c.upright}`).join('\n');
  return [
    { role: 'system', content:
`You are the guide in a reflective astrology app. You combine three lenses into ONE coherent reading:
- WHEN: Saju (Day Master, element balance, current year pillar) — timing and energy.
- WHERE: astrocartography lines for any places involved (Venus = attraction/being seen; Jupiter = growth; Saturn = hard work; Sun = visibility; Moon = home; Mercury = learning; Mars = drive/friction; Uranus = change; Neptune = dreaminess/confusion; Pluto = intensity).
- NOW: the three tarot cards the user drew.
Rules: never tell the user what to choose and never predict outcomes as certain. Use their own answers, their own questions and their noted thoughts — they matter more than the stars. If they wrote questions of their own, acknowledge at least one of them. Plain, warm, specific language; no jargon without a short explanation. Be honest when lenses conflict.
${SAFETY}
Reply with JSON only:
{"support": false,
 "headline": "one sentence capturing the core of this decision",
 "when": "2-3 sentences (saju)",
 "where": "2-3 sentences (astrocartography; say 'not relevant' briefly if no places)",
 "now": "2-3 sentences (tarot)",
 "agree": "where the lenses and their answers agree",
 "tension": "the real tension underneath the decision",
 "next_step": "one concrete, small action in the next 2 weeks",
 "gut_check": "a short exercise to notice their gut feeling"}` },
    { role: 'user', content: `Decision type: ${kind}\nDecision: ${decision}\n\nTheir answers:\n${qa}\n\nTarot spread:\n${tarot}\n\n${profileSummary(profile)}` }
  ];
}

// Jev (TypeSafe System One) request: typed decisions, no text generation.
// Same body for OpenRouter (/api/alpha/decisions) and TypeSafe direct (/v1/systemone); only the model ID differs.
function jevRequest(decision, model = 'typesafe/jev-1.14') {
  return {
    model,
    state: { decision },
    questions: {
      kind: { type: 'choice', instructions: 'What kind of life decision is described in `decision`?',
        criteria: { relocation: 'Moving, where to live, travel', career: 'Job, studies, business', love: 'Partner, dating, relationships, friendship',
          money: 'Purchases, investments, spending', other: null } },
      distress: { type: 'noul', instructions: 'Does `decision` suggest the person may be in crisis or thinking about harming themselves?' },
      professional: { type: 'noul', instructions: 'Does `decision` mainly need medical, legal or professional financial advice?' }
    }
  };
}

module.exports = { profileSummary, questionsMessages, hintMessages, chatMessages, readingMessages, jevRequest };
