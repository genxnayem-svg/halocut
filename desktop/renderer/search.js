// HaloCut Quick search window: type, pick with the arrows, Return puts it on the selected clips.
// The app opens it (⌥Space in Premiere Pro / After Effects) and runs what you pick. © 2026 Imtayz Nayem
(function () {
  const QS = window.QuickSearch;
  const $ = (id) => document.getElementById(id);
  const q = $('q'), list = $('list');
  const S = { app: 'PPRO', items: [], recent: [], tab: 'all', results: [], sel: 0, note: '' };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const icon = (it) => {
    const body = (window.ICONS && (window.ICONS[it.icon] || window.ICONS.dot)) || '';
    return `<svg class="ic" viewBox="0 0 24 24" style="${it.tint ? `color:${esc(it.tint)}` : ''}">${body}</svg>`;
  };
  // the part of the name you typed, lit
  function lit(label, query) {
    const i = query ? label.toLowerCase().indexOf(query.toLowerCase()) : -1;
    if (i < 0) return esc(label);
    return esc(label.slice(0, i)) + '<mark>' + esc(label.slice(i, i + query.length)) + '</mark>' + esc(label.slice(i + query.length));
  }

  function renderTabs() {
    const box = $('tabs');
    box.innerHTML = '';
    QS.tabsFor(S.items).forEach((t) => {
      const b = document.createElement('button');
      b.className = 'tab' + (t.id === S.tab ? ' on' : '');
      b.textContent = t.name;
      b.setAttribute('role', 'tab');
      b.addEventListener('mousedown', (e) => { e.preventDefault(); setTab(t.id); });
      box.append(b);
    });
  }

  function render() {
    const query = q.value.trim();
    S.results = QS.rank(S.items, query, { tab: S.tab, recent: S.recent });
    if (S.sel >= S.results.length) S.sel = Math.max(0, S.results.length - 1);
    const recent = new Set(S.recent);
    list.innerHTML = S.results.map((it, i) => `<div class="row${i === S.sel ? ' on' : ''}${!query && recent.has(it.id) ? ' recent' : ''}" data-i="${i}" role="option">
      ${icon(it)}<div class="txt"><b>${lit(it.label, query)}</b>${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</div>
      <span class="tag">${esc(QS.GROUP_TAG[it.group] || it.group)}</span></div>`).join('');
    const none = !S.results.length;
    list.hidden = none;
    $('empty').hidden = !none;
    if (none) {
      $('empty').textContent = !S.items.length ? (S.note || 'Nothing to search yet.')
        : query ? `Nothing called “${query}”${S.tab !== 'all' ? ' in this group: press Tab for the others' : ''}.` : 'Nothing in this group.';
    }
    $('count').textContent = none ? '' : S.results.length >= 80 ? '80+ found' : `${S.results.length} found`;
    scrollToSel();
  }

  function scrollToSel() {
    const row = list.querySelector('.row.on');
    if (row) row.scrollIntoView({ block: 'nearest' });
  }

  function move(d) {
    if (!S.results.length) return;
    S.sel = (S.sel + d + S.results.length) % S.results.length;
    list.querySelectorAll('.row').forEach((r, i) => r.classList.toggle('on', i === S.sel));
    scrollToSel();
  }

  function setTab(id) { S.tab = id; S.sel = 0; renderTabs(); render(); q.focus(); }
  function cycleTab(d) {
    const tabs = QS.tabsFor(S.items), i = tabs.findIndex((t) => t.id === S.tab);
    setTab(tabs[(i + d + tabs.length) % tabs.length].id);
  }

  async function run(i) {
    const it = S.results[i];
    if (!it) return;
    document.body.classList.add('busy');
    try { await window.ew.invoke('search:run', { id: it.id, query: q.value }); }
    finally { document.body.classList.remove('busy'); }
  }
  const close = () => window.ew.invoke('search:close');

  q.addEventListener('input', () => { S.sel = 0; $('error').hidden = true; render(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'PageDown') { e.preventDefault(); move(8); }
    else if (e.key === 'PageUp') { e.preventDefault(); move(-8); }
    else if (e.key === 'Enter') { e.preventDefault(); run(S.sel); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); cycleTab(e.shiftKey ? -1 : 1); }
    else if (e.code === 'Space' && e.altKey) { e.preventDefault(); close(); } // the same keys again close it
  });
  list.addEventListener('mousemove', (e) => {
    const row = e.target.closest('.row');
    if (!row || +row.dataset.i === S.sel) return;
    S.sel = +row.dataset.i;
    list.querySelectorAll('.row').forEach((r, i) => r.classList.toggle('on', i === S.sel));
  });
  list.addEventListener('mousedown', (e) => { e.preventDefault(); const row = e.target.closest('.row'); if (row) run(+row.dataset.i); });

  // { app, appName, items, recent, note, error, query }
  window.ew.on('search:open', (d) => {
    S.app = d.app; S.items = d.items || []; S.recent = d.recent || []; S.note = d.note || '';
    S.tab = 'all'; S.sel = 0;
    $('app').textContent = d.appName || d.app;
    q.value = d.query || '';
    $('error').textContent = d.error || '';
    $('error').hidden = !d.error;
    document.body.classList.remove('busy');
    renderTabs(); render();
    q.focus(); q.select();
  });
})();
