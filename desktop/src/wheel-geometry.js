// Tool wheel geometry, shared by the main process (hit testing) and the renderers (drawing).
// Angles are in degrees, 0 at the top, clockwise.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WheelGeometry = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const R = { cancel: 46, ring: 150, tools: 238 };

  function norm(a) { return ((a % 360) + 360) % 360; }
  function angleDiff(a, b) { const d = norm(a - b); return d > 180 ? d - 360 : d; }

  function segmentAngle(i, count) { return (i * 360) / count; }

  // Where each tool of a segment sits on the outer ring: an arc centred on the segment.
  function toolSlots(segIndex, segCount, toolCount) {
    const step = Math.max(18, Math.min(30, 300 / Math.max(1, toolCount)));
    const centre = segmentAngle(segIndex, segCount);
    const start = centre - ((toolCount - 1) * step) / 2;
    const slots = [];
    for (let k = 0; k < toolCount; k++) slots.push(norm(start + k * step));
    return { step, slots };
  }

  function toolUnder(angle, segIndex, segCount, toolCount) {
    if (toolCount === 0) return -1;
    const { step, slots } = toolSlots(segIndex, segCount, toolCount);
    let best = -1, bestDiff = Infinity;
    slots.forEach((s, k) => {
      const d = Math.abs(angleDiff(angle, s));
      if (d < bestDiff) { bestDiff = d; best = k; }
    });
    return bestDiff <= step / 2 + 0.01 ? best : -1;
  }

  // dx, dy: pointer offset from the wheel centre (screen pixels, y down).
  // openSeg: segment whose tools are currently fanned out (keeps it open while you travel outward).
  function hit(dx, dy, layout, openSeg) {
    const n = layout.segments.length;
    const dist = Math.hypot(dx, dy);
    const angle = norm((Math.atan2(dx, -dy) * 180) / Math.PI);
    if (dist < R.cancel || n === 0) return { seg: -1, tool: -1, dist, angle };

    const segUnder = Math.round(angle / (360 / n)) % n;
    if (dist < R.ring) return { seg: segUnder, tool: -1, dist, angle };

    if (openSeg >= 0 && openSeg < n) {
      const t = toolUnder(angle, openSeg, n, layout.segments[openSeg].tools.length);
      if (t >= 0) return { seg: openSeg, tool: t, dist, angle };
    }
    const t = toolUnder(angle, segUnder, n, layout.segments[segUnder].tools.length);
    return { seg: segUnder, tool: t, dist, angle };
  }

  // What a hit result resolves to: a tool id, or null for cancel.
  function resolve(h, layout) {
    if (h.seg < 0) return null;
    const seg = layout.segments[h.seg];
    return h.tool >= 0 ? seg.tools[h.tool] : seg.main;
  }

  return { R, norm, angleDiff, segmentAngle, toolSlots, hit, resolve };
});
