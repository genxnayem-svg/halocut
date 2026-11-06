// Overlay renderer: draws whichever wheel the main process opens, and the result toast.
(function () {
  const svg = document.getElementById('wheel');
  const APP = { PPRO: 'Premiere Pro', AEFT: 'After Effects', other: 'Options wheel' };
  const TITLE = { orbit: 'Orbit switch' };
  let state = null;

  function draw() {
    if (!state) return;
    const opts = { cx: state.center.x, cy: state.center.y, hover: state.hover, appLabel: TITLE[state.mode] || APP[state.app] || 'Options wheel' };
    svg.innerHTML = state.mode === 'options'
      ? OptionsDraw.render(state.rings, opts)
      : WheelDraw.render(state.layout, opts);
  }

  window.ew.on('wheel:open', (data) => {
    const [a1, a2] = window.Appearance.accentOf(data.accent); // the same list as the settings window
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
    svg.style.transformOrigin = `${state.center.x}px ${state.center.y}px`;
    draw();
    requestAnimationFrame(() => { document.body.className = 'open'; });
  });

  // The Orbit switch sends its layout again once browser tabs are in.
  window.ew.on('wheel:layout', (layout) => {
    if (!state || state.mode !== 'orbit') return;
    state.layout = layout;
    draw();
  });

  window.ew.on('wheel:hover', (hover) => {
    if (!state) return;
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
