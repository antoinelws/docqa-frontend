// estimation_rules.js
// Single source for client + internal: normalization + compute.
// Requires: config.js (window.SOWCFG)

// --- Ensure resolveWeight exists even if bundling or load order changes ---
if (typeof resolveWeight !== "function") {
  function resolveWeight(map, raw) {
    if (!map) return { key: undefined, value: 0 };

    // exact string match
    if (raw in map) return { key: raw, value: map[raw] };

    // numeric bucketing
    const n = Number(raw);
    if (!Number.isNaN(n)) {
      let best;
      for (const [label, val] of Object.entries(map)) {
        const L = label.toLowerCase().trim();
        if (L.startsWith("only ")) {
          const one = Number(L.replace("only", "").trim());
          if (n === one) return { key: label, value: val };
        } else if (L.includes(" to ")) {
          const [aStr, bStr] = L.split(" to ").map(s => s.replace(/[^0-9.-]/g, ""));
          const a = Number(aStr), b = Number(bStr);
          if (!Number.isNaN(a) && !Number.isNaN(b) && n >= a && n <= b) return { key: label, value: val };
        } else if (L.startsWith("more than")) {
          const m = Number(L.replace("more than", "").trim());
          if (!Number.isNaN(m) && n > m) best = { key: label, value: val };
        }
      }
      if (best) return best;
    }

    if ("default" in map) return { key: "default", value: map.default };
    return { key: undefined, value: 0 };
  }
}

window.SOWRULES = (function () {
  // ---------------------- helpers ----------------------
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

  // ---------------- New Carrier normalization ----------------
  function normalizeNewCarrierPayload(p, cfgAll) {
    const out = { ...p };

    // backfill carrierName from carrierOther if needed
    if ((!out.carrierName || !String(out.carrierName).trim()) && out.carrierOther) {
      out.carrierName = String(out.carrierOther).trim();
    }

    // keep raw bucket or number, don't force int yet
    out.zEnhancements = p?.zEnhancements ?? "";

    // yes/no canon
    const yesNo = v => {
      const s = String(v ?? "").trim().toLowerCase();
      if (["yes","oui","true","1"].includes(s)) return "Yes";
      if (["no","non","false","0"].includes(s))  return "No";
      return v ?? "";
    };

    // unify alreadyUsed / serpcarUsage
    if (out.alreadyUsed == null && out.serpcarUsage != null) out.alreadyUsed = out.serpcarUsage;
    if (out.serpcarUsage == null && out.alreadyUsed != null) out.serpcarUsage = out.alreadyUsed;
    out.alreadyUsed  = yesNo(out.alreadyUsed);
    out.serpcarUsage = yesNo(out.serpcarUsage);

    // alias Online/Offline
    if (out.onlineOffline && !out.onlineOrOffline) out.onlineOrOffline = out.onlineOffline;

    // hard override from config (keeps parity if desired)
    const forced = cfgAll?.newCarrier?.forceOnlineOffline;
    if (forced === "Online" || forced === "Offline") {
      out.onlineOrOffline = forced;
    } else {
      const s = String(out.onlineOrOffline ?? "").trim().toLowerCase();
      if (s === "online" || s === "on-line") out.onlineOrOffline = "Online";
      else if (s === "offline" || s === "off-line") out.onlineOrOffline = "Offline";
      else out.onlineOrOffline = "Offline"; // safe default
    }

    // arrays
    const arr = v => (Array.isArray(v) ? v : []);
    out.features        = arr(out.features);
    // If features not provided as array, try split from featureInterest
    if ((!out.features || out.features.length === 0) && typeof out.featureInterest === "string") {
      out.features = out.featureInterest.split(/[;,]/).map(s => s.trim()).filter(Boolean);
    }
    out.systemUsed      = arr(out.systemUsed);
    out.shipmentScreens = arr(out.shipmentScreens);
    out.shipFrom        = arr(out.shipFrom);
    out.shipTo          = arr(out.shipTo);

    // reconstruct shipmentScreens from string if needed
    if (!out.shipmentScreens.length && typeof out.shipmentScreenString === "string" && out.shipmentScreenString.trim()) {
      out.shipmentScreens = out.shipmentScreenString.split(",").map(s => s.trim()).filter(Boolean);
    }
    if (!out.shipmentScreens || out.shipmentScreens.length === 0) {
      out.shipmentScreens = ["Small Parcel Screen"];
    }

    out.featuresCount = out.features.length;
    return out;
  }

  // ---------------------- Rollout (frontend math) ----------------------
  async function rollout(p) {
    const cfgAll = await SOWCFG.get();
    const R  = cfgAll?.rollout || {};
    const UI = cfgAll?.ui || {};
    const AL = cfgAll?.aliases?.rollout || {};

    // Normalize inputs via aliases (string labels/numbers allowed)
    const siteCount      = normalizeByMap(AL.siteCount, p.siteCount);
    const shipToRegion   = normalizeByMap(AL.shipToRegion, p.shipToRegion);
    const blueprintNeed  = normalizeByMap(AL.blueprintNeeded, p.blueprintNeeded);

    // Interpret alternate question wording: if user answered the "same process?" question with NO,
    // we require a blueprint. Accept several field names.
    const sameProcessRaw = p.sameProcess ?? p.sameRules ?? p.sameAsExisting ?? p.sameShipping;
    const sameProcessStr = String(normalizeByMap(AL.sameProcess, sameProcessRaw) ?? "").trim().toLowerCase();
    const saidSame = ["yes","oui","true","1"].includes(sameProcessStr);

    // Decide if blueprint is required
    let requiresBlueprint = false;
    if (String(blueprintNeed).toLowerCase() === "yes") requiresBlueprint = true; // legacy field means blueprint needed
    if (sameProcessStr && !saidSame) requiresBlueprint = true;                     // if they said NO to same process

    // If configured to only show blueprint when process differs, short-circuit and return just blueprint effort
    const blueprintOnlyWhenDifferent = R.blueprintOnlyWhenDifferent ?? true;
    if (blueprintOnlyWhenDifferent && requiresBlueprint) {
      const hours = Number(R.blueprintHours ?? 16);
      return {
        hours,
        total_hours: hours,
        total_effort: hours,
        message: "Blueprint is required due to process differences",
        range_total: rngFromCfg(UI, hours)
      };
    }

    // Base hours from site count bucket
    const baseRes   = resolveWeight(R.baseHours || {}, siteCount);
    const regionRes = resolveWeight(R.regionExtra || {}, shipToRegion);
    const blueprint = requiresBlueprint ? (R.blueprintHours ?? 0) : 0;

    let total = (baseRes.value || 0) + (regionRes.value || 0) + blueprint;

    // Carriers impact (config-driven); support several field names and fall back to upgrade map if rollout map missing
    const carriersRaw = p.onlineCarriers ?? p.carriers ?? p.carriersCount;
    const carriersNorm = normalizeByMap(AL.onlineCarriers || AL.carriers, carriersRaw);
    const carriersMap = R.carriersWeights || R.onlineCarriersWeights || (cfgAll?.upgrade?.onlineCarriersWeights || {});
    const carriersRes = resolveWeight(carriersMap, carriersNorm);
    const carriersHours = carriersRes.value || 0;
    total += carriersHours;

    // Modules impact (config-driven)
    const rawModules = p.modulesUsed ?? p.modules ?? p.module ?? p.shiperpModule;
    let modulesArr = Array.isArray(rawModules) ? rawModules : [];
    if (!modulesArr.length && typeof rawModules === "string") {
      modulesArr = rawModules.split(/[;,]/).map(s => s.trim()).filter(Boolean);
    }
    const perMod = Number(R.modulesPerModule ?? 8);
    const included = Math.max(0, Number(R.modulesBaseIncluded ?? 1));
    const extraModules = Math.max(0, modulesArr.length - included) * perMod;
    total += extraModules;

    // Feature-step addition (config-driven)
    const norm = normalizeNewCarrierPayload(p, cfgAll); // reuse to count features
    const stepCfg = R.featureStep || { size: 3, increment: 12 };
    const size = Math.max(1, Number(stepCfg.size) || 3);
    const inc  = Number(stepCfg.increment) || 12;
    const featureCount = (norm.features || []).length;
    const extraSteps = Math.max(0, Math.floor((featureCount - 1) / size));
    const extraHours = extraSteps * inc;
    total += extraHours;

        // 5b) Local additive weights (config-driven) for Systems/ShipFrom/ShipTo
    try {
      const ncCfg = cfg?.newCarrier || {};

      // --- helper to sum weights by list of labels OR by count (if map looks numeric/ranged) ---
      const sumWeights = (map, raw) => {
        if (!map) return 0;
        // if raw is an array of labels → sum each label using resolveWeight (string or numeric)
        if (Array.isArray(raw)) {
          return raw.reduce((acc, item) => acc + (resolveWeight(map, item)?.value || 0), 0);
        }
        // if raw is a number → bucket the count
        const n = Number(raw);
        if (!Number.isNaN(n)) {
          return resolveWeight(map, n)?.value || 0;
        }
        return 0;
      };

      // --- Systems used ---
      // Deux modes supportés :
      // 1) Poids par libellé (ex. ECC:4, EWM:6, TM:8)   → cfg.newCarrier.systemsLabelWeights
      // 2) Poids par "count" (ex. 1→0h, 2→4h, 3→8h...) → cfg.newCarrier.systemsCountWeights
      const sysLabels = Array.isArray(norm.systemUsed) ? norm.systemUsed : [];
      const sysCount  = sysLabels.length;
      let sysHours = 0;
      if (ncCfg.systemsLabelWeights) sysHours += sumWeights(ncCfg.systemsLabelWeights, sysLabels);
      if (ncCfg.systemsCountWeights) sysHours += sumWeights(ncCfg.systemsCountWeights, sysCount);
      if (json && typeof json.total_effort === "number" && sysHours) {
        json.total_effort += sysHours;
        if (json.details && typeof json.details === "object") {
          json.details.E2x_SystemsImpact = (json.details.E2x_SystemsImpact || 0) + sysHours;
        }
      }

      // --- Ship FROM location (multi) ---
      // Ex: cfg.newCarrier.formLocationWeights = { "US": 0, "CA": 4, "EU": 8, "default": 0 }
      const fromList = Array.isArray(norm.shipFrom) ? norm.shipFrom : [];
      const fromHours = sumWeights(ncCfg.formLocationWeights, fromList);
      if (json && typeof json.total_effort === "number" && fromHours) {
        json.total_effort += fromHours;
        if (json.details && typeof json.details === "object") {
          json.details.E24_ShipFromLocation = (json.details.E24_ShipFromLocation || 0) + fromHours;
        }
      }

      // --- Ship TO location (multi) ---
      // Ex: cfg.newCarrier.toLocationWeights = { "US": 0, "CA": 4, "EU": 8, "default": 0 }
      const toList = Array.isArray(norm.shipTo) ? norm.shipTo : [];
      const toHours = sumWeights(ncCfg.toLocationWeights, toList);
      if (json && typeof json.total_effort === "number" && toHours) {
        json.total_effort += toHours;
        if (json.details && typeof json.details === "object") {
          json.details.E25_ShipToLocation = (json.details.E25_ShipToLocation || 0) + toHours;
        }
      }
    } catch (e) {
      console.warn("Local newCarrier add-ons failed:", e);
    }

    return {
      hours: total,
      total_hours: total,
      total_effort: total,
      range_base:      rngFromCfg(UI, baseRes.value || 0),
      range_region:    rngFromCfg(UI, regionRes.value || 0),
      range_blueprint: rngFromCfg(UI, blueprint),
      range_carriers:  rngFromCfg(UI, carriersHours),
      range_modules:   rngFromCfg(UI, extraModules),
      range_features:  rngFromCfg(UI, extraHours),
      range_total:     rngFromCfg(UI, total)
    };
  }

  // ---------------------- Upgrade ----------------------
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

    const vRes = resolveWeight(U.versionWeights || {},        version);
    const zRes = resolveWeight(U.zEnhancementsWeights || {},  z);
    const cRes = resolveWeight(U.onlineCarriersWeights || {}, carriers);
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

  // ----------------------- Other (API) -----------------------
  async function other(payload) {
    const url = (await SOWCFG.get())?.api?.otherUrl ||
      "https://docqa-api.onrender.com/sow-estimate";

    const res  = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  // ----------------------- New Carrier (API) -----------------------
  async function newCarrier(payload) {
    const cfg = await SOWCFG.get();
    const url = cfg?.api?.newCarrierUrl ||
      "https://docqa-api.onrender.com/estimate/new_carrier";

    // 1) Normalize everything
    const norm = normalizeNewCarrierPayload(payload, cfg);

    // 1b) Map zEnhancements to a safe integer
    let zInt = 0;
    if (typeof norm.zEnhancements === "number" && Number.isFinite(norm.zEnhancements)) {
      zInt = norm.zEnhancements;
    } else {
      const zr = String(norm.zEnhancements ?? "").trim().toLowerCase();
      if (zr.includes("less than 10") || zr === "0" || zr === "") {
        zInt = 0;
      } else {
        zInt = 1;
      }
    }

    // 2) Build EXACT body expected by API
    const body = {
      carrierName:        String(norm.carrierName ?? ""),
      sapVersion:         String(norm.sapVersion ?? ""),
      abapVersion:        String(norm.abapVersion ?? ""),
      zEnhancements:      zInt, // safe integer
      onlineOrOffline:    String(norm.onlineOrOffline ?? ""),
      features:           Array.isArray(norm.features) ? norm.features : [],
      systemUsed:         Array.isArray(norm.systemUsed) ? norm.systemUsed : [],
      shipmentScreens:    Array.isArray(norm.shipmentScreens) ? norm.shipmentScreens : [],
      serpcarUsage:       String(norm.serpcarUsage ?? ""),
      shipFrom:           Array.isArray(norm.shipFrom) ? norm.shipFrom : [],
      shipToVolume:       String(
                            norm.shipToVolume ||
                            norm.zEnhancementsString ||
                            norm.zEnhancements || ""
                          ),
      shipTo:             Array.isArray(norm.shipTo) ? norm.shipTo : [],
      shiperpVersion:     String(norm.shiperpVersion ?? ""),
      shipmentScreenString: String(
                            norm.shipmentScreenString ||
                            (Array.isArray(norm.shipmentScreens) ? norm.shipmentScreens.join(", ") : "")
                          ),
    };

    // 3) Call API
    const res  = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    if (!res.ok) {
      console.warn("API 4xx/5xx:", res.status, text);
      return { total_effort: null, details: null };
    }

    // 4) Parse defensively
    const json = safeParseJson(text);

    // Optional: fix sign for E23 if configured
    try {
      const fix = (await SOWCFG.get())?.newCarrier?.fixOnlineSign;
      if (fix && json && json.details && typeof json.total_effort === "number") {
        const isOnline = String(norm.onlineOrOffline).toLowerCase() === "online";
        const e23 = Number(json.details.E23_OnlineImpact ?? 0);
        if (isOnline && e23 < 0) {
          const delta = Math.abs(e23) * 2;
          json.details.E23_OnlineImpact = Math.abs(e23);
          json.total_effort += delta;
        } else if (!isOnline && e23 > 0) {
          const delta = Math.abs(e23) * 2;
          json.details.E23_OnlineImpact = -Math.abs(e23);
          json.total_effort -= delta;
          if (json.total_effort < 0) json.total_effort = 0;
        }
      }
    } catch {}

    // 5) Feature-step addition for New Carrier (config-driven)
    try {
      const stepCfg = cfg?.newCarrier?.featureStep || { size: 3, increment: 12 };
      const size = Math.max(1, Number(stepCfg.size) || 3);
      const inc  = Number(stepCfg.increment) || 12;
      const featureCount = (norm.features || []).length;
      const extraSteps = Math.max(0, Math.floor((featureCount - 1) / size));
      const extraHours = extraSteps * inc;

      if (json && typeof json.total_effort === "number") {
        json.total_effort += extraHours;
        if (json.details && typeof json.details === "object") {
          json.details.FeatureBlocks = extraHours; // optional detail
        }
      }
    } catch {}

    return {
      total_effort: json?.total_effort ?? null,
      details: json?.details || null
    };
  }

  // ---- expose public API
  return { rollout, upgrade, other, newCarrier };
})();

// Signal readiness so other scripts can safely wait for SOWRULES
try { window.dispatchEvent(new Event("sowrules-ready")); } catch {}
