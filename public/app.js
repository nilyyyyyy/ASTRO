// Front-end: birth input -> two views: My chart (chart.js) and Decide (decision -> reflection game in reflect.js -> tarot -> reading).
// All astrology is calculated here in the browser; only text goes to the AI endpoints.
const $ = id => document.getElementById(id);
const ELEMENT_COLORS = { Wood:'#6fcf8a', Fire:'#ef6b5b', Earth:'#d6a96a', Metal:'#c9cbd6', Water:'#5aa9f0' };
const COLORS = { Sun:'#f5c542', Moon:'#d9dff2', Mercury:'#7fd1c7', Venus:'#e98fc4', Mars:'#ef5b5b', Jupiter:'#9b7bff',
  Saturn:'#a89f7a', Uranus:'#4fb3ff', Neptune:'#5d7cf0', Pluto:'#b35bb0' };
const POSITIONS = ['Situation', 'Challenge', 'Guidance'];

const state = { birthPlace: null, chart: null, saju: null, places: [], decision: '', kind: 'other', questions: [], cards: [], usage: [] };

// ---------- helpers ----------
function step(n) {
  state.decideStep = n;
  if (n === 4) $('toReading').disabled = !!$('cards').querySelector('.card:not(.flipped)');
  document.querySelectorAll('#steps span').forEach(s => s.classList.toggle('on', +s.dataset.s === n));
  ['s2', 's3', 's4', 's5'].forEach((id, i) => $(id).classList.toggle('hidden', i + 2 !== n));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
        res.forEach(p => { const d = document.createElement('div'); d.textContent = p.label; d.onclick = () => { box.innerHTML = ''; onPick(p, input); }; box.appendChild(d); });
      } catch (e) { box.innerHTML = '<div>Place search unavailable</div>'; }
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
  const c = state.chart;
  const now = new Date();
  return {
    ascendant: `${c.ascendant.sign} ${c.ascendant.degree}°`, midheaven: `${c.midheaven.sign} ${c.midheaven.degree}°`,
    planets: c.planets.map(p => ({ name: p.name, sign: p.sign, degree: p.degree, house: p.house })),
    saju: state.saju,
    currentYearPillar: (() => { const y = AstroEngine.saju(now.getFullYear(), now.getMonth() + 1, now.getDate(), 12, 0).pillars[0]; return `${y.hanja} ${y.polarity} ${y.stemElement} ${y.animal}`; })(),
    places: places.map(p => ({ label: p.label, lines: AstroEngine.linesNearCity(c, p.lat, p.lon, 700) }))
  };
}

// ---------- step 1: birth ----------
attachSearch('place', 'placeResults', (p, input) => { state.birthPlace = p; input.value = p.label; });
$('calc').onclick = async () => {
  try {
    $('status1').textContent = 'Calculating…';
    if (!state.birthPlace) { const r = await geocode($('place').value); if (!r.length) throw new Error('Place not found'); state.birthPlace = r[0]; }
    const [y, mo, d] = $('date').value.split('-').map(Number);
    const [h, mi] = $('time').value.split(':').map(Number);
    const utc = AstroEngine.localToUTC(y, mo, d, h, mi, state.birthPlace.tz);
    state.chart = AstroEngine.westernChart(utc, state.birthPlace.lat, state.birthPlace.lon);
    state.saju = AstroEngine.saju(y, mo, d, h, mi);
    state.name = $('name').value.trim();
    saveProfile();
    $('status1').textContent = '';
    ChartView.render();
    view('chart');
  } catch (e) { $('status1').textContent = 'Error: ' + e.message; }
};

// ---------- saved profile (this device only) ----------
const PROFILE_KEY = 'trine.profile.v1';
function saveProfile() {
  try {
    if (!$('remember').checked) { localStorage.removeItem(PROFILE_KEY); return; }
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: $('name').value.trim(), date: $('date').value, time: $('time').value, place: state.birthPlace }));
  } catch (e) { /* storage unavailable: app still works without it */ }
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

// ---------- back buttons ----------
document.querySelectorAll('.back').forEach(b => b.onclick = () => b.dataset.to === 'chart' ? view('chart') : step(+b.dataset.to));
document.querySelectorAll('[data-go="chart"]').forEach(b => b.onclick = () => view('chart'));
$('newDecision').onclick = () => {
  state.decision = ''; state.places = []; state.cards = []; $('decision').value = '';
  renderPlaces(); step(2);
};

// ---------- views: My chart / Decide ----------
function view(name) {
  $('s1').classList.add('hidden'); $('intro').classList.add('hidden');
  $('tabs').classList.remove('hidden');
  $('chartView').classList.toggle('hidden', name !== 'chart');
  $('decideView').classList.toggle('hidden', name !== 'decide');
  document.querySelectorAll('#tabs [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === name));
  if (name === 'decide' && !state.decideStep) step(2);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('#tabs [data-v]').forEach(b => b.onclick = () => view(b.dataset.v));
$('editBirth').onclick = () => {
  state.decideStep = 0;
  $('chartView').classList.add('hidden'); $('decideView').classList.add('hidden'); $('tabs').classList.add('hidden');
  $('s1').classList.remove('hidden'); $('intro').classList.remove('hidden');
};

// ---------- step 2: decision + places ----------
attachSearch('cityQ', 'cityResults', (p, input) => { state.places.push(p); input.value = ''; renderPlaces(); });
function renderPlaces() {
  $('placeChips').innerHTML = state.places.map((p, i) => {
    const near = AstroEngine.linesNearCity(state.chart, p.lat, p.lon, 700);
    const top = near.slice(0, 2).map(n => `${n.planet} ${n.angle}`).join(', ') || 'neutral';
    return `<div class="chip">${esc(p.label.split(',')[0])} · <b>${top}</b><span class="x" data-i="${i}">✕</span></div>`;
  }).join('');
  $('placeChips').querySelectorAll('.x').forEach(x => x.onclick = () => { state.places.splice(+x.dataset.i, 1); renderPlaces(); });
  $('map').classList.toggle('hidden', !state.places.length);
  if (state.places.length) renderMap('map', state.places);
}

let land = null;
const X = lon => (lon + 180) / 360 * 1000, Y = lat => (90 - lat) / 180 * 500;
async function renderMap(svgId = 'map', places = state.places) {
  if (!land) { try { const t = await (await fetch('/vendor/land.json')).json(); land = topojson.feature(t, t.objects.land); } catch (e) { land = { features: [] }; } }
  let svg = '';
  (land.features || []).forEach(f => {
    const g = f.geometry; if (!g) return;
    (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach(poly => poly.forEach(ring => {
      let d = '', prev = null;
      ring.forEach(([lo, la]) => { d += (prev === null || Math.abs(lo - prev) > 180 ? 'M' : 'L') + X(lo).toFixed(1) + ',' + Y(la).toFixed(1); prev = lo; });
      svg += `<path d="${d}Z" fill="#231f3d" stroke="#3a3460" stroke-width=".5"/>`;
    }));
  });
  AstroEngine.cartoLines(state.chart, { latStep: 1 }).forEach(l => {
    let d = '', prev = null;
    l.points.forEach(([la, lo]) => { d += (prev === null || Math.abs(lo - prev) > 180 ? 'M' : 'L') + X(lo).toFixed(1) + ',' + Y(la).toFixed(1); prev = lo; });
    const dash = l.angle === 'DSC' ? '6 4' : l.angle === 'IC' ? '2 4' : '';
    svg += `<path d="${d}" fill="none" stroke="${COLORS[l.planet]}" stroke-width="${l.planet === 'Venus' ? 2.4 : 1.2}" stroke-dasharray="${dash}" opacity=".85"><title>${l.planet} ${l.angle}</title></path>`;
  });
  places.forEach(p => { svg += `<circle cx="${X(p.lon)}" cy="${Y(p.lat)}" r="5" fill="#fff" stroke="#0e0c1a" stroke-width="2"><title>${esc(p.label)}</title></circle>`; });
  $(svgId).innerHTML = svg;
}

$('toQuestions').onclick = async () => {
  state.decision = $('decision').value.trim();
  if (state.decision.length < 5) { $('status2').textContent = 'Describe your decision in a sentence or two.'; return; }
  $('toQuestions').disabled = true; $('status2').textContent = 'Thinking about your decision…';
  try {
    const r = await api('/api/questions', { profile: profilePayload(), decision: state.decision });
    if (r.support) return showSupport(r.message);
    state.kind = r.kind || 'other';
    state.questions = r.questions || [];
    Reflect.start(state.questions, r.professional);
    $('status2').textContent = '';
    step(3);
  } catch (e) { $('status2').textContent = 'Error: ' + e.message; }
  finally { $('toQuestions').disabled = false; }
};

// ---------- step 3 -> 4: tarot ----------
$('toCards').onclick = () => {
  state.cards = Tarot.draw(3, POSITIONS);
  $('cards').innerHTML = state.cards.map((c, i) => `<div><div class="card" data-i="${i}"><div class="inner"><div class="face back"></div>
    <div class="face front"><div class="nm">${esc(c.name)}</div>${c.reversed ? '<div class="rv">reversed</div>' : ''}<div class="kw">${esc(c.reversed ? c.reversed_kw : c.upright)}</div></div></div></div>
    <div class="pos">${c.position}</div></div>`).join('');
  $('cards').querySelectorAll('.card').forEach(el => el.onclick = () => {
    el.classList.add('flipped');
    $('toReading').disabled = $('cards').querySelectorAll('.card:not(.flipped)').length > 0;
  });
  step(4);
};

// ---------- step 5: reading ----------
$('toReading').onclick = async () => {
  $('toReading').disabled = true; $('status4').textContent = 'Reading your three lenses together…';
  try {
    const r = await api('/api/reading', { profile: profilePayload(), decision: state.decision, kind: state.kind,
      answers: Reflect.answers(), notes: Reflect.notes(), cards: state.cards });
    if (r.support) return showSupport(r.message);
    $('reading').innerHTML = `<p class="note" style="margin:0 0 6px">${esc(state.decision)}</p><p class="headline">${esc(r.headline)}</p>
      <div class="lens"><b>When · Saju</b>${esc(r.when)}</div>
      <div class="lens"><b>Where · Astrocartography</b>${esc(r.where)}</div>
      <div class="lens"><b>Now · Tarot</b>${esc(state.cards.map(c => c.name + (c.reversed ? ' (rev.)' : '')).join(' · '))}<br>${esc(r.now)}</div>
      <div class="lens k"><b>Where it all agrees</b>${esc(r.agree)}</div>
      <div class="lens k"><b>The real tension</b>${esc(r.tension)}</div>
      <div class="lens k"><b>One next step</b>${esc(r.next_step)}</div>
      <div class="lens k"><b>Gut check</b>${esc(r.gut_check)}</div>
      <p class="note" style="margin-top:18px">This reading is for reflection. The decision is yours.</p>`;
    $('status4').textContent = '';
    step(5);
  } catch (e) { $('status4').textContent = 'Error: ' + e.message; $('toReading').disabled = false; }
};

function showSupport(msg) {
  ['s2', 's3', 's4', 's5'].forEach(id => $(id).classList.add('hidden'));
  $('supportMsg').textContent = msg;
  $('support').classList.remove('hidden');
}

function renderCost(mock) {
  const rows = state.usage.map(u => `<tr><td>${esc(u.model)}</td><td>${u.input}</td><td>${u.output}</td><td>${u.cost == null ? '–' : '$' + u.cost.toFixed(5)}${u.estimated ? ' (est.)' : ''}</td></tr>`).join('');
  const total = state.usage.reduce((s, u) => s + (u.cost || 0), 0);
  $('costTable').innerHTML = `<table><tr><th>Model</th><th>Input tokens</th><th>Output tokens</th><th>Cost</th></tr>${rows}
    <tr><td><b>Total</b></td><td></td><td></td><td><b>$${total.toFixed(4)}</b></td></tr></table>` +
    (mock ? '<p class="note">Mock mode: no API calls were made. Token counts are estimates and costs use list prices.</p>' : '');
  $('cost').classList.remove('hidden');
}

// Returning visitor: open their chart straight away (after all scripts have loaded)
window.addEventListener('load', () => { if (loadProfile()) $('calc').click(); });
