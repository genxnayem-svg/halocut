// Draws the Tool wheel as SVG. Used by the overlay and by the settings preview.
(function () {
  const G = window.WheelGeometry;
  const R = G.R;

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

  function icon(name, x, y, size, color) {
    const body = (window.ICONS && window.ICONS[name]) || window.ICONS.dot;
    const s = size / 24;
    return `<g transform="translate(${x - size / 2} ${y - size / 2}) scale(${s})" fill="none" stroke="${color}"
      stroke-width="${1.7 / Math.max(s, 0.6)}" stroke-linecap="round" stroke-linejoin="round" style="color:${color}">${body}</g>`;
  }

  function short(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // opts: { cx, cy, hover: { seg, tool, openSeg }, appLabel }
  function render(layout, opts) {
    const { cx, cy } = opts;
    const hover = opts.hover || { seg: -1, tool: -1, openSeg: -1 };
    const n = layout.segments.length;
    const span = 360 / n;
    const gap = 1.4;
    let out = `
      <defs>
        <radialGradient id="ew-disc" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stop-color="#2a2230" stop-opacity=".97"/>
          <stop offset="100%" stop-color="#151118" stop-opacity=".97"/>
        </radialGradient>
        <filter id="ew-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#000" flood-opacity=".55"/>
        </filter>
        <filter id="ew-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6"/>
        </filter>
      </defs>`;

    // Tool arc of the open segment (drawn first, under the disc edge)
    const open = hover.openSeg;
    if (open >= 0 && open < n && layout.segments[open].tools.length) {
      const seg = layout.segments[open];
      const { step, slots } = G.toolSlots(open, n, seg.tools.length);
      const a0 = slots[0] - step / 2;
      const a1 = a0 + step * seg.tools.length;
      const rIn = R.ring + 8, rOut = R.tools;
      out += `<path d="${sector(cx, cy, rIn, rOut, a0, a1)}" fill="url(#ew-disc)" stroke="rgba(255,255,255,.10)" filter="url(#ew-shadow)"/>`;
      slots.forEach((a, k) => {
        const tool = seg.tools[k];
        const active = hover.seg === open && hover.tool === k;
        const tint = tool.tint || '#ece8f2';
        if (active) {
          out += `<path d="${sector(cx, cy, rIn + 3, rOut - 3, a - step / 2 + 0.8, a + step / 2 - 0.8)}" fill="${seg.color}" opacity=".9"/>`;
        }
        const [x, y] = polar(cx, cy, (rIn + rOut) / 2, a);
        if (tool.icon) out += icon(tool.icon, x, y, step > 24 ? 22 : 18, active ? '#fff' : tint);
        else out += `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="${step > 24 ? 10.5 : 9.5}" font-weight="${active ? 700 : 500}" fill="${active ? '#fff' : 'rgba(236,232,242,.85)'}">${esc(short(tool.label, step > 24 ? 9 : 7))}</text>`;
      });
    }

    // Main disc
    out += `<circle cx="${cx}" cy="${cy}" r="${R.ring}" fill="url(#ew-disc)" stroke="rgba(255,255,255,.10)" filter="url(#ew-shadow)"/>`;

    // Slices first, then every icon and name on top: a lit slice never covers its neighbour's name
    layout.segments.forEach((seg, i) => {
      const mid = G.segmentAngle(i, n);
      const a0 = mid - span / 2 + gap, a1 = mid + span / 2 - gap;
      const active = hover.seg === i && hover.tool < 0;
      const isOpen = open === i;
      if (active || isOpen) {
        out += `<path d="${sector(cx, cy, R.cancel + 6, R.ring - 4, a0, a1)}" fill="${seg.color}" opacity="${active ? 0.95 : 0.35}"/>`;
        if (active) out += `<path d="${sector(cx, cy, R.ring - 10, R.ring - 4, a0, a1)}" fill="${seg.color}" filter="url(#ew-glow)"/>`;
      } else {
        out += `<path d="${sector(cx, cy, R.cancel + 6, R.ring - 4, a0, a1)}" fill="rgba(255,255,255,.035)"/>`;
      }
    });
    layout.segments.forEach((seg, i) => {
      const mid = G.segmentAngle(i, n);
      const active = hover.seg === i && hover.tool < 0;
      const isOpen = open === i;
      const [ix, iy] = polar(cx, cy, (R.cancel + R.ring) / 2 + 2, mid);
      const col = active ? '#fff' : isOpen ? '#fff' : '#cfc8d8';
      if (seg.image) {
        const sz = n > 9 ? 30 : 36;
        out += `<image href="${seg.image}" x="${ix - sz / 2}" y="${iy - sz / 2 - 6}" width="${sz}" height="${sz}"${seg.dim && !active ? ' opacity=".45"' : ''}/>`;
        if (seg.badge) {
          out += `<circle cx="${ix + sz / 2 - 2}" cy="${iy - sz / 2 - 4}" r="8" fill="var(--a2, #e8457c)"/>`;
          out += `<text x="${ix + sz / 2 - 2}" y="${iy - sz / 2 - 0.5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#fff">${seg.badge > 99 ? '99' : seg.badge}</text>`;
        }
        out += `<text x="${ix}" y="${iy + sz / 2 + 6}" text-anchor="middle" class="seg-label" fill="${col}">${esc(short(seg.name, n > 11 ? 10 : n > 9 ? 11 : 12))}</text>`;
      } else {
        out += icon(seg.icon, ix, iy - 7, 20, col);
        out += `<text x="${ix}" y="${iy + 16}" text-anchor="middle" class="seg-label" fill="${col}">${esc(seg.name)}</text>`;
      }
    });

    // Centre: what will run on release
    let title = opts.appLabel || layout.name, sub = 'Release in the centre to cancel';
    if (hover.seg >= 0) {
      const seg = layout.segments[hover.seg];
      const t = hover.tool >= 0 ? seg.tools[hover.tool] : seg.main;
      title = t.label;
      sub = t.hint || seg.name;
    }
    out += `<circle cx="${cx}" cy="${cy}" r="${R.cancel}" fill="#0f0c12" stroke="${hover.seg >= 0 ? layout.segments[hover.seg].color : 'rgba(255,255,255,.14)'}" stroke-width="1.5"/>`;
    out += `<foreignObject x="${cx - 120}" y="${cy + R.ring + 14}" width="240" height="56">
      <div xmlns="http://www.w3.org/1999/xhtml" class="caption"><b>${esc(title)}</b><span>${esc(sub)}</span></div></foreignObject>`;
    out += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" class="centre-mark">${hover.seg >= 0 ? '●' : '✕'}</text>`;
    return out;
  }

  window.WheelDraw = { render };
})();
