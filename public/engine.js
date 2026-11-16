// Astro engine: Western chart (whole-sign houses), Saju four pillars, astrocartography lines.
// Pure calculation — no AI here. Works in the browser (globals) and in Node (require).
(function (root) {
  const A = typeof Astronomy !== 'undefined' ? Astronomy : require('astronomy-engine');
  const L = typeof Solar !== 'undefined' ? { Solar } : require('lunar-javascript');

  const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  const BODIES = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const norm = x => ((x % 360) + 360) % 360;
  const norm180 = x => { x = norm(x); return x > 180 ? x - 360 : x; };

  function signOf(lon) {
    const i = Math.floor(norm(lon) / 30);
    return { sign: SIGNS[i], signIndex: i, degree: Math.floor(norm(lon) - i * 30), lon: norm(lon) };
  }

  // Local wall-clock time in an IANA zone -> UTC Date (handles historical DST via Intl)
  function localToUTC(y, mo, d, h, mi, timeZone) {
    let guess = Date.UTC(y, mo - 1, d, h, mi);
    for (let i = 0; i < 3; i++) {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
        .formatToParts(new Date(guess)).reduce((o, p) => (o[p.type] = +p.value, o), {});
      const asIfUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute);
      guess += Date.UTC(y, mo - 1, d, h, mi) - asIfUTC;
    }
    return new Date(guess);
  }

  function obliquity(time) {
    const T = time.tt / 36525;
    return 23.4392911 - 0.0130042 * T; // mean obliquity, degrees
  }

  // Equatorial (true equator of date) RA/Dec, and ecliptic longitude of date
  function bodyCoords(body, time) {
    const vecJ2000 = A.GeoVector(A.Body[body], time, true);
    const rot = A.Rotation_EQJ_EQD(time);
    const eq = A.EquatorFromVector(A.RotateVector(rot, vecJ2000));
    const ecl = A.Ecliptic(vecJ2000); // ecliptic of date
    return { ra: eq.ra * 15, dec: eq.dec, lon: ecl.elon };
  }

  function westernChart(utcDate, lat, lon) {
    const time = A.MakeTime(utcDate);
    const eps = obliquity(time) * RAD;
    const gast = A.SiderealTime(time) * 15;           // degrees
    const ramc = norm(gast + lon) * RAD;
    const phi = lat * RAD;

    const mc = norm(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps)) * DEG);
    const asc = norm(Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) * DEG);

    const ascSign = signOf(asc).signIndex;
    const house = l => ((signOf(l).signIndex - ascSign + 12) % 12) + 1; // whole-sign houses

    const planets = BODIES.map(b => {
      const c = bodyCoords(b, time);
      return { name: b, ...signOf(c.lon), house: house(c.lon), ra: c.ra, dec: c.dec };
    });
    // True (osculating) lunar node, as used by CHANI and Human Design
    const nn = trueNode(time);
    planets.push({ name: 'North Node', ...signOf(nn), house: house(nn) });
    planets.push({ name: 'South Node', ...signOf(nn + 180), house: house(nn + 180) });

    return {
      ascendant: { ...signOf(asc), house: 1 },
      midheaven: { ...signOf(mc), house: house(mc) },
      planets, gast
    };
  }

  // ---- Saju (Four Pillars) via lunar-javascript (solar-term based) ----
  const STEM = { '甲':['Gap','Wood','Yang'],'乙':['Eul','Wood','Yin'],'丙':['Byeong','Fire','Yang'],'丁':['Jeong','Fire','Yin'],
    '戊':['Mu','Earth','Yang'],'己':['Gi','Earth','Yin'],'庚':['Gyeong','Metal','Yang'],'辛':['Sin','Metal','Yin'],
    '壬':['Im','Water','Yang'],'癸':['Gye','Water','Yin'] };
  const BRANCH = { '子':['Ja','Rat','Water'],'丑':['Chuk','Ox','Earth'],'寅':['In','Tiger','Wood'],'卯':['Myo','Rabbit','Wood'],
    '辰':['Jin','Dragon','Earth'],'巳':['Sa','Snake','Fire'],'午':['O','Horse','Fire'],'未':['Mi','Goat','Earth'],
    '申':['Sin','Monkey','Metal'],'酉':['Yu','Rooster','Metal'],'戌':['Sul','Dog','Earth'],'亥':['Hae','Pig','Water'] };

  function saju(y, mo, d, h, mi) {
    // Saju uses local birth time (wall clock), as in standard manseryeok
    const ec = L.Solar.fromYmdHms(y, mo, d, h, mi, 0).getLunar().getEightChar();
    const pillar = (label, gz) => {
      const s = STEM[gz[0]], b = BRANCH[gz[1]];
      return { pillar: label, hanja: gz, stem: s[0], stemElement: s[1], polarity: s[2], branch: b[0], animal: b[1], branchElement: b[2] };
    };
    const pillars = [pillar('Year', ec.getYear()), pillar('Month', ec.getMonth()), pillar('Day', ec.getDay()), pillar('Hour', ec.getTime())];
    const balance = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
    pillars.forEach(p => { balance[p.stemElement]++; balance[p.branchElement]++; });
    const dm = pillars[2];
    return { pillars, dayMaster: `${dm.polarity} ${dm.stemElement} (${dm.stem})`, elementBalance: balance };
  }

  // ---- Astrocartography: where each planet is angular (rising / setting / MC / IC) ----
  function cartoLines(chart, { latStep = 2, latMax = 72 } = {}) {
    const lines = [];
    for (const p of chart.planets) {
      if (p.ra === undefined) continue;
      const mcLon = norm180(p.ra - chart.gast);
      lines.push({ planet: p.name, angle: 'MC', points: [[-latMax, mcLon], [latMax, mcLon]] });
      lines.push({ planet: p.name, angle: 'IC', points: [[-latMax, norm180(mcLon + 180)], [latMax, norm180(mcLon + 180)]] });
      const asc = [], dsc = [];
      for (let la = -latMax; la <= latMax; la += latStep) {
        const c = -Math.tan(la * RAD) * Math.tan(p.dec * RAD);
        if (c < -1 || c > 1) continue; // circumpolar here
        const H0 = Math.acos(c) * DEG;
        asc.push([la, norm180(p.ra - H0 - chart.gast)]);
        dsc.push([la, norm180(p.ra + H0 - chart.gast)]);
      }
      lines.push({ planet: p.name, angle: 'ASC', points: asc });
      lines.push({ planet: p.name, angle: 'DSC', points: dsc });
    }
    return lines;
  }

  // Lines passing within `orbKm` of a city (east-west distance at the city's latitude)
  function linesNearCity(chart, lat, lon, orbKm = 700) {
    const out = [];
    const kmPerDeg = 111.32 * Math.cos(lat * RAD);
    for (const p of chart.planets) {
      if (p.ra === undefined) continue;
      const cands = [];
      const mcLon = p.ra - chart.gast;
      cands.push(['MC', mcLon], ['IC', mcLon + 180]);
      const c = -Math.tan(lat * RAD) * Math.tan(p.dec * RAD);
      if (c >= -1 && c <= 1) {
        const H0 = Math.acos(c) * DEG;
        cands.push(['ASC', p.ra - H0 - chart.gast], ['DSC', p.ra + H0 - chart.gast]);
      }
      for (const [angle, lineLon] of cands) {
        const km = Math.abs(norm180(lineLon - lon)) * kmPerDeg;
        if (km <= orbKm) out.push({ planet: p.name, angle, km: Math.round(km) });
      }
    }
    return out.sort((a, b) => a.km - b.km);
  }


  // True lunar node: from the Moon's instantaneous orbit plane (h = r × v) in the ecliptic of date.
  function trueNode(time) {
    const dt = 1 / 1440; // one minute, in days
    const rot = A.Rotation_EQJ_ECT(time);
    const r = A.RotateVector(rot, A.GeoMoon(time));
    const a = A.RotateVector(rot, A.GeoMoon(time.AddDays(-dt))), b = A.RotateVector(rot, A.GeoMoon(time.AddDays(dt)));
    const v = { x: (b.x - a.x) / (2 * dt), y: (b.y - a.y) / (2 * dt), z: (b.z - a.z) / (2 * dt) };
    const hx = r.y * v.z - r.z * v.y, hy = r.z * v.x - r.x * v.z;
    return norm(Math.atan2(hx, -hy) * DEG);
  }

  // ---- Human Design: gates, centers, channels, type, authority, profile ----
  const HD_ORDER = [41,19,13,49,30,55,37,63,22,36,25,17,21,51,42,3,27,24,2,23,8,20,16,35,45,12,15,52,39,53,62,56,31,33,7,4,29,59,40,64,47,6,46,18,48,57,32,50,28,44,1,43,14,34,9,5,26,11,10,58,38,54,61,60];
  const HD_CENTERS = {
    Head: [64, 61, 63], Ajna: [47, 24, 4, 17, 43, 11], Throat: [62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16],
    G: [1, 13, 25, 46, 2, 15, 10, 7], Heart: [21, 40, 26, 51], 'Solar Plexus': [6, 37, 22, 36, 30, 55, 49],
    Sacral: [5, 14, 29, 59, 9, 3, 42, 27, 34], Spleen: [48, 57, 44, 50, 32, 28, 18], Root: [53, 60, 52, 19, 39, 41, 58, 38, 54] };
  const HD_CHANNELS = [[1,8,'Inspiration'],[2,14,'The Beat'],[3,60,'Mutation'],[4,63,'Logic'],[5,15,'Rhythm'],[6,59,'Intimacy'],[7,31,'The Alpha'],
    [9,52,'Concentration'],[10,20,'Awakening'],[10,34,'Exploration'],[10,57,'Perfected Form'],[11,56,'Curiosity'],[12,22,'Openness'],
    [13,33,'The Prodigal'],[16,48,'The Wavelength'],[17,62,'Acceptance'],[18,58,'Judgment'],[19,49,'Synthesis'],[20,34,'Charisma'],
    [20,57,'The Brainwave'],[21,45,'Money'],[23,43,'Structuring'],[24,61,'Awareness'],[25,51,'Initiation'],[26,44,'Surrender'],
    [27,50,'Preservation'],[28,38,'Struggle'],[29,46,'Discovery'],[30,41,'Recognition'],[32,54,'Transformation'],[34,57,'Power'],
    [35,36,'Transitoriness'],[37,40,'Community'],[39,55,'Emoting'],[42,53,'Maturation'],[47,64,'Abstraction']];
  const HD_BODIES = ['Sun', 'Earth', 'North Node', 'South Node', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  const MOTORS = ['Heart', 'Solar Plexus', 'Sacral', 'Root'];
  const gateCenter = {};
  for (const [c, gs] of Object.entries(HD_CENTERS)) gs.forEach(g => gateCenter[g] = c);

  function gateOf(lon) {
    const x = norm(lon - 302) / 5.625;
    return { gate: HD_ORDER[Math.floor(x)], line: Math.floor((x % 1) * 6) + 1 };
  }
  function activations(utcDate) {
    const c = westernChart(utcDate, 0, 0);
    const lonOf = n => c.planets.find(p => p.name === n).lon;
    const lon = { Sun: lonOf('Sun'), Earth: lonOf('Sun') + 180, 'North Node': lonOf('North Node'), 'South Node': lonOf('South Node') };
    ['Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].forEach(n => lon[n] = lonOf(n));
    return HD_BODIES.map(b => ({ body: b, ...gateOf(lon[b]) }));
  }
  // Design moment: when the Sun was 88° of arc before its birth position (about 88 days earlier)
  function designDate(utcDate) {
    const sunLon = d => westernChart(d, 0, 0).planets.find(p => p.name === 'Sun').lon;
    const target = norm(sunLon(utcDate) - 88);
    let t = utcDate.getTime() - 88 * 864e5;
    for (let i = 0; i < 30; i++) {
      const diff = ((sunLon(new Date(t)) - target + 540) % 360) - 180;
      if (Math.abs(diff) < 1e-7) break;
      t -= diff / 0.9856 * 864e5;
    }
    return new Date(t);
  }

  function humanDesign(utcDate) {
    const dDate = designDate(utcDate);
    const personality = activations(utcDate), design = activations(dDate);
    const pGates = new Set(personality.map(a => a.gate)), dGates = new Set(design.map(a => a.gate));
    const active = new Set([...pGates, ...dGates]);
    const channels = HD_CHANNELS.filter(([a, b]) => active.has(a) && active.has(b))
      .map(([a, b, name]) => ({ gates: [a, b], name, centers: [gateCenter[a], gateCenter[b]] }));
    const defined = new Set(channels.flatMap(ch => ch.centers));
    // connected groups of defined centers
    const adj = {}; defined.forEach(c => adj[c] = new Set());
    channels.forEach(ch => { adj[ch.centers[0]].add(ch.centers[1]); adj[ch.centers[1]].add(ch.centers[0]); });
    const seen = new Set(), groups = [];
    defined.forEach(c => { if (seen.has(c)) return; const g = [], st = [c]; seen.add(c);
      while (st.length) { const x = st.pop(); g.push(x); adj[x].forEach(y => { if (!seen.has(y)) { seen.add(y); st.push(y); } }); } groups.push(g); });
    const linked = (from, to) => groups.some(g => g.includes(from) && g.includes(to));
    const motorToThroat = MOTORS.some(m => defined.has(m) && linked(m, 'Throat'));
    let type;
    if (!defined.size) type = 'Reflector';
    else if (defined.has('Sacral')) type = motorToThroat ? 'Manifesting Generator' : 'Generator';
    else type = motorToThroat ? 'Manifestor' : 'Projector';
    let authority;
    if (defined.has('Solar Plexus')) authority = 'Emotional';
    else if (defined.has('Sacral')) authority = 'Sacral';
    else if (defined.has('Spleen')) authority = 'Splenic';
    else if (defined.has('Heart')) authority = linked('Heart', 'Throat') ? 'Ego Manifested' : 'Ego Projected';
    else if (defined.has('G') && linked('G', 'Throat')) authority = 'Self-Projected';
    else authority = type === 'Reflector' ? 'Lunar' : 'Mental (outer authority)';
    const STRAT = { Generator: 'To respond', 'Manifesting Generator': 'To respond, then inform', Manifestor: 'To inform', Projector: 'Wait for the invitation', Reflector: 'Wait a lunar cycle' };
    const SIG = { Generator: ['Satisfaction', 'Frustration'], 'Manifesting Generator': ['Satisfaction', 'Frustration and anger'], Manifestor: ['Peace', 'Anger'], Projector: ['Success', 'Bitterness'], Reflector: ['Surprise', 'Disappointment'] };
    const pl = personality[0].line, dl = design[0].line, profile = `${pl}/${dl}`;
    const angle = profile === '4/1' ? 'Juxtaposition' : pl >= 5 ? 'Left Angle' : 'Right Angle';
    const DEF = ['No definition', 'Single definition', 'Split definition', 'Triple split definition', 'Quadruple split definition'];
    return {
      designDate: dDate, personality, design, channels,
      definedCenters: Object.keys(HD_CENTERS).filter(c => defined.has(c)),
      openCenters: Object.keys(HD_CENTERS).filter(c => !defined.has(c)),
      activeGates: [...active].sort((a, b) => a - b),
      hangingGates: [...active].filter(g => !channels.some(ch => ch.gates.includes(g))).sort((a, b) => a - b),
      type, strategy: STRAT[type], authority, profile,
      signature: SIG[type][0], notSelf: SIG[type][1],
      definition: DEF[groups.length] || `${groups.length} groups`,
      cross: { angle, gates: `${personality[0].gate}/${personality[1].gate} | ${design[0].gate}/${design[1].gate}` }
    };
  }

  const api = { SIGNS, humanDesign, HD_CENTERS, HD_CHANNELS, gateCenter, trueNode, localToUTC, westernChart, saju, cartoLines, linesNearCity };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AstroEngine = api;
})(this);
