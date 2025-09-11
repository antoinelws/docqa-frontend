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
  return SOWRULES.rollout(p);
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
