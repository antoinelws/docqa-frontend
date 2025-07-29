// script_sow_rollout.js

document.addEventListener("DOMContentLoaded", () => {
  window.submitRolloutEstimate = function () {
    const siteCount = document.getElementById("siteCount")?.value;
    const shipToRegion = document.getElementById("shipToRegion")?.value;
    const blueprintNeeded = document.getElementById("blueprintNeeded")?.value;

    // DOM multiple select value collection for modules
    const moduleSelect = document.getElementById("zEnhancementRollout");
    const modules = Array.from(moduleSelect?.selectedOptions || []).map(opt => opt.value);

    const onlineOffline = document.getElementById("onlineOfflineRollout")?.value;
    const resultBox = document.getElementById("rolloutResultBox");

    if (blueprintNeeded === "No") {
      resultBox.textContent = "A 16 hours Blueprint/Workshop would be required";
      resultBox.style.color = "red";
      return;
    }

    let baseHours = 0;
    if (siteCount === "Only 1") baseHours = 40;
    else if (siteCount === "2 to 5") baseHours = 120;
    else if (siteCount === "More than 5") baseHours = 200;

    const regionalExtra = shipToRegion === "US" ? 0 : 16;
    const total = baseHours + regionalExtra;

    resultBox.textContent = `Estimated Effort: ${total} hours`;
    resultBox.style.color = "green";
  };
});
