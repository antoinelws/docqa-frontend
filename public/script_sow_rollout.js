// script_sow_rollout.js (INTERNAL/CUSTOMER)
// Collect form → call shared SOWRULES.rollout → show result
// Requires: config.js, estimation_rules.js

(function () {
  function getVal(id){ return document.getElementById(id)?.value || ""; }
  function getMulti(id){ return Array.from(document.getElementById(id)?.selectedOptions || []).map(o=>o.value); }

  function collectRolloutForm() {
    // robust across pages / ids
    const siteCount    = getVal("siteCount") || getVal("sites") || getVal("locationCount");
    const shipToRegion = getVal("shipToRegion") || getVal("region") || getVal("locationRegion");

    // modules: multi-select or comma string
    let modulesUsed = getMulti("modulesUsed");
    if (!modulesUsed.length) modulesUsed = getMulti("moduleUsed");
    if (!modulesUsed.length) {
      const s = getVal("shiperpModule") || getVal("modules") || getVal("module");
      if (s) modulesUsed = s.split(/[;,]/).map(x=>x.trim()).filter(Boolean);
    }

    // same process ?  (blueprint trigger)
    const sameProcess = getVal("sameProcess") || getVal("sameRules") || getVal("sameAsExisting") || getVal("sameShipping");

    // carriers selection
    const onlineCarriers = getVal("onlineCarriers") || getVal("carriers") || getVal("carriersCount");

    return { siteCount, shipToRegion, modulesUsed, sameProcess, onlineCarriers };
  }

  function ensureSowrulesReady() {
    if (window.SOWRULES && typeof SOWRULES.rollout === "function") return Promise.resolve();
    return new Promise(resolve => {
      const onReady = () => resolve();
      window.addEventListener("sowrules-ready", onReady, { once: true });
      const iv = setInterval(() => {
        if (window.SOWRULES && typeof SOWRULES.rollout === "function") { clearInterval(iv); resolve(); }
      }, 50);
      setTimeout(() => { clearInterval(iv); resolve(); }, 5000);
    });
  }

  async function run() {
    const resultBox = document.getElementById("resultBox") || document.getElementById("customerResult");
    if (!resultBox) return;

    const payload = collectRolloutForm();
    console.log("[ROLLOUT] payload:", payload);

    try {
      await ensureSowrulesReady();
      if (!window.SOWRULES || typeof SOWRULES.rollout !== "function") throw new Error("SOWRULES.rollout not available");

      const est = await SOWRULES.rollout(payload);
      console.log("[ROLLOUT] response:", est);

      const hours = est?.total_effort ?? est?.total_hours ?? est?.hours;
      if (hours != null) {
        resultBox.textContent = `Estimated Effort: ${hours} hours`;
        resultBox.style.color = "green";
      } else {
        resultBox.textContent = "No total hours returned.";
        resultBox.style.color = "red";
      }
    } catch (err) {
      console.error(err);
      resultBox.textContent = `Error while estimating: ${err.message || err}`;
      resultBox.style.color = "red";
    }
  }

  // Support both: onclick="submitRolloutEstimate()" and #btnCalc click
  window.submitRolloutEstimate = async function (e) {
    try { e && e.preventDefault && e.preventDefault(); } catch {}
    await run();
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnCalc")?.addEventListener("click", (e) => {
      e.preventDefault();
      run();
    });
    document.getElementById("customerBtnCalc")?.addEventListener("click", (e) => {
      e.preventDefault();
      run();
    });
  });
})();
