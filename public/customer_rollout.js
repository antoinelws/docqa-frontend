// customer_rollout.js — copie logique rollout + email

/* 1) Collect */
function collectRolloutForm() {
  const moduleSelect = document.getElementById("zEnhancementRollout");
  return {
    siteCount: document.getElementById("siteCount")?.value,
    shipToRegion: document.getElementById("shipToRegion")?.value,
    blueprintNeeded: document.getElementById("blueprintNeeded")?.value,
    modules: Array.from(moduleSelect?.selectedOptions || []).map(opt => opt.value),
    onlineOffline: document.getElementById("onlineOfflineRollout")?.value
  };
}

/* 2) Estimation: identique à ton script (local, pas d’API) */
// customer_rollout.js
function estimateRollout_INTERNAL(p) {
  // config.js must be loaded on the page before this file
  const cfg = SOWCFG.getSync();
  const R = cfg?.rollout || {};

  const baseMap = R.baseHours || {};
  const regionMap = R.regionExtra || {};

  // p.siteCount and p.shipToRegion should match your form values
  const base = baseMap[p.siteCount] ?? 0;
  const extra = regionMap[p.shipToRegion] ?? (regionMap.default ?? 0);

  if (p.blueprintNeeded === "No") {
    return { total_effort: R.blueprintHours ?? 16, note: "Blueprint/Workshop required" };
  }
  return { total_effort: base + extra };
}


/* 3) Breakdown simple */
function rolloutBreakdownHtml(est) {
  if (!est) return "";
  if (est.note) return `<p style="margin:8px 0;"><em>${est.note}</em></p>`;
  return "";
}

/* 4) Bouton */
window.submitCustomer_Rollout = async function () {
  await runCustomerFlow({
    formType: "Rollout",
    collectFn: collectRolloutForm,
    estimateFn: estimateRollout_INTERNAL,
    composeBreakdownHtml: rolloutBreakdownHtml
  });
};
