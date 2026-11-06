// Draws the Options wheel (three rings) as SVG. Used by the overlay and the settings preview.
(function () {
  const OG = window.OptionsGeometry;
  const MAC = /Mac/.test(navigator.platform);

  function polar(cx, cy, r, a) {
    const rad = (a * Math.PI) / 180;
    return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
  }

  function sector(cx, cy, r0, r1, a0, a1) {
    const large = a1 - a0 > 180 ? 1 : 0;
    const [x0, y0] = polar(cx, cy, r1, a0), [x1, y1] = polar(cx, cy, r1, a1);
    const [x2, y2] = polar(cx, cy, r0, a1), [x3, y3] = polar(cx, cy, r0, a0);
    return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Split a label into at most two lines that fit roughly `max` characters.
  function lines(label, max) {
    if (label.length <= max) return [label];
    const words = label.split(' ');
    let a = '';
    while (words.length && (a + ' ' + words[0]).trim().length <= max) a = (a + ' ' + words.shift()).trim();
    const b = words.join(' ');
    if (!a) return [label.slice(0, max - 1) + '…'];
    return [a, b.length > max ? b.slice(0, max - 1) + '…' : b];
  }

  // "mod+shift+k" -> "⇧⌘K"
  function keysText(keys) {
    const MOD = MAC ? { mod: '⌘', cmd: '⌘', ctrl: '⌃', alt: '⌥', shift: '⇧' } : { mod: 'Ctrl', cmd: 'Win', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift' };
    const NAMES = { space: 'Space', right: '→', left: '←', up: '↑', down: '↓', equal: '=', minus: '−', enter: '↩', delete: '⌦', backspace: '⌫' };
    const parts = keys.split('+');
    const main = parts.pop();
    const mods = parts.map((p) => MOD[p] || p);
    const name = NAMES[main] || (main.length === 1 ? main.toUpperCase() : main);
    return MAC ? mods.join('') + name : [...mods, name].join(' + ');
  }

  function describe(slot) {
    if (!slot) return 'Empty slot';
    const a = slot.action || {};
    switch (a.type) {
      case 'keys': return keysText(a.keys || '');
      case 'text': return `Types “${(a.text || '').slice(0, 18)}${(a.text || '').length > 18 ? '…' : ''}”`;
      case 'launch': return `Opens ${(a.target || '').replace(/^https?:\/\//, '').slice(0, 24)}`;
      case 'tool': return 'HaloCut tool';
      case 'macro': return `Macro · ${(a.steps || []).length} steps`;
      default: return '';
    }
  }

  // An arc along radius r from angle a0 to a1 (for the glowing edge of the slice being pointed at).
  function arc(cx, cy, r, a0, a1) {
    const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
    return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  }

  // The slot of ring `ri` that sits at angle `a` (the one the pointer crossed on its way out).
  function slotAt(ring, a) { const n = ring.length; return Math.round(OG.norm(a) / (360 / n)) % n; }

  // HaloCut's mark: the halo, open at the top right, with its spark. Drawn at (x, y), r across.
  function mark(x, y, r) {
    const c = 2 * Math.PI * r;
    return `<g transform="translate(${x} ${y})">
      <circle r="${r}" fill="none" stroke="url(#ow-halo)" stroke-width="${r * 0.36}" stroke-linecap="round"
        stroke-dasharray="${c * 0.847} ${c * 0.153}" stroke-dashoffset="${-c * 0.188}" transform="rotate(-90)"/>
      <circle cx="${r * 0.64}" cy="${-r * 0.77}" r="${r * 0.3}" fill="#ffd0a0" opacity=".55"/>
      <circle cx="${r * 0.64}" cy="${-r * 0.77}" r="${r * 0.12}" fill="#fff"/>
      <circle r="${r * 0.18}" fill="#fff"/>
    </g>`;
  }

  const FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', Inter, sans-serif";

  // opts: { cx, cy, hover: { ring, slot }, appLabel, selected: { ring, slot } }
  function render(rings, opts) {
    const { cx, cy } = opts;
    const hover = opts.hover || { ring: -1, slot: -1 };
    const sel = opts.selected || { ring: -1, slot: -1 };
    const outer = OG.R.rings[2][1], inner = OG.R.cancel;
    const hotAngle = hover.ring >= 0 ? OG.slotAngle(hover.slot, rings[hover.ring].length) : null;
    const u = (id) => `url(#${id})`;
    let out = `
      <defs>
        <radialGradient id="ow-disc" cx="${cx}" cy="${cy - outer * 0.25}" r="${outer * 1.15}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#2b2431"/><stop offset="70%" stop-color="#18141d"/><stop offset="100%" stop-color="#0f0c13"/>
        </radialGradient>
        <linearGradient id="ow-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff" stop-opacity=".22"/><stop offset="55%" stop-color="#fff" stop-opacity=".05"/><stop offset="100%" stop-color="#fff" stop-opacity=".1"/>
        </linearGradient>
        <linearGradient id="ow-band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff" stop-opacity=".065"/><stop offset="100%" stop-color="#fff" stop-opacity=".025"/>
        </linearGradient>
        <filter id="ow-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000" flood-opacity=".6"/>
        </filter>
        <radialGradient id="ow-hot" cx="${cx}" cy="${cy}" r="${outer}" gradientUnits="userSpaceOnUse">
          <stop offset="20%" stop-color="var(--a2, #e8457c)" stop-opacity=".7"/><stop offset="100%" stop-color="var(--a2, #e8457c)"/>
        </radialGradient>
        <linearGradient id="ow-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff" stop-opacity=".22"/><stop offset="60%" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
        <radialGradient id="ow-trail" cx="${cx}" cy="${cy}" r="${outer}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--a2, #e8457c)" stop-opacity=".06"/><stop offset="100%" stop-color="var(--a2, #e8457c)" stop-opacity=".3"/>
        </radialGradient>
        <linearGradient id="ow-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="var(--a1, #ff8a3d)"/><stop offset="100%" stop-color="var(--a2, #e8457c)"/>
        </linearGradient>
        <radialGradient id="ow-core" cx="${cx}" cy="${cy - inner * 0.4}" r="${inner * 1.2}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#231c28"/><stop offset="100%" stop-color="#0b090e"/>
        </radialGradient>
        <linearGradient id="ow-halo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffb347"/><stop offset="45%" stop-color="#ff5d7a"/><stop offset="100%" stop-color="#9b5cff"/>
        </linearGradient>
        <filter id="ow-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx="${cx}" cy="${cy}" r="${outer + 3}" fill="${u('ow-disc')}" filter="${u('ow-shadow')}"/>
      <circle cx="${cx}" cy="${cy}" r="${outer + 2.5}" fill="none" stroke="${u('ow-rim')}" stroke-width="1"/>
      <g font-family="${FONT}">`;

    let hot = '';
    rings.forEach((ring, ri) => {
      const [r0, r1] = OG.R.rings[ri];
      const n = ring.length, span = 360 / n, rm = (r0 + r1) / 2;
      const size = [11.5, 10.5, 9.8][ri];
      // the inner ring reads level; the outer two turn to follow the ring, so longer names fit along it
      const along = ri > 0, max = along ? Math.max(6, Math.floor((rm * span * Math.PI / 180 - 10) / (size * 0.56))) : 11;
      // the slice on this ring that the pointer crossed on its way out to the one it is on
      const trail = hotAngle !== null && ri < hover.ring ? slotAt(ring, hotAngle) : -1;
      // the band: a soft top-lit ring, hairlines at its edges
      out += `<path d="${sector(cx, cy, r0, r1, 0, 359.999)}" fill="${u('ow-band')}"/>`;
      out += `<circle cx="${cx}" cy="${cy}" r="${r1}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="1"/>`;
      out += `<circle cx="${cx}" cy="${cy}" r="${r0}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1.5"/>`;
      ring.forEach((slot, si) => {
        const mid = OG.slotAngle(si, n), a0 = mid - span / 2, a1 = mid + span / 2;
        const isHot = hover.ring === ri && hover.slot === si, isSel = sel.ring === ri && sel.slot === si;
        // the hairline between this slice and the next
        const [lx0, ly0] = polar(cx, cy, r0 + 1, a1), [lx1, ly1] = polar(cx, cy, r1 - 1, a1);
        out += `<line x1="${lx0}" y1="${ly0}" x2="${lx1}" y2="${ly1}" stroke="rgba(0,0,0,.5)" stroke-width="1.5"/>`;
        if (si === trail) out += `<path d="${sector(cx, cy, r0 + 1, r1 - 1, a0 + 0.4, a1 - 0.4)}" fill="${u('ow-trail')}"/>`;
        if (isSel && !isHot) out += `<path d="${sector(cx, cy, r0 + 1.5, r1 - 1.5, a0 + 0.6, a1 - 0.6)}" fill="rgba(255,255,255,.08)" stroke="var(--a1, #ff8a3d)" stroke-width="1.5"/>`;
        if (isHot) {
          const d = sector(cx, cy, r0 + 1, r1 - 0.5, a0 + 0.4, a1 - 0.4);
          // lifted: drawn after every ring, with a sheen, a fine border and the glowing outer edge
          hot = `<path d="${d}" fill="${u('ow-hot')}"/><path d="${d}" fill="${u('ow-sheen')}" opacity=".6"/>
            <path d="${d}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1"/>
            <path d="${arc(cx, cy, r1 - 1.5, a0 + 1, a1 - 1)}" fill="none" stroke="var(--a1, #ff8a3d)" stroke-width="3" stroke-linecap="round" filter="${u('ow-glow')}"/>`;
        }
        const [x, y] = polar(cx, cy, rm, mid);
        if (!slot) { out += `<circle cx="${x}" cy="${y}" r="1.6" fill="rgba(255,255,255,.16)"/>`; return; }
        const turn = along ? (mid > 90 && mid < 270 ? mid - 180 : mid) : 0; // flipped on the lower half so nothing reads upside down
        const label = textBlock(lines(slot.label, max), size, isHot ? '#fff' : si === trail ? 'rgba(255,238,244,.96)' : 'rgba(232,228,240,.74)', isHot ? 650 : ri === 0 ? 560 : 500);
        if (isHot) hot += `<g transform="translate(${x} ${y}) rotate(${turn})">${label}</g>`;
        else out += `<g transform="translate(${x} ${y}) rotate(${turn})">${label}</g>`;
      });
    });
    out += hot; // the pointed-at slice sits on top, so its glow isn't covered by the next ring

    // Centre: HaloCut's mark, then what will run on release, and its keys in a chip
    const slot = hover.ring >= 0 ? rings[hover.ring][hover.slot] : null;
    const title = hover.ring >= 0 ? (slot ? slot.label : 'Empty slot') : (opts.appLabel || 'Options wheel');
    const keys = slot && slot.action && slot.action.type === 'keys';
    const sub = hover.ring >= 0 ? describe(slot) : 'Centre cancels';
    const rc = inner - 4;
    out += `<circle cx="${cx}" cy="${cy}" r="${rc + 3}" fill="rgba(0,0,0,.35)"/>`;
    out += `<circle cx="${cx}" cy="${cy}" r="${rc}" fill="${u('ow-core')}" stroke="${hover.ring >= 0 ? u('ow-ring') : 'rgba(255,255,255,.12)'}" stroke-width="${hover.ring >= 0 ? 2 : 1}"/>`;
    out += mark(cx, cy - 22, 9.5);
    out += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" letter-spacing=".1">${esc(lines(title, 12)[0])}</text>`;
    if (keys) {
      const w = Math.max(18, sub.length * 7 + 10);
      out += `<rect x="${cx - w / 2}" y="${cy + 12}" width="${w}" height="16" rx="5" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.16)"/>`;
      out += `<text x="${cx}" y="${cy + 23.5}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--a1, #ff8a3d)" font-family="ui-monospace, Menlo, monospace">${esc(sub)}</text>`;
    } else {
      out += `<text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="9.5" fill="${hover.ring >= 0 ? 'var(--a1, #ff8a3d)' : 'rgba(255,255,255,.45)'}">${esc(lines(sub, 15)[0])}</text>`;
    }
    return out + '</g>';
  }

  // A label of one or two lines centred on (0, 0).
  function textBlock(ls, size, col, weight) {
    return ls.map((l, li) => `<text x="0" y="${(li - (ls.length - 1) / 2) * (size + 1.6) + size / 3}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${col}" letter-spacing=".15">${esc(l)}</text>`).join('');
  }

  window.OptionsDraw = { render, describe, keysText };
})();
