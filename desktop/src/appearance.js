// HaloCut's looks: accents (two colours that run through tabs, buttons and the wheels) and backgrounds.
// One list for the settings window and the wheels. © 2026 Imtayz Nayem
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Appearance = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const ACCENTS = {
    sunset: { name: 'Sunset', c: ['#ff8a3d', '#e8457c'] },
    ocean: { name: 'Ocean', c: ['#36c2ff', '#5b6cff'] },
    mint: { name: 'Mint', c: ['#4be3b0', '#1fa3a6'] },
    grape: { name: 'Grape', c: ['#c084fc', '#7c4dff'] },
    rose: { name: 'Rose', c: ['#ff8fb1', '#e0457b'] },
    amber: { name: 'Amber', c: ['#ffd166', '#f08a24'] },
    aurora: { name: 'Aurora', c: ['#5ef2c4', '#8f6bff'] },
    ember: { name: 'Ember', c: ['#ff6a3d', '#c4161c'] },
    ice: { name: 'Ice', c: ['#bfe9ff', '#6c8cff'] },
    lime: { name: 'Lime', c: ['#c6f24e', '#3fbf6a'] },
    coral: { name: 'Coral', c: ['#ff9a8b', '#ff5e7e'] },
    gold: { name: 'Gold', c: ['#f6d365', '#d99a1c'] },
    silver: { name: 'Silver', c: ['#e6e6ea', '#8d8d99'] },
  };
  // bg2 → bg: the window's gradient · glow1/glow2: the soft light behind the panels · side: the sidebar
  const BACKGROUNDS = {
    dusk: { name: 'Dusk', bg2: '#1b1520', bg: '#141016', glow1: '#7a3324', glow2: '#5b2457' },
    midnight: { name: 'Midnight', bg2: '#121826', bg: '#0d1018', glow1: '#1d3460', glow2: '#33215c' },
    graphite: { name: 'Graphite', bg2: '#1c1c1d', bg: '#141414', glow1: '#3a3a3a', glow2: '#2a2a33' },
    plum: { name: 'Plum', bg2: '#22142a', bg: '#170d1c', glow1: '#5d2a6e', glow2: '#2f2266' },
    black: { name: 'Black', bg2: '#0b0b0c', bg: '#000000', glow1: '#262626', glow2: '#1a1a22' },
    forest: { name: 'Forest', bg2: '#13211a', bg: '#0c1611', glow1: '#1f5a3a', glow2: '#1d3f4a' },
    deepsea: { name: 'Deep sea', bg2: '#0f1e2a', bg: '#08131c', glow1: '#14506b', glow2: '#1b2f66' },
    wine: { name: 'Wine', bg2: '#27121a', bg: '#190a10', glow1: '#7a1f3a', glow2: '#4a1d4f' },
    // the one light theme: the window turns light; the wheels and the Premiere panel stay dark (they sit over video)
    paper: { name: 'Paper', bg2: '#f6f3f8', bg: '#ebe7ef', glow1: '#ffd9c2', glow2: '#e3d4ff', light: true },
  };
  const DARK_INK = { text: '#efebf4', muted: '#9d95a9', card: 'rgba(255, 255, 255, 0.045)', cardStrong: 'rgba(255, 255, 255, 0.075)',
    line: 'rgba(255, 255, 255, 0.085)', side: 'rgba(12, 9, 14, .55)' };
  const LIGHT_INK = { text: '#231d2b', muted: '#6d6578', card: 'rgba(255, 255, 255, 0.72)', cardStrong: 'rgba(255, 255, 255, 0.95)',
    line: 'rgba(40, 20, 60, 0.13)', side: 'rgba(255, 255, 255, .55)' };
  const WHEEL_DARK = ['#2a2230', '#151118']; // the wheels' own disc, when the theme is light
  const DEFAULT = { accent: 'sunset', background: 'dusk', glow: true, glass: false };

  const accentOf = (id) => (ACCENTS[id] || ACCENTS.sunset).c;
  const backgroundOf = (id) => BACKGROUNDS[id] || BACKGROUNDS.dusk;

  // lighter (amt > 0) or darker (amt < 0) by a share of the way to white or black
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16), to = amt > 0 ? 255 : 0, k = Math.abs(amt);
    const ch = (v) => Math.round(v + (to - v) * k).toString(16).padStart(2, '0');
    return '#' + ch(n >> 16) + ch((n >> 8) & 255) + ch(n & 255);
  }

  // Everything a look comes to, for the settings window, the wheels and the Premiere / After Effects panel.
  function theme(appearance) {
    const a = { ...DEFAULT, ...(appearance || {}) };
    const [a1, a2] = accentOf(a.accent), bg = backgroundOf(a.background), light = !!bg.light;
    const ink = light ? LIGHT_INK : DARK_INK;
    // the wheels take the background's tone; over a light window they keep their dark disc
    const disc = light ? WHEEL_DARK : [shade(bg.bg2, 0.07), shade(bg.bg, -0.1)];
    return { accent: a.accent, background: a.background, light, a1, a2, bg: bg.bg, bg2: bg.bg2, glow1: bg.glow1, glow2: bg.glow2,
      ...ink, disc,
      // the panel sits inside a dark editor: dark themes carry over, the light one keeps the panel's own dark ground
      panel: { accent1: a1, accent2: a2, bg: light ? '#1b1720' : bg.bg2, glow: light ? '#2c1f2a' : shade(bg.glow1, -0.45) } };
  }

  return { ACCENTS, BACKGROUNDS, DEFAULT, accentOf, backgroundOf, theme, shade };
});
