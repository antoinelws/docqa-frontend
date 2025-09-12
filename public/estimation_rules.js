// estimation_rules.js
// Source unique pour client + interne : normalisation + calcul.
// Requiert: config.js (expose window.SOWCFG)

window.SOWRULES = (function () {
  // ---------- helpers ----------
  function safeParseJson(text) {
    try { return JSON.parse(text); } catch {
      const s = text.indexOf("{"), e = text.lastIndexOf("}");
      if (s !== -1 && e > s) { try { return JSON.parse(text.slice(s, e + 1)); } catch {} }
      return null;
    }
  }

  function rngFromCfg(cfgUI, v) {
    const low  = Number(cfgUI?.rangeFactor?.low  ?? 0.8);
    const high = Number(cfgUI?.rangeFactor?.high ?? 1.2);
    return { from: Math.round(v * low), to: Math.round(v * high) };
  }

  function normalizeByMap(map, val) {
    if (!map) return val;
    const k = String(val ?? "").trim();
    return map[k] ?? val;
  }

  // bucketise "Only 1" / "2 to 5" / "More than 10" + support valeurs numériques
  function resolveWeight(map, raw) {
    if (!map) return { key: undefined, value: 0 };

    // 1) Exact match
    if (raw in map) return { key: raw, value: map[raw] };

    // 2) Numérique → trouver le bon intervalle
    const n = Number(raw);
    if (!Number.isNaN(n)) {
      let best;
      for (const [label, val] of Object.entries(map)) {
        const L = label.toLowerCase().trim();
        if (L.startsWith("only ")) {
          const one = Number(L.replace("only", "").trim());
          if (n === one) return { key: label, value: val };
        } else if (L.includes(" to ")) {
          const [aStr, bStr] = L.split(" to ").map(s => s.replace(/[^\d.-]/g, ""));
          const a = Number(aStr), b = Number(bStr);
          if (!Number.isNaN(a) && !Number.isNaN(b) && n >= a && n <= b) {
            return { key: label, value: val };
          }
        } else if (L.startsWith("more than")) {
          const m = Number(L.replace("more than", "").trim());
          if (!Number.isNaN(m) && n > m) best = { key: label, value: val };
        }
      }
      if (best) return best;
    }

    // 3) défaut
    if ("default" in map) return { key: "default", value: map.default };
    return { key: undefined, value: 0 };
  }

  // ---------- Normalisation centralisée: New Carrier ----------
  function normalizeNewCarrierPayload(p, cfgAll) {
    const out = { ...p };

    // types
    out.zEnhancements = Number(out.zEnhancements ?? 0) || 0;

    // alias de clés
    if (out.onlineOffline && !out.onlineOrOffline) out.onlineOrOffline = out.onlineOffline;

    // valeurs canoniques Online/Offline
    if (typeof out.onlineOrOffline === 'string') {
      const s = out.onlineOrOffline.trim().toLowerCase();
      out.onlineOrOffline = (s === 'online' || s === 'on-line') ? 'Online'
                         : (s === 'offline' || s === 'off-line') ? 'Offline'
                         : out.onlineOrOffline;
    }

    // ⚙️ défaut configurable via JSON ("newCarrier.forceOnlineOffline"), sinon "Offline"
    const forced = cfgAll?.newCarrier?.forceOnlineOffline;
    if (!out.onlineOrOffline || !/^(Online|Offline)$/i.test(out.onlineOrOffline)) {
      out.onlineOrOffline = (forced === 'Online' || forced === 'Offline') ? forced : 'Offline';
    }

    // tableaux
    out.features        = Array.isArray(out.features) ? out.features : [];
    out.systemUsed      = Array.isArray(out.systemUsed) ? out.systemUsed : [];
    out.shipmentScreens = Array.isArray(out.shipmentScreens) ? out.shipmentScreens : [];
    out.shipFrom        = Array.isArray(out.shipFrom) ? out.shipFrom : [];
    out.shipTo          = Array.isArray(out.shipTo) ? out.shipTo : [];

    // reconstitution si on n'a qu'une string
    if ((!out.shipmentScreens.length) && typeof out.shipmentScreenString === 'string' && out.shipmentScreenString.trim()) {
      out.shipmentScreens = out.shipmentScreenString.split(",").map(s => s.trim()).filter(Boolean);
    }

    // info utile potentielle côté backend
    out.featuresCount = out.features.length;

    return out;
  }

  // ---------- Rollout ----------
  async function rollout(p) {
    const cfgAll = await SOWCFG.get();
    const R  = cfgAll?.rollout || {};
    const UI = cfgAll?.ui || {};
    const AL = cfgAll?.aliases?.rollout || {};

    const siteCount       = normalizeByMap(AL.siteCount, p.siteCount);
    const shipToRegion    = normalizeByMap(AL.shipToRegion, p.shipToRegion);
    const blueprintNeeded = normalizeByMap(AL.blueprintNeeded, p.blueprintNeeded);

    const baseRes = resolveWeight(R.baseHours || {}, siteCount);
    const regionV = (R.regionExtra || {})[shipToRegion] ?? (R.regionExtra?.default ?? 0);

    if (blueprintNeeded === "No") {
      return {
        total_effort: R.blueprintHours ?? 0,
        note: UI?.notes?.rolloutBlueprint || "Blueprint/Workshop required"
      };
    }
    return { total_effort: Number(baseRes.value || 0) + Number(regionV || 0) };
  }

  // ---------- Upgrade ----------
  async function upgrade(p) {
    const cfgAll = await SOWCFG.get();
    const U  = cfgAll?.upgrade || {};
    const UI = cfgAll?.ui || {};
    const AL = cfgAll?.aliases?.upgrade || {};

    const version     = normalizeByMap(AL.shiperpVersion, p.shiperpVersion);
    const z           = normalizeByMap(AL.zenhancements, p.zenhancements);
    const carriers    = normalizeByMap(AL.onlineCarriers, p.onlineCarriers);
    const ewm         = normalizeByMap(AL.ewmUsage, p.ewmUsage);
    const modulesUsed = Array.isArray(p.modulesUsed) ? p.modulesUsed : [];

    const vRes = resolveWeight(U.versionWeights || {},         version);
    const zRes = resolveWeight(U.zEnhancementsWeights || {},   z);
    const cRes = resolveWeight(U.onlineCarriersWeights || {},  carriers);
    const wE   = (ewm === "Yes") ? (U.ewmWeight ?? 0) : 0;
    const wM   = modulesUsed.length > (U.modulesThreshold ?? 0) ? (U.modulesExtra ?? 0) : 0;

    const base  = U.baseEffort ?? 0;
    const integ = (U.integrationBase ?? 0) + (U.integrationCoeff ?? 0) * (cRes.value + wE);
    const test  = (U.testingBase ?? 0) + (U.testingCoeff ?? 0) * (cRes.value + wM);
    const train = U.training ?? 0;
    const docs  = U.documentation ?? 0;

    const core  = (U.coreFactor ?? 0) *
      (vRes.value + zRes.value + cRes.value + wE + wM + base + integ + test + train + docs);
    const total = core + base + zRes.value + cRes.value + wE + integ + test + train + docs;

    return {
      range_core:        rngFromCfg(UI, core),
      range_foundation:  rngFromCfg(UI, base),
      range_z:           rngFromCfg(UI, zRes.value + wE),
      range_carriers:    rngFromCfg(UI, cRes.value),
      range_integration: rngFromCfg(UI, integ),
      range_testing:     rngFromCfg(UI, test),
      range_training:    rngFromCfg(UI, train),
      range_docs:        rngFromCfg(UI, docs),
      range_total:       rngFromCfg(UI, total)
    };
  }

  // ---------- Other (API) ----------
  async function other(payload) {
    const url = (await SOWCFG.get())?.api?.otherUrl ||
      "https://docqa-api.onrender.com/sow-estimate";

    const res  = await fetch(url, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    const data = safeParseJson(text);
    if (!data) return { total_effort: null, details: null };

    return {
      total_effort: (data?.from != null && data?.to != null) ? `${data.from}-${data.to}` : null,
      details: data?.details || null
    };
  }

  // ---------- New Carrier (API) ----------
  async function newCarrier(payload) {
    const cfg = await SOWCFG.get();
    const url = cfg?.api?.newCarrierUrl ||
      "https://docqa-api.onrender.com/estimate/new_carrier";

    // Normalisation centralisée + défauts
    const norm = normalizeNewCarrierPayload(payload, cfg);

    const res  = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(norm)
    });

    const text = await res.text();
    const json = safeParseJson(text);
    return {
      total_effort: json?.total_effort ?? null,
      details: json?.details || null
    };
  }

  return { rollout, upgrade, other, newCarrier };
})();
