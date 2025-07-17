// script_sow_upgrade.js

document.addEventListener("DOMContentLoaded", () => {
  window.submitUpgradeEstimate = function () {
    const shiperpVersion = document.getElementById("shiperpVersionUpgrade")?.value;
    const zenhancements = document.getElementById("zenhancementsUpgrade")?.value;
    const onlineCarriers = document.getElementById("onlineCarrierCountUpgrade")?.value;
    const ewmUsage = document.getElementById("ewmUsageUpgrade")?.value;
    const modulesUsed = Array.from(document.getElementById("modulesUsedUpgrade")?.selectedOptions || []).map(el => el.value);

    // Convert inputs to weight values
    const weightVersion = shiperpVersion === "Between 3.6 and 3.9" ? 15 : shiperpVersion === "Lower than 3.6" ? 25 : 0;

    const weightZ = {
      "1 to 10": 15,
      "10 to 50": 60,
      "50 to 100": 100,
      "More than 100": 150
    }[zenhancements] || 0;

    const weightCarrier = {
      "1 to 5": 60,
      "6 to 10": 200,
      "More than 10": 300
    }[onlineCarriers] || 0;

    const weightEWM = ewmUsage === "Yes" ? 50 : 0;
    const weightModules = modulesUsed.length > 3 ? 40 : 0;

    const baseEffort = 8;
    const integrationEffort = 16 + 0.1 * (weightCarrier + weightEWM);
    const testingEffort = 8 + 0.2 * (weightCarrier + weightModules);
    const trainingEffort = 40;
    const documentationEffort = 32;
    const totalEffort = 0.2 * (weightVersion + weightZ + weightCarrier + weightEWM + weightModules + baseEffort + integrationEffort + testingEffort + trainingEffort + documentationEffort);

    const range = (value) => `From ${Math.round(value * 0.8)} to ${Math.round(value * 1.2)}`;

    const resultHTML = `
      <p><strong>Base Estimation:</strong> ${range(totalEffort)}</p>
      <p><strong>Foundation Setup:</strong> ${range(baseEffort)}</p>
      <p><strong>Z Enhancements:</strong> ${range(weightZ + weightEWM)}</p>
      <p><strong>Online Carriers:</strong> ${range(weightCarrier)}</p>
      <p><strong>Integration:</strong> ${range(integrationEffort)}</p>
      <p><strong>Testing:</strong> ${range(testingEffort)}</p>
      <p><strong>Training:</strong> ${range(trainingEffort)}</p>
      <p><strong>Documentation:</strong> ${range(documentationEffort)}</p>
      <p><strong>Total:</strong> ${range(totalEffort + baseEffort + weightZ + weightCarrier + weightEWM + integrationEffort + testingEffort + trainingEffort + documentationEffort)}</p>
    `;

    const resultBox = document.getElementById("upgradeResultBox");
    resultBox.innerHTML = resultHTML;
    resultBox.style.color = "green";
  };
});
