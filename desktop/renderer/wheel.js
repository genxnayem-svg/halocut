// Overlay renderer: draws whichever wheel the main process opens, and the result toast.
(function () {
  const svg = document.getElementById('wheel');
  const APP = { PPRO: 'Premiere Pro', AEFT: 'After Effects', other: 'Options wheel' };
  const TITLE = { orbit: 'Orbit switch' };
  let state = null;
  let drawn = { on: '', arc: '' }; // what the last drawing showed

  // A tick as the pointer crosses onto a segment, tool or slice (General page: Sound). Made here, no sound files.
  let audio = null;
  function tick(kind) {
    const level = state && state.sound === 'clear' ? 0.16 : state && state.sound === 'soft' ? 0.06 : 0;
    if (!level) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(kind === 'tool' ? 1320 : 880, t); // tools tick a little higher than segments
      osc.frequency.exponentialRampToValueAtTime(kind === 'tool' ? 900 : 620, t + 0.045);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(level, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      osc.connect(gain).connect(audio.destination);
      osc.start(t); osc.stop(t + 0.07);
    } catch { /* no sound then */ }
  }

  function draw() {
    if (!state) return;
    const L = state.layout;
    // several layouts: the centre names the one showing ("Classic · 2 of 2")
    const many = state.mode === 'tool' && L && L.count > 1 ? `${String(L.name).split(' · ').pop()} · ${L.index + 1} of ${L.count}` : null;
    const opts = { cx: state.center.x, cy: state.center.y, hover: state.hover, appLabel: many || TITLE[state.mode] || APP[state.app] || (L && L.name) || 'Options wheel',
      sub: many ? 'Scroll for the next layout' : undefined };
    // what changed since the last drawing decides what moves: a new arc slides out, a new lit slice fades in
    const h = state.hover || {}, on = `${h.seg}/${h.tool}/${h.ring}/${h.slot}`, arc = String(h.openSeg);
    svg.classList.toggle('hot-new', on !== drawn.on);
    svg.classList.toggle('arc-new', arc !== drawn.arc);
    drawn = { on, arc };
    svg.innerHTML = state.mode === 'options'
      ? OptionsDraw.render(state.rings, opts)
      : WheelDraw.render(state.layout, opts);
  }

  window.ew.on('wheel:open', (data) => {
    const [a1, a2] = window.Appearance.accentOf(data.accent); // the same list as the settings window
    if (data.disc) { // the background theme's tone on the wheel's disc
      document.documentElement.style.setProperty('--wd1', data.disc[0]);
      document.documentElement.style.setProperty('--wd2', data.disc[1]);
      document.documentElement.style.setProperty('--wd3', window.Appearance.shade(data.disc[1], -0.25));
    }
    document.documentElement.style.setProperty('--a1', a1);
    document.documentElement.style.setProperty('--a2', a2);
    // Size from the General page: everything draws at its own size, zoomed, so the centre comes in divided
    const scale = data.scale || 1;
    document.body.style.zoom = scale;
    const px = data.size || window.innerWidth; // the window's size: the window may not have caught up yet
    svg.style.width = svg.style.height = (px / scale) + 'px'; // zoomed, it fills the window again
    document.documentElement.dataset.anim = data.animation || 'smooth';
    document.documentElement.classList.toggle('glass', !!data.glass); // see-through wheels (Appearance page)
    state = { ...data, center: { x: data.center.x / scale, y: data.center.y / scale }, hover: { seg: -1, tool: -1, openSeg: -1, ring: -1, slot: -1 } };
    document.body.className = '';
    drawn = { on: '', arc: '-1' };
    svg.style.transformOrigin = `${state.center.x}px ${state.center.y}px`;
    draw();
    requestAnimationFrame(() => { document.body.className = 'open'; });
  });

  // The Orbit switch sends its layout again once browser tabs are in.
  window.ew.on('wheel:layout', (layout) => {
    if (!state || (state.mode !== 'orbit' && state.mode !== 'tool')) return;
    state.layout = layout; // the Orbit switch with its tabs in, or the next Tool wheel layout (scrolled)
    state.hover = { seg: -1, tool: -1, openSeg: -1, ring: -1, slot: -1 };
    draw();
  });

  window.ew.on('wheel:hover', (hover) => {
    if (!state) return;
    const was = state.hover || {};
    const on = (h) => (h.seg !== undefined ? `${h.seg}/${h.tool}` : `${h.ring}/${h.slot}`);
    const over = hover.seg !== undefined ? hover.seg >= 0 : hover.ring >= 0;
    if (over && on(hover) !== on(was)) tick(hover.tool >= 0 || hover.ring > 0 ? 'tool' : 'segment');
    state.hover = hover;
    draw();
  });

  window.ew.on('wheel:toast', ({ ok, label, msg }) => {
    const t = document.getElementById('toast');
    t.className = ok ? 'toast' : 'toast fail';
    document.getElementById('toastLabel').textContent = label;
    document.getElementById('toastMsg').textContent = msg && msg !== label ? msg : '';
    if (state) {
      t.style.left = state.center.x + 'px';
      t.style.top = state.center.y + 'px';
    }
    document.body.className = 'toasting';
  });

  window.ew.on('wheel:close', () => {
    state = null;
    document.body.className = '';
    svg.innerHTML = '';
  });

  // Sticky mode: the window takes clicks while the wheel stays open.
  window.addEventListener('mousedown', () => window.ew.click());
})();
