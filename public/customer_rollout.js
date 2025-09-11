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
function estimateRollout_INTERNAL(p) {
  const { siteCount, shipToRegion, blueprintNeeded } = p;

  if (blueprintNeeded === "No") {
    // Interne: message & stop — côté email on renvoie 16h avec note
    return { total_effort: 16, note: "Blueprint/Workshop (16 hours) required" };
  }

  let baseHours = 0;
  if (siteCount === "Only 1") baseHours = 40;
  else if (siteCount === "2 to 5") baseHours = 120;
  else if (siteCount === "More than 5") baseHours = 200;

  const regionalExtra = shipToRegion === "US" ? 0 : 16;
  const total = baseHours + regionalExtra;

  return { total_effort: total };
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
