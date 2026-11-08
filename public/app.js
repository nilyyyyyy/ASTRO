// Trine front end. Birth data once, then three tools: My chart (chart.js), Cards, and Decide
// (decision -> optional reflect in reflect.js -> cards -> reading).
// All astrology is calculated in the browser; only text goes to the AI endpoints.
const $ = id => document.getElementById(id);
const ELEMENT_COLORS = { Wood:'#3E9A5B', Fire:'#D2553F', Earth:'#B5873C', Metal:'#8D93A6', Water:'#2F79C9' };
const COLORS = { Sun:'#C98A00', Moon:'#7A8299', Mercury:'#12857A', Venus:'#C2457A', Mars:'#C8402F', Jupiter:'#6A45C9',
  Saturn:'#8A7A4A', Uranus:'#1F7FC4', Neptune:'#3E55C7', Pluto:'#8C3C89' };
const POSITIONS = ['Situation', 'Challenge', 'Guidance'];

const state = { birthPlace: null, chart: null, saju: null, places: [], decision: '', cards: [], usage: [], decideStep: 0 };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- helpers ----------
async function geocode(q) {
  const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=5&language=en&name=' + encodeURIComponent(q.split(',')[0].trim()));
  const j = await r.json();
  return (j.results || []).map(x => ({ label: [x.name, x.admin1, x.country].filter(Boolean).join(', '), lat: x.latitude, lon: x.longitude, tz: x.timezone }));
}
function attachSearch(inputId, resultsId, onPick) {
  const input = $(inputId), box = $(resultsId); let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      if (input.value.trim().length < 2) { box.innerHTML = ''; return; }
      try {
        const res = await geocode(input.value); box.innerHTML = '';
        if (!res.length) box.innerHTML = '<div>No place found. Try the city name only.</div>';
        res.forEach(p => { const d = document.createElement('div'); d.textContent = p.label; d.onclick = () => { box.innerHTML = ''; onPick(p, input); }; box.appendChild(d); });
      } catch (e) { box.innerHTML = '<div>Place search is unavailable right now.</div>'; }
    }, 300);
  });
}

async function api(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  state.usage.push(...(j.usage || []).filter(Boolean));
  renderCost(j.mock);
  return j;
}

function profilePayload(places = state.places) {
  const c = state.chart, now = new Date();
  return {
    ascendant: `${c.ascendant.sign} ${c.ascendant.degree}°`, midheaven: `${c.midheaven.sign} ${c.midheaven.degree}°`,
    planets: c.planets.map(p => ({ name: p.name, sign: p.sign, degree: p.degree, house: p.house })),
    saju: state.saju,
    currentYearPillar: (() => { const y = AstroEngine.saju(now.getFullYear(), now.getMonth() + 1, now.getDate(), 12, 0).pillars[0]; return `${y.hanja} ${y.polarity} ${y.stemElement} ${y.animal}`; })(),
    places: places.map(p => ({ label: p.label, lines: AstroEngine.linesNearCity(c, p.lat, p.lon, 700) }))
  };
}

// ---------- birth data ----------
attachSearch('place', 'placeResults', (p, input) => { state.birthPlace = p; input.value = p.label; });
$('calc').onclick = async () => {
  try {
    $('status1').textContent = 'Calculating your chart…';
    if (!state.birthPlace) { const r = await geocode($('place').value); if (!r.length) throw new Error('Birth place not found. Try the city name only.'); state.birthPlace = r[0]; }
    const [y, mo, d] = $('date').value.split('-').map(Number);
    const [h, mi] = $('time').value.split(':').map(Number);
    if (!y || isNaN(h)) throw new Error('Add your birth date and time.');
    const utc = AstroEngine.localToUTC(y, mo, d, h, mi, state.birthPlace.tz);
    state.chart = AstroEngine.westernChart(utc, state.birthPlace.lat, state.birthPlace.lon);
    state.saju = AstroEngine.saju(y, mo, d, h, mi);
    state.name = $('name').value.trim();
    saveProfile();
    $('status1').textContent = '';
    ChartView.render();
    view('chart');
  } catch (e) { $('status1').textContent = e.message; }
};

// saved profile (this device only)
const PROFILE_KEY = 'trine.profile.v1';
function saveProfile() {
  try {
    if (!$('remember').checked) { localStorage.removeItem(PROFILE_KEY); return; }
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: $('name').value.trim(), date: $('date').value, time: $('time').value, place: state.birthPlace }));
  } catch (e) { /* storage unavailable: the app still works without it */ }
}
function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    if (!p || !p.place) return false;
    $('name').value = p.name || ''; $('date').value = p.date; $('time').value = p.time;
    $('place').value = p.place.label; state.birthPlace = p.place;
    return true;
  } catch (e) { return false; }
}

// ---------- views ----------
const VIEWS = { chart: 'chartView', cards: 'cardsView', decide: 'decideView' };
function view(name) {
  $('birth').classList.add('hidden'); $('support').classList.add('hidden');
  $('nav').classList.remove('hidden');
  Object.entries(VIEWS).forEach(([k, id]) => $(id).classList.toggle('hidden', k !== name));
  document.querySelectorAll('#nav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === name));
  if (name === 'decide') step(state.decideStep || 2);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('#nav [data-v]').forEach(b => b.onclick = () => view(b.dataset.v));
document.querySelectorAll('[data-go="chart"]').forEach(b => b.onclick = () => view('chart'));
document.querySelectorAll('[data-to]').forEach(b => b.onclick = () => step(+b.dataset.to));
$('editBirth').onclick = () => {
  state.decideStep = 0;
  Object.values(VIEWS).forEach(id => $(id).classList.add('hidden'));
  $('nav').classList.add('hidden'); $('birth').classList.remove('hidden');
};

// ---------- shared: tarot card table ----------
function dealCards(containerId, cards, onAllTurned) {
  const box = $(containerId);
  box.classList.toggle('one', cards.length === 1);
  box.innerHTML = cards.map((c, i) => `<div><div class="card" data-i="${i}" tabindex="0" role="button" aria-label="Turn card ${i + 1}"><div class="inner"><div class="face back"></div>
    <div class="face front"><div class="nm">${esc(c.name)}</div>${c.reversed ? '<div class="rv">Reversed</div>' : ''}<div class="kw">${esc(c.reversed ? c.reversed_kw : c.upright)}</div></div></div></div>
    <div class="pos">${c.position}</div></div>`).join('');
  box.querySelectorAll('.card').forEach(el => {
    const turn = () => { el.classList.add('flipped'); onAllTurned(!box.querySelector('.card:not(.flipped)')); };
    el.onclick = turn; el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); turn(); } };
  });
  onAllTurned(false);
}

// ---------- CARDS tool ----------
let tCount = 3, tCards = [];
$('tSpread').querySelectorAll('button').forEach(b => b.onclick = () => {
  tCount = +b.dataset.n;
  $('tSpread').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
});
$('tDraw').onclick = () => {
  tCards = Tarot.draw(tCount, tCount === 1 ? ['Your card'] : ['Past', 'Present', 'Next']);
  $('tReading').classList.add('hidden'); $('tStatus').textContent = '';
  $('tTable').classList.remove('hidden');
  dealCards('tCards', tCards, all => { $('tRead').disabled = !all; });
  $('tDraw').textContent = 'Draw again';
  $('tTable').scrollIntoView({ behavior: 'smooth', block: 'start' });
};
$('tRead').onclick = async () => {
  $('tRead').disabled = true; $('tStatus').textContent = 'Reading your cards…';
  try {
    const q = $('tQuestion').value.trim();
    const r = await api('/api/tarot', { profile: profilePayload([]), question: q, cards: tCards });
    if (r.support) return showSupport(r.message);
    $('tReading').innerHTML = `${q ? `<p class="question">${esc(q)}</p>` : ''}<p class="headline">${esc(r.summary)}</p>` +
      (r.cards || []).map((c, i) => `<div class="lens"><b>${esc(c.position || tCards[i]?.position || '')}: ${esc(tCards[i]?.name || '')}</b>${esc(c.reading)}</div>`).join('') +
      (r.reflect ? `<div class="lens k"><b>Something to sit with</b>${esc(r.reflect)}</div>` : '') +
      `<div class="btnrow"><button class="ghost" id="tToDecide">Turn this into a decision</button></div>`;
    $('tReading').classList.remove('hidden'); $('tStatus').textContent = '';
    $('tToDecide').onclick = () => { if (q) $('decision').value = q; state.decideStep = 2; view('decide'); };
    $('tReading').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { $('tStatus').textContent = 'The reading did not load: ' + e.message + '. Try again.'; $('tRead').disabled = false; }
};

// ---------- DECIDE ----------
function step(n) {
  state.decideStep = n;
  ['s2', 's3', 's4', 's5'].forEach((id, i) => $(id).classList.toggle('hidden', i + 2 !== n));
  $('support').classList.add('hidden');
  document.querySelectorAll('#progress span').forEach(s => { const k = +s.dataset.s; s.classList.toggle('on', k === n); s.classList.toggle('done', k < n); });
  if (n === 4) $('toReading').disabled = !state.cards.length || !!$('cards').querySelector('.card:not(.flipped)');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

attachSearch('cityQ', 'cityResults', (p, input) => { state.places.push(p); input.value = ''; renderPlaces(); });
function renderPlaces() {
  $('placeChips').innerHTML = state.places.map((p, i) => {
    const near = AstroEngine.linesNearCity(state.chart, p.lat, p.lon, 700);
    const top = near.slice(0, 2).map(n => `${n.planet} ${n.angle}`).join(', ') || 'neutral for you';
    return `<div class="chip">${esc(p.label.split(',')[0])}: <b>${top}</b><span class="x" data-i="${i}" role="button" aria-label="Remove">✕</span></div>`;
  }).join('');
  $('placeChips').querySelectorAll('.x').forEach(x => x.onclick = () => { state.places.splice(+x.dataset.i, 1); renderPlaces(); });
  $('map').classList.toggle('hidden', !state.places.length);
  if (state.places.length) renderMap('map', state.places);
}

let land = null;
const X = lon => (lon + 180) / 360 * 1000, Y = lat => (90 - lat) / 180 * 500;
async function renderMap(svgId, places) {
  if (!land) { try { const t = await (await fetch('/vendor/land.json')).json(); land = topojson.feature(t, t.objects.land); } catch (e) { land = { features: [] }; } }
  let svg = '';
  (land.features || []).forEach(f => {
    const g = f.geometry; if (!g) return;
    (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach(poly => poly.forEach(ring => {
      let d = '', prev = null;
      ring.forEach(([lo, la]) => { d += (prev === null || Math.abs(lo - prev) > 180 ? 'M' : 'L') + X(lo).toFixed(1) + ',' + Y(la).toFixed(1); prev = lo; });
      svg += `<path d="${d}Z" fill="#E3E7F0" stroke="#CDD3E1" stroke-width=".5"/>`;
    }));
  });
  AstroEngine.cartoLines(state.chart, { latStep: 1 }).forEach(l => {
    let d = '', prev = null;
    l.points.forEach(([la, lo]) => { d += (prev === null || Math.abs(lo - prev) > 180 ? 'M' : 'L') + X(lo).toFixed(1) + ',' + Y(la).toFixed(1); prev = lo; });
    const dash = l.angle === 'DSC' ? '6 4' : l.angle === 'IC' ? '2 4' : '';
    svg += `<path d="${d}" fill="none" stroke="${COLORS[l.planet]}" stroke-width="${l.planet === 'Venus' ? 2.4 : 1.2}" stroke-dasharray="${dash}" opacity=".9"><title>${l.planet} ${l.angle}</title></path>`;
  });
  places.forEach(p => { svg += `<circle cx="${X(p.lon)}" cy="${Y(p.lat)}" r="5" fill="#1C2340" stroke="#fff" stroke-width="2"><title>${esc(p.label)}</title></circle>`; });
  $(svgId).innerHTML = svg;
}

$('toReflect').onclick = () => {
  const d = $('decision').value.trim();
  if (d.length < 5) { $('status2').textContent = 'Describe your decision in a sentence or two.'; return; }
  $('status2').textContent = '';
  if (d !== state.decision) { state.decision = d; state.cards = []; Reflect.reset(); }
  step(3);
};

function drawDecisionCards() {
  if (!state.cards.length) {
    state.cards = Tarot.draw(3, POSITIONS);
    dealCards('cards', state.cards, all => { $('toReading').disabled = !all; });
  }
  step(4);
}
$('skipToCards').onclick = drawDecisionCards;

$('toReading').onclick = async () => {
  $('toReading').disabled = true; $('status4').textContent = 'Reading your three lenses together…';
  try {
    const r = await api('/api/reading', { profile: profilePayload(), decision: state.decision, kind: Reflect.kind(),
      answers: Reflect.answers(), notes: Reflect.notes(), cards: state.cards });
    if (r.support) return showSupport(r.message);
    $('reading').innerHTML = `<p class="question">${esc(state.decision)}</p><p class="headline">${esc(r.headline)}</p>
      <div class="lens"><b>When: saju</b>${esc(r.when)}</div>
      <div class="lens"><b>Where: your map</b>${esc(r.where)}</div>
      <div class="lens"><b>Now: ${esc(state.cards.map(c => c.name + (c.reversed ? ' (reversed)' : '')).join(', '))}</b>${esc(r.now)}</div>
      <div class="lens k"><b>Where it all agrees</b>${esc(r.agree)}</div>
      <div class="lens k"><b>The real tension</b>${esc(r.tension)}</div>
      <div class="lens k"><b>One next step</b>${esc(r.next_step)}</div>
      <div class="lens k"><b>Gut check</b>${esc(r.gut_check)}</div>
      <p class="note" style="margin-top:14px">This reading is for reflection. The decision is yours.</p>`;
    $('status4').textContent = '';
    step(5);
  } catch (e) { $('status4').textContent = 'The reading did not load: ' + e.message + '. Try again.'; $('toReading').disabled = false; }
};

$('newDecision').onclick = () => {
  state.decision = ''; state.places = []; state.cards = []; $('decision').value = '';
  Reflect.reset(); renderPlaces(); step(2);
};

function showSupport(msg) {
  Object.values(VIEWS).forEach(id => $(id).classList.add('hidden'));
  $('supportMsg').textContent = msg;
  $('support').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCost(mock) {
  const rows = state.usage.map(u => `<tr><td>${esc(u.model)}</td><td>${u.input} in</td><td>${u.output} out</td><td>${u.cost == null ? '–' : '$' + u.cost.toFixed(5)}${u.estimated ? ' (est.)' : ''}</td></tr>`).join('');
  const total = state.usage.reduce((s, u) => s + (u.cost || 0), 0);
  $('costTable').innerHTML = `<table>${rows}<tr><td>Total</td><td></td><td></td><td>$${total.toFixed(4)}</td></tr></table>` +
    (mock ? '<p>Mock mode: no AI calls were made, so the AI text is placeholder text. Add an OpenRouter key to get real readings.</p>' : '');
  $('usage').classList.remove('hidden');
}

// Returning visitor: open their chart straight away (after all scripts have loaded)
window.addEventListener('load', () => { if (loadProfile()) $('calc').click(); });
