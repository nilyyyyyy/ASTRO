// Human Design lens: bodygraph, plain explanations, your reactions ("so me / not me / not sure" + note)
// and two-week experiments with check-ins. Calculation lives in engine.js (AstroEngine.humanDesign).
// Reactions and experiments are saved on this device only.
const HDView = (() => {
  const TYPE = {
    Generator: 'You have steady, renewable life energy. You do your best work when something outside you lights you up and you respond to it, instead of forcing things from your head.',
    'Manifesting Generator': 'You have lots of energy and you move fast, often doing several things at once. You work best by responding first, then telling people what you are about to do.',
    Manifestor: 'You are here to start things and get them moving. You are not designed to wait; telling people what you are about to do clears your path.',
    Projector: 'You are a guide who sees people and systems clearly. Your insight lands best when it is invited, and you do not have the steady work energy of a Generator, so rest matters.',
    Reflector: 'You are a mirror for your community. You take in the energy around you, so where you are and who you are with matters a lot. Big decisions want time.' };
  const AUTH = {
    Emotional: 'Your clarity comes in waves. Avoid deciding at the high or the low; sleep on big choices and decide once you feel calm about it.',
    Sacral: 'Your gut answers in the moment, often as a sound ("uh-huh" or "uh-uh") or a pull towards or away. Ask yourself yes/no questions and listen to the body, not the mind.',
    Splenic: 'Your intuition speaks once, quietly, in the moment. Your first instinct is usually right; thinking it over again and again tends to drown it out.',
    'Ego Manifested': 'Your truth comes from what you really want and are willing to commit to. Say it out loud: if you hear yourself say "I want", trust it.',
    'Ego Projected': 'Your truth comes from what you really want. Talk it through with someone you trust and listen for what your will is saying.',
    'Self-Projected': 'You find your truth by hearing yourself speak. Talk your decision through out loud and notice what sounds like you.',
    'Mental (outer authority)': 'You are not meant to decide from one place inside. Talk it through with different trusted people and environments, then let clarity form over time.',
    Lunar: 'Your clarity forms over a full lunar cycle, about 28 days. Give big decisions a month and notice how you feel about them across it.' };
  const STRATEGY_TXT = {
    'To respond': 'Wait for something to show up that you can respond to (a question, an offer, a sign), then check your gut.',
    'To respond, then inform': 'Respond first, then tell the people affected what you are going to do before you do it.',
    'To inform': 'Before you act, tell the people your action will affect. It removes resistance.',
    'Wait for the invitation': 'Wait to be recognised and invited for the big things: work, love, where to live. Your insight is most powerful when someone asks for it.',
    'Wait a lunar cycle': 'Wait about 28 days before big decisions, talking them through along the way.' };
  const LINE = {
    1: 'Investigator: you need solid research and foundations before you feel secure.',
    2: 'Natural: you have gifts others see before you do, and you need time alone.',
    3: 'Experimenter: you learn by trial and error; "mistakes" are your method.',
    4: 'Networker: opportunities come through people you already know.',
    5: 'Problem solver: people project expectations onto you and look to you for practical solutions.',
    6: 'Role model: you live in three phases, from experimenting, to observing, to leading by example.' };
  const CENTER = {
    Head: ['Steady inspiration and mental pressure to figure things out.', 'You pick up other people\'s questions. Not every question needs your answer.'],
    Ajna: ['A fixed way of thinking and processing ideas that people can rely on.', 'You can see many perspectives; you do not need to be certain.'],
    Throat: ['A consistent voice and way of expressing yourself.', 'Your voice changes with who you are with. You do not need to fill silences.'],
    G: ['A clear sense of identity and direction in life.', 'Your sense of self flows with places and people, so the right environment matters.'],
    Heart: ['Willpower and the drive to make and keep promises.', 'You have nothing to prove. Watch out for overpromising.'],
    'Solar Plexus': ['Emotional waves: your feelings move in cycles.', 'You feel others\' emotions strongly. Notice which feelings are actually yours.'],
    Sacral: ['Steady life force and work energy.', 'You amplify energy around you but do not have it consistently. Know when enough is enough.'],
    Spleen: ['Instinct, timing and a sense of what is healthy for you, in the moment.', 'You may hold on to things that are not good for you. Practise letting go.'],
    Root: ['A steady way of handling pressure and stress.', 'You feel outside pressure strongly. Not everything is urgent.'] };
  // Bodygraph layout (viewBox 300 x 470)
  const POS = { Head: [150, 38], Ajna: [150, 108], Throat: [150, 184], G: [150, 262], Heart: [212, 292], 'Solar Plexus': [250, 352], Sacral: [150, 352], Spleen: [50, 352], Root: [150, 430] };

  let hd = null, key = '', react = {}, exps = {};

  // ---------- storage (device only) ----------
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };

  function compute() {
    const [y, mo, d] = $('date').value.split('-').map(Number);
    const [h, mi] = $('time').value.split(':').map(Number);
    hd = AstroEngine.humanDesign(AstroEngine.localToUTC(y, mo, d, h, mi, state.birthPlace.tz));
    key = `trine.hd.${$('date').value}.${$('time').value}.${state.birthPlace.lat}`;
    react = load(key + '.react', {}); exps = load(key + '.exp', {});
    return hd;
  }

  // ---------- bodygraph ----------
  function shape(name, cx, cy, on) {
    const cls = `bg-c ${on ? 'on' : ''}`;
    const tri = (up, w, h) => up ? `${cx},${cy - h / 2} ${cx + w / 2},${cy + h / 2} ${cx - w / 2},${cy + h / 2}` : `${cx - w / 2},${cy - h / 2} ${cx + w / 2},${cy - h / 2} ${cx},${cy + h / 2}`;
    let el;
    if (name === 'Head') el = `<polygon points="${tri(true, 58, 46)}" class="${cls}"/>`;
    else if (name === 'Ajna') el = `<polygon points="${tri(false, 58, 46)}" class="${cls}"/>`;
    else if (name === 'G') el = `<polygon points="${cx},${cy - 30} ${cx + 30},${cy} ${cx},${cy + 30} ${cx - 30},${cy}" class="${cls}"/>`;
    else if (name === 'Heart') el = `<polygon points="${tri(true, 38, 30)}" class="${cls}"/>`;
    else if (name === 'Spleen') el = `<polygon points="${cx - 22},${cy - 30} ${cx + 22},${cy} ${cx - 22},${cy + 30}" class="${cls}"/>`;
    else if (name === 'Solar Plexus') el = `<polygon points="${cx + 22},${cy - 30} ${cx - 22},${cy} ${cx + 22},${cy + 30}" class="${cls}"/>`;
    else el = `<rect x="${cx - 27}" y="${cy - 25}" width="54" height="50" rx="6" class="${cls}"/>`;
    return `<g class="bg-g" data-item="center:${name}" tabindex="0" role="button" aria-label="${name} center, ${on ? 'defined' : 'open'}">${el}<title>${name}: ${on ? 'defined' : 'open'}</title></g>`;
  }
  function bodygraph() {
    const active = new Set(hd.activeGates), defined = new Set(hd.definedCenters);
    const pairCount = {};
    let lines = '';
    AstroEngine.HD_CHANNELS.forEach(([a, b, name]) => {
      const ca = AstroEngine.gateCenter[a], cb = AstroEngine.gateCenter[b];
      const k = [ca, cb].sort().join('|'); const i = pairCount[k] = (pairCount[k] || 0) + 1;
      const [x1, y1] = POS[ca], [x2, y2] = POS[cb];
      const len = Math.hypot(x2 - x1, y2 - y1), ox = -(y2 - y1) / len, oy = (x2 - x1) / len, off = (i - 1) * 5 - 2.5 * (i > 1);
      const X1 = x1 + ox * off, Y1 = y1 + oy * off, X2 = x2 + ox * off, Y2 = y2 + oy * off, mx = (X1 + X2) / 2, my = (Y1 + Y2) / 2;
      const full = active.has(a) && active.has(b);
      lines += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" class="bg-ch"/>`;
      if (full) lines += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" class="bg-ch on"><title>${a}-${b} ${name}</title></line>`;
      else {
        if (active.has(a)) lines += `<line x1="${X1}" y1="${Y1}" x2="${mx}" y2="${my}" class="bg-ch half"><title>Gate ${a}</title></line>`;
        if (active.has(b)) lines += `<line x1="${X2}" y1="${Y2}" x2="${mx}" y2="${my}" class="bg-ch half"><title>Gate ${b}</title></line>`;
      }
    });
    const centers = Object.keys(POS).map(n => shape(n, POS[n][0], POS[n][1], defined.has(n))).join('');
    return `<svg viewBox="0 0 300 470" class="bodygraph" aria-label="Your bodygraph">${lines}${centers}</svg>`;
  }

  // ---------- reactions ----------
  function reactHtml(id) {
    const r = react[id] || {};
    const btn = (v, label) => `<button class="rx ${r.r === v ? 'on' : ''}" data-id="${id}" data-v="${v}">${label}</button>`;
    return `<div class="rxrow">${btn('yes', 'So me')}${btn('no', 'Not me')}${btn('unsure', 'Not sure')}
      <button class="quiet rxnote" data-id="${id}">${r.note ? 'Edit note' : 'Add note'}</button></div>
      ${r.note ? `<p class="rx-note">${esc(r.note)}</p>` : ''}
      <div class="row rx-edit hidden" data-id="${id}"><input placeholder="What does this bring up for you?" maxlength="400" value="${esc(r.note || '')}"><button class="ghost rxsave" data-id="${id}">Save</button></div>`;
  }
  function item(id, title, body) {
    return `<div class="hd-item" id="hd-${id.replace(/[^a-z0-9]/gi, '-')}"><h3>${title}</h3><p>${body}</p>${reactHtml(id)}</div>`;
  }

  // ---------- experiments ----------
  function experimentList() {
    const list = [];
    const byType = {
      Projector: ['Wait for the invitation', 'For two weeks, share advice or big ideas only when someone asks for them. Notice how differently they land.', 'Were you invited today, and how did it feel?'],
      Generator: ['Respond, don\'t initiate', 'For two weeks, before saying yes to anything, notice your gut\'s first sound or pull.', 'What did your gut respond to today?'],
      'Manifesting Generator': ['Respond, then inform', 'For two weeks, respond with your gut first, then tell the people affected before you act.', 'What did you respond to, and who did you inform?'],
      Manifestor: ['Inform before you act', 'For two weeks, tell the people affected before you start something new.', 'Who did you inform today, and what changed?'],
      Reflector: ['Wait a moon', 'Pick one decision and give it 28 days. Write a line about it each day.', 'How does the decision feel today?'] };
    const byAuth = {
      Splenic: ['Trust the first instinct', 'Once a day, act on a first instinct within a minute, before your mind argues.', 'What did your instinct say, and what happened?'],
      Emotional: ['Sleep on it', 'For two weeks, wait at least one night before any decision that matters.', 'How did your feeling about it change overnight?'],
      Sacral: ['Yes/no gut check', 'Ask yourself three yes/no questions a day and answer with your body, not your head.', 'Which answers surprised you?'],
      'Self-Projected': ['Talk it out', 'Once a day, talk a choice through out loud and notice what sounds true.', 'What did you hear yourself say?'] };
    if (byType[hd.type]) list.push({ id: 'type', ...toExp(byType[hd.type]) });
    if (byAuth[hd.authority]) list.push({ id: 'auth', ...toExp(byAuth[hd.authority]) });
    const open = hd.openCenters[0];
    if (open) list.push({ id: 'open', ...toExp([`Open ${open}: notice what isn't yours`, `For two weeks, notice moments when you feel pushed around by ${open === 'Head' ? 'other people\'s questions' : open === 'Solar Plexus' ? 'other people\'s emotions' : open === 'Root' ? 'outside pressure' : open === 'Sacral' ? 'other people\'s energy' : open === 'Heart' ? 'the urge to prove yourself' : 'other people\'s influence'}.`, 'When did you notice it today?']) });
    return list;
  }
  const toExp = ([title, how, question]) => ({ title, how, question });
  function expHtml(e) {
    const st = exps[e.id];
    if (!st) return `<div class="hd-item"><h3>${esc(e.title)}</h3><p>${esc(e.how)}</p><button class="ghost exstart" data-id="${e.id}">Start this experiment</button></div>`;
    const day = Math.min(14, Math.floor((Date.now() - st.start) / 864e5) + 1);
    const todayDone = st.log.some(l => new Date(l.t).toDateString() === new Date().toDateString());
    return `<div class="hd-item exp-on"><h3>${esc(e.title)}</h3><p class="note">Day ${day} of 14. ${st.log.length} check-in${st.log.length === 1 ? '' : 's'} so far.</p><p>${esc(e.how)}</p>
      <div class="exbar"><i style="width:${day / 14 * 100}%"></i></div>
      ${todayDone ? '<p class="note">Checked in today.</p>' : `<label>${esc(e.question)}</label><div class="row"><input class="exin" data-id="${e.id}" maxlength="300"><button class="btn excheck" data-id="${e.id}">Check in</button></div>`}
      ${st.log.length ? `<ul class="exlog">${st.log.slice().reverse().map(l => `<li><b>${new Date(l.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</b> ${esc(l.text)}</li>`).join('')}</ul>` : ''}
      <button class="quiet exstop" data-id="${e.id}">${day >= 14 ? 'Finish experiment' : 'Stop experiment'}</button></div>`;
  }

  // ---------- render ----------
  function render() {
    compute();
    const p = hd.profile.split('/');
    $('hdPane').innerHTML = `
      <h2>Human Design</h2>
      <p class="sub">Calculated from your birth moment and your "design" moment on ${hd.designDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}, when the Sun was 88° earlier. Tap anything to react to it.</p>
      <div class="hd-top">
        <div>${bodygraph()}<p class="note" style="text-align:center">Filled shapes are defined centers. Solid lines are complete channels; short lines are single gates.</p></div>
        <div class="hd-facts">
          ${[['Type', hd.type], ['Strategy', hd.strategy], ['Authority', hd.authority], ['Profile', hd.profile], ['Definition', hd.definition], ['Signature', hd.signature], ['Not-self theme', hd.notSelf], ['Cross', `${hd.cross.angle} (${hd.cross.gates})`]]
            .map(([k, v]) => `<div class="fact"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}
        </div>
      </div>
      <div class="tabs2" id="hdTabs"><button data-h="core" class="on">The essentials</button><button data-h="centers">Centers and channels</button><button data-h="gates">Gates</button><button data-h="exp">Experiments</button></div>
      <div class="hd-sec" data-h="core">
        ${item('type', `Type: ${hd.type}`, TYPE[hd.type])}
        ${item('strategy', `Strategy: ${hd.strategy}`, STRATEGY_TXT[hd.strategy])}
        ${item('authority', `Authority: ${hd.authority}`, AUTH[hd.authority])}
        ${item('profile', `Profile: ${hd.profile}`, `${LINE[p[0]]} ${LINE[p[1]]}`)}
        ${item('signature', `Signature: ${hd.signature}. Not-self: ${hd.notSelf}`, `Feeling ${hd.signature.toLowerCase()} is the sign you are living your design. Feeling ${hd.notSelf.toLowerCase()} is the signal you have drifted from it.`)}
      </div>
      <div class="hd-sec hidden" data-h="centers">
        ${Object.keys(CENTER).map(c => { const on = hd.definedCenters.includes(c); return item(`center:${c}`, `${c}: ${on ? 'defined' : 'open'}`, CENTER[c][on ? 0 : 1]); }).join('')}
        ${hd.channels.map(ch => item(`channel:${ch.gates.join('-')}`, `Channel ${ch.gates.join('-')}: ${ch.name}`, `A fixed connection between your ${ch.centers[0]} and ${ch.centers[1]} centers: a reliable part of who you are.`)).join('')}
      </div>
      <div class="hd-sec hidden" data-h="gates">
        <p class="note">Personality is your conscious side (birth). Design is your unconscious side (88° earlier).</p>
        <table class="cv-table hd-gates"><thead><tr><th>Planet</th><th>Personality</th><th>Design</th></tr></thead><tbody>
          ${hd.personality.map((a, i) => `<tr><td>${a.body}</td><td>${a.gate}.${a.line}</td><td>${hd.design[i].gate}.${hd.design[i].line}</td></tr>`).join('')}
        </tbody></table>
        <p class="note">Gates not in a channel (hanging gates): ${hd.hangingGates.join(', ') || 'none'}. Ask about any gate in the chat below.</p>
      </div>
      <div class="hd-sec hidden" data-h="exp">
        <p class="sub">Human Design asks you to test it in your own life. Pick an experiment and check in each day.</p>
        ${experimentList().map(expHtml).join('')}
      </div>`;
    bind();
  }

  function bind() {
    const pane = $('hdPane');
    pane.querySelectorAll('#hdTabs button').forEach(b => b.onclick = () => showSec(b.dataset.h));
    pane.querySelectorAll('.bg-g').forEach(g => {
      const go = () => { showSec('centers'); const el = $('hd-' + g.dataset.item.replace(/[^a-z0-9]/gi, '-')); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); } };
      g.onclick = go; g.onkeydown = e => { if (e.key === 'Enter') go(); };
    });
    pane.querySelectorAll('.rx').forEach(b => b.onclick = () => {
      const r = react[b.dataset.id] = react[b.dataset.id] || {};
      r.r = r.r === b.dataset.v ? undefined : b.dataset.v; save(key + '.react', react); rerender(b.dataset.id);
    });
    pane.querySelectorAll('.rxnote').forEach(b => b.onclick = () => { const e = pane.querySelector(`.rx-edit[data-id="${CSS.escape(b.dataset.id)}"]`); e.classList.toggle('hidden'); e.querySelector('input').focus(); });
    pane.querySelectorAll('.rxsave').forEach(b => b.onclick = () => {
      const v = pane.querySelector(`.rx-edit[data-id="${CSS.escape(b.dataset.id)}"] input`).value.trim();
      const r = react[b.dataset.id] = react[b.dataset.id] || {}; r.note = v; save(key + '.react', react); rerender(b.dataset.id);
    });
    pane.querySelectorAll('.exstart').forEach(b => b.onclick = () => { exps[b.dataset.id] = { start: Date.now(), log: [] }; save(key + '.exp', exps); rerender(); showSec('exp'); });
    pane.querySelectorAll('.excheck').forEach(b => b.onclick = () => {
      const v = pane.querySelector(`.exin[data-id="${b.dataset.id}"]`).value.trim(); if (!v) return;
      exps[b.dataset.id].log.push({ t: Date.now(), text: v }); save(key + '.exp', exps); rerender(); showSec('exp');
    });
    pane.querySelectorAll('.exstop').forEach(b => b.onclick = () => { delete exps[b.dataset.id]; save(key + '.exp', exps); rerender(); showSec('exp'); });
  }
  function rerender() { const open = $('hdTabs').querySelector('.on').dataset.h, y = window.scrollY; render(); showSec(open); window.scrollTo(0, y); }
  function showSec(h) {
    $('hdTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.h === h));
    $('hdPane').querySelectorAll('.hd-sec').forEach(s => s.classList.toggle('hidden', s.dataset.h !== h));
  }

  // Short summary for the AI, including the user's own reactions
  function summary() {
    if (!hd) compute();
    const label = { yes: 'feels true', no: 'does not feel true', unsure: 'not sure' };
    const rx = Object.entries(react).filter(([, r]) => r.r || r.note).map(([id, r]) => `${id}: ${r.r ? label[r.r] : ''}${r.note ? ` (note: ${r.note})` : ''}`);
    const ex = Object.entries(exps).map(([id, e]) => `${id} experiment, ${e.log.length} check-ins${e.log.length ? `, latest: ${e.log[e.log.length - 1].text}` : ''}`);
    return { type: hd.type, strategy: hd.strategy, authority: hd.authority, profile: hd.profile, definition: hd.definition,
      signature: hd.signature, notSelf: hd.notSelf, definedCenters: hd.definedCenters, channels: hd.channels.map(c => `${c.gates.join('-')} ${c.name}`),
      cross: `${hd.cross.angle} ${hd.cross.gates}`, reactions: rx, experiments: ex };
  }

  return { render, summary, get: () => hd || compute() };
})();
