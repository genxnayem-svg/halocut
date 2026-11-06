// Practice page: a pretend timeline with a hold-to-open wheel, and a history you can step back through.
// Nothing here talks to Premiere Pro.
window.Practice = (function () {
  const SECONDS = 40;          // timeline length shown
  const HOLD_MS = 160;         // press this long to open the wheel
  const R0 = 46, R1 = 150;     // wheel radii (same feel as the real one)

  const TOOLS = [
    { id: 'cut', label: 'Cut', icon: 'scissors' },
    { id: 'ripple', label: 'Ripple delete', icon: 'ripple' },
    { id: 'marker', label: 'Marker', icon: 'flag' },
    { id: 'zoomIn', label: 'Zoom in', icon: 'zoomIn' },
    { id: 'label', label: 'Label', icon: 'tag' },
    { id: 'disable', label: 'Enable / disable', icon: 'eyeOff' },
    { id: 'zoomOut', label: 'Zoom out', icon: 'zoomOut' },
    { id: 'undo', label: 'Undo', icon: 'undo' },
  ];
  const LABELS = ['#ef9b1d', '#3e5fd9', '#3b9e3e', '#e23bd6', '#e2d63b', '#00a3a3'];

  const initial = () => ({
    zoom: 1, playhead: 16, labelIx: 0,
    tracks: [
      { name: 'V2', clips: [{ id: 1, s: 2, e: 8.5, name: 'Title', cls: 't' }] },
      { name: 'V1', clips: [
        { id: 2, s: 0, e: 9, name: 'Intro', cls: 'v' }, { id: 3, s: 9, e: 20, name: 'Interview', cls: 'v' },
        { id: 4, s: 20, e: 29, name: 'Nested Sequence 01', cls: 'n' }, { id: 5, s: 29, e: 36, name: 'Outro', cls: 'v' }] },
      { name: 'A1', clips: [
        { id: 6, s: 0, e: 9, name: 'Intro', cls: 'a' }, { id: 7, s: 9, e: 20, name: 'Interview', cls: 'a' },
        { id: 8, s: 20, e: 29, name: 'Nested Sequence 01', cls: 'a' }, { id: 9, s: 29, e: 36, name: 'Outro', cls: 'a' }] },
    ],
    markers: [],
    selected: null,
    nextId: 20,
  });

  let el, state, history, cursor, wheelState = null, holdTimer = null, down = null;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function mount(root) {
    el = {
      root, tracks: root.querySelector('#tracks'), ruler: root.querySelector('#ruler'),
      playhead: root.querySelector('#playhead'), tc: root.querySelector('#tc'), zoom: root.querySelector('#zoomOut'),
      wheel: root.querySelector('#practiceWheel'), history: document.getElementById('history'),
    };
    document.body.append(el.wheel); // float above the window so the wheel is never clipped by the timeline
    reset();
    root.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKey);
    document.getElementById('practiceReset').addEventListener('click', reset);
  }

  function reset() {
    state = initial();
    history = [{ label: 'Start', snap: clone(state) }];
    cursor = 0;
    render();
  }

  // ---- drawing -----------------------------------------------------------------
  function trackWidth() { return el.tracks.querySelector('.track')?.clientWidth || el.root.clientWidth - 60; }
  const visible = () => SECONDS / state.zoom;
  const x = (sec) => (sec / visible()) * 100;

  function tc(sec) {
    const f = Math.round((sec % 1) * 25), s = Math.floor(sec);
    const p = (n) => String(n).padStart(2, '0');
    return `00:00:${p(s)}:${p(f)}`;
  }

  function render() {
    el.tracks.innerHTML = '';
    state.tracks.forEach((t) => {
      const tr = document.createElement('div');
      tr.className = 'track';
      tr.innerHTML = `<span class="tname">${t.name}</span>`;
      t.clips.forEach((c) => {
        const d = document.createElement('div');
        d.className = `clip ${c.cls}${state.selected === c.id ? ' sel' : ''}${c.off ? ' off' : ''}`;
        d.style.left = `${x(c.s)}%`;
        d.style.width = `${x(c.e - c.s)}%`;
        if (c.label) d.style.background = c.label;
        d.textContent = c.name;
        d.dataset.id = c.id;
        tr.append(d);
      });
      el.tracks.append(tr);
    });
    // markers on the ruler
    el.ruler.innerHTML = '';
    const step = state.zoom >= 2 ? 4 : 8;
    for (let s = 0; s <= visible(); s += step) {
      const sp = document.createElement('span');
      sp.style.left = `${x(s)}%`;
      sp.textContent = `00:${String(Math.round(s)).padStart(2, '0')}`;
      el.ruler.append(sp);
    }
    state.markers.forEach((m) => {
      const mk = document.createElement('i');
      mk.className = 'clip-mk';
      mk.style.cssText = `position:absolute;top:0;left:calc(${x(m.t)}% - 5px);width:10px;height:12px;background:${m.color};clip-path:polygon(0 0,100% 0,100% 60%,50% 100%,0 60%)`;
      el.ruler.append(mk);
    });
    const left = el.tracks.querySelector('.track').offsetLeft;
    el.playhead.style.left = `${left + (x(state.playhead) / 100) * trackWidth()}px`;
    el.tc.textContent = tc(state.playhead);
    el.zoom.textContent = `${state.zoom}×`;
    renderHistory();
  }

  function renderHistory() {
    el.history.innerHTML = '';
    history.forEach((h, i) => {
      const li = document.createElement('li');
      li.className = i === cursor ? 'cur' : i > cursor ? 'future' : '';
      li.innerHTML = `<svg class="ic" viewBox="0 0 24 24">${ICONS[h.icon || 'dot']}</svg>`;
      li.append(h.label);
      li.addEventListener('click', () => { cursor = i; state = clone(h.snap); render(); });
      el.history.append(li);
    });
  }

  // ---- the wheel -------------------------------------------------------------------
  function drawWheel() {
    const { cx, cy, hover } = wheelState;
    const n = TOOLS.length, span = 360 / n;
    const pol = (r, a) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)];
    const sector = (r0, r1, a0, a1) => {
      const [x0, y0] = pol(r1, a0), [x1, y1] = pol(r1, a1), [x2, y2] = pol(r0, a1), [x3, y3] = pol(r0, a0);
      return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
    };
    let s = `<circle cx="${cx}" cy="${cy}" r="${R1}" fill="rgba(20,16,24,.94)" stroke="rgba(255,255,255,.12)"/>`;
    TOOLS.forEach((t, i) => {
      const a = i * span;
      const on = hover === i;
      s += `<path d="${sector(R0 + 4, R1 - 4, a - span / 2 + 1.5, a + span / 2 - 1.5)}" fill="${on ? 'var(--a2)' : 'rgba(255,255,255,.035)'}"/>`;
      const [ix, iy] = pol((R0 + R1) / 2 + 4, a);
      s += `<g transform="translate(${ix - 10} ${iy - 18}) scale(.84)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[t.icon]}</g>`;
      s += `<text x="${ix}" y="${iy + 16}" text-anchor="middle" fill="#fff" font-size="11" font-weight="600">${t.label}</text>`;
    });
    const label = hover >= 0 ? TOOLS[hover].label : 'Pick a tool';
    s += `<circle cx="${cx}" cy="${cy}" r="${R0}" fill="#0f0c12" stroke="var(--a1)" stroke-width="2"/>`;
    s += `<text x="${cx}" y="${cy + 1}" text-anchor="middle" fill="#fff" font-size="12" font-weight="700">${label}</text>`;
    s += `<text x="${cx}" y="${cy + 16}" text-anchor="middle" fill="rgba(255,255,255,.6)" font-size="9.5">${hover >= 0 ? 'let go to run' : 'centre cancels'}</text>`;
    el.wheel.innerHTML = s;
  }

  function hoverAt(px, py) {
    const dx = px - wheelState.cx, dy = py - wheelState.cy;
    if (Math.hypot(dx, dy) < R0) return -1;
    const ang = ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360;
    return Math.round(ang / (360 / TOOLS.length)) % TOOLS.length;
  }

  const local = (e) => [e.clientX, e.clientY]; // the wheel layer covers the whole window

  function openWheel(px, py) {
    const cx = Math.min(Math.max(px, R1 + 4), window.innerWidth - R1 - 4);
    const cy = Math.min(Math.max(py, R1 + 4), window.innerHeight - R1 - 4);
    wheelState = { cx, cy, hover: -1, at: down };
    el.wheel.removeAttribute('hidden'); // SVG elements have no .hidden property
    drawWheel();
  }

  function closeWheel() { wheelState = null; el.wheel.setAttribute('hidden', ''); }

  function onDown(e) {
    if (e.target.closest('.tl-head')) return;
    const [px, py] = local(e);
    down = { px, py, sec: secAt(e), clip: clipAt(e), button: e.button };
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => openWheel(px, py), HOLD_MS);
  }

  function onMove(e) {
    if (!wheelState) return;
    const [px, py] = local(e);
    const h = hoverAt(px, py);
    if (h !== wheelState.hover) { wheelState.hover = h; drawWheel(); }
  }

  function onUp() {
    clearTimeout(holdTimer);
    if (wheelState) {
      const pick = wheelState.hover;
      const at = wheelState.at;
      closeWheel();
      if (pick >= 0) run(TOOLS[pick], at);
    } else if (down) {
      // A quick click: move the playhead and select what is under it
      if (down.sec !== null) state.playhead = Math.max(0, Math.min(visible(), down.sec));
      state.selected = down.clip;
      render();
    }
    down = null;
  }

  function onKey(e) {
    if (!wheelState) return;
    if (e.key === 'Escape') { closeWheel(); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= TOOLS.length) { const at = wheelState.at; closeWheel(); run(TOOLS[n - 1], at); }
  }

  function secAt(e) {
    const tr = el.tracks.querySelector('.track').getBoundingClientRect();
    if (e.clientX < tr.left) return null;
    return ((e.clientX - tr.left) / tr.width) * visible();
  }

  function clipAt(e) {
    const c = e.target.closest('.clip');
    return c ? Number(c.dataset.id) : null;
  }

  // ---- pretend tools ---------------------------------------------------------------
  function findClip(id) {
    for (const t of state.tracks) { const c = t.clips.find((x) => x.id === id); if (c) return { t, c }; }
    return null;
  }

  function run(tool, at) {
    const t0 = at && at.sec !== null ? at.sec : state.playhead;
    const target = (at && at.clip) || state.selected;
    let label = tool.label;

    switch (tool.id) {
      case 'undo':
        if (cursor > 0) { cursor--; state = clone(history[cursor].snap); render(); }
        return;
      case 'cut': {
        let n = 0;
        state.tracks.forEach((t) => {
          const c = t.clips.find((x) => x.s < t0 && x.e > t0);
          if (c) { t.clips.push({ ...c, id: state.nextId++, s: t0 }); c.e = t0; n++; }
          t.clips.sort((a, b) => a.s - b.s);
        });
        state.playhead = t0;
        label = n ? `Cut ${n} tracks` : 'Cut (nothing here)';
        break;
      }
      case 'ripple': {
        const f = target && findClip(target);
        if (!f) { label = 'Ripple delete (select a clip first)'; break; }
        const len = f.c.e - f.c.s, s = f.c.s;
        state.tracks.forEach((t) => {
          t.clips = t.clips.filter((x) => !(x.s === s && x.e === s + len && (x.id === f.c.id || t !== f.t)));
          t.clips.forEach((x) => { if (x.s >= s) { x.s -= len; x.e -= len; } });
        });
        state.selected = null;
        label = `Ripple delete ${f.c.name}`;
        break;
      }
      case 'marker': {
        const color = LABELS[state.markers.length % LABELS.length];
        state.markers.push({ t: t0, color });
        label = 'Marker';
        break;
      }
      case 'label': {
        const f = target && findClip(target);
        if (!f) { label = 'Label (select a clip first)'; break; }
        f.c.label = LABELS[state.labelIx++ % LABELS.length];
        label = `Label on ${f.c.name}`;
        break;
      }
      case 'disable': {
        const f = target && findClip(target);
        if (!f) { label = 'Enable / disable (select a clip first)'; break; }
        f.c.off = !f.c.off;
        label = `${f.c.off ? 'Disabled' : 'Enabled'} ${f.c.name}`;
        break;
      }
      case 'zoomIn': state.zoom = Math.min(4, state.zoom * 2); label = `Zoom ${state.zoom}×`; break;
      case 'zoomOut': state.zoom = Math.max(1, state.zoom / 2); label = `Zoom ${state.zoom}×`; break;
      default: break;
    }
    history = history.slice(0, cursor + 1);
    history.push({ label, icon: tool.icon, snap: clone(state) });
    cursor = history.length - 1;
    render();
  }

  return { mount, render: () => state && render() };
})();
