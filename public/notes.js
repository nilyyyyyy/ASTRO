// Automatic written notes on each lens (and each city on the map), so nothing needs a question first.
// Each note is written once by the fast model and saved on this device; "Refresh" writes it again.
const Notes = (() => {
  // Well-known cities used to find where the user's lines fall on the map
  const CITIES = [
    ['London', 51.51, -0.13], ['Paris', 48.86, 2.35], ['Berlin', 52.52, 13.40], ['Vienna', 48.21, 16.37], ['Rome', 41.90, 12.50],
    ['Madrid', 40.42, -3.70], ['Lisbon', 38.72, -9.14], ['Barcelona', 41.39, 2.17], ['Amsterdam', 52.37, 4.90], ['Zurich', 47.38, 8.54],
    ['Copenhagen', 55.68, 12.57], ['Stockholm', 59.33, 18.07], ['Athens', 37.98, 23.73], ['Prague', 50.08, 14.44], ['Istanbul', 41.01, 28.98],
    ['Reykjavik', 64.15, -21.94], ['Tbilisi', 41.72, 44.79], ['Dubai', 25.20, 55.27], ['Cairo', 30.04, 31.24], ['Marrakech', 31.63, -7.99],
    ['Cape Town', -33.92, 18.42], ['Nairobi', -1.29, 36.82], ['Lagos', 6.52, 3.38], ['Mumbai', 19.08, 72.88], ['Delhi', 28.61, 77.21],
    ['Bangkok', 13.76, 100.50], ['Singapore', 1.35, 103.82], ['Bali', -8.65, 115.22], ['Hong Kong', 22.32, 114.17], ['Shanghai', 31.23, 121.47],
    ['Seoul', 37.57, 126.98], ['Tokyo', 35.68, 139.69], ['Sydney', -33.87, 151.21], ['Melbourne', -37.81, 144.96], ['Auckland', -36.85, 174.76],
    ['Los Angeles', 34.05, -118.24], ['San Francisco', 37.77, -122.42], ['Vancouver', 49.28, -123.12], ['Mexico City', 19.43, -99.13],
    ['New York', 40.71, -74.01], ['Toronto', 43.65, -79.38], ['Miami', 25.76, -80.19], ['Chicago', 41.88, -87.63], ['Austin', 30.27, -97.74],
    ['Buenos Aires', -34.60, -58.38], ['Sao Paulo', -23.55, -46.63], ['Rio de Janeiro', -22.91, -43.17], ['Lima', -12.05, -77.04], ['Bogota', 4.71, -74.07] ];

  const mem = {}, pending = {};
  const base = () => `trine.notes.v1.${$('date').value}.${$('time').value}.${state.birthPlace.lat}`;
  function get(key) {
    if (mem[key]) return mem[key];
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); if (v) mem[key] = v; return v; } catch (e) { return null; }
  }
  function put(key, v) { mem[key] = v; try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }

  function mapExtra() {
    const rows = CITIES.map(([name, lat, lon]) => {
      const near = AstroEngine.linesNearCity(state.chart, lat, lon, 500);
      return near.length ? `${name}: ${near.map(n => `${n.planet} ${n.angle} ${n.km} km`).join(', ')}` : null;
    }).filter(Boolean);
    return `Cities near their planet lines (within 500 km):\n${rows.join('\n') || 'none'}`;
  }

  // Ask once per key; share the same request if two views ask at the same time
  async function fetchNotes(key, body) {
    if (!pending[key]) pending[key] = api('/api/notes', body).finally(() => { delete pending[key]; });
    const r = await pending[key];
    if (r.notes && r.notes.length) put(key, { headline: r.headline, notes: r.notes });
    return get(key);
  }

  function html(n) {
    return `${n.headline ? `<p class="ai-head">${esc(n.headline)}</p>` : ''}
      <div class="ai-list">${n.notes.map(x => `<div class="ai-note"><b>${esc(x.title)}</b><p>${esc(x.text)}</p></div>`).join('')}</div>
      <div class="ai-foot"><span class="note">Want to go deeper? Ask in the chat below.</span><button class="quiet ai-refresh">Write new notes</button></div>`;
  }

  // Fill the notes box for a lens (western, saju, hd, map)
  async function fill(lens, refresh = false) {
    const key = `${base()}.${lens}`;
    const box = () => document.querySelector(`.ai-notes[data-lens="${lens}"]`);
    if (!box()) return;
    const cached = !refresh && get(key);
    if (cached) return show(box(), cached, lens);
    box().innerHTML = '<p class="note ai-wait">Writing your notes…</p>';
    try {
      const n = await fetchNotes(key, { profile: profilePayload([]), lens, extra: lens === 'map' ? mapExtra() : '' });
      if (box()) n ? show(box(), n, lens) : box().innerHTML = '<p class="note">No notes came back. <button class="quiet ai-retry">Try again</button></p>';
    } catch (e) {
      if (box()) box().innerHTML = `<p class="note">Notes did not load: ${esc(e.message)}. <button class="quiet ai-retry">Try again</button></p>`;
    }
    const r = box() && box().querySelector('.ai-retry'); if (r) r.onclick = () => fill(lens, true);
  }
  function show(el, n, lens) {
    el.innerHTML = html(n);
    el.querySelector('.ai-refresh').onclick = () => fill(lens, true);
  }

  // One short note for a city on the map
  async function city(place, el) {
    const key = `${base()}.city.${place.label}`;
    const cached = get(key);
    const put1 = n => { el.innerHTML = n && n.notes[0] ? `<p class="city-note">${esc(n.notes[0].text)}</p>` : ''; };
    if (cached) return put1(cached);
    el.innerHTML = '<p class="note ai-wait">Writing a note about this place…</p>';
    const lines = AstroEngine.linesNearCity(state.chart, place.lat, place.lon, 700);
    try {
      put1(await fetchNotes(key, { profile: profilePayload([]), lens: 'city',
        extra: `City: ${place.label}\nPlanet lines within 700 km: ${lines.length ? lines.map(n => `${n.planet} ${n.angle} ${n.km} km`).join(', ') : 'none'}` }));
    } catch (e) { el.innerHTML = ''; }
  }

  return { fill, city };
})();
