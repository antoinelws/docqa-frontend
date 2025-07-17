// script_sow_rollout.js

document.addEventListener("DOMContentLoaded", () => {
  window.submitRolloutEstimate = function () {
    const rolloutForm = {
      siteCount: document.getElementById("siteCount")?.value,
      shipToRegion: document.getElementById("shipToRegion")?.value,
      zEnhancementRollout: document.getElementById("zEnhancementRollout")?.value,
      onlineOfflineRollout: document.getElementById("onlineOfflineRollout")?.value,
      blueprintNeeded: document.getElementById("blueprintNeeded")?.value,
    };

    const resultBox = document.getElementById("rolloutResultBox");

    if (rolloutForm.blueprintNeeded === "No") {
      resultBox.textContent = "A 16 hours Blueprint/Workshop would be required";
      resultBox.style.color = "red";
      return;
    }

    let baseHours = 0;
    if (rolloutForm.siteCount === "Only 1") baseHours = 40;
    else if (rolloutForm.siteCount === "2 to 5") baseHours = 120;
    else if (rolloutForm.siteCount === "More than 5") baseHours = 200;

    const regionalExtra = rolloutForm.shipToRegion === "US" ? 0 : 16;
    const total = baseHours + regionalExtra;

    resultBox.textContent = `Estimated Effort: ${total} hours`;
    resultBox.style.color = "green";
  };
});
