// Step 3: the reflection game. Light stars by answering, asking your own questions and noting thoughts.
// "Ask the stars" gives an astrology-based hint for any question the user is stuck on.
const Reflect = (() => {
  const GOAL = 7;          // stars for 100% clarity
  const UNLOCK = 3;        // stars needed to draw cards
  const MIN_ANSWER = 12;   // characters that count as a real answer
  const MILESTONES = { 1: 'First star lit ✦', 3: 'Your cards are unlocked', 5: 'The picture is getting clearer', 7: 'Full constellation. You know more than you think.' };
  let items = [], notes = [], lastStars = 0, professional = 0;

  // ---- scoring ----
  function stars() {
    const answered = items.filter(i => i.a.trim().length >= MIN_ANSWER).length;
    const own = items.filter(i => i.own).length;
    return Math.min(GOAL, answered + own + Math.min(notes.length, 3));
  }

  // ---- rendering ----
  function render() {
    const host = $('reflect');
    host.innerHTML = `
      <div class="rf-head">
        <div>${constellation()}</div>
        <div class="rf-meter"><div class="rf-label"><span>Clarity</span><b id="rfPct"></b></div><div class="rf-bar"><i id="rfFill"></i></div>
          <p class="note" style="margin:6px 0 0">Answer, ask your own questions, or drop thoughts in the jar. Every one lights a star.</p></div>
      </div>
      <div id="rfCards"></div>
      <div class="rf-add">
        <label>A question of your own</label>
        <div class="rf-row"><input id="rfOwnQ" placeholder="e.g. Will I regret not trying?" maxlength="200"><button id="rfAddQ" class="ghost">Add</button></div>
      </div>
      <div class="rf-jar">
        <div class="rf-jarhead"><span class="rf-jaricon">🫙</span><div><b>Thought jar</b><div class="note" id="rfJarCount"></div></div></div>
        <div class="rf-row"><input id="rfNote" placeholder="Anything that pops into your head: a feeling, a memory, a fear, a wish…" maxlength="300"><button id="rfAddNote" class="ghost">Drop in</button></div>
        <div id="rfNotes" class="rf-notes"></div>
      </div>
      ${professional > 0.5 ? '<p class="note">This decision may also need advice from a qualified professional. The reading is for reflection only.</p>' : ''}
      <div class="btnrow"><button id="rfToCards"></button></div>
      <div id="rfToast" class="rf-toast"></div>`;
    renderCards(); renderNotes(); update(false);

    $('rfAddQ').onclick = addOwn;
    $('rfOwnQ').onkeydown = e => { if (e.key === 'Enter') addOwn(); };
    $('rfAddNote').onclick = addNote;
    $('rfNote').onkeydown = e => { if (e.key === 'Enter') addNote(); };
    $('rfToCards').onclick = () => { if (stars() >= UNLOCK) $('toCards').click(); };
  }

  function constellation() {
    // 7 stars in a loose arc, linked as they light up
    const pts = [[20, 60], [55, 30], [95, 48], [135, 20], [175, 42], [210, 18], [245, 50]];
    const lines = pts.slice(1).map((p, i) => `<line class="rf-link" data-i="${i + 1}" x1="${pts[i][0]}" y1="${pts[i][1]}" x2="${p[0]}" y2="${p[1]}"/>`).join('');
    const dots = pts.map((p, i) => `<g class="rf-star" data-i="${i}"><circle cx="${p[0]}" cy="${p[1]}" r="9" class="glow"/><circle cx="${p[0]}" cy="${p[1]}" r="4" class="core"/></g>`).join('');
    return `<svg viewBox="0 0 265 75" class="rf-const">${lines}${dots}</svg>`;
  }

  function renderCards() {
    $('rfCards').innerHTML = items.map((it, i) => `
      <div class="rf-card ${it.a.trim().length >= MIN_ANSWER ? 'done' : ''} ${it.skipped && !it.a.trim() ? 'skipped' : ''}" data-i="${i}">
        <div class="rf-qhead"><span class="rf-num">${it.own ? '✎' : i + 1}</span><p>${esc(it.q)}</p>${it.own ? '<span class="rf-tag">your question</span>' : ''}</div>
        <textarea placeholder="${it.own ? 'Your answer, if one comes…' : 'Your honest answer…'}" data-i="${i}">${esc(it.a)}</textarea>
        <div class="rf-actions">
          <button class="rf-ask" data-i="${i}" ${it.loading ? 'disabled' : ''}>${it.loading ? 'Reading your chart…' : it.hint ? '✦ Ask again' : '✦ Ask the stars'}</button>
          ${!it.own && !it.a.trim() ? `<button class="rf-skip" data-i="${i}">${it.skipped ? 'Skipped' : "I can't answer this yet"}</button>` : ''}
          ${it.own ? `<button class="rf-del" data-i="${i}">Remove</button>` : ''}
        </div>
        ${it.hint ? `<div class="rf-hint"><b>The stars say</b>${esc(it.hint)}<div class="rf-try">${esc(it.prompt || '')}</div></div>` : ''}
      </div>`).join('');
    $('rfCards').querySelectorAll('textarea').forEach(t => t.oninput = () => {
      const it = items[+t.dataset.i]; const was = it.a.trim().length >= MIN_ANSWER;
      it.a = t.value;
      const now = it.a.trim().length >= MIN_ANSWER;
      t.closest('.rf-card').classList.toggle('done', now);
      if (was !== now) update(true);
    });
    $('rfCards').querySelectorAll('.rf-ask').forEach(b => b.onclick = () => ask(+b.dataset.i));
    $('rfCards').querySelectorAll('.rf-skip').forEach(b => b.onclick = () => { items[+b.dataset.i].skipped = true; renderCards(); ask(+b.dataset.i); });
    $('rfCards').querySelectorAll('.rf-del').forEach(b => b.onclick = () => { items.splice(+b.dataset.i, 1); renderCards(); update(true); });
  }

  function renderNotes() {
    $('rfNotes').innerHTML = notes.map((n, i) => `<div class="rf-note" style="--r:${(i % 2 ? 1 : -1) * (1 + i % 3)}deg">${esc(n)}<span class="x" data-i="${i}">✕</span></div>`).join('');
    $('rfNotes').querySelectorAll('.x').forEach(x => x.onclick = () => { notes.splice(+x.dataset.i, 1); renderNotes(); update(true); });
    $('rfJarCount').textContent = notes.length ? `${notes.length} thought${notes.length > 1 ? 's' : ''} in your jar` : 'Empty for now';
  }

  function update(celebrate) {
    const s = stars();
    document.querySelectorAll('.rf-star').forEach(el => el.classList.toggle('lit', +el.dataset.i < s));
    document.querySelectorAll('.rf-link').forEach(el => el.classList.toggle('lit', +el.dataset.i < s));
    $('rfPct').textContent = Math.round(s / GOAL * 100) + '%';
    $('rfFill').style.width = (s / GOAL * 100) + '%';
    const btn = $('rfToCards');
    btn.disabled = s < UNLOCK;
    btn.textContent = s < UNLOCK ? `Light ${UNLOCK - s} more star${UNLOCK - s > 1 ? 's' : ''} to unlock your cards` : 'Draw your cards ✦';
    if (celebrate && s > lastStars) toast(MILESTONES[s] || '+1 star lit ✦');
    lastStars = s;
  }

  function toast(msg) {
    const t = $('rfToast'); t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  }

  // ---- actions ----
  function addOwn() {
    const q = $('rfOwnQ').value.trim();
    if (q.length < 4) return;
    items.push({ q, a: '', own: true });
    $('rfOwnQ').value = '';
    renderCards(); update(true);
    ask(items.length - 1);
  }
  function addNote() {
    const n = $('rfNote').value.trim();
    if (!n) return;
    notes.push(n); $('rfNote').value = '';
    renderNotes(); update(true);
  }
  async function ask(i) {
    const it = items[i];
    it.loading = true; renderCards();
    try {
      const r = await api('/api/hint', { profile: profilePayload(), decision: state.decision, question: it.q, own: !!it.own, notes });
      if (r.support) return showSupport(r.message);
      it.hint = r.insight; it.prompt = r.prompt;
    } catch (e) { it.hint = 'The stars are quiet right now (' + e.message + '). Try again in a moment.'; it.prompt = ''; }
    finally { it.loading = false; renderCards(); }
  }

  return {
    start(questions, prof) { items = questions.map(q => ({ q, a: '', own: false })); notes = []; lastStars = 0; professional = prof || 0; render(); },
    answers: () => items.filter(it => it.a.trim() || it.hint || it.own)
      .map(it => ({ q: it.q, a: it.a.trim() || '(not answered yet)', own: !!it.own, hint: it.hint ? `${it.hint} ${it.prompt || ''}`.trim() : '' })),
    notes: () => notes.slice(),
  };
})();
