document.addEventListener("DOMContentLoaded", () => {
  window.submitUpgradeEstimate = async function () {
    const shiperpVersion = document.getElementById("shiperpVersionUpgrade")?.value;
    const zenhancements  = document.getElementById("zenhancementsUpgrade")?.value;
    const onlineCarriers = document.getElementById("onlineCarrierCountUpgrade")?.value;
    const ewmUsage       = document.getElementById("ewmUsageUpgrade")?.value;
    const modulesUsed    = Array.from(
      document.getElementById("modulesUsedUpgrade")?.selectedOptions || []
    ).map(el => el.value);

    const box = document.getElementById("upgradeResultBox");

    try {
      const r = await SOWRULES.upgrade({
        shiperpVersion, zenhancements, onlineCarriers, ewmUsage, modulesUsed
      });

      const fmt = (rng) => rng ? `From ${rng.from} to ${rng.to}` : "N/A";
      box.innerHTML = `
        <p><strong>Base Estimation (Core factor):</strong> ${fmt(r.range_core)}</p>
        <p><strong>Foundation Setup:</strong> ${fmt(r.range_foundation)}</p>
        <p><strong>Z Enhancements (incl. EWM):</strong> ${fmt(r.range_z)}</p>
        <p><strong>Online Carriers:</strong> ${fmt(r.range_carriers)}</p>
        <p><strong>Integration:</strong> ${fmt(r.range_integration)}</p>
        <p><strong>Testing:</strong> ${fmt(r.range_testing)}</p>
        <p><strong>Training:</strong> ${fmt(r.range_training)}</p>
        <p><strong>Documentation:</strong> ${fmt(r.range_docs)}</p>
        <p><strong>Total:</strong> ${fmt(r.range_total)}</p>`;
      box.style.color = "green";
    } catch (e) {
      console.error(e);
      box.textContent = "Error while estimating (see console).";
      box.style.color = "red";
    }
  };
});
