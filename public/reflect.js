// Decide, step 2: optional reflection. Nothing appears until the user asks for it.
// Suggested questions load only on request (saves AI calls). Any question can get an "Ask the stars" hint.
const Reflect = (() => {
  const MIN_ANSWER = 3;
  let items = [], notes = [], kind = '', professional = 0, loading = false;

  function render() {
    $('reflect').innerHTML = `
      <div class="sect">
        <h3>Questions to think about</h3>
        ${items.length ? `<p class="note" id="rfCount">${countText()}</p>` :
          `<p class="note">Get a few questions written for your decision and your chart.</p>
           <button class="ghost" id="rfSuggest" ${loading ? 'disabled' : ''}>${loading ? 'Writing questions…' : 'Suggest questions'}</button>`}
        <div id="rfList">${items.map(itemHtml).join('')}</div>
        ${professional > 0.5 ? '<p class="note">This decision may also need advice from a qualified professional. The reading is for reflection only.</p>' : ''}
      </div>
      <div class="sect">
        <h3>A question of your own</h3>
        <p class="note">Stuck on something? Add it and get a hint from your chart.</p>
        <div class="row"><input id="rfOwnQ" placeholder="e.g. Will I regret not trying?" maxlength="200"><button class="ghost" id="rfAddQ">Add</button></div>
      </div>
      <div class="sect">
        <h3>Notes</h3>
        <p class="note">Anything on your mind: a feeling, a memory, a fear, a wish.</p>
        <div class="row"><input id="rfNote" placeholder="Write a note" maxlength="300"><button class="ghost" id="rfAddNote">Add note</button></div>
        <div class="notes">${notes.map((n, i) => `<span class="chip">${esc(n)}<span class="x" data-i="${i}" role="button" aria-label="Remove note">✕</span></span>`).join('')}</div>
      </div>`;
    bind();
  }

  function countText() {
    const answered = items.filter(it => it.a.trim().length >= MIN_ANSWER).length;
    return `${answered} of ${items.length} answered. Answer any you like and skip the rest.`;
  }

  function itemHtml(it, i) {
    const done = it.a.trim().length >= MIN_ANSWER;
    return `<details class="q" data-i="${i}" ${it.open ? 'open' : ''}>
      <summary><span>${esc(it.q)}</span>${it.own ? '<span class="own-mark">your question</span>' : ''}<span class="done-mark ${done ? '' : 'hidden'}">Answered</span></summary>
      <div class="q-body">
        <textarea data-i="${i}" placeholder="Your answer, in your own words">${esc(it.a)}</textarea>
        <div class="btnrow" style="margin-top:8px">
          <button class="ghost ask" data-i="${i}" ${it.loading ? 'disabled' : ''}>${it.loading ? 'Reading your chart…' : it.hint ? 'Ask the stars again' : 'Ask the stars'}</button>
          ${it.own ? `<button class="quiet del" data-i="${i}">Remove</button>` : ''}
        </div>
        ${it.hint ? `<div class="hint">${esc(it.hint)}${it.prompt ? `<div class="try">${esc(it.prompt)}</div>` : ''}</div>` : ''}
      </div>
    </details>`;
  }

  function bind() {
    const s = $('rfSuggest'); if (s) s.onclick = suggest;
    $('rfAddQ').onclick = addOwn; $('rfOwnQ').onkeydown = e => { if (e.key === 'Enter') addOwn(); };
    $('rfAddNote').onclick = addNote; $('rfNote').onkeydown = e => { if (e.key === 'Enter') addNote(); };
    $('reflect').querySelectorAll('.notes .x').forEach(x => x.onclick = () => { notes.splice(+x.dataset.i, 1); render(); });
    $('reflect').querySelectorAll('details.q').forEach(d => d.ontoggle = () => { items[+d.dataset.i].open = d.open; });
    $('reflect').querySelectorAll('.q textarea').forEach(t => {
      t.oninput = () => {
        items[+t.dataset.i].a = t.value;
        t.closest('details').querySelector('.done-mark').classList.toggle('hidden', t.value.trim().length < MIN_ANSWER);
        const c = $('rfCount'); if (c) c.textContent = countText();
      };
    });
    $('reflect').querySelectorAll('.ask').forEach(b => b.onclick = () => ask(+b.dataset.i));
    $('reflect').querySelectorAll('.del').forEach(b => b.onclick = () => { items.splice(+b.dataset.i, 1); render(); });
  }

  async function suggest() {
    loading = true; render();
    try {
      const r = await api('/api/questions', { profile: profilePayload(), decision: state.decision });
      if (r.support) return showSupport(r.message);
      kind = r.kind || ''; professional = r.professional || 0;
      items = (r.questions || []).map(q => ({ q, a: '', own: false })).concat(items);
    } catch (e) { alertLine('Questions did not load: ' + e.message + '. Try again.'); }
    finally { loading = false; render(); }
  }
  function alertLine(msg) { const p = document.createElement('p'); p.className = 'note'; p.textContent = msg; $('reflect').prepend(p); }

  function addOwn() {
    const q = $('rfOwnQ').value.trim();
    if (q.length < 4) return;
    items.push({ q, a: '', own: true, open: true });
    render(); ask(items.length - 1);
  }
  function addNote() {
    const n = $('rfNote').value.trim();
    if (!n) return;
    notes.push(n); render(); $('rfNote').focus();
  }
  async function ask(i) {
    const it = items[i]; it.loading = true; it.open = true; render();
    try {
      const r = await api('/api/hint', { profile: profilePayload(), decision: state.decision, question: it.q, own: !!it.own, notes });
      if (r.support) return showSupport(r.message);
      it.hint = r.insight; it.prompt = r.prompt;
    } catch (e) { it.hint = 'No hint right now (' + e.message + '). Try again in a moment.'; it.prompt = ''; }
    finally { it.loading = false; render(); }
  }

  render();
  return {
    reset() { items = []; notes = []; kind = ''; professional = 0; render(); },
    kind: () => kind,
    answers: () => items.filter(it => it.a.trim() || it.hint || it.own)
      .map(it => ({ q: it.q, a: it.a.trim() || '(not answered)', own: !!it.own, hint: it.hint ? `${it.hint} ${it.prompt || ''}`.trim() : '' })),
    notes: () => notes.slice(),
  };
})();
