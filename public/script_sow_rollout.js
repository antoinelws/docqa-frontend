// script_sow_rollout.js (INTERNAL)
// Collect form → call shared SOWRULES.rollout → show result
// Requires: config.js, estimation_rules.js (charger avec "defer" avant ce fichier)

(function () {
  // -- Defaults: première option pour chaque select, premier radio si rien n'est coché
  function applyDefaultInputs() {
    document.querySelectorAll("select").forEach(sel => {
      const anySelected = Array.from(sel.options).some(o => o.selected);
      if (!anySelected && sel.options.length) {
        sel.options[0].selected = true;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    const groups = new Map();
    document.querySelectorAll('input[type="radio"]').forEach(r => {
      if (!groups.has(r.name)) groups.set(r.name, []);
      groups.get(r.name).push(r);
    });

    groups.forEach(list => {
      if (!list.some(r => r.checked) && list.length) {
        list[0].checked = true;
        list[0].dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  // -- Getters robustes
  const getVal = (idOrName) => {
    const byId = document.getElementById(idOrName);
    if (byId) return byId.value || "";
    const checked = document.querySelector(`input[name="${idOrName}"]:checked`);
    if (checked) return checked.value || "";
    const sel = document.querySelector(`select[name="${idOrName}"]`);
    if (sel) return sel.value || "";
    return "";
  };

  const getMulti = (idOrName) => {
    const el = document.getElementById(idOrName);
    if (el && el.tagName === "SELECT" && el.multiple) {
      return Array.from(el.selectedOptions).map(o => o.value);
    }
    const sel = document.querySelector(`select[name="${idOrName}"]`);
    if (sel && sel.multiple) {
      return Array.from(sel.selectedOptions).map(o => o.value);
    }
    return Array.from(document.querySelectorAll(`input[name="${idOrName}"]:checked`)).map(c => c.value);
  };

  // -- Normalisation de libellés carriers (UI ↔ JSON)
  const CARRIERS_LABEL_MAP = {
    "1 to 3": "1 to 3",
    "3 to 10": "3 to 10",
    "More than 10": "More than 10",
  };

  function normalizeCarriersLabel(label) {
    const key = String(label || "").trim();
    return CARRIERS_LABEL_MAP[key] || key;
  }

  // -- Collecte Rollout (corrigée pour correspondre à la logique Excel)
  function collectRolloutForm() {
    // site & region
    const siteCount = getVal("siteCount") || getVal("sites") || getVal("locationCount");
    const shipToRegion = getVal("shipToRegion") || getVal("region") || getVal("locationRegion");

    // modules → features proxy
    let modulesUsed = getMulti("modulesUsed");
    if (!modulesUsed.length) modulesUsed = getMulti("zEnhancementRollout");
    if (!modulesUsed.length) modulesUsed = getMulti("moduleUsed");
    if (!modulesUsed.length) modulesUsed = getMulti("shiperpModule");
    if (!modulesUsed.length) modulesUsed = Array.from(document.querySelectorAll(".module-box:checked")).map(x => x.value);
    if (!modulesUsed.length) {
      const s = getVal("shiperpModule") || getVal("modules") || getVal("module");
      if (s) modulesUsed = s.split(/[;,]/).map(x => x.trim()).filter(Boolean);
    }
    modulesUsed = Array.from(new Set(modulesUsed.filter(Boolean)));

    // same process ?
    const sameProcess = getVal("sameProcess") || getVal("blueprintNeeded") || getVal("sameRules") || getVal("sameAsExisting") || getVal("sameShipping");

    // carriers
    const carriersRaw = getVal("onlineCarriers") || getVal("carriers") || getVal("carriersCount") || getVal("onlineOfflineRollout");
    const onlineCarriersUI = String(carriersRaw || "");
    const onlineCarriers = normalizeCarriersLabel(onlineCarriersUI);

    // blueprintNeeded: map from "Will this new location be following..." question
    let blueprintNeeded = getVal("blueprintNeeded") || getVal("blueprint");
    if (!blueprintNeeded && sameProcess) {
      blueprintNeeded = sameProcess;
    }

    // alias booléen pour compat éventuelle
    const blueprint_required = String(blueprintNeeded).toLowerCase() === "no";

    // features pour featureStep (copie des modules)
    const features = modulesUsed.slice();

    return {
      siteCount,
      shipToRegion,
      modulesUsed,
      features,
      sameProcess,
      blueprintNeeded,
      blueprint_required,
      onlineCarriers
    };
  }

  // -- Calcul local basé sur la formule Excel
  function calculateLocalEstimate(payload) {
    const { siteCount, shipToRegion, blueprintNeeded, onlineCarriers } = payload;

    // Si "blueprintNeeded" = "No" → 16 heures de Blueprint/Workshop requis
    if (blueprintNeeded === "No") {
      return {
        total_effort: 16,
        breakdown: "A 16 hours Blueprint/Workshop would be required",
        requiresBlueprint: true
      };
    }

    // Sinon, si carriers n'est pas "1 to 3", retourner 99
    if (onlineCarriers !== "1 to 3") {
      return {
        total_effort: 99,
        breakdown: "Carriers count requires custom estimation",
        customEstimate: true
      };
    }

    // Calculer les heures basées sur siteCount
    let baseHours = 0;
    switch (siteCount) {
      case "Only 1":
        baseHours = 40;
        break;
      case "2 to 5":
        baseHours = 120;
        break;
      case "More than 5":
        baseHours = 200;
        break;
      default:
        baseHours = 99; // Valeur par défaut si non reconnu
    }

    // Ajouter 16 heures si région n'est pas US
    const regionHours = (shipToRegion === "US") ? 0 : 16;

    const total = baseHours + regionHours;

    return {
      total_effort: total,
      breakdown: `Base hours (${siteCount}): ${baseHours}h + Region adjustment: ${regionHours}h`,
      baseHours,
      regionHours
    };
  }

  // -- SOWRULES ready (optionnel si vous voulez aussi utiliser SOWRULES)
  function ensureSowrulesReady() {
    if (window.SOWRULES && typeof SOWRULES.rollout === "function") return Promise.resolve();
    return new Promise(resolve => {
      const onReady = () => resolve();
      window.addEventListener("sowrules-ready", onReady, { once: true });
      const iv = setInterval(() => {
        if (window.SOWRULES && typeof SOWRULES.rollout === "function") {
          clearInterval(iv);
          window.removeEventListener("sowrules-ready", onReady);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(iv);
        resolve();
      }, 5000);
    });
  }

  async function run() {
    applyDefaultInputs();

    const resultBox = document.getElementById("rolloutResultBox") || 
                      document.getElementById("resultBox") || 
                      document.getElementById("customerResult");
    
    if (!resultBox) return;

    const payload = collectRolloutForm();
    console.log("[ROLLOUT] payload:", payload);

    try {
      // Utiliser le calcul local basé sur la formule Excel
      const est = calculateLocalEstimate(payload);
      console.log("[ROLLOUT] response:", est);

      if (est && est.total_effort != null) {
        let message = `Estimated Effort: ${est.total_effort} hours`;
        if (est.breakdown) {
          message += `\n${est.breakdown}`;
        }
        resultBox.textContent = message;
        resultBox.style.color = est.requiresBlueprint ? "orange" : "green";
        resultBox.style.whiteSpace = "pre-line";
      } else {
        resultBox.textContent = "No total_effort returned.";
        resultBox.style.color = "red";
      }
    } catch (err) {
      console.error(err);
      const msg = err && err.message ? err.message : String(err);
      resultBox.textContent = `Error: ${msg}`;
      resultBox.style.color = "red";
    }
  }

  // Exposer pour l'inline onclick existant sur la page
  window.submitRolloutEstimate = run;

  document.addEventListener("DOMContentLoaded", () => {
    applyDefaultInputs();
    
    document.getElementById("btnCalc")?.addEventListener("click", (e) => {
      e.preventDefault();
      run();
    });

    document.querySelector("#rolloutForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      run();
    });
  });
})();