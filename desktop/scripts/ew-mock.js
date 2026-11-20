// A stand-in for the desktop app's bridge (window.ew), for looking at the settings window in a browser.
// Loaded only by the preview server (?mock=ew); the app itself never uses it.
(function () {
  let data = null;
  const ready = fetch('/__ew-data.json').then((r) => r.json()).then((d) => { data = d; });
  const layout = (appId, idx) => {
    const all = [data.config.layouts[appId]].concat((data.config.extraLayouts || {})[appId] || []);
    const l = all[idx || 0] || all[0];
    if (!l) return null;
    const info = (id) => { const t = data.tools[id] || { label: id, icon: 'dot' }; return { id, label: t.label, icon: t.icon, tint: t.tint, hint: t.hint }; };
    return { name: l.name, segments: l.segments.map((s) => ({ name: s.name, icon: s.icon, color: s.color, main: info(s.main), tools: s.tools.map(info) })) };
  };
  let login = false;
  const handlers = {};
  window.__ewEmit = (channel, payload) => (handlers[channel] || []).forEach((fn) => fn(payload)); // play the app's side in a preview
  window.__ewLayout = async (appId) => { await ready; return layout(appId); };
  window.ew = {
    on: (channel, fn) => { (handlers[channel] = handlers[channel] || []).push(fn); },
    click: () => {},
    invoke: async (channel, ...args) => {
      await ready;
      switch (channel) {
        case 'settings:get': return JSON.parse(JSON.stringify(data));
        case 'settings:set': Object.assign(data.config, args[0]); return JSON.parse(JSON.stringify(data.config));
        case 'settings:layout': return layout(args[0], args[1]);
        case 'settings:loginItem': if (args[0] !== undefined) login = !!args[0]; return { openAtLogin: login, packaged: true };
        case 'settings:orbitPreview': return null;
        case 'settings:readGrade': return { ok: true, msg: 'A001.mov', data: { here: { id: 'n1', name: 'A001.mov' }, values: { exposure: 0.4, contrast: 12 }, had: true } };
        case 'settings:catalog': return { items: window.ToolCatalog.build({ tools: data.tools, app: args[0], cores: null }), groups: window.ToolCatalog.GROUPS, note: '', live: false };
        default: return { ok: true, msg: `(preview: ${channel.replace('settings:', '')})` };
      }
    },
  };
})();
