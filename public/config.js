// config.js — tiny config loader with overrides
window.DOCQA_API_BASE = "https://docqa-api.onrender.com";
window.SOWCFG = (function () {
  const LS_KEY = "sow_config_v1";

  const defaultsUrl = "sow_config.defaults.json"; // relative to your page
  let cache = null;

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
    return res.json();
  }

  function deepMerge(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) return b.slice();
    if (a && typeof a === "object" && b && typeof b === "object") {
      const out = { ...a };
      for (const k of Object.keys(b)) out[k] = deepMerge(a[k], b[k]);
      return out;
    }
    return b === undefined ? a : b;
  }

  function getLocalOverride() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch { return null; }
  }

  function setLocalOverride(obj) {
    localStorage.setItem(LS_KEY, JSON.stringify(obj, null, 2));
  }

  async function load() {
    if (cache) return cache;
    const base = await fetchJson(defaultsUrl);

    // Optional remote URL override via ?config=https://...
    const u = new URL(location.href);
    const remote = u.searchParams.get("config");
    let remoteCfg = null;
    if (remote) {
      try { remoteCfg = await fetchJson(remote); } catch { /* ignore */ }
    }

    const local = getLocalOverride();

    cache = deepMerge(base, deepMerge(remoteCfg || {}, local || {}));
    return cache;
  }

  return {
    load,
    get: async () => await load(),
    getSync: () => cache, // after first load
    setLocalOverride
  };
})();
