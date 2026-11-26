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
    // Aurora glass: a tinted, see-through disc lit by the accent colours (--a1, --a2), a coloured rim and a soft shine
    const A1 = 'var(--a1, #ff8a3d)', A2 = 'var(--a2, #e8457c)';
    let out = `
      <defs>
        <radialGradient id="ew-disc" cx="${cx}" cy="${cy - R.ring * 0.2}" r="${R.ring * 1.1}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--wd1, #2a1f33)" stop-opacity=".66"/>
          <stop offset="100%" stop-color="var(--wd3, #0c0810)" stop-opacity=".82"/>
        </radialGradient>
        <radialGradient id="ew-wash" cx="${cx - R.ring * 0.45}" cy="${cy - R.ring * 0.55}" r="${R.ring * 1.7}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${A1}" stop-opacity=".40"/>
          <stop offset="50%" stop-color="${A2}" stop-opacity=".14"/>
          <stop offset="100%" stop-color="${A2}" stop-opacity=".30"/>
        </radialGradient>
        <linearGradient id="ew-rim" x1="${cx - R.ring}" y1="${cy - R.ring}" x2="${cx + R.ring}" y2="${cy + R.ring}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${A1}"/><stop offset="100%" stop-color="${A2}"/>
        </linearGradient>
        <linearGradient id="ew-shine" x1="0" y1="${cy - R.ring}" x2="0" y2="${cy - R.ring * 0.3}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#fff" stop-opacity=".30"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="ew-sheen" x1="0" y1="${cy - R.tools}" x2="0" y2="${cy + R.tools}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#fff" stop-opacity=".34"/><stop offset="55%" stop-color="#fff" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".18"/>
        </linearGradient>
        <clipPath id="ew-clip"><circle cx="${cx}" cy="${cy}" r="${R.ring}"/></clipPath>
        <filter id="ew-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="17" flood-color="#000" flood-opacity=".6"/>
        </filter>
        <filter id="ew-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8"/>
        </filter>
        <filter id="ew-glow2" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4"/>
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
      const arcPath = sector(cx, cy, rIn, rOut, a0, a1);
      out += `<path d="${arcPath}" fill="none" stroke="url(#ew-rim)" stroke-width="7" filter="url(#ew-glow)" opacity=".6"/>`;
      out += `<path d="${arcPath}" fill="url(#ew-disc)" filter="url(#ew-shadow)"/><path d="${arcPath}" fill="url(#ew-wash)"/>`;
      out += `<path d="${arcPath}" fill="none" stroke="url(#ew-rim)" stroke-width="1.6"/>`;
      slots.forEach((a, k) => {
        const tool = seg.tools[k];
        const active = hover.seg === open && hover.tool === k;
        const tint = tool.tint || '#ece8f2';
        if (active) {
          const d = sector(cx, cy, rIn + 3, rOut - 3, a - step / 2 + 0.8, a + step / 2 - 0.8);
          out += `<path d="${d}" fill="${seg.color}" filter="url(#ew-glow2)" opacity=".8"/><path d="${d}" fill="${seg.color}"/><path d="${d}" fill="url(#ew-sheen)"/><path d="${d}" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="1"/>`;
        }
        const [x, y] = polar(cx, cy, (rIn + rOut) / 2, a);
        if (tool.icon) out += icon(tool.icon, x, y, step > 24 ? 22 : 18, active ? '#fff' : tint);
        else out += `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="${step > 24 ? 10.5 : 9.5}" font-weight="${active ? 700 : 500}" fill="${active ? '#fff' : 'rgba(236,232,242,.85)'}">${esc(short(tool.label, step > 24 ? 9 : 7))}</text>`;
      });
    }

    // Main disc
    out += `<circle cx="${cx}" cy="${cy}" r="${R.ring + 2}" fill="none" stroke="url(#ew-rim)" stroke-width="9" filter="url(#ew-glow)" opacity=".8"/>`;
    out += `<circle cx="${cx}" cy="${cy}" r="${R.ring}" fill="url(#ew-disc)" filter="url(#ew-shadow)"/>`;
    out += `<circle cx="${cx}" cy="${cy}" r="${R.ring}" fill="url(#ew-wash)"/>`;

    // Slices first, then every icon and name on top: a lit slice never covers its neighbour's name
    layout.segments.forEach((seg, i) => {
      const mid = G.segmentAngle(i, n);
      const a0 = mid - span / 2 + gap, a1 = mid + span / 2 - gap;
      const active = hover.seg === i && hover.tool < 0;
      const isOpen = open === i;
      const d = sector(cx, cy, R.cancel + 6, R.ring - 5, a0, a1);
      if (active) {
        // the picked slice: its own colour, glowing, with a sheen and a fine bright edge
        out += `<path d="${d}" fill="${seg.color}" filter="url(#ew-glow)" opacity=".85"/><path d="${d}" fill="${seg.color}"/>`;
        out += `<path d="${d}" fill="url(#ew-sheen)"/><path d="${d}" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1"/>`;
      } else if (isOpen) {
        out += `<path d="${d}" fill="${seg.color}" opacity=".38"/><path d="${d}" fill="none" stroke="${seg.color}" stroke-width="1"/>`;
      } else {
        out += `<path d="${d}" fill="rgba(255,255,255,.055)" stroke="rgba(255,255,255,.12)" stroke-width=".8"/>`;
      }
    });
    // the shine on the glass, and its coloured rim
    out += `<g clip-path="url(#ew-clip)"><ellipse cx="${cx}" cy="${cy - R.ring * 0.81}" rx="${R.ring * 0.93}" ry="${R.ring * 0.44}" fill="url(#ew-shine)"/></g>`;
    out += `<circle cx="${cx}" cy="${cy}" r="${R.ring - 0.8}" fill="none" stroke="url(#ew-rim)" stroke-width="2"/>`;
    layout.segments.forEach((seg, i) => {
      const mid = G.segmentAngle(i, n);
      const active = hover.seg === i && hover.tool < 0;
      const isOpen = open === i;
      const [ix, iy] = polar(cx, cy, (R.cancel + R.ring) / 2 + 2, mid);
      const col = active ? '#fff' : isOpen ? '#fff' : '#f1ecf7';
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
    let title = opts.appLabel || layout.name, sub = opts.sub || 'Release in the centre to cancel';
    if (hover.seg >= 0) {
      const seg = layout.segments[hover.seg];
      const t = hover.tool >= 0 ? seg.tools[hover.tool] : seg.main;
      title = t.label;
      sub = t.hint || seg.name;
    }
    const hub = hover.seg >= 0 ? layout.segments[hover.seg].color : 'url(#ew-rim)';
    out += `<circle cx="${cx}" cy="${cy}" r="${R.cancel + 3}" fill="none" stroke="${hub}" stroke-width="5" filter="url(#ew-glow2)" opacity=".85"/>`;
    out += `<circle cx="${cx}" cy="${cy}" r="${R.cancel}" fill="rgba(10,7,14,.8)" stroke="${hub}" stroke-width="1.6"/>`;
    out += `<foreignObject x="${cx - 120}" y="${cy + R.ring + 14}" width="240" height="56">
      <div xmlns="http://www.w3.org/1999/xhtml" class="caption"><b>${esc(title)}</b><span>${esc(sub)}</span></div></foreignObject>`;
    out += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" class="centre-mark">${hover.seg >= 0 ? '●' : '✕'}</text>`;
    return out;
  }

  window.WheelDraw = { render };
})();
