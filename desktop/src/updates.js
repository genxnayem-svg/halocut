// Tells you when a newer HaloCut is out: asks GitHub for the latest release of HaloCut's repository and compares
// its version with this one. Nothing is downloaded or installed on its own; the notification opens the installer.
// © 2026 Imtayz Nayem

// "1.2.10" vs "1.2.9" → 1 · "v0.3" vs "0.3.0" → 0 · pre-releases ("0.3.0-beta") count as older than "0.3.0"
function compare(a, b) {
  const parse = (v) => {
    const [main, pre] = String(v || '').trim().replace(/^v/i, '').split('-');
    return { n: main.split('.').map((x) => parseInt(x, 10) || 0), pre: pre || '' };
  };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < Math.max(x.n.length, y.n.length); i++) {
    const d = (x.n[i] || 0) - (y.n[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre > y.pre ? 1 : -1;
}

// "github:owner/name", "owner/name", "https://github.com/owner/name(.git)" or { url } → "owner/name", or '' when unset
function repoOf(repository) {
  const s = typeof repository === 'object' && repository ? repository.url : repository;
  const m = /(?:github:|github\.com[/:])?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(String(s || '').trim());
  return m && !/OWNER/.test(m[1]) ? `${m[1]}/${m[2]}` : '';
}

// The latest release → { newer, version, notes, page, download } (download: the .pkg if there is one, else the .dmg)
function readRelease(rel, current) {
  if (!rel || rel.draft || !rel.tag_name) return { newer: false };
  const version = String(rel.tag_name).replace(/^v/i, '');
  const assets = rel.assets || [];
  const pick = (ext) => assets.find((a) => String(a.name).toLowerCase().endsWith(ext));
  const asset = pick('.pkg') || pick('.dmg');
  return {
    newer: compare(version, current) > 0, version, notes: String(rel.body || '').slice(0, 2000),
    page: rel.html_url || '', download: asset ? asset.browser_download_url : rel.html_url || '',
  };
}

// Asks GitHub. fetchImpl: fetch (global in Electron). Never throws: { ok: false, msg } when it couldn't ask.
async function check({ repo, current, fetchImpl = globalThis.fetch, timeoutMs = 10000 }) {
  if (!repo) return { ok: false, msg: 'No GitHub repository set for updates' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'HaloCut-update-check' }, signal: ctrl.signal,
    });
    if (res.status === 404) return { ok: true, newer: false, msg: 'No releases yet' };
    if (!res.ok) return { ok: false, msg: `GitHub said ${res.status}` };
    return { ok: true, ...readRelease(await res.json(), current) };
  } catch (e) {
    return { ok: false, msg: e.name === 'AbortError' ? 'GitHub did not answer in time' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { compare, repoOf, readRelease, check };
