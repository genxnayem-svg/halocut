// How often each tool is used, per app, and the "Most used" segment built from it: your top tools gather on the
// wheel by themselves. usage: { PPRO: { 'pr.cut': { n: 12, last: 1731500000000 } } }.
// © 2026 Imtayz Nayem
const MAX_FAV = 8, MIN_FAV = 2, KEEP = 200;

function record(usage, appId, toolId, now) {
  const app = { ...((usage || {})[appId] || {}) };
  const was = app[toolId] || { n: 0, last: 0 };
  app[toolId] = { n: was.n + 1, last: now };
  // never grows without end: the least used go first
  const ids = Object.keys(app);
  if (ids.length > KEEP) ids.sort((a, b) => app[a].n - app[b].n || app[a].last - app[b].last).slice(0, ids.length - KEEP).forEach((id) => delete app[id]);
  return { ...(usage || {}), [appId]: app };
}

// The most used tool ids that still exist (valid(id)), most used first; a tie goes to the one used last
function top(usage, appId, valid, limit = MAX_FAV) {
  const app = (usage || {})[appId] || {};
  return Object.keys(app).filter((id) => !valid || valid(id))
    .sort((a, b) => app[b].n - app[a].n || app[b].last - app[a].last).slice(0, limit);
}

// The layout with a "Most used" segment at the end, or the layout as it is when there isn't enough to show yet
function withFavourites(layout, ids, maxSegments = 10) {
  if (!layout || !ids || ids.length < MIN_FAV || layout.segments.length >= maxSegments) return layout;
  return { ...layout, segments: layout.segments.concat([{ name: 'Most used', icon: 'flag', color: '#e9b949', main: ids[0], tools: ids.slice(0, MAX_FAV), auto: true }]) };
}

module.exports = { MAX_FAV, MIN_FAV, record, top, withFavourites };
