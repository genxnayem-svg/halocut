// Settings window: sidebar pages, top bar, per-app tabs.
(async function () {
  const G = window.WheelGeometry;
  const SIZE = 572, C = SIZE / 2;
  const APP_NAMES = { PPRO: 'Premiere Pro', AEFT: 'After Effects', other: 'Other apps' };
  // Apps added in Settings ([{ id, bundleId, name, path }]): each has a tab with its own wheels and buttons
  const addedApps = () => (data && data.config.apps) || [];
  const isAdded = (id) => addedApps().some((a) => a.id === id);
  const appName = (id) => APP_NAMES[id] || (addedApps().find((a) => a.id === id) || {}).name || id;
  const $ = (id) => document.getElementById(id);
  const icon = (name) => `<svg class="ic" viewBox="0 0 24 24">${ICONS[name] || ICONS.dot}</svg>`;

  let data = await window.ew.invoke('settings:get');
  let page = 'wheel';
  let currentApp = 'PPRO';
  let layout = await window.ew.invoke('settings:layout', currentApp);
  let hover = { seg: -1, tool: -1, openSeg: -1 };
  let picked = null;
  const MAC = data.platform === 'darwin';
  if (!MAC) document.body.classList.add('win');

  document.querySelectorAll('[data-icon]').forEach((i) => { i.outerHTML = icon(i.dataset.icon); });
  $('version').textContent = `HaloCut ${data.status.version || ''}`;

  // ------------------------------------------------------------ helpers
  function toast(text, ok = true) {
    const t = $('toast');
    t.textContent = text;
    t.className = 'toast show' + (ok ? '' : ' fail');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.className = 'toast'; }, 2400);
  }

  async function save(patch) {
    data.config = await window.ew.invoke('settings:set', patch);
    const s = $('saved');
    s.classList.add('show');
    clearTimeout(save.timer);
    save.timer = setTimeout(() => s.classList.remove('show'), 1600);
  }

  const MOD_ORDER = ['ctrl', 'alt', 'shift', 'cmd'];
  const MOD_LABEL = MAC ? { ctrl: '⌃ Control', alt: '⌥ Option', shift: '⇧ Shift', cmd: '⌘ Cmd' }
    : { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', cmd: 'Win' };
  const BTN_LABEL = { left: 'Left button', right: 'Right button', middle: 'Middle button', mouse4: 'Mouse 4 (back)', mouse5: 'Mouse 5 (forward)' };
  const buttonLabel = (name) => BTN_LABEL[name] || name.replace(/^mouse(\d+)$/, 'Mouse $1');
  const comboParts = (t) => [...MOD_ORDER.filter((m) => (t.mods || []).includes(m)).map((m) => MOD_LABEL[m]),
    t.kind === 'mouse' ? buttonLabel(t.name) : t.name];
  const kbds = (parts) => parts.map((p) => `<kbd>${p}</kbd>`).join(' ');
  const toolLabel = (id) => (data.tools[id] ? data.tools[id].label : id);

  // ------------------------------------------------------------ navigation
  const APP_PAGES = { options: ['PPRO', 'AEFT', 'other'], orbit: null, wheel: ['PPRO', 'AEFT'], buttons: ['PPRO', 'AEFT', 'other'], shortcuts: ['PPRO', 'AEFT', 'other'] };
  // the added apps go after After Effects, before "Other apps"
  const appsFor = (p) => {
    const base = APP_PAGES[p];
    if (!base) return null;
    const ids = addedApps().map((a) => a.id), at = base.indexOf('other');
    return at < 0 ? base.concat(ids) : base.slice(0, at).concat(ids, base.slice(at));
  };
  const SOON = {
  };

  function go(p) {
    page = p;
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.page === p));
    const isSoon = p.startsWith('soon-');
    document.querySelectorAll('.page').forEach((s) => { s.hidden = s.id !== (isSoon ? 'page-soon' : `page-${p}`); });
    if (isSoon) { $('soonTitle').textContent = SOON[p][0]; $('soonText').textContent = SOON[p][1]; }
    const apps = appsFor(p);
    $('appTabs').style.visibility = apps ? 'visible' : 'hidden';
    if (apps && !apps.includes(currentApp)) setApp(apps[0]);
    showTabsFor(apps);
    if (p === 'practice') Practice.render();
    if (p === 'devices') renderDevices();
    if (p === 'appearance') { lookLayout = null; renderAppearance(); } // the wheel as it is now
    if (p === 'orbit') { loadOrbit(); loadOrbitApps(); }
  }
  document.querySelectorAll('#nav button').forEach((b) => b.addEventListener('click', () => go(b.dataset.page)));

  function showTabsFor(apps) {
    document.querySelectorAll('#appTabs button').forEach((b) => {
      b.hidden = b.dataset.add ? !apps : !!apps && !apps.includes(b.dataset.app);
    });
  }

  // A tab for each added app, between After Effects and "Other apps", then "+ Add app"
  function renderAppTabs() {
    const box = $('appTabs');
    box.querySelectorAll('button.added, button[data-add]').forEach((b) => b.remove());
    const other = box.querySelector('button[data-app="other"]');
    addedApps().forEach((a) => {
      const b = document.createElement('button');
      b.className = 'added' + (a.id === currentApp ? ' on' : '');
      b.dataset.app = a.id;
      b.title = `${a.name}: its own Tool wheel, Options wheel and buttons`;
      b.innerHTML = '<b class="badge app"></b><span></span>';
      b.querySelector('b').textContent = a.name.replace(/^(Adobe|Microsoft|Google|Apple)\s+/i, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || '··';
      b.querySelector('span').textContent = a.name;
      box.insertBefore(b, other);
    });
    const add = document.createElement('button');
    add.dataset.add = '1';
    add.className = 'add-app';
    add.title = 'Give another app its own Tool wheel, Options wheel and buttons: DaVinci Resolve, Lightroom, any app';
    add.textContent = '+ Add app';
    box.append(add);
    showTabsFor(appsFor(page));
  }

  async function setApp(appId) {
    currentApp = appId;
    document.querySelectorAll('#appTabs button').forEach((b) => b.classList.toggle('on', b.dataset.app === appId));
    $('removeApp').hidden = !isAdded(appId);
    if (appId !== 'other') {
      layout = await window.ew.invoke('settings:layout', appId);
      hover = { seg: -1, tool: -1, openSeg: -1 };
      picked = null;
      renderPicked();
      drawPreview();
      renderSegments();
    }
    $('wheelApp').textContent = appName(appId);
    $('optApp').textContent = appName(appId);
    optSel = null; optHover = { ring: -1, slot: -1 };
    drawOptions(); renderSlotEditor();
    $('mapApp').textContent = appName(appId);
    renderProfile();
    renderShortcuts();
  }
  $('appTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.add) openAppPicker('tabs'); else setApp(b.dataset.app);
  });
  $('removeApp').addEventListener('click', async () => {
    const id = currentApp, name = appName(id);
    if (!isAdded(id) || !confirm(`Remove ${name}? Its Tool wheel, Options wheel and buttons go with it.`)) return;
    const r = await window.ew.invoke('settings:removeApp', id);
    toast(r.msg, r.ok);
    if (!r.ok) return;
    data.config = r.config;
    renderAppTabs();
    setApp('PPRO');
  });

  // ------------------------------------------------------------ top bar
  $('pause').addEventListener('click', () => save({ paused: !data.config.paused }));
  $('quit').addEventListener('click', () => window.ew.invoke('settings:quit'));

  // ------------------------------------------------------------ Tool wheel page
  function drawPreview() {
    $('preview').innerHTML = WheelDraw.render(layout, { cx: C, cy: C, hover, appLabel: appName(currentApp) });
  }

  function svgPoint(ev) {
    const svg = $('preview');
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  $('preview').addEventListener('mousemove', (ev) => {
    const p = svgPoint(ev);
    const h = G.hit(p.x - C, p.y - C, layout, hover.openSeg);
    const openSeg = h.seg >= 0 ? h.seg : hover.openSeg;
    if (h.seg !== hover.seg || h.tool !== hover.tool || openSeg !== hover.openSeg) {
      hover = { seg: h.seg, tool: h.tool, openSeg };
      drawPreview();
    }
  });
  $('preview').addEventListener('mouseleave', () => { hover = { seg: -1, tool: -1, openSeg: -1 }; drawPreview(); });
  $('preview').addEventListener('click', () => {
    if (hover.seg < 0) return;
    const seg = layout.segments[hover.seg];
    const idx = hover.tool >= 0 ? hover.tool : seg.tools.findIndex((t) => t.id === seg.main.id);
    pick(hover.tool >= 0 ? seg.tools[hover.tool] : seg.main, idx >= 0 ? { seg: hover.seg, idx } : null);
  });

  // ------------------------------------------------------------ Tool wheel: changing it
  const TC = window.ToolCatalog;
  let pickedAt = null; // { seg, idx }: where the picked tool sits in the layout
  const rawLayout = () => data.config.layouts[currentApp];
  const customTools = () => data.config.customTools || {};

  // res: { ok, layout, msg } from ToolCatalog. customs: new tools to remember, by id.
  async function saveLayout(res, customs) {
    if (res.msg) toast(res.msg, res.ok);
    if (!res.ok) return false;
    const layouts = { ...data.config.layouts, [currentApp]: res.layout };
    const kept = TC.prune({ ...customTools(), ...(customs || {}) }, { ...data.config, layouts });
    await save({ layouts, customTools: kept });
    data.tools = { ...data.tools, ...kept };
    layout = await window.ew.invoke('settings:layout', currentApp);
    const s = pickedAt && layout.segments[pickedAt.seg];
    picked = s && s.tools[pickedAt.idx] ? s.tools[pickedAt.idx] : null;
    if (!picked) pickedAt = null;
    drawPreview(); renderSegments(); renderPicked();
    return true;
  }

  function renderPicked() {
    const box = $('picked');
    if (!picked) { box.innerHTML = '<span class="muted small">Click a tool on the wheel or in the list below to change it</span>'; return; }
    const seg = pickedAt && rawLayout().segments[pickedAt.seg];
    const isMain = !!seg && seg.main === picked.id;
    const custom = customTools()[picked.id];
    box.innerHTML = '<div class="picked-top"><div><b></b><span class="id"></span></div><button class="btn primary small" data-run>Run it now</button></div>' +
      (seg ? `<div class="picked-edit">${custom ? '<label class="picked-name">Name on the wheel<input type="text" maxlength="24" data-name></label>' : ''}
        <div class="picked-btns"><button class="btn small" data-move="-1" title="Earlier in the segment">◀</button><button class="btn small" data-move="1" title="Later in the segment">▶</button>
        <button class="btn small" data-main ${isMain ? 'disabled' : ''}>${isMain ? '★ Main tool' : 'Make it the main tool'}</button>
        <button class="btn small danger" data-remove>Remove</button></div></div>` : '');
    box.querySelector('b').textContent = picked.label;
    box.querySelector('.id').textContent = seg ? `${seg.name}${picked.hint ? ' · ' + picked.hint : ''}` : picked.id;
    box.querySelector('[data-run]').addEventListener('click', async () => {
      const res = await window.ew.invoke('settings:test', picked.id, currentApp);
      toast(`${picked.label}: ${res.msg || (res.ok ? 'done' : 'failed')}`, res.ok);
    });
    if (!seg) return;
    const name = box.querySelector('[data-name]');
    if (name) {
      name.value = custom.label;
      name.addEventListener('change', () => {
        const label = name.value.trim() || custom.label;
        saveLayout({ ok: true, layout: rawLayout(), msg: '' }, { [picked.id]: { ...custom, label } });
      });
    }
    box.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => {
      const dir = Number(b.dataset.move), res = TC.moveTool(rawLayout(), pickedAt.seg, pickedAt.idx, dir);
      if (res.ok) pickedAt = { seg: pickedAt.seg, idx: pickedAt.idx + dir };
      saveLayout(res);
    }));
    box.querySelector('[data-main]').addEventListener('click', () => saveLayout(TC.setMain(rawLayout(), pickedAt.seg, picked.id)));
    box.querySelector('[data-remove]').addEventListener('click', () => {
      const res = TC.removeTool(rawLayout(), pickedAt.seg, pickedAt.idx);
      if (res.ok) pickedAt = null;
      saveLayout(res);
    });
  }

  function pick(tool, at = null) { picked = tool; pickedAt = at; renderPicked(); renderSegments(); }

  $('tapToStick').addEventListener('change', (e) => save({ wheel: { ...data.config.wheel, tapToStick: e.target.checked } }));

  // Trigger list editor, shared by the Tool wheel and the Options wheel.
  // which: "wheel" or "options" (the config key holding { triggers: [...] }).
  async function setTrigger(which, i, t) {
    const triggers = data.config[which].triggers.slice();
    triggers[i] = t;
    await save({ [which]: { ...data.config[which], triggers } });
    renderTriggers('wheel');
    renderTriggers('options');
    renderTriggers('orbit');
    renderTriggers('search');
    renderProfile();
    renderShortcuts();
  }

  function renderTriggers(which) {
    const box = $({ wheel: 'triggers', options: 'optTriggers', orbit: 'orbitTriggers', search: 'searchTriggers' }[which]);
    box.innerHTML = '';
    data.config[which].triggers.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'trigger';
      row.innerHTML = `<div class="trigger-main"><div class="combo"></div>
        <button class="btn primary small rec">Record</button><button class="btn small clear">Clear</button></div>`;
      const combo = row.querySelector('.combo');
      if (t) combo.innerHTML = kbds(comboParts(t));
      else { combo.classList.add('empty'); combo.textContent = i === 0 ? 'No key or button' : 'Add a second trigger'; }
      row.querySelector('.clear').disabled = !t;

      row.querySelector('.rec').addEventListener('click', async () => {
        combo.className = 'combo listening';
        combo.textContent = 'Press a mouse button or key… (Esc cancels)';
        const got = await window.ew.invoke('settings:record');
        if (!got) { renderTriggers(which); return; }
        const delayMs = got.kind === 'mouse' && got.name === 'right' && !got.mods.length ? 200 : (t && t.kind === 'mouse' ? t.delayMs : 0);
        await setTrigger(which, i, { ...got, delayMs });
        toast(`Trigger: ${comboParts(got).join(' + ')}`);
      });
      row.querySelector('.clear').addEventListener('click', () => setTrigger(which, i, null));

      if (t && t.kind === 'mouse') {
        const d = document.createElement('div');
        d.className = 'trigger-delay';
        d.innerHTML = `<label>Hold <b class="out"></b> to open<small>A quicker tap stays a normal click</small></label>
          <input type="range" min="0" max="600" step="20">`;
        const range = d.querySelector('input'), out = d.querySelector('.out');
        range.value = t.delayMs || 0;
        out.textContent = `${range.value} ms`;
        range.addEventListener('input', () => { out.textContent = `${range.value} ms`; });
        range.addEventListener('change', () => setTrigger(which, i, { ...t, delayMs: Number(range.value) }));
        row.append(d);
      }
      box.append(row);
    });
  }

  // ------------------------------------------------------------ Options wheel page
  const OG = window.OptionsGeometry;
  const OC = 300; // centre of the 600×600 preview
  let optHover = { ring: -1, slot: -1 };
  let optSel = null; // { ring, slot }
  const optApp = () => currentApp;
  const optRings = () => (data.config.options.wheels[optApp()] || data.config.options.wheels.other).rings;

  function drawOptions() {
    $('optPreview').innerHTML = OptionsDraw.render(optRings(), {
      cx: OC, cy: OC, hover: optHover, selected: optSel || undefined, appLabel: appName(optApp()),
    });
  }

  function optPoint(ev) {
    const svg = $('optPreview');
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  $('optPreview').addEventListener('mousemove', (ev) => {
    const p = optPoint(ev);
    const h = OG.hit(p.x - OC, p.y - OC, optRings());
    if (h.ring !== optHover.ring || h.slot !== optHover.slot) { optHover = { ring: h.ring, slot: h.slot }; drawOptions(); }
  });
  $('optPreview').addEventListener('mouseleave', () => { optHover = { ring: -1, slot: -1 }; drawOptions(); });
  $('optPreview').addEventListener('click', () => {
    if (optHover.ring < 0) return;
    optSel = { ...optHover };
    drawOptions();
    renderSlotEditor();
  });

  async function saveSlot(slot) {
    const wheels = JSON.parse(JSON.stringify(data.config.options.wheels));
    if (!wheels[optApp()]) wheels[optApp()] = JSON.parse(JSON.stringify(wheels.other));
    wheels[optApp()].rings[optSel.ring][optSel.slot] = slot;
    await save({ options: { ...data.config.options, wheels } });
    drawOptions();
  }

  const ACTION_TYPES = [['keys', 'Keystroke'], ['text', 'Type text'], ['launch', 'Open an app, file or link'], ['tool', 'HaloCut tool'], ['none', 'Empty']];

  function renderSlotEditor() {
    const box = $('slotEditor');
    box.innerHTML = '';
    if (!optSel) { box.innerHTML = '<p class="muted small">Click a slice on the wheel to change it.</p>'; return; }
    const slot = optRings()[optSel.ring][optSel.slot];
    const action = slot ? slot.action : { type: 'none' };
    box.insertAdjacentHTML('beforeend', `<span class="where">Ring ${optSel.ring + 1} · slice ${optSel.slot + 1}</span>`);

    const typeSel = document.createElement('select');
    ACTION_TYPES.forEach(([v, l]) => typeSel.add(new Option(l, v)));
    typeSel.value = action.type === 'macro' ? 'keys' : action.type;
    const typeLab = document.createElement('label');
    typeLab.append('What it does', typeSel);
    box.append(typeLab);

    const label = document.createElement('input');
    label.type = 'text';
    label.value = slot ? slot.label : '';
    label.placeholder = 'Name on the wheel';
    const nameLab = document.createElement('label');
    nameLab.append('Name', label);

    const value = document.createElement('div');
    const commit = () => {
      const type = typeSel.value;
      if (type === 'none') return saveSlot(null).then(renderSlotEditor);
      const v = value.querySelector('[data-v]');
      const val = v ? v.value : '';
      const next = type === 'keys' ? { type, keys: val.trim() } : type === 'text' ? { type, text: val }
        : type === 'launch' ? { type, target: val.trim() } : { type, id: val };
      const name = label.value.trim() || (type === 'tool' && data.tools[val] ? data.tools[val].label : val.trim() || 'Slice');
      return saveSlot({ label: name, action: next });
    };

    function fillValue() {
      value.innerHTML = '';
      const type = typeSel.value;
      if (type === 'none') return;
      const lab = document.createElement('label');
      if (type === 'tool') {
        const sel = document.createElement('select');
        sel.dataset.v = '1';
        const entries = Object.entries(data.tools).filter(([, t]) => !t.app || t.app === optApp());
        entries.forEach(([id, t]) => sel.add(new Option(t.label, id)));
        sel.value = action.type === 'tool' ? action.id : entries[0][0];
        sel.addEventListener('change', commit);
        lab.append('Tool', sel);
      } else {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.dataset.v = '1';
        inp.value = type === 'keys' ? (action.keys || '') : type === 'text' ? (action.text || '') : (action.target || '');
        inp.placeholder = { keys: 'e.g. mod+shift+k', text: 'Text to type', launch: 'App name, ~/folder or https://…' }[type];
        inp.addEventListener('change', commit);
        if (type === 'keys') {
          const row = document.createElement('div');
          row.className = 'inline';
          const rec = document.createElement('button');
          rec.className = 'btn small';
          rec.textContent = 'Record';
          rec.addEventListener('click', async () => {
            rec.textContent = 'Press keys…';
            const got = await window.ew.invoke('settings:record');
            rec.textContent = 'Record';
            if (!got || got.kind !== 'key') { if (got) toast('Press a key, not a mouse button', false); return; }
            const mods = got.mods.map((m) => (m === 'cmd' && MAC) || (m === 'ctrl' && !MAC) ? 'mod' : m);
            inp.value = [...mods, got.name.toLowerCase()].join('+');
            commit();
          });
          row.append(inp, rec);
          lab.append('Keys', row);
        } else {
          lab.append(type === 'text' ? 'Text' : 'Open', inp);
        }
      }
      value.append(lab);
    }

    typeSel.addEventListener('change', () => { fillValue(); commit(); });
    label.addEventListener('change', commit);
    fillValue();
    box.append(nameLab, value);

    const btns = document.createElement('div');
    btns.className = 'inline';
    const test = document.createElement('button');
    test.className = 'btn small';
    test.textContent = 'Try it';
    test.addEventListener('click', async () => {
      const s = optRings()[optSel.ring][optSel.slot];
      if (!s) return;
      const res = await window.ew.invoke('settings:runSlot', s.action, optApp());
      toast(`${s.label}: ${(res && res.msg) || (res && res.ok ? 'done' : 'failed')}`, !res || res.ok !== false);
    });
    const clear = document.createElement('button');
    clear.className = 'btn small';
    clear.textContent = 'Empty this slice';
    clear.addEventListener('click', () => saveSlot(null).then(renderSlotEditor));
    btns.append(test, clear);
    box.append(btns);
  }

  // ------------------------------------------------------------ Orbit switch page
  let orbitLayout = null;
  let orbitHover = { seg: -1, tool: -1, openSeg: -1 };

  function drawOrbit() {
    if (!orbitLayout || !orbitLayout.segments.length) {
      $('orbitPreview').innerHTML = '<text x="286" y="286" text-anchor="middle" fill="#9d95a9" font-size="14">No open apps to show</text>';
      return;
    }
    $('orbitPreview').innerHTML = WheelDraw.render(orbitLayout, { cx: C, cy: C, hover: orbitHover, appLabel: 'Orbit switch' });
  }

  async function loadOrbit() {
    $('orbitNote').textContent = 'Reading your open apps…';
    orbitLayout = await window.ew.invoke('settings:orbitPreview');
    orbitHover = { seg: -1, tool: -1, openSeg: -1 };
    const n = orbitLayout ? orbitLayout.segments.length : 0;
    $('orbitNote').textContent = !orbitLayout ? 'The Orbit switch is macOS only for now.'
      : orbitLayout.trusted === false ? 'Window titles need the Accessibility permission (Setup & help).'
      : `${n} app${n === 1 ? '' : 's'} open. Hover the preview to see their windows.`;
    drawOrbit();
  }

  $('orbitPreview').addEventListener('mousemove', (ev) => {
    if (!orbitLayout || !orbitLayout.segments.length) return;
    const svg = $('orbitPreview');
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const h = G.hit(p.x - C, p.y - C, orbitLayout, orbitHover.openSeg);
    const openSeg = h.seg >= 0 ? h.seg : orbitHover.openSeg;
    if (h.seg !== orbitHover.seg || h.tool !== orbitHover.tool || openSeg !== orbitHover.openSeg) {
      orbitHover = { seg: h.seg, tool: h.tool, openSeg };
      drawOrbit();
    }
  });
  $('orbitPreview').addEventListener('mouseleave', () => { orbitHover = { seg: -1, tool: -1, openSeg: -1 }; drawOrbit(); });
  $('orbitRefresh').addEventListener('click', () => { loadOrbit(); loadOrbitApps(); });

  // ------------------------------------------------------------ Orbit switch: which apps
  // pinned: [{ bundleId, name, path }] in wheel order · hidden: [{ bundleId, name }] · showOthers
  const orbitCfg = () => data.config.orbit;
  const pinnedList = () => orbitCfg().pinned || [];
  const hiddenList = () => (orbitCfg().hidden || []).map((h) => (typeof h === 'string' ? { bundleId: h, name: h } : h));
  const isPinned = (bundleId) => pinnedList().some((p) => p.bundleId === bundleId);
  let orbitOpen = [], orbitIcons = {};

  async function saveOrbit(patch, msg) {
    await save({ orbit: { ...orbitCfg(), ...patch } });
    if (msg) toast(msg);
    renderOrbitApps();
    loadOrbit();
  }
  function pinApp(a) {
    if (isPinned(a.bundleId)) return toast(`${a.name} is already pinned`);
    if (pinnedList().length >= 12) return toast('The wheel holds 12 apps: remove one first', false);
    if (a.image) orbitIcons[a.bundleId] = a.image;
    return saveOrbit({ pinned: [...pinnedList(), { bundleId: a.bundleId, name: a.name, path: a.path }],
      hidden: hiddenList().filter((h) => h.bundleId !== a.bundleId) }, `${a.name} pinned`);
  }
  function movePin(i, dir) {
    const list = [...pinnedList()], to = i + dir;
    if (to < 0 || to >= list.length) return;
    list.splice(to, 0, list.splice(i, 1)[0]);
    saveOrbit({ pinned: list });
  }
  function appRow(a, buttons) {
    const row = document.createElement('div');
    row.className = 'oa-row';
    const img = a.image || orbitIcons[a.bundleId];
    row.innerHTML = `${img ? `<img src="${img}" alt="">` : '<span class="oa-noimg"></span>'}<span class="oa-name"></span><span class="oa-btns"></span>`;
    row.querySelector('.oa-name').textContent = a.name;
    buttons.forEach(([label, title, fn]) => {
      const b = document.createElement('button');
      b.className = 'btn small'; b.textContent = label; b.title = title;
      b.addEventListener('click', fn);
      row.querySelector('.oa-btns').append(b);
    });
    return row;
  }
  function renderOrbitApps() {
    const pinned = pinnedList(), hidden = hiddenList();
    const pinBox = $('orbitPinned');
    pinBox.innerHTML = pinned.length ? '' : '<p class="muted small">None yet. Pinned apps keep their place on the wheel, even when closed.</p>';
    pinned.forEach((p, i) => pinBox.append(appRow(p, [
      ['↑', 'Earlier on the wheel', () => movePin(i, -1)],
      ['↓', 'Later on the wheel', () => movePin(i, 1)],
      ['Remove', 'Take it off the wheel', () => saveOrbit({ pinned: pinned.filter((_, k) => k !== i) }, `${p.name} removed`)],
    ])));
    const openBox = $('orbitOpenApps');
    const others = orbitOpen.filter((a) => !isPinned(a.bundleId) && !hidden.some((h) => h.bundleId === a.bundleId));
    openBox.innerHTML = others.length ? '' : `<p class="muted small">${orbitOpen.length ? 'Every open app is pinned or hidden.' : 'Open apps show here.'}</p>`;
    others.forEach((a) => openBox.append(appRow(a, [
      ['Pin', 'Keep it on the wheel, in a fixed place', () => pinApp(a)],
      ['Hide', 'Never show it on the wheel', () => saveOrbit({ hidden: [...hidden, { bundleId: a.bundleId, name: a.name }] }, `${a.name} hidden`)],
    ])));
    $('orbitHiddenWrap').hidden = !hidden.length;
    const hid = $('orbitHidden');
    hid.innerHTML = '';
    hidden.forEach((h) => {
      const c = document.createElement('button');
      c.className = 'chip';
      c.textContent = `${h.name}  ✕`;
      c.title = 'Show it on the wheel again';
      c.addEventListener('click', () => saveOrbit({ hidden: hidden.filter((x) => x.bundleId !== h.bundleId) }, `${h.name} is back`));
      hid.append(c);
    });
    $('orbitOthers').checked = orbitCfg().showOthers !== false;
  }
  async function loadOrbitApps() {
    const r = await window.ew.invoke('settings:orbitApps');
    if (r) { orbitOpen = r.open || []; Object.assign(orbitIcons, r.icons || {}); }
    renderOrbitApps();
  }
  $('orbitOthers').addEventListener('change', (e) => saveOrbit({ showOthers: e.target.checked }));
  $('orbitAdd').addEventListener('click', () => openAppPicker('orbit'));
  // for: 'orbit' (pin it on the Orbit switch) or 'tabs' (give it its own wheels)
  async function openAppPicker(forWhat) {
    PK.mode = 'apps'; PK.appsFor = forWhat; PK.target = null; PK.at = 0;
    $('picker').hidden = false;
    $('pickerSearch').value = '';
    pickerTitle();
    showPicker();
    $('pickerSearch').focus();
    if (!PK.apps) {
      const list = await window.ew.invoke('settings:installedApps');
      PK.apps = (Array.isArray(list) ? list : []).map((a) => ({ id: a.bundleId, label: a.name, hint: a.path.replace(/\/[^/]+$/, ''), image: a.image, app: a }));
      if (PK.mode === 'apps') showPicker();
    }
  }
  $('orbitTabs').addEventListener('change', async (e) => {
    await save({ orbit: { ...data.config.orbit, showTabs: e.target.checked } });
    loadOrbit();
  });

  $('resetOptions').addEventListener('click', async () => {
    data.config = await window.ew.invoke('settings:resetOptions', optApp());
    optSel = null;
    drawOptions(); renderSlotEditor();
    toast('Options wheel reset');
  });


  function renderSegments() {
    $('layoutName').textContent = `· ${layout.name}`;
    const box = $('segments');
    box.innerHTML = '';
    layout.segments.forEach((seg, si) => {
      const row = document.createElement('div');
      row.className = 'segment';
      row.innerHTML = `<div class="name"><button class="swatch" title="Change its colour" style="background:${seg.color}"></button><input type="text" class="seg-name" maxlength="16" spellcheck="false" title="Rename">
        <span class="seg-btns"><button data-dir="-1" title="Move up">↑</button><button data-dir="1" title="Move down">↓</button><button data-del title="Delete this segment">✕</button></span></div><div class="chips"></div>`;
      const name = row.querySelector('.seg-name');
      name.value = seg.name;
      name.addEventListener('change', () => saveLayout(TC.renameSegment(rawLayout(), si, name.value)));
      name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });
      row.querySelector('.swatch').addEventListener('click', () => saveLayout(TC.recolorSegment(rawLayout(), si)));
      row.querySelectorAll('[data-dir]').forEach((b) => b.addEventListener('click', () => { pickedAt = null; saveLayout(TC.moveSegment(rawLayout(), si, Number(b.dataset.dir))); }));
      const del = row.querySelector('[data-del]');
      del.addEventListener('click', () => {
        if (!del.classList.contains('armed')) {
          del.classList.add('armed'); del.textContent = 'Delete?';
          setTimeout(() => { del.classList.remove('armed'); del.textContent = '✕'; }, 2500);
          return;
        }
        pickedAt = null; saveLayout(TC.removeSegment(rawLayout(), si));
      });
      const chips = row.querySelector('.chips');
      seg.tools.forEach((t, ti) => {
        const c = document.createElement('span');
        const sel = pickedAt ? pickedAt.seg === si && pickedAt.idx === ti : picked && picked.id === t.id;
        c.className = 'chip' + (t.id === seg.main.id ? ' main' : '') + (sel ? ' sel' : '');
        if (t.tint) { const i = document.createElement('i'); i.style.background = t.tint; c.append(i); }
        c.append(t.label);
        c.title = t.id === seg.main.id ? 'Main tool: runs when you let go on the segment itself' : (t.hint || t.id);
        c.addEventListener('click', () => pick(t, { seg: si, idx: ti }));
        chips.append(c);
      });
      const add = document.createElement('button');
      add.className = 'chip add';
      add.textContent = '+ Add';
      add.title = `Add anything from ${appName(currentApp)} to ${seg.name}`;
      add.addEventListener('click', () => openPicker({ seg: si }));
      chips.append(add);
      box.append(row);
    });
  }
  $('addSegment').addEventListener('click', () => openPicker({ seg: null }));

  // ------------------------------------------------------------ Tool wheel: the picker
  const SEG_NAME = { halocut: 'HaloCut', prtools: 'Tools', prcommands: 'Commands', effects: 'Effects', audio: 'Audio', transitions: 'Transitions', looks: 'Looks', keys: 'Shortcuts' };
  const PK = { target: null, app: null, items: [], groups: TC.GROUPS, shown: [], at: 0, group: 'all', note: '' };

  async function loadCatalog(force) {
    if (!force && PK.app === currentApp && PK.items.length) return;
    PK.app = currentApp; PK.items = [];
    $('pickerNote').textContent = '';
    renderPickerList('Getting the list…');
    const cat = await window.ew.invoke('settings:catalog', currentApp);
    PK.items = cat.items; PK.groups = cat.groups; PK.note = cat.note || '';
  }
  // The catalog, plus shortcuts already added by hand for this app
  function pickerItems() {
    const have = new Set(PK.items.map((i) => i.id)), own = [];
    for (const [id, t] of Object.entries(customTools())) {
      if (!have.has(id) && t.kind === 'keys' && t.app === currentApp) own.push({ id, label: t.label, hint: TC.keysLabel(t.keys, MAC), group: 'keys', icon: t.icon || 'keyboard', def: t });
    }
    return PK.items.concat(own);
  }
  async function openPicker(target) {
    PK.mode = 'tools'; PK.target = target; PK.at = 0; PK.group = 'all';
    $('pickerGroups').hidden = false; $('pickerRefresh').hidden = false;
    $('picker').hidden = false;
    $('pickerSearch').value = '';
    pickerTitle();
    $('pickerSearch').focus();
    await loadCatalog(false);
    showPicker();
  }
  function closePicker() { $('picker').hidden = true; PK.target = null; PK.mode = 'tools'; }
  // An app picked for a tab of its own: HaloCut sets up its wheels, then shows its Tool wheel
  async function addApp(a) {
    const r = await window.ew.invoke('settings:addApp', { bundleId: a.bundleId, name: a.name, path: a.path });
    toast(r.msg, r.ok);
    if (!r.ok) return;
    data.config = r.config;
    data.tools = { ...data.tools, ...(r.config.customTools || {}) }; // its shortcut tools, by name
    closePicker();
    renderAppTabs();
    if (page !== 'wheel') go('wheel');
    setApp(r.id);
  }
  function pickerTitle() {
    if (PK.mode === 'apps') { $('pickerTitle').textContent = PK.appsFor === 'tabs' ? 'Add an app: its own Tool wheel, Options wheel and buttons' : 'Pin an app on the Orbit switch'; return; }
    const s = PK.target && PK.target.seg !== null ? rawLayout().segments[PK.target.seg] : null;
    $('pickerTitle').textContent = s ? `Add to ${s.name} · ${s.tools.length}/${TC.MAX_TOOLS}` : 'New segment: pick its first tool';
  }
  function showPicker() {
    if (PK.mode === 'apps') {
      $('pickerGroups').hidden = true; $('pickerKeys').hidden = true; $('pickerRefresh').hidden = true;
      $('pickerNote').textContent = '';
      PK.shown = TC.search(PK.apps || [], $('pickerSearch').value, 'all');
      PK.at = Math.min(PK.at, Math.max(0, PK.shown.length - 1));
      renderPickerList(PK.apps ? '' : 'Finding your apps…');
      return;
    }
    const items = pickerItems();
    const count = {}; items.forEach((i) => { count[i.group] = (count[i.group] || 0) + 1; });
    const box = $('pickerGroups');
    box.innerHTML = '';
    PK.groups.filter((g) => g.id === 'all' || g.id === 'keys' || count[g.id]).forEach((g) => {
      const b = document.createElement('button');
      b.className = 'chip' + (g.id === PK.group ? ' on' : '');
      b.innerHTML = `${g.name} <small>${g.id === 'all' ? items.length : count[g.id] || ''}</small>`;
      b.addEventListener('click', () => { PK.group = g.id; PK.at = 0; showPicker(); $('pickerSearch').focus(); });
      box.append(b);
    });
    $('pickerNote').textContent = PK.note;
    $('pickerKeys').hidden = PK.group !== 'keys';
    PK.shown = TC.search(items, $('pickerSearch').value, PK.group);
    PK.at = Math.min(PK.at, Math.max(0, PK.shown.length - 1));
    renderPickerList();
  }
  function renderPickerList(msg) {
    const list = $('pickerList');
    list.innerHTML = '';
    if (msg) { list.innerHTML = `<div class="pk-empty">${msg}</div>`; return; }
    if (!PK.shown.length) {
      list.innerHTML = `<div class="pk-empty">${PK.mode !== 'apps' && PK.group === 'keys' ? 'Record a shortcut above to put it on the wheel.' : 'Nothing by that name.'}</div>`;
      return;
    }
    const seg = PK.target && PK.target.seg !== null ? rawLayout().segments[PK.target.seg] : null;
    const gname = {}; PK.groups.forEach((g) => { gname[g.id] = g.name; });
    PK.shown.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'pk-row' + (i === PK.at ? ' on' : '');
      const got = PK.mode === 'apps'
        ? (PK.appsFor === 'tabs' ? addedApps().some((a) => a.bundleId === it.id) && '✓ added' : isPinned(it.id) && '✓ pinned')
        : seg && seg.tools.includes(it.id) && '✓ in this segment';
      row.innerHTML = `${it.image ? `<img class="pk-img" src="${it.image}" alt="">` : icon(it.icon)}<div><b></b><small></small></div>${got ? `<span class="got">${got}</span>` : '<span></span>'}`;
      row.querySelector('b').textContent = it.label;
      row.querySelector('small').textContent = [gname[it.group], it.hint].filter(Boolean).join(' · ');
      row.addEventListener('click', () => { PK.at = i; addPicked(it); });
      list.append(row);
    });
    const on = list.querySelector('.pk-row.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }
  async function addPicked(it) {
    if (PK.mode === 'apps' && PK.appsFor === 'tabs') { await addApp(it.app); return; }
    if (PK.mode === 'apps') { await pinApp(it.app); showPicker(); return; }
    if (!PK.target) return;
    const customs = it.def ? { [it.id]: it.def } : null;
    let res;
    if (PK.target.seg === null) {
      res = TC.addSegment(rawLayout(), SEG_NAME[it.group] || 'New', it.id, it.icon);
      if (res.ok) PK.target = { seg: res.layout.segments.length - 1 }; // what you pick next goes in there too
    } else {
      res = TC.addTool(rawLayout(), PK.target.seg, it.id, it.label);
    }
    if (await saveLayout(res, customs)) { pickerTitle(); showPicker(); }
  }
  $('pickerSearch').addEventListener('input', () => { PK.at = 0; showPicker(); });
  $('pickerClose').addEventListener('click', closePicker);
  $('picker').addEventListener('mousedown', (e) => { if (e.target === $('picker')) closePicker(); });
  $('pickerRefresh').addEventListener('click', async () => { await loadCatalog(true); showPicker(); toast(PK.note || 'List refreshed', !PK.note); });
  document.addEventListener('keydown', (e) => {
    if ($('picker').hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closePicker(); return; }
    if (PK.mode === 'apps' && e.key === 'Enter' && PK.shown[PK.at]) { e.preventDefault(); addPicked(PK.shown[PK.at]); return; }
    if (document.activeElement && ['pkKeys', 'pkName'].includes(document.activeElement.id)) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      PK.at = Math.max(0, Math.min(PK.shown.length - 1, PK.at + (e.key === 'ArrowDown' ? 1 : -1)));
      renderPickerList();
    } else if (e.key === 'Enter' && PK.shown[PK.at]) { e.preventDefault(); addPicked(PK.shown[PK.at]); }
  });
  // Any shortcut: record it (or type it), name it, add it
  $('pkRecord').addEventListener('click', async () => {
    const b = $('pkRecord');
    b.textContent = 'Press keys…';
    const got = await window.ew.invoke('settings:record');
    b.textContent = 'Record';
    if (!got) return;
    if (got.kind !== 'key') { toast('Press a key, not a mouse button', false); return; }
    $('pkKeys').value = TC.keysFromRecord(got, MAC);
  });
  $('pkAdd').addEventListener('click', () => {
    const keys = TC.cleanKeys($('pkKeys').value);
    if (!keys) { toast($('pkKeys').value.trim() ? "HaloCut can't press those keys: click Record and press them instead" : 'Record the keys first, or type them like mod+shift+n', false); return; }
    const label = $('pkName').value.trim() || TC.keysLabel(keys, MAC);
    addPicked(TC.keysItem(currentApp, label, keys)).then(() => { $('pkKeys').value = ''; $('pkName').value = ''; });
  });

  $('resetLayout').addEventListener('click', async () => {
    data.config = await window.ew.invoke('settings:resetLayout', currentApp);
    layout = await window.ew.invoke('settings:layout', currentApp);
    drawPreview(); renderSegments();
    toast('Layout reset');
  });
  $('openConfig').addEventListener('click', () => window.ew.invoke('settings:openConfig'));

  // ------------------------------------------------------------ Button mapping page
  const BUTTONS = ['middle', 'mouse4', 'mouse5'];
  const isTriggerButton = (btn) => data.config.wheel.triggers.some((t) => t && t.kind === 'mouse' && t.name === btn && !(t.mods || []).length);

  function actionSelect(appId, action) {
    const sel = document.createElement('select');
    [['none', 'Nothing'], ['wheel', 'Open the Tool wheel'], ['options', 'Open the Options wheel'], ['orbit', 'Open the Orbit switch'], ['keys', 'Keystroke…']].forEach(([v, l]) => sel.add(new Option(l, v)));
    const entries = Object.entries(data.tools);
    const groups = appId === 'other' ? [] : [[appName(appId), entries.filter(([, t]) => t.app === appId)]];
    groups.push(['Any app', entries.filter(([, t]) => !t.app)]);
    groups.forEach(([gname, list]) => {
      const og = document.createElement('optgroup');
      og.label = gname;
      list.forEach(([id, t]) => og.append(new Option(t.label, `tool:${id}`)));
      sel.append(og);
    });
    sel.value = action.type === 'tool' ? `tool:${action.id}` : action.type;
    return sel;
  }

  function renderProfile() {
    const appId = currentApp;
    const prof = data.config.profiles[appId] || {};
    const box = $('profile');
    box.innerHTML = '';
    const rows = BUTTONS.slice();
    Object.keys(prof).forEach((b) => { if (!rows.includes(b)) rows.push(b); });

    rows.forEach((btn) => {
      const action = prof[btn] || { type: 'none' };
      const row = document.createElement('div');
      row.className = 'binding';
      row.innerHTML = `<span class="bname">${icon('mouse')}</span>`;
      row.querySelector('.bname').append(buttonLabel(btn));
      const sel = actionSelect(appId, action);
      const keys = document.createElement('input');
      keys.type = 'text';
      keys.placeholder = 'e.g. mod+k or shift+delete';
      keys.value = action.keys || '';
      keys.hidden = action.type !== 'keys';
      if (isTriggerButton(btn) && appId !== 'other') {
        sel.disabled = true;
        keys.hidden = false; keys.disabled = true; keys.value = 'Wheel trigger';
      }
      const commit = () => {
        const v = sel.value;
        const next = v.startsWith('tool:') ? { type: 'tool', id: v.slice(5) }
          : v === 'keys' ? { type: 'keys', keys: keys.value.trim() } : { type: v };
        keys.hidden = v !== 'keys';
        save({ profiles: { ...data.config.profiles, [appId]: { ...prof, [btn]: next } } }).then(renderShortcuts);
      };
      sel.addEventListener('change', commit);
      keys.addEventListener('change', commit);
      row.append(sel, keys);
      box.append(row);
    });

    const add = document.createElement('button');
    add.className = 'btn add-btn';
    add.textContent = '+ Record another button';
    add.addEventListener('click', async () => {
      add.textContent = 'Press the mouse button… (Esc cancels)';
      const got = await window.ew.invoke('settings:record');
      if (!got || got.kind !== 'mouse' || got.name === 'left') {
        if (got) toast('Pick a mouse button other than the left one', false);
        renderProfile();
        return;
      }
      if (!prof[got.name]) await save({ profiles: { ...data.config.profiles, [appId]: { ...prof, [got.name]: { type: 'none' } } } });
      renderProfile();
      toast(`${buttonLabel(got.name)} added for ${appName(appId)}`);
    });
    box.append(add);
  }

  // ------------------------------------------------------------ Devices page
  const MOUSE_PARTS = {
    left: '<path class="part" data-b="left" d="M100 20 C60 20 36 46 34 88 L34 118 L98 118 L98 20 Z"/>',
    right: '<path class="part" data-b="right" d="M102 20 C140 20 164 46 166 88 L166 118 L102 118 L102 20 Z"/>',
    middle: '<rect class="part" data-b="middle" x="90" y="44" width="20" height="42" rx="10"/>',
    body: '<path class="part" d="M34 122 L166 122 L166 190 C166 250 140 282 100 282 C60 282 34 250 34 190 Z"/>',
    mouse4: '<rect class="part" data-b="mouse4" x="22" y="150" width="14" height="34" rx="6"/>',
    mouse5: '<rect class="part" data-b="mouse5" x="22" y="112" width="14" height="34" rx="6"/>',
  };
  let lastHit = null;

  function renderDevices() {
    $('mouseArt').innerHTML = Object.values(MOUSE_PARTS).join('');
    const seen = new Set(data.status.seenButtons || []);
    $('mouseArt').querySelectorAll('[data-b]').forEach((p) => {
      p.classList.toggle('seen', seen.has(p.dataset.b));
      p.classList.toggle('hit', p.dataset.b === lastHit);
    });
    const list = $('buttonList');
    list.innerHTML = '';
    const names = ['left', 'right', 'middle', 'mouse4', 'mouse5', ...[...seen].filter((n) => !BTN_LABEL[n])];
    names.forEach((n) => {
      const r = document.createElement('div');
      r.className = 'dev-row' + (n === lastHit ? ' hit' : '');
      r.innerHTML = `${icon('mouse')}<span></span><span class="dot${seen.has(n) ? ' on' : ''}"></span>`;
      r.querySelector('span').textContent = buttonLabel(n) + (seen.has(n) ? '' : '  · press it once');
      list.append(r);
    });
    $('inputState').textContent = data.status.inputError
      ? `Not listening: ${data.status.inputError}`
      : data.status.accessibility ? 'Listening to every mouse and keyboard. Buttons you map are taken over.' : 'Waiting for the macOS permission (Setup & help).';
  }

  window.ew.on('input', (ev) => {
    if (!data.status.seenButtons.includes(ev.name)) data.status.seenButtons.push(ev.name);
    lastHit = ev.name;
    if (page === 'devices') renderDevices();
    clearTimeout(renderDevices.t);
    renderDevices.t = setTimeout(() => { lastHit = null; if (page === 'devices') renderDevices(); }, 600);
  });

  // ------------------------------------------------------------ Shortcuts page
  function renderShortcuts() {
    const box = $('shortcutList');
    box.innerHTML = '';
    let count = 0;
    const apps = currentApp === 'other' ? ['other'] : [currentApp, 'other'];
    apps.forEach((appId) => {
      const wrap = document.createElement('div');
      wrap.className = 'sc-app';
      wrap.innerHTML = `<h4>${appName(appId)}</h4>`;
      const add = (input, what, extra = '') => {
        const r = document.createElement('div');
        r.className = 'sc-row';
        r.innerHTML = `<span>${input}</span><span class="what"></span><span>${extra}</span>`;
        r.querySelector('.what').textContent = what;
        wrap.append(r);
        count++;
      };
      if (appId !== 'other') {
        data.config.wheel.triggers.filter(Boolean).forEach((t) => {
          add(`${t.delayMs ? 'Hold ' : ''}${kbds(comboParts(t))}`, `Tool wheel · ${data.config.layouts[appId].segments.length} segments`);
        });
        if (appId === 'PPRO' || appId === 'AEFT') ((data.config.search || {}).triggers || []).filter(Boolean).forEach((t) => {
          add(kbds(comboParts(t)), 'Quick search · effects, transitions, looks, commands');
        });
      }
      const ow = data.config.options.wheels[appId] || data.config.options.wheels.other;
      const favs = ow.rings.reduce((n, r) => n + r.filter(Boolean).length, 0);
      data.config.options.triggers.filter(Boolean).forEach((t) => {
        add(`${t.delayMs ? 'Hold ' : ''}${kbds(comboParts(t))}`, `Options wheel · ${favs} favourites`);
      });
      if (appId === apps[0]) data.config.orbit.triggers.filter(Boolean).forEach((t) => add(`${t.delayMs ? 'Hold ' : ''}${kbds(comboParts(t))}`, 'Orbit switch · every app'));
      Object.entries(data.config.profiles[appId] || {}).forEach(([btn, a]) => {
        if (!a || a.type === 'none') return;
        const what = a.type === 'tool' ? toolLabel(a.id) : a.type === 'wheel' ? 'Tool wheel' : a.type === 'options' ? 'Options wheel' : a.type === 'orbit' ? 'Orbit switch' : 'Keystroke';
        add(kbds([buttonLabel(btn)]), what, a.type === 'keys' ? kbds([a.keys]) : '');
      });
      if (wrap.querySelectorAll('.sc-row').length === 0) wrap.insertAdjacentHTML('beforeend', '<p class="muted small">Nothing set yet.</p>');
      box.append(wrap);
    });
    $('shortcutCount').textContent = `${count} assigned`;
  }

  // ------------------------------------------------------------ Appearance page
  // Accents and backgrounds come from one list (src/appearance.js), shared with the wheels
  const LOOK = window.Appearance;
  const look = () => ({ ...LOOK.DEFAULT, ...(data.config.appearance || {}) });

  function applyAppearance() {
    const a = look();
    const [c1, c2] = LOOK.accentOf(a.accent), bg = LOOK.backgroundOf(a.background);
    document.documentElement.style.setProperty('--a1', c1);
    document.documentElement.style.setProperty('--a2', c2);
    // on the body, so they win over the older body[data-bg] rules
    [['--bg', bg.bg], ['--bg2', bg.bg2], ['--glow1', bg.glow1], ['--glow2', bg.glow2]].forEach(([k, v]) => document.body.style.setProperty(k, v));
    document.body.dataset.bg = a.background;
    document.body.classList.toggle('noglow', a.glow === false);
    return a;
  }

  let lookLayout = null;
  async function drawLookPreview() {
    const svg = $('lookWheel');
    if (!svg) return;
    if (!lookLayout) lookLayout = await window.ew.invoke('settings:layout', 'PPRO');
    if (!lookLayout || !lookLayout.segments) return;
    const open = Math.max(0, lookLayout.segments.findIndex((sg) => sg.name === 'Effects'));
    svg.innerHTML = WheelDraw.render(lookLayout, { cx: C, cy: C, hover: { seg: open, tool: 1, openSeg: open }, appLabel: 'Premiere Pro' });
  }

  function renderAppearance() {
    const a = applyAppearance();
    const sw = $('accents');
    sw.innerHTML = '';
    Object.entries(LOOK.ACCENTS).forEach(([id, { name, c: [c1, c2] }]) => {
      const b = document.createElement('button');
      b.className = 'accent-card' + (a.accent === id ? ' on' : '');
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(a.accent === id));
      b.innerHTML = `<span class="accent-dot" style="background:linear-gradient(135deg, ${c1}, ${c2})"></span><b></b><span class="tick">✓</span>`;
      b.querySelector('b').textContent = name;
      b.addEventListener('click', () => setAppearance({ accent: id }));
      sw.append(b);
    });
    const th = $('backgrounds');
    th.innerHTML = '';
    Object.entries(LOOK.BACKGROUNDS).forEach(([id, bg]) => {
      const b = document.createElement('button');
      b.className = 'bg-card' + (a.background === id ? ' on' : '');
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(a.background === id));
      b.innerHTML = `<div class="mini" style="background:linear-gradient(160deg, ${bg.bg2}, ${bg.bg})">
          <span class="m-glow" style="background:${bg.glow2}"></span>
          <div class="m-side"><i class="on"></i><i></i><i></i><i></i></div>
          <div class="m-main"><div class="m-card"></div><div class="m-card"></div></div><span class="m-btn"></span>
        </div><div class="row-name"><b></b><span class="tick">✓</span></div>`;
      b.querySelector('b').textContent = bg.name;
      b.addEventListener('click', () => setAppearance({ background: id }));
      th.append(b);
    });
    $('glow').checked = a.glow !== false;
    $('glass').checked = !!a.glass;
    $('lookStage').classList.toggle('glass', !!a.glass);
    $('lookName').textContent = `${LOOK.ACCENTS[a.accent] ? LOOK.ACCENTS[a.accent].name : 'Sunset'} · ${LOOK.backgroundOf(a.background).name}`;
    drawLookPreview();
  }

  async function setAppearance(patch) {
    await save({ appearance: { ...look(), ...patch } });
    renderAppearance();
  }
  $('glow').addEventListener('change', (e) => setAppearance({ glow: e.target.checked }));
  $('glass').addEventListener('change', (e) => setAppearance({ glass: e.target.checked }));

  // ------------------------------------------------------------ General page
  const CHOICES = {
    genSize: ['wheelSize', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]],
    genAnim: ['animation', [['smooth', 'Smooth'], ['fast', 'Fast'], ['off', 'Off']]],
    genNoteLen: ['noteLength', [['short', 'Short'], ['normal', 'Normal'], ['long', 'Long']]],
  };
  const gen = () => data.config.general || {};
  async function setGeneral(patch) { await save({ general: { ...gen(), ...patch } }); renderGeneral(); }

  async function renderGeneral() {
    const g = gen();
    Object.entries(CHOICES).forEach(([id, [key, items]]) => {
      const box = $(id);
      box.innerHTML = '';
      items.forEach(([value, label]) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.className = g[key] === value ? 'on' : '';
        b.addEventListener('click', () => setGeneral({ [key]: value }));
        box.append(b);
      });
    });
    $('genShow').checked = g.showOnStart !== false;
    $('genNotes').checked = g.notes !== false;
    $('genNoteRow').hidden = g.notes === false;
    // the system knows best whether HaloCut opens at login
    const login = await window.ew.invoke('settings:loginItem');
    $('genLogin').checked = !!login.openAtLogin;
    $('genLoginNote').textContent = login.packaged ? 'It waits quietly in the menu bar' : 'Works once HaloCut runs as the installed app';
  }
  $('genLogin').addEventListener('change', async (e) => {
    const r = await window.ew.invoke('settings:loginItem', e.target.checked);
    data.config.general = { ...gen(), openAtLogin: r.openAtLogin };
    toast(r.openAtLogin ? 'HaloCut starts when you log in' : 'HaloCut won’t start by itself');
    renderGeneral();
  });
  $('genShow').addEventListener('change', (e) => setGeneral({ showOnStart: e.target.checked }));
  $('genNotes').addEventListener('change', (e) => setGeneral({ notes: e.target.checked }));
  $('genExport').addEventListener('click', async () => { const r = await window.ew.invoke('settings:export'); if (r.msg) toast(r.msg, r.ok); });
  $('genImport').addEventListener('click', async () => {
    const r = await window.ew.invoke('settings:import');
    if (!r.ok) { if (r.msg !== 'Nothing loaded') toast(r.msg, false); return; }
    location.reload(); // every page redraws from the loaded settings
  });
  $('genFile').addEventListener('click', () => window.ew.invoke('settings:openConfig'));
  $('genReset').addEventListener('click', async () => {
    const b = $('genReset');
    if (!b.classList.contains('armed')) { // a second click to be sure
      b.classList.add('armed'); b.textContent = 'Click again to reset';
      clearTimeout(b.timer); b.timer = setTimeout(() => { b.classList.remove('armed'); b.textContent = 'Reset…'; }, 3000);
      return;
    }
    await window.ew.invoke('settings:reset');
    location.reload();
  });

  // ------------------------------------------------------------ Setup page + live status
  function renderStatus(s) {
    data.status = s;
    $('stepPerm').classList.toggle('done', s.accessibility);
    $('permBtn').textContent = s.accessibility ? 'Allowed' : 'Open settings';
    $('stepExt').classList.toggle('done', s.extensionInstalled);
    $('installBtn').textContent = s.extensionInstalled ? 'Reinstall' : 'Install';
    $('stepConn').classList.toggle('done', !!(s.bridge.PPRO || s.bridge.AEFT));
    ['PPRO', 'AEFT'].forEach((id) => {
      const el = $(`conn${id}`);
      const c = s.bridge[id];
      el.querySelector('.dot').classList.toggle('on', !!c);
      el.querySelector('.muted').textContent = c ? `Connected · ${c.appVersion}` : 'Not running';
    });
    $('connFront').querySelector('.muted').textContent = s.frontApp || '—';
    const blocked = /(Accessibility|Input Monitoring) is off/.exec(s.inputError || '');
    $('permBanner').hidden = !blocked;
    if (blocked) $('permWhat').textContent = `${blocked[1]} is off for HaloCut`;
    $('inputError').hidden = !s.inputError;
    $('inputError').textContent = s.inputError ? `Input: ${s.inputError}` : '';

    $('pause').querySelector('span').textContent = s.paused ? 'Resume controls' : 'Pause controls';
    $('pause').classList.toggle('on', s.paused);
    const front = s.frontAppId !== 'other' ? appName(s.frontAppId) : (s.frontApp || 'no app');
    $('crumb').textContent = s.paused ? 'Controls paused' : `Editing controls: ${front}`;
    $('liveDot').className = 'dot' + (s.paused || s.inputError ? ' warn' : s.accessibility ? ' on' : '');
    if (page === 'devices') renderDevices();
  }

  $('permBtn').addEventListener('click', () => window.ew.invoke('settings:permissions'));
  $('permFix').addEventListener('click', () => window.ew.invoke('settings:permissions'));
  $('installBtn').addEventListener('click', async () => {
    const res = await window.ew.invoke('settings:install');
    toast(res.msg, res.ok);
  });

  window.ew.on('status', renderStatus);

  // ------------------------------------------------------------ first paint
  renderAppearance();
  renderGeneral();
  renderTriggers('wheel');
  renderTriggers('options');
  renderTriggers('orbit');
  renderTriggers('search');
  renderAppTabs();
  $('orbitTabs').checked = data.config.orbit.showTabs !== false;
  drawOptions();
  renderSlotEditor();
  $('tapToStick').checked = data.config.wheel.tapToStick;
  drawPreview();
  renderSegments();
  renderPicked();
  renderProfile();
  renderDevices();
  renderShortcuts();
  renderStatus(data.status);
  Practice.mount($('timeline'));
  go('wheel');
})();
