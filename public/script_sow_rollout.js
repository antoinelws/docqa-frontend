document.addEventListener("DOMContentLoaded", () => {
  window.submitRolloutEstimate = async function () {
    const siteCount       = document.getElementById("siteCount")?.value;
    const shipToRegion    = document.getElementById("shipToRegion")?.value;
    const blueprintNeeded = document.getElementById("blueprintNeeded")?.value;

    const box = document.getElementById("rolloutResultBox");

    try {
      const r = await SOWRULES.rollout({ siteCount, shipToRegion, blueprintNeeded });
      if (r.note) {
        box.textContent = `${r.note} (${r.total_effort} hours)`;
        box.style.color = "red";
      } else {
        box.textContent = `Estimated Effort: ${r.total_effort} hours`;
        box.style.color = "green";
      }
    } catch (e) {
      console.error(e);
      box.textContent = "Error while estimating (see console).";
      box.style.color = "red";
    }
  };
});
