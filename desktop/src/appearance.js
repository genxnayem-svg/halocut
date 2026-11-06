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
  };
  // bg2 → bg: the window's gradient · glow1/glow2: the soft light behind the panels · side: the sidebar
  const BACKGROUNDS = {
    dusk: { name: 'Dusk', bg2: '#1b1520', bg: '#141016', glow1: '#7a3324', glow2: '#5b2457' },
    midnight: { name: 'Midnight', bg2: '#121826', bg: '#0d1018', glow1: '#1d3460', glow2: '#33215c' },
    graphite: { name: 'Graphite', bg2: '#1c1c1d', bg: '#141414', glow1: '#3a3a3a', glow2: '#2a2a33' },
    plum: { name: 'Plum', bg2: '#22142a', bg: '#170d1c', glow1: '#5d2a6e', glow2: '#2f2266' },
    black: { name: 'Black', bg2: '#0b0b0c', bg: '#000000', glow1: '#262626', glow2: '#1a1a22' },
  };
  const DEFAULT = { accent: 'sunset', background: 'dusk', glow: true, glass: false };

  const accentOf = (id) => (ACCENTS[id] || ACCENTS.sunset).c;
  const backgroundOf = (id) => BACKGROUNDS[id] || BACKGROUNDS.dusk;

  return { ACCENTS, BACKGROUNDS, DEFAULT, accentOf, backgroundOf };
});
