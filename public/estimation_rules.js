// estimation_rules.js
// Shared rules used by both internal and customer pages.
// Requires config.js to be loaded first.

window.SOWRULES = (function () {
  // --- Rollout ---
 // --- Rollout ---
// --- Rollout ---
async function rollout(p) {
  const cfgAll = await SOWCFG.get();
  const cfg = cfgAll?.rollout || {};

  const baseMap = cfg.baseHours || {};
  const regionMap = cfg.regionExtra || {};

  const base = baseMap[p.siteCount] ?? 0;
  const extra = regionMap[p.shipToRegion] ?? (regionMap.default ?? 0);

  if (p.blueprintNeeded === "No") {
    return { total_effort: cfg.blueprintHours ?? 16, note: "Blueprint/Workshop required" };
  }
  return { total_effort: base + extra };
}

// --- Upgrade ---
async function upgrade(p) {
  const U = (await SOWCFG.get())?.upgrade || {};

  const wV = (U.versionWeights?.[p.shiperpVersion] ?? U.versionWeights?.default ?? 0);
  const wZ = (U.zEnhancementsWeights?.[p.zenhancements] ?? U.zEnhancementsWeights?.default ?? 0);
  const wC = (U.onlineCarriersWeights?.[p.onlineCarriers] ?? U.onlineCarriersWeights?.default ?? 0);
  const wE = (p.ewmUsage === "Yes") ? (U.ewmWeight ?? 0) : 0;
  const wM = (p.modulesUsed?.length || 0) > (U.modulesThreshold ?? 3) ? (U.modulesExtra ?? 0) : 0;

  const base = U.baseEffort ?? 8;
  const integ = (U.integrationBase ?? 16) + (U.integrationCoeff ?? 0.1) * (wC + wE);
  const test  = (U.testingBase ?? 8) + (U.testingCoeff ?? 0.2) * (wC + wM);
  const train = U.training ?? 40;
  const docs  = U.documentation ?? 32;

  const core  = (U.coreFactor ?? 0.2) * (wV + wZ + wC + wE + wM + base + integ + test + train + docs);
  const total = core + base + wZ + wC + wE + integ + test + train + docs;

  const rng = (v) => ({ from: Math.round(v * 0.8), to: Math.round(v * 1.2) });
  return {
    range_core: rng(core),
    range_foundation: rng(base),
    range_z: rng(wZ + wE),
    range_carriers: rng(wC),
    range_integration: rng(integ),
    range_testing: rng(test),
    range_training: rng(train),
    range_docs: rng(docs),
    range_total: rng(total)
  };
}


  // --- Other (API) ---
  async function other(payload) {
    const url = (await SOWCFG.get())?.api?.otherUrl || "https://docqa-api.onrender.com/sow-estimate";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => null);
    if (!data) return { total_effort: null, details: null };
    return {
      total_effort: (data?.from != null && data?.to != null) ? `${data.from}-${data.to}` : null,
      details: data?.details || null
    };
  }

  // --- New Carrier (API) ---
  async function newCarrier(payload) {
    const cfg = await SOWCFG.get();
    const url = cfg?.api?.newCarrierUrl || "https://docqa-api.onrender.com/estimate/new_carrier";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return { total_effort: json?.total_effort ?? null, details: json?.details || null };
    } catch {
      return { total_effort: null, details: null };
    }
  }

  return { rollout, upgrade, other, newCarrier };
})();
