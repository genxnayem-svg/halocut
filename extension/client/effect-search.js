/* HaloCut Studio — effect search ranking: exact, then starts-with, then a word that starts with it,
 * then anywhere in the name, then letters in order. © 2026 Imtayz Nayem */
(function (root) {
  function score(name, q) {
    var n = name.toLowerCase();
    if (n === q) return 0;
    if (n.indexOf(q) === 0) return 1;
    if ((" " + n).indexOf(" " + q) >= 0) return 2;
    if (n.indexOf(q) >= 0) return 3;
    // letters in order, e.g. "gblur" -> Gaussian Blur
    var i = 0;
    for (var k = 0; k < n.length && i < q.length; k++) if (n[k] === q[i]) i++;
    return i === q.length ? 4 : -1;
  }

  // items: [{ name, kind }]. Every word of the query has to match.
  function rank(items, query, limit) {
    var words = String(query || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    var out = [];
    items.forEach(function (it) {
      var total = 0;
      for (var w = 0; w < words.length; w++) {
        var s = score(it.name, words[w]);
        if (s < 0) return;
        total += s;
      }
      // the whole query as one phrase beats the same words scattered
      var whole = score(it.name, words.join(" "));
      if (whole >= 0 && whole < 3) total -= 1;
      out.push({ item: it, score: total });
    });
    out.sort(function (a, b) {
      return a.score - b.score || a.item.name.length - b.item.name.length || (a.item.name < b.item.name ? -1 : 1);
    });
    return out.slice(0, limit || 40).map(function (r) { return r.item; });
  }

  var api = { rank: rank };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HaloEffectSearch = api;
})(typeof self !== "undefined" ? self : this);
