// script_sow_upgrade.js (internal)
// Requires: config.js, estimation_rules.js

document.addEventListener("DOMContentLoaded", () => {
  window.submitUpgradeEstimate = async function () {
    const shiperpVersion = document.getElementById("shiperpVersionUpgrade")?.value;
    const zenhancements = document.getElementById("zenhancementsUpgrade")?.value;
    const onlineCarriers = document.getElementById("onlineCarrierCountUpgrade")?.value;
    const ewmUsage = document.getElementById("ewmUsageUpgrade")?.value;
    const modulesUsed = Array.from(
      document.getElementById("modulesUsedUpgrade")?.selectedOptions || []
    ).map(el => el.value);

    const resultBox = document.getElementById("upgradeResultBox");

    try {
      // Shared rules return ranges, e.g. { from, to } for each section
      const r = await SOWRULES.upgrade({
        shiperpVersion,
        zenhancements,
        onlineCarriers,
        ewmUsage,
        modulesUsed
      });

      // r has: range_core, range_foundation, range_z, range_carriers, range_integration,
      //        range_testing, range_training, range_docs, range_total
      const fmt = (rng) =>
        rng && typeof rng.from === "number" && typeof rng.to === "number"
          ? `From ${rng.from} to ${rng.to}`
          : "N/A";

      const resultHTML = `
        <p><strong>Base Estimation (Core factor):</strong> ${fmt(r.range_core)}</p>
        <p><strong>Foundation Setup:</strong> ${fmt(r.range_foundation)}</p>
        <p><strong>Z Enhancements (incl. EWM):</strong> ${fmt(r.range_z)}</p>
        <p><strong>Online Carriers:</strong> ${fmt(r.range_carriers)}</p>
        <p><strong>Integration:</strong> ${fmt(r.range_integration)}</p>
        <p><strong>Testing:</strong> ${fmt(r.range_testing)}</p>
        <p><strong>Training:</strong> ${fmt(r.range_training)}</p>
        <p><strong>Documentation:</strong> ${fmt(r.range_docs)}</p>
        <p><strong>Total:</strong> ${fmt(r.range_total)}</p>
      `;

      resultBox.innerHTML = resultHTML;
      resultBox.style.color = "green";
    } catch (err) {
      console.error("Upgrade estimate failed:", err);
      resultBox.innerText = "An error occurred while estimating. Check console.";
      resultBox.style.color = "red";
    }
  };
});
