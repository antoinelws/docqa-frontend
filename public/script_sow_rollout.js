// script_sow_rollout.js (INTERNAL)
// Collect form → call shared SOWRULES.rollout → show result
// Requires: config.js, estimation_rules.js  (charger avec "defer" avant ce fichier)

(function () {
  // -- Defaults: première option pour chaque select, premier radio si rien n’est coché
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

  // -- Collecte Rollout (corrigée)
  function collectRolloutForm() {
    // site & region
    const siteCount    = getVal("siteCount") || getVal("sites") || getVal("locationCount");
    const shipToRegion = getVal("shipToRegion") || getVal("region") || getVal("locationRegion");

    // modules → features proxy (toutes variantes courantes)
    let modulesUsed = getMulti("modulesUsed");
    if (!modulesUsed.length) modulesUsed = getMulti("moduleUsed");
    if (!modulesUsed.length) modulesUsed = getMulti("shiperpModule");           // alt multiselect
    if (!modulesUsed.length) modulesUsed = Array.from(document.querySelectorAll(".module-box:checked")).map(x => x.value);
    if (!modulesUsed.length) {
      const s = getVal("shiperpModule") || getVal("modules") || getVal("module");
      if (s) modulesUsed = s.split(/[;,]/).map(x => x.trim()).filter(Boolean);
    }
    modulesUsed = Array.from(new Set(modulesUsed.filter(Boolean))); // nettoyé/dédoublonné

    // same process ?
    const sameProcess = getVal("sameProcess") || getVal("sameRules") || getVal("sameAsExisting") || getVal("sameShipping");

    // carriers : garder le **libellé** exact pour carriersWeights ; exposer en plus un max numérique si utile côté règles
    const carriersRaw = getVal("onlineCarriers") || getVal("carriers") || getVal("carriersCount");
    const onlineCarriers = String(carriersRaw || "");  // ex: "1 to 5", "6 to 10", "More than 10"
    let onlineCarriersMax;                             // ex: 5, 10, 11…
    const m = onlineCarriers.match(/(\d+)\s*to\s*(\d+)/i);
    if (m) onlineCarriersMax = Number(m[2]);
    else if (/^>\s*\d+/.test(onlineCarriers)) onlineCarriersMax = Number(onlineCarriers.replace(/\D/g, "")) + 1;
    else if (!Number.isNaN(Number(onlineCarriers))) onlineCarriersMax = Number(onlineCarriers);

    // blueprintNeeded : si absent, le déduire de sameProcess (No => Yes)
    let blueprintNeeded = getVal("blueprintNeeded") || getVal("blueprint");
    if (!blueprintNeeded && sameProcess) {
      const sp = String(sameProcess).trim().toLowerCase();
      blueprintNeeded = (["no","non","false","0"].includes(sp)) ? "Yes" : "No";
    }
    // alias booléen pour compat éventuelle
    const blueprint_required = String(blueprintNeeded).toLowerCase() === "yes";

    // features pour featureStep (copie des modules)
    const features = modulesUsed.slice();

    return {
      siteCount,
      shipToRegion,
      modulesUsed,
      features,
      sameProcess,
      blueprintNeeded,
      blueprint_required,   // ← utile si les règles s’attendent à un booléen
      onlineCarriers,       // ← **libellé intact** pour carriersWeights
      onlineCarriersMax     // ← numérique (facultatif) si les règles en tirent parti
    };
  }

  // -- SOWRULES ready
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
      setTimeout(() => { clearInterval(iv); resolve(); }, 5000);
    });
  }

  async function run() {
    // sécurité : appliquer les defaults juste avant la collecte au cas où
    applyDefaultInputs();

    // Support de plusieurs conteneurs possibles
    const resultBox =
      document.getElementById("rolloutResultBox") ||
      document.getElementById("resultBox") ||
      document.getElementById("customerResult");
    if (!resultBox) return;

    const payload = collectRolloutForm();
    console.log("[ROLLOUT] payload:", payload);

    try {
      await ensureSowrulesReady();
      if (!window.SOWRULES || typeof SOWRULES.rollout !== "function") {
        throw new Error("SOWRULES.rollout is not available. Make sure estimation_rules.js is loaded before this script.");
      }

      const est = await SOWRULES.rollout(payload);
      console.log("[ROLLOUT] response:", est);

      if (est && est.total_effort != null) {
        resultBox.textContent = `Estimated Effort: ${est.total_effort} hours`;
        resultBox.style.color = "green";
      } else {
        resultBox.textContent = "No total_effort returned.";
        resultBox.style.color = "red";
      }
    } catch (err) {
      console.error(err);
      const msg = err && err.message ? err.message : String(err);
      resultBox.textContent = `Network or server error: ${msg}`;
      resultBox.style.color = "red";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyDefaultInputs();
    document.getElementById("btnCalc")?.addEventListener("click", (e) => {
      e.preventDefault();
      run();
    });
  });
})();
