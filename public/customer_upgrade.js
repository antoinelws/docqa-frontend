// customer_upgrade.js — copie logique upgrade + email

/* 1) Collect */
function collectUpgradeForm() {
  return {
    shiperpVersion: document.getElementById("shiperpVersionUpgrade")?.value,
    zenhancements: document.getElementById("zenhancementsUpgrade")?.value,
    onlineCarriers: document.getElementById("onlineCarrierCountUpgrade")?.value,
    ewmUsage: document.getElementById("ewmUsageUpgrade")?.value,
    modulesUsed: Array.from(document.getElementById("modulesUsedUpgrade")?.selectedOptions || []).map(el => el.value)
  };
}

/* 2) Estimation: identique à ton script (local) */
// customer_upgrade.js
// customer_upgrade.js
function estimateUpgrade_INTERNAL(p) {
  return SOWRULES.upgrade(p);
}



/* 3) Breakdown — même présentation (compact) */
function upgradeBreakdownHtml(est) {
  if (!est) return "";
  const line = (label, r) => `<tr><td style="padding:4px;border:1px solid #eee;"><strong>${label}</strong></td><td style="padding:4px;border:1px solid #eee;">From ${r.from} to ${r.to} h</td></tr>`;
  return `
    <h3 style="margin:12px 0 6px;">Estimation breakdown</h3>
    <table style="border-collapse:collapse;width:100%;max-width:700px">
      ${line("Base Estimation", est.range_core)}
      ${line("Foundation Setup", est.range_foundation)}
      ${line("Z Enhancements", est.range_z)}
      ${line("Online Carriers", est.range_carriers)}
      ${line("Integration", est.range_integration)}
      ${line("Testing", est.range_testing)}
      ${line("Training", est.range_training)}
      ${line("Documentation", est.range_docs)}
      ${line("Total", est.range_total)}
    </table>`;
}

/* 4) Bouton */
window.submitCustomer_Upgrade = async function () {
  await runCustomerFlow({
    formType: "Upgrade",
    collectFn: collectUpgradeForm,
    estimateFn: estimateUpgrade_INTERNAL,
    composeBreakdownHtml: upgradeBreakdownHtml
  });
};
