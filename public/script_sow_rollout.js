// script_sow_rollout.js (internal)
// Requires: config.js, estimation_rules.js

document.addEventListener("DOMContentLoaded", () => {
  window.submitRolloutEstimate = async function () {
    const siteCount = document.getElementById("siteCount")?.value;
    const shipToRegion = document.getElementById("shipToRegion")?.value;
    const blueprintNeeded = document.getElementById("blueprintNeeded")?.value;

    // You were reading additional fields; keep them if you need them elsewhere
    const moduleSelect = document.getElementById("zEnhancementRollout");
    const modules = Array.from(moduleSelect?.selectedOptions || []).map(opt => opt.value);
    const onlineOffline = document.getElementById("onlineOfflineRollout")?.value;

    const resultBox = document.getElementById("rolloutResultBox");

    try {
      const result = await SOWRULES.rollout({
        siteCount,
        shipToRegion,
        blueprintNeeded
      });

      // result = { total_effort: number, note?: string }
      if (result?.note) {
        resultBox.textContent = `${result.note} (${result.total_effort} hours)`;
        resultBox.style.color = "red";
        return;
      }

      if (result?.total_effort != null) {
        resultBox.textContent = `Estimated Effort: ${result.total_effort} hours`;
        resultBox.style.color = "green";
      } else {
        resultBox.textContent = "No estimate returned.";
        resultBox.style.color = "orange";
      }
    } catch (err) {
      console.error("Rollout estimate failed:", err);
      resultBox.textContent = "An error occurred while estimating. Check console.";
      resultBox.style.color = "red";
    }
  };
});
