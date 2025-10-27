// script_sow_new_carrier.js (INTERNAL)
// Collect form → call shared SOWRULES.newCarrier → show result
// Requires: config.js, estimation_rules.js  (les charger avec "defer" avant ce fichier)

(function () {
  // ---------- Defaults (1er <option> / 1er radio) ----------
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

  // ---------- Helpers ----------
  const cleanList = (arr) => Array.from(new Set((arr || []).map(x => String(x).trim()).filter(Boolean)));

  const getVal = (idOrName) => {
    const byId = document.getElementById(idOrName);
    if (byId) return byId.value ?? "";
    const radio = document.querySelector(`input[name="${idOrName}"]:checked`);
    if (radio) return radio.value ?? "";
    const sel = document.querySelector(`select[name="${idOrName}"]`);
    if (sel) return sel.value ?? "";
    return "";
  };

  const getMulti = (idOrName) => {
    const byId = document.getElementById(idOrName);
    if (byId && byId.tagName === "SELECT" && byId.multiple) {
      return Array.from(byId.selectedOptions).map(o => o.value);
    }
    const sel = document.querySelector(`select[name="${idOrName}"]`);
    if (sel && sel.multiple) {
      return Array.from(sel.selectedOptions).map(o => o.value);
    }
    return Array.from(document.querySelectorAll(`input[name="${idOrName}"]:checked`)).map(el => el.value);
  };

  // ---------- Collecte New Carrier ----------
  function collectNewCarrierForm() {
    // FEATURES: union des 2 styles (name='features' + legacy .feature-box) + support select[name="features"]
    let features = []
      .concat(Array.from(document.querySelectorAll(`input[name="features"]:checked`)).map(el => el.value))
      .concat(Array.from(document.querySelectorAll("input.feature-box:checked")).map(el => el.value))
      .concat(getMulti("features"));
    features = cleanList(features);

    // SYSTEMS: multi ou single ; fallback legacy (sys_ecc/sys_ewm/sys_tm)
    let systemsUsed = []
      .concat(getMulti("systemsUsed"))
      .concat(getMulti("systemUsed"));
    if (!systemsUsed.length) {
      const one = getVal("whichSystem") || getVal("system") || getVal("erpSystem");
      if (one) systemsUsed = [String(one)];
    }
    const legacySystemUsed = ["sys_ecc", "sys_ewm", "sys_tm"]
      .filter(id => document.getElementById(id)?.checked)
      .map(id => document.getElementById(id).value);
    if (!systemsUsed.length && legacySystemUsed.length) systemsUsed = legacySystemUsed.slice();
    systemsUsed = cleanList(systemsUsed);
    const systemsCount = systemsUsed.length || Number(getVal("systemsCount")) || 0;

    // SHIP FROM (Ship Form Location) — support id, name & select
    let shipFormLocation = []
      .concat(getMulti("shipFormLocation"))
      .concat(Array.from(document.getElementById("shipFrom")?.selectedOptions || []).map(o => o.value));
    if (!shipFormLocation.length) {
      const v = getVal("shipFrom") || getVal("formLocation");
      if (v) shipFormLocation = [String(v)];
    }
    shipFormLocation = cleanList(shipFormLocation);

    // SHIP TO Location — support id, name & select
    let shipToLocation = []
      .concat(getMulti("shipToLocation"))
      .concat(Array.from(document.getElementById("shipTo")?.selectedOptions || []).map(o => o.value));
    if (!shipToLocation.length) {
      const v = getVal("shipTo") || getVal("toLocation");
      if (v) shipToLocation = [String(v)];
    }
    shipToLocation = cleanList(shipToLocation);

    // Shipment screens : checkboxes OU select[name="shipmentScreens"]
    let shipmentScreens = ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"]
      .filter(id => document.getElementById(id)?.checked)
      .map(id => document.getElementById(id).value);
    if (!shipmentScreens.length) {
      shipmentScreens = getMulti("shipmentScreens");
    }
    shipmentScreens = cleanList(shipmentScreens);
    const shipmentScreenString = shipmentScreens.join(", ");

    // Contexte optionnel
    const shipToRegion = getVal("shipToRegion") || getVal("region");

    return {
      // === champs existants (compat backend) ===
      clientName:        document.getElementById("clientName")?.value || "",
      featureInterest:   document.getElementById("featureInterest")?.value || "",
      email:             document.getElementById("email")?.value || "",
      carrierName:       document.getElementById("carrierName")?.value || "",
      carrierOther:      document.getElementById("carrierOther")?.value || "",
      alreadyUsed:       document.getElementById("alreadyUsed")?.value || "",
      zEnhancements:     document.getElementById("zEnhancements")?.value || "",
      onlineOrOffline:   document.getElementById("onlineOrOffline")?.value || "",

      sapVersion:        document.getElementById("sapVersion")?.value || "",
      abapVersion:       document.getElementById("abapVersion")?.value || "",
      shiperpVersion:    document.getElementById("shiperpVersion")?.value || "",
      serpcarUsage:      document.getElementById("serpcarUsage")?.value || "",

      // legacy conservés
      systemUsed: legacySystemUsed,
      shipFrom:  Array.from(document.getElementById("shipFrom")?.selectedOptions || []).map(el => el.value),
      shipTo:    Array.from(document.getElementById("shipTo")?.selectedOptions || []).map(el => el.value),
      shipToVolume: document.getElementById("zEnhancements")?.value || "",
      shipmentScreenString,

      // === champs normalisés pour les règles ===
      features,
      systemsUsed,
      systemsCount,
      shipFormLocation,
      shipToLocation,
      shipToRegion,
      shipmentScreens
    };
  }

  // ---------- SOWRULES ready ----------
  function ensureSowrulesReady() {
    if (window.SOWRULES && typeof SOWRULES.newCarrier === "function") return Promise.resolve();
    return new Promise(resolve => {
      const onReady = () => resolve();
      window.addEventListener("sowrules-ready", onReady, { once: true });
      const iv = setInterval(() => {
        if (window.SOWRULES && typeof SOWRULES.newCarrier === "function") {
          clearInterval(iv);
          window.removeEventListener("sowrules-ready", onReady);
          resolve();
        }
      }, 50);
      setTimeout(() => { clearInterval(iv); resolve(); }, 5000);
    });
  }

  // ---------- Run ----------
  async function run() {
    // applique les defaults juste avant la collecte, au cas où
    applyDefaultInputs();

    const resultBox =
      document.getElementById("carrierResultBox") ||
      document.getElementById("resultBox");
    if (!resultBox) return;

    const payload = collectNewCarrierForm();
    console.log("[NC INTERNAL] payload:", payload);

    try {
      await ensureSowrulesReady();
      if (!window.SOWRULES || typeof SOWRULES.newCarrier !== "function") {
        throw new Error("SOWRULES.newCarrier is not available. Make sure estimation_rules.js is loaded before this script.");
      }

      const est = await SOWRULES.newCarrier(payload);
      console.log("[NC INTERNAL] response:", est);

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

  // ---------- Bindings (inline & modernes) ----------
  // si la page utilise un onclick="submitCarrierEstimate()" ou "submitNewCarrierEstimate()", expose-les :
  window.submitCarrierEstimate     = run;
  window.submitNewCarrierEstimate  = run;

  document.addEventListener("DOMContentLoaded", () => {
    applyDefaultInputs();
    document.getElementById("btnCalc")?.addEventListener("click", (e) => {
      e.preventDefault();
      run();
    });
    document.querySelector("#newCarrierForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      run();
    });
  });
})();
