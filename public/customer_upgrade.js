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
function estimateUpgrade_INTERNAL(p) {
  const { shiperpVersion, zenhancements, onlineCarriers, ewmUsage, modulesUsed } = p;

  const weightVersion =
    shiperpVersion === "Between 3.6 and 3.9" ? 15 :
    shiperpVersion === "Lower than 3.6" ? 25 : 0;

  const weightZ = ({
    "1 to 10": 15,
    "10 to 50": 60,
    "50 to 100": 100,
    "More than 100": 150
  }[zenhancements]) || 0;

  const weightCarrier = ({
    "1 to 5": 60,
    "6 to 10": 200,
    "More than 10": 300
  }[onlineCarriers]) || 0;

  const weightEWM = ewmUsage === "Yes" ? 50 : 0;
  const weightModules = (modulesUsed || []).length > 3 ? 40 : 0;

  const baseEffort = 8;
  const integrationEffort = 16 + 0.1 * (weightCarrier + weightEWM);
  const testingEffort = 8 + 0.2 * (weightCarrier + weightModules);
  const trainingEffort = 40;
  const documentationEffort = 32;

  const totalEffortCore = 0.2 * (weightVersion + weightZ + weightCarrier + weightEWM + weightModules + baseEffort + integrationEffort + testingEffort + trainingEffort + documentationEffort);
  const totalAll = totalEffortCore + baseEffort + weightZ + weightCarrier + weightEWM + integrationEffort + testingEffort + trainingEffort + documentationEffort;

  const rng = v => ({ from: Math.round(v*0.8), to: Math.round(v*1.2) });

  return {
    range_core: rng(totalEffortCore),
    range_foundation: rng(baseEffort),
    range_z: rng(weightZ + weightEWM),
    range_carriers: rng(weightCarrier),
    range_integration: rng(integrationEffort),
    range_testing: rng(testingEffort),
    range_training: rng(trainingEffort),
    range_docs: rng(documentationEffort),
    range_total: rng(totalAll)
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
