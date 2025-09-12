// estimation_rules.js
// Shared estimation logic used by both internal and customer pages.
// Requires config.js to be loaded first.

window.SOWRULES = (function () {

  // ---------- helpers ----------
  function safeParseJson(text) {
    // tolerate JSON + trailing noise
    try { return JSON.parse(text); } catch {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end > start) {
        try { return JSON.parse(text.slice(start, end + 1)); } catch {}
      }
      return null;
    }
  }

  function rngFromCfg(cfgUI, v) {
    const low = Number(cfgUI?.rangeFactor?.low ?? 0.8);
    const high = Number(cfgUI?.rangeFactor?.high ?? 1.2);
    return { from: Math.round(v * low), to: Math.round(v * high) };
  }

  function normalize(map, val) {
    if (!map) return val;
    const k = String(val ?? "").trim();
    return map[k] ?? val;
  }

  // ---------- Rollout ----------
  async function rollout(p) {
    const cfgAll = await SOWCFG.get();
    const R  = cfgAll?.rollout || {};
    const UI = cfgAll?.ui || {};
    const AL = cfgAll?.aliases?.rollout || {};

    const siteCount      = normalize(AL.siteCount, p.siteCount);
    const shipToRegion   = normalize(AL.shipToRegion, p.shipToRegion);
    const blueprintNeeded= normalize(AL.blueprintNeeded, p.blueprintNeeded);

    const base   = (R.baseHours || {})[siteCount] ?? 0;
    const extra  = (R.regionExtra || {})[shipToRegion] ?? (R.regionExtra?.default ?? 0);

    if (blueprintNeeded === "No") {
      return {
        total_effort: R.blueprintHours ?? 0,
        note: UI?.notes?.rolloutBlueprint || "Blueprint/Workshop required"
      };
    }
    return { total_effort: base + extra };
  }

  // ---------- Upgrade ----------
  async function upgrade(p) {
    const cfgAll = await SOWCFG.get();
    const U  = cfgAll?.upgrade || {};
    const UI = cfgAll?.ui || {};
    const AL = cfgAll?.aliases?.upgrade || {};

    const shiperpVersion = normalize(AL.shiperpVersion, p.shiperpVersion);
    const zenhancements  = normalize(AL.zenhancements, p.zenhancements);
    const onlineCarriers = normalize(AL.onlineCarriers, p.onlineCarriers);
    const ewmUsage       = normalize(AL.ewmUsage, p.ewmUsage);
    const modulesUsed    = Array.isArray(p.modulesUsed) ? p.modulesUsed : [];

    const wV = (U.versionWeights?.[shiperpVersion] ?? U.versionWeights?.default ?? 0);
    const wZ = (U.zEnhancementsWeights?.[zenhancements] ?? U.zEnhancementsWeights?.default ?? 0);
    const wC = (U.onlineCarriersWeights?.[onlineCarriers] ?? U.onlineCarriersWeights?.default ?? 0);
    const wE = (ewmUsage === "Yes") ? (U.ewmWeight ?? 0) : 0;
    const wM = modulesUsed.length > (U.modulesThreshold ?? 0) ? (U.modulesExtra ?? 0) : 0;

    const base = U.baseEffort ?? 0;
    const integ= (U.integrationBase ?? 0) + (U.integrationCoeff ?? 0) * (wC + wE);
    const test = (U.testingBase ?? 0) + (U.testingCoeff ?? 0) * (wC + wM);
    const train= U.training ?? 0;
    const docs = U.documentation ?? 0;

    const core = (U.coreFactor ?? 0) *
      (wV + wZ + wC + wE + wM + base + integ + test + train + docs);
    const total = core + base + wZ + wC + wE + integ + test + train + docs;

    return {
      range_core:        rngFromCfg(UI, core),
      range_foundation:  rngFromCfg(UI, base),
      range_z:           rngFromCfg(UI, wZ + wE),
      range_carriers:    rngFromCfg(UI, wC),
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
      total_effort: (data?.from != null && data?.to != null)
        ? `${data.from}-${data.to}` : null,
      details: data?.details || null
    };
  }

  // ---------- New Carrier (API) ----------
  async function newCarrier(payload) {
    const cfg = await SOWCFG.get();
    const url = cfg?.api?.newCarrierUrl ||
      "https://docqa-api.onrender.com/estimate/new_carrier";
    const res  = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    const json = safeParseJson(text);
    return {
      total_effort: json?.total_effort ?? null,
      details: json?.details || null
    };
  }

  // Export all functions
  return { rollout, upgrade, other, newCarrier };
})();
