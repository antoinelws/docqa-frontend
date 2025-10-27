// script_sow_rollout.js (INTERNAL/CUSTOMER)
// Collect form → call shared SOWRULES.rollout → show result
// Requires: config.js, estimation_rules.js

(function () {
  function getVal(id){ return document.getElementById(id)?.value || ""; }
  function getMulti(id){ return Array.from(document.getElementById(id)?.selectedOptions || []).map(o=>o.value); }

function collectRolloutForm() {
  // helpers
  const getVal = (idOrName) => {
    const el = document.getElementById(idOrName);
    if (el) {
      if (el.tagName === "SELECT" || el.tagName === "INPUT" || el.tagName === "TEXTAREA") return el.value || "";
      return el.value || "";
    }
    const radios = document.querySelectorAll(`input[name="${idOrName}"]`);
    const r = Array.from(radios).find(x => x.checked);
    if (r) return r.value || "";
    const any = document.querySelector(`#${idOrName}, [name="${idOrName}"]`);
    return any?.value || "";
  };

  const getMulti = (idOrName) => {
    const el = document.getElementById(idOrName);
    if (el && el.tagName === "SELECT" && el.multiple) {
      return Array.from(el.selectedOptions).map(o => o.value);
    }
    // fallback: checkboxes group
    const checks = document.querySelectorAll(`input[name="${idOrName}"]:checked, .${idOrName}.feature-box:checked`);
    if (checks.length) return Array.from(checks).map(c => c.value);
    return [];
  };

  // site & region
  const siteCount    = getVal("siteCount") || getVal("sites") || getVal("locationCount");
  const shipToRegion = getVal("shipToRegion") || getVal("region") || getVal("locationRegion");

  // modules → features proxy
  let modulesUsed = getMulti("modulesUsed");
  if (!modulesUsed.length) modulesUsed = getMulti("moduleUsed");
  if (!modulesUsed.length) modulesUsed = getMulti("shiperpModule"); // multi-select alt id
  if (!modulesUsed.length) {
    const s = getVal("shiperpModule") || getVal("modules") || getVal("module");
    if (s) modulesUsed = s.split(/[;,]/).map(x => x.trim()).filter(Boolean);
  }

  // same process? (radio/select/text supported)
  const sameProcess = getVal("sameProcess") || getVal("sameRules") || getVal("sameAsExisting") || getVal("sameShipping");

  // carriers: accept "1 to 5", "6 to 10", ">10", or a number; normalize for resolveWeight
  let onlineCarriersRaw = getVal("onlineCarriers") || getVal("carriers") || getVal("carriersCount");
  let onlineCarriers = onlineCarriersRaw;
  const m = String(onlineCarriersRaw || "").match(/(\d+)\s*to\s*(\d+)/i);
  if (m) {
    onlineCarriers = Number(m[2]);      // borne haute → tombera dans le bon bucket "6 to 10", etc.
  } else if (/^\s*>\s*(\d+)/.test(String(onlineCarriersRaw || ""))) {
    const over = Number(String(onlineCarriersRaw).replace(/[^\d]/g, ""));
    onlineCarriers = over + 1;          // forcer >10 → 11 pour matcher "More than 10"
  } else if (!Number.isNaN(Number(onlineCarriersRaw))) {
    onlineCarriers = Number(onlineCarriersRaw);
  }

  // blueprintNeeded: si absent, déduire de sameProcess
  let blueprintNeeded = getVal("blueprintNeeded") || getVal("blueprint");
  if (!blueprintNeeded && sameProcess) {
    const sp = String(sameProcess).trim().toLowerCase();
    blueprintNeeded = (["no","non","false","0"].includes(sp)) ? "Yes" : "No";
  }

  // envoyer aussi features pour featureStep (on réutilise modules)
  const features = modulesUsed.slice();

  return { siteCount, shipToRegion, modulesUsed, sameProcess, blueprintNeeded, onlineCarriers, features };
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
    const resultBox = document.getElementById("resultBox") || document.getElementById("rolloutResultBox") || document.getElementById("customerResult");
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
