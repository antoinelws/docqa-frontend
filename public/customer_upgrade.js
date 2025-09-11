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
function estimateUpgrade_INTERNAL(p) {
  const U = SOWCFG.getSync()?.upgrade || {};

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
