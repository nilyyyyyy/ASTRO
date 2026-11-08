// "My chart" frame: chart wheel, full placements, saju with meanings, astrocartography and a chat about your chart.
const ChartView = (() => {
  const GLYPH = { Sun:'☉', Moon:'☽', Mercury:'☿', Venus:'♀', Mars:'♂', Jupiter:'♃', Saturn:'♄', Uranus:'♅', Neptune:'♆', Pluto:'♇', 'North Node':'☊', 'South Node':'☋' };
  const SIGN_GLYPH = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'].map(g => g + '\uFE0E'); // text style, not emoji
  const PLANET = { Sun:'who you are at the core', Moon:'your emotions and what makes you feel safe', Mercury:'how you think and communicate',
    Venus:'how you love, what you find beautiful', Mars:'your drive and how you go after things', Jupiter:'where you grow and find luck',
    Saturn:'where you learn discipline and patience', Uranus:'where you need freedom and change', Neptune:'your dreams and intuition',
    Pluto:'where you transform and hold power', 'North Node':'the direction your life is pulling you', 'South Node':'your comfort zone, what to grow beyond' };
  const SIGN = { Aries:'bold, direct, pioneering', Taurus:'steady, sensual, loyal', Gemini:'curious, quick, sociable', Cancer:'nurturing, protective, sensitive',
    Leo:'warm, expressive, proud', Virgo:'precise, helpful, analytical', Libra:'harmonious, fair, charming', Scorpio:'intense, deep, private',
    Sagittarius:'free, optimistic, meaning-seeking', Capricorn:'ambitious, disciplined, practical', Aquarius:'original, independent, idealistic', Pisces:'dreamy, empathetic, intuitive' };
  const HOUSE = ['', 'self and appearance', 'money and values', 'communication and daily life', 'home and roots', 'creativity, romance and play',
    'work routines and health', 'partnerships', 'intimacy and shared resources', 'travel, study and beliefs', 'career and public image', 'friends and community', 'inner life and rest'];
  const DAY_MASTER = {
    'Yang Wood': 'a tall tree: upright, principled, growing steadily towards the light.', 'Yin Wood': 'a flower or vine: flexible, graceful, always finding a way around obstacles.',
    'Yang Fire': 'the sun: warm, generous and hard to miss.', 'Yin Fire': 'a candle: focused warmth, intuitive, lighting the way for others.',
    'Yang Earth': 'a mountain: stable, reliable, protective of the people around you.', 'Yin Earth': 'garden soil: nurturing, adaptable, quietly productive.',
    'Yang Metal': 'raw steel: decisive, strong-willed, with a strong sense of justice.', 'Yin Metal': 'a jewel: refined, precise, drawn to beauty and quality.',
    'Yang Water': 'the ocean: expansive, adventurous, wise.', 'Yin Water': 'rain or morning dew: gentle, intuitive, quietly persistent.' };
  const PILLAR = { Year: 'roots and family background; how others first see you', Month: 'career, parents and the world you grew up in',
    Day: 'you (your Day Master) and your closest partner', Hour: 'inner wishes, children and later life' };
  const ELEMENT = { Wood: 'growth and creativity', Fire: 'passion and expression', Earth: 'stability and trust', Metal: 'structure and decisiveness', Water: 'wisdom and adaptability' };
  const GEN = { Wood: 'Fire', Fire: 'Earth', Earth: 'Metal', Metal: 'Water', Water: 'Wood' };   // generating cycle
  const CTRL = { Wood: 'Earth', Earth: 'Water', Water: 'Fire', Fire: 'Metal', Metal: 'Wood' };  // controlling cycle
  const ANGLE = { ASC: 'in how you come across', DSC: 'in relationships and partners', MC: 'in career and public image', IC: 'in home and private life' };
  const STARTERS = ['What does my Day Master mean for me?', 'Why is my element balance like this?', 'What do my Sun, Moon and Rising say together?', 'Where in the world do I look my best?'];

  let places = [], chat = [], busy = false;

  // ---------- Western chart wheel ----------
  function wheel(c) {
    const cx = 160, cy = 160, R = 150, r1 = 122, r2 = 92;
    const asc = c.ascendant.lon;
    const pt = (lon, r) => { const t = (180 + (lon - asc)) * Math.PI / 180; return [cx + r * Math.cos(t), cy - r * Math.sin(t)]; };
    let s = `<circle cx="${cx}" cy="${cy}" r="${R}" class="w-outer"/><circle cx="${cx}" cy="${cy}" r="${r1}" class="w-ring"/><circle cx="${cx}" cy="${cy}" r="${r2}" class="w-ring"/>`;
    const ascSign = Math.floor(asc / 30);
    for (let i = 0; i < 12; i++) {
      const [x1, y1] = pt(i * 30, r2), [x2, y2] = pt(i * 30, R);
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="w-tick"/>`;
      const [gx, gy] = pt(i * 30 + 15, (R + r1) / 2);
      s += `<text x="${gx}" y="${gy}" class="w-sign">${SIGN_GLYPH[i]}</text>`;
      const [hx, hy] = pt(i * 30 + 15, r2 - 14);
      s += `<text x="${hx}" y="${hy}" class="w-house">${((i - ascSign + 12) % 12) + 1}</text>`;
    }
    // ascendant / MC axes
    const [ax, ay] = pt(asc, R + 2), [dx, dy] = pt(asc + 180, R + 2), [mx, my] = pt(c.midheaven.lon, R + 2), [ix, iy] = pt(c.midheaven.lon + 180, R + 2);
    s += `<line x1="${ax}" y1="${ay}" x2="${dx}" y2="${dy}" class="w-axis"/><line x1="${mx}" y1="${my}" x2="${ix}" y2="${iy}" class="w-axis"/>`;
    s += `<text x="${ax - 4}" y="${ay - 6}" class="w-lbl" text-anchor="end">ASC</text><text x="${mx}" y="${my - 6}" class="w-lbl">MC</text>`;
    // planets, nudged inward when close together
    const sorted = c.planets.filter(p => p.name !== 'South Node').slice().sort((a, b) => a.lon - b.lon);
    let prev = -99, lane = 0;
    sorted.forEach(p => {
      lane = p.lon - prev < 7 ? (lane + 1) % 3 : 0; prev = p.lon;
      const [x, y] = pt(p.lon, r1 - 14 - lane * 15), [tx, ty] = pt(p.lon, r1);
      s += `<line x1="${tx}" y1="${ty}" x2="${pt(p.lon, r1 - 5)[0]}" y2="${pt(p.lon, r1 - 5)[1]}" class="w-tick"/>`;
      s += `<text x="${x}" y="${y}" class="w-planet" fill="${COLORS[p.name] || '#bbb'}"><title>${p.name} ${p.sign} ${p.degree}°</title>${GLYPH[p.name]}\uFE0E</text>`;
    });
    return `<svg viewBox="-34 -16 388 352" class="wheel">${s}</svg>`;
  }

  // ---------- saju helpers ----------
  function yearRelation(dmEl, yearEl) {
    if (dmEl === yearEl) return ['Companion year', 'Same element as you: a year of peers, independence and some competition.'];
    if (GEN[yearEl] === dmEl) return ['Resource year', 'This year\'s energy feeds yours: support, learning and people backing you.'];
    if (GEN[dmEl] === yearEl) return ['Expression year', 'You pour your energy outward: creativity, visibility and new projects.'];
    if (CTRL[dmEl] === yearEl) return ['Wealth year', 'You shape this year\'s energy: opportunities where effort turns into results.'];
    return ['Pressure year', 'This year\'s energy challenges yours: responsibility, structure and recognition through discipline.'];
  }

  // ---------- render ----------
  function render() {
    const c = state.chart, s = state.saju, f = p => `${p.sign} ${p.degree}°`;
    const sun = c.planets.find(p => p.name === 'Sun'), moon = c.planets.find(p => p.name === 'Moon');
    const dm = s.pillars[2], dmKey = `${dm.polarity} ${dm.stemElement}`;
    const now = new Date(), yp = AstroEngine.saju(now.getFullYear(), now.getMonth() + 1, now.getDate(), 12, 0).pillars[0];
    const [relTitle, relText] = yearRelation(dm.stemElement, yp.stemElement);
    const bal = s.elementBalance, max = Math.max(...Object.values(bal), 1);
    const strong = Object.keys(bal).filter(k => bal[k] >= 3), missing = Object.keys(bal).filter(k => bal[k] === 0);

    $('chartView').innerHTML = `
      <div class="panel cv-hero">
        <div class="cv-hero-text">
          <h2>${state.name ? esc(state.name) + '\'s sky' : 'Your sky'}</h2>
          <p class="sub" style="margin:0 0 12px">Born ${esc(new Date($('date').value + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))} at ${esc($('time').value)} in ${esc(state.birthPlace.label)}</p>
          <div class="chips"><div class="chip">Sun <b>${f(sun)}</b></div><div class="chip">Moon <b>${f(moon)}</b></div><div class="chip">Rising <b>${f(c.ascendant)}</b></div><div class="chip">Day master <b>${dmKey}</b></div></div>
          <p class="cv-big3">Your <b>Sun in ${sun.sign}</b> is ${PLANET.Sun}: ${SIGN[sun.sign]}. Your <b>Moon in ${moon.sign}</b> shows ${PLANET.Moon}: ${SIGN[moon.sign]}. With <b>${c.ascendant.sign} rising</b>, people first meet someone ${SIGN[c.ascendant.sign]}.</p>
          <button id="cvToChat" class="ghost">Ask about your chart</button>
        </div>
        <div class="cv-wheel">${wheel(c)}</div>
      </div>

      <div class="tabs2" id="cvTabs"><button data-t="western" class="on">Birth chart</button><button data-t="saju">Saju</button><button data-t="map">Where on Earth</button></div>

      <div class="panel cv-pane" data-t="western">
        <h2>Birth chart</h2>
        <table class="cv-table"><thead><tr><th></th><th>Placement</th><th>House</th><th>What it says</th></tr></thead><tbody>
          <tr><td class="g">↑</td><td><b>Rising ${f(c.ascendant)}</b></td><td>1</td><td>The first impression you give: ${SIGN[c.ascendant.sign]}.</td></tr>
          <tr><td class="g">⌃</td><td><b>Midheaven ${f(c.midheaven)}</b></td><td>${c.midheaven.house}</td><td>Your public path and calling: ${SIGN[c.midheaven.sign]}.</td></tr>
          ${c.planets.map(p => `<tr><td class="g" style="color:${COLORS[p.name] || 'var(--muted)'}">${GLYPH[p.name]}</td><td><b>${p.name}</b> ${f(p)}</td><td>${p.house}</td>
            <td>${cap(PLANET[p.name])}: ${SIGN[p.sign]}, showing up in ${HOUSE[p.house]}.</td></tr>`).join('')}
        </tbody></table>
        <p class="note">Tropical zodiac, whole-sign houses, mean lunar node.</p>
      </div>

      <div class="panel cv-pane hidden" data-t="saju">
        <h2>Saju: your four pillars</h2>
        <div class="cv-pillars">${s.pillars.map(p => `<div class="cv-pillar ${p.pillar === 'Day' ? 'me' : ''}">
          <small>${p.pillar}${p.pillar === 'Day' ? ' (you)' : ''}</small><div class="hz">${p.hanja}</div>
          <div class="el" style="color:${ELEMENT_COLORS[p.stemElement]}">${p.polarity} ${p.stemElement}</div><div class="el" style="color:${ELEMENT_COLORS[p.branchElement]}">${p.animal}, ${p.branchElement}</div>
          <p>${PILLAR[p.pillar]}</p></div>`).join('')}</div>
        <div class="cv-dm"><b>Day master: ${dmKey} (${dm.stem})</b><p>Your core self is like ${DAY_MASTER[dmKey]}</p></div>
        <div class="grid2" style="margin-top:14px">
          <div><h3>Element balance</h3>${Object.entries(bal).map(([k, v]) => `<div class="bar"><span>${k}</span><i style="width:${Math.max(v / max * 70, 2)}%;background:${ELEMENT_COLORS[k]}"></i><span>${v}</span></div>`).join('')}
            <p class="note" style="margin-top:8px">${strong.length ? `Strong: ${strong.map(k => `${k} (${ELEMENT[k]})`).join(', ')}. ` : ''}${missing.length ? `Missing: ${missing.map(k => `${k} (${ELEMENT[k]})`).join(', ')}, often something you seek in people and places.` : 'Every element is present.'}</p></div>
          <div><h3>This year: ${yp.hanja} ${yp.polarity} ${yp.stemElement} ${yp.animal}</h3><p style="margin:4px 0"><b style="color:var(--blue)">${relTitle}</b></p><p class="note" style="font-size:14px">${relText}</p></div>
        </div>
      </div>

      <div class="panel cv-pane hidden" data-t="map">
        <h2>Where on Earth</h2>
        <p class="sub">Lines show where each planet was rising, setting, overhead or underfoot when you were born. The thicker pink Venus lines are where you tend to look and feel your best.</p>
        <svg id="chartMap" viewBox="0 0 1000 500" class="map"></svg>
        <div class="legend">${Object.keys(COLORS).map(p => `<span><span class="sw" style="background:${COLORS[p]}"></span>${p}</span>`).join('')}<span>Solid: rising or overhead. Dashed: setting. Dotted: underfoot.</span></div>
        <label for="cvCityQ" style="margin-top:16px">Check a city</label><input id="cvCityQ" placeholder="e.g. London" autocomplete="off"><div class="results" id="cvCityResults"></div>
        <div id="cvCities"></div>
      </div>

      <div class="panel cv-chat" id="cvChat">
        <h2>Ask about your chart</h2>
        <div id="cvLog" class="log"><div class="msg bot">Ask me anything about your chart, your saju or your map. I'll answer from your actual placements.</div></div>
        <div class="chips" id="cvStarters">${STARTERS.map(q => `<button class="chip cv-starter">${esc(q)}</button>`).join('')}</div>
        <div class="row"><input id="cvInput" placeholder="Type your question" maxlength="500" aria-label="Your question"><button class="btn" id="cvSend">Ask</button></div>
      </div>
      <div class="panel" style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap"><div><h3>Facing a decision?</h3><p class="note" style="margin:0">Saju for when, your map for where, tarot for now.</p></div><div class="btnrow" style="margin:0"><button class="ghost" id="cvToCards">Pull cards</button><button class="btn" id="cvToDecide">Start a decision</button></div></div>`;

    $('cvTabs').querySelectorAll('button').forEach(b => b.onclick = () => tab(b.dataset.t));
    $('cvToChat').onclick = () => { $('cvChat').scrollIntoView({ behavior: 'smooth' }); $('cvInput').focus(); };
    $('cvToDecide').onclick = () => view('decide');
    $('cvToCards').onclick = () => view('cards');
    attachSearch('cvCityQ', 'cvCityResults', (p, input) => { places.unshift(p); input.value = ''; renderCities(); });
    $('cvSend').onclick = send;
    $('cvInput').onkeydown = e => { if (e.key === 'Enter') send(); };
    $('cvStarters').querySelectorAll('.cv-starter').forEach(b => b.onclick = () => { $('cvInput').value = b.textContent; send(); });
    places = [state.birthPlace]; chat = [];
    renderCities();
  }

  function tab(t) {
    $('cvTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    document.querySelectorAll('.cv-pane').forEach(p => p.classList.toggle('hidden', p.dataset.t !== t));
    if (t === 'map') renderMap('chartMap', places);
  }

  function renderCities() {
    $('cvCities').innerHTML = places.map((p, i) => {
      const near = AstroEngine.linesNearCity(state.chart, p.lat, p.lon, 700);
      const venus = near.some(n => n.planet === 'Venus');
      return `<div class="city"><h3>${esc(p.label)}${i === places.length - 1 && p === state.birthPlace ? ' <span class="note">(where you were born)</span>' : ''}</h3>` +
        (near.length ? near.map(n => `<span class="tag ${n.planet === 'Venus' ? 'venus' : ''}"><b style="color:${COLORS[n.planet]}">${n.planet} ${n.angle}</b>, ${n.km} km away</span>`).join('') +
          `<div class="note" style="margin-top:6px">${near.slice(0, 3).map(n => `${n.planet} ${n.angle}: ${PLANET[n.planet]} ${ANGLE[n.angle]}.`).join(' ')}</div>` +
          (venus ? '<div class="note" style="color:var(--rose);margin-top:4px">Venus line nearby: one of the places where you look your best.</div>' : '')
          : '<span class="note">No planet lines within 700 km: a neutral, blank-page place for you.</span>') + '</div>';
    }).join('');
    if (!$('chartMap').closest('.cv-pane').classList.contains('hidden')) renderMap('chartMap', places);
  }

  // ---------- chat ----------
  function addMsg(role, text) {
    const d = document.createElement('div');
    d.className = 'msg ' + (role === 'user' ? 'me' : 'bot');
    d.textContent = text;
    $('cvLog').appendChild(d); $('cvLog').scrollTop = $('cvLog').scrollHeight;
    return d;
  }
  async function send() {
    const q = $('cvInput').value.trim();
    if (!q || busy) return;
    busy = true; $('cvInput').value = ''; $('cvSend').disabled = true;
    $('cvStarters').classList.add('hidden');
    addMsg('user', q); chat.push({ role: 'user', content: q });
    const wait = addMsg('bot', 'Reading your chart…'); wait.classList.add('typing');
    try {
      const r = await api('/api/chat', { profile: profilePayload(places), messages: chat });
      const text = r.support ? r.message : r.reply;
      wait.classList.remove('typing'); wait.textContent = text;
      chat.push({ role: 'assistant', content: text });
    } catch (e) { wait.classList.remove('typing'); wait.textContent = 'Sorry, I could not answer just now (' + e.message + ').'; chat.pop(); }
    finally { busy = false; $('cvSend').disabled = false; $('cvLog').scrollTop = $('cvLog').scrollHeight; }
  }

  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  return { render };
})();
