// estimation_rules.js
// Shared estimation logic for both internal & customer pages.
// Requires: config.js

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
    const low = Number(cfgUI?.rangeFactor?.low ?? 0.8);
    const high = Number(cfgUI?.rangeFactor?.high ?? 1.2);
    return { from: Math.round(v * low), to: Math.round(v * high) };
  }

  function normalizeByMap(map, val) {
    if (!map) return val;
    const k = String(val ?? "").trim();
    return map[k] ?? val;
  }

  // Try exact label, else bucketize a numeric value into map keys like:
  // "Only 1", "2 to 5", "More than 10"
  function resolveWeight(map, raw) {
    if (!map) return { key: undefined, value: 0 };

    // 1) Exact match
    if (raw in map) return { key: raw, value: map[raw] };

    // 2) If raw is numeric, bucket it
    const n = Number(raw);
    if (!Number.isNaN(n)) {
      let best = { key: undefined, value: undefined };
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
          if (!Number.isNaN(m) && n > m) {
            // pick the smallest upper "more than" that still matches
            if (best.key === undefined || m > Number(best.key.replace(/[^\d.-]/g, "") || -Infinity)) {
              best = { key: label, value: val };
            }
          }
        }
      }
      if (best.key !== undefined) return best;
    }

    // 3) Fallback to default
    if ("default" in map) return { key: "default", value: map.default };
    return { key: undefined, value: 0 };
  }

  // ---------- Rollout ----------
  async function rollout(p, debug = false) {
    const cfgAll = await SOWCFG.get();
    const R  = cfgAll?.rollout || {};
    const UI = cfgAll?.ui || {};
    const AL = cfgAll?.aliases?.rollout || {};

    const siteCountRaw      = normalizeByMap(AL.siteCount, p.siteCount);
    const shipToRegionRaw   = normalizeByMap(AL.shipToRegion, p.shipToRegion);
    const blueprintNeeded   = normalizeByMap(AL.blueprintNeeded, p.blueprintNeeded);

    const baseRes  = resolveWeight(R.baseHours || {}, siteCountRaw);
    const regionV  = (R.regionExtra || {})[shipToRegionRaw] ?? (R.regionExtra?.default ?? 0);

    const total = (blueprintNeeded === "No")
      ? (R.blueprintHours ?? 0)
      : (Number(baseRes.value || 0) + Number(regionV || 0));

    const out = (blueprintNeeded === "No")
      ? { total_effort: total, note: (UI?.notes?.rolloutBlueprint || "Blueprint/Workshop required") }
      : { total_effort: total };

    if (debug) {
      out._debug = {
        inputs: p,
        normalized: { siteCount: siteCountRaw, shipToRegion: shipToRegionRaw, blueprintNeeded },
        baseKey: baseRes.key, baseHours: baseRes.value,
        regionExtra: regionV
      };
    }
    return out;
  }

  // ---------- Upgrade ----------
  async function upgrade(p, debug = false) {
    const cfgAll = await SOWCFG.get();
    const U  = cfgAll?.upgrade || {};
    const UI = cfgAll?.ui || {};
    const AL = cfgAll?.aliases?.upgrade || {};

    const versionRaw   = normalizeByMap(AL.shiperpVersion, p.shiperpVersion);
    const zRaw         = normalizeByMap(AL.zenhancements, p.zenhancements);
    const carriersRaw  = normalizeByMap(AL.onlineCarriers, p.onlineCarriers);
    const ewmRaw       = normalizeByMap(AL.ewmUsage, p.ewmUsage);
    const modulesUsed  = Array.isArray(p.modulesUsed) ? p.modulesUsed : [];

    const vRes = resolveWeight(U.versionWeights || {}, versionRaw);
    const zRes = resolveWeight(U.zEnhancementsWeights || {}, zRaw);
    const cRes = resolveWeight(U.onlineCarriersWeights || {}, carriersRaw);
    const wE   = (ewmRaw === "Yes") ? (U.ewmWeight ?? 0) : 0;
    const wM   = modulesUsed.length > (U.modulesThreshold ?? 0) ? (U.modulesExtra ?? 0) : 0;

    const base = U.baseEffort ?? 0;
    const integ= (U.integrationBase ?? 0) + (U.integrationCoeff ?? 0) * (cRes.value + wE);
    const test = (U.testingBase ?? 0) + (U.testingCoeff ?? 0) * (cRes.value + wM);
    const train= U.training ?? 0;
    const docs = U.documentation ?? 0;

    const core = (U.coreFactor ?? 0) *
      (vRes.value + zRes.value + cRes.value + wE + wM + base + integ + test + train + docs);
    const total = core + base + zRes.value + cRes.value + wE + integ + test + train + docs;

    const out = {
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

    if (debug) {
      out._debug = {
        inputs: p,
        normalized: {
          shiperpVersion: versionRaw,
          zenhancements: zRaw,
          onlineCarriers: carriersRaw,
          ewmUsage: ewmRaw,
          modulesCount: modulesUsed.length
        },
        pickedKeys: { version: vRes.key, z: zRes.key, carriers: cRes.key },
        weights: { version: vRes.value, z: zRes.value, carriers: cRes.value, ewm: wE, modules: wM },
        constants: { base, integrationBase: U.integrationBase ?? 0, testingBase: U.testingBase ?? 0,
          training: train, documentation: docs, coreFactor: U.coreFactor ?? 0 }
      };
    }
    return out;
  }

  // ---------- Other (API) ----------
  async function other(payload) {
    const url = (await SOWCFG.get())?.api?.otherUrl ||
      "https://docqa-api.onrender.com/sow-estimate";
    const res  = await fetch(url, {
      method: "POST", headers: { "Content-Type":"application/json" },
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
    const url = (await SOWCFG.get())?.api?.newCarrierUrl ||
      "https://docqa-api.onrender.com/estimate/new_carrier";
    const res  = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    const json = safeParseJson(text);
    return { total_effort: json?.total_effort ?? null, details: json?.details || null };
  }

  // Expose a debug namespace (optional)
  const debug = {
    rollout: (p) => rollout(p, true),
    upgrade: (p) => upgrade(p, true)
  };

  return { rollout, upgrade, other, newCarrier, debug };
})();
