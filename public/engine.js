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
    // Mean lunar node
    const T = time.tt / 36525;
    const nn = norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T);
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

  const api = { SIGNS, localToUTC, westernChart, saju, cartoLines, linesNearCity };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AstroEngine = api;
})(this);
