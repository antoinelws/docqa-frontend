// script_sow_new_carrier.js (INTERNAL)
// Collect form → call shared SOWRULES.newCarrier → show result
// Requires: config.js, estimation_rules.js

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
    if (byId) return byId.value ?? "";
    const checked = document.querySelector(`input[name="${idOrName}"]:checked`);
    if (checked) return checked.value ?? "";
    const sel = document.querySelector(`select[name="${idOrName}"]`);
    if (sel) return sel.value ?? "";
    return "";
  };
  const getMulti = (idOrName) => {
    const el = document.getElementById(idOrName);
    if (el && el.tagName === "SELECT" && el.multiple) return Array.from(el.selectedOptions).map(o => o.value);
    const sel = document.querySelector(`select[name="${idOrName}"]`);
    if (sel && sel.multiple) return Array.from(sel.selectedOptions).map(o => o.value);
    return Array.from(document.querySelectorAll(`input[name="${idOrName}"]:checked`)).map(c => c.value);
  };

  function collectNewCarrierForm() {
    // FEATURES : union (name='features' + legacy .feature-box), nettoyée & dédoublonnée
    let features = Array.from(document.querySelectorAll("input[name='features']:checked")).map(el => el.value)
      .concat(Array.from(document.querySelectorAll("input.feature-box:checked")).map(el => el.value));
    features = Array.from(new Set(features.filter(Boolean)));

    // SYSTEMS : multi ou single ; fallback legacy (sys_ecc/sys_ewm/sys_tm)
    let systemsUsed = getMulti("systemsUsed");
    if (!systemsUsed.length) systemsUsed = getMulti("systemUsed");
    if (!systemsUsed.length) {
      const one = getVal("whichSystem") || getVal("system") || getVal("erpSystem");
      if (one) systemsUsed = [String(one)];
    }
    const legacySystemUsed = ["sys_ecc", "sys_ewm", "sys_tm"]
      .filter(id => document.getElementById(id)?.checked)
      .map(id => document.getElementById(id).value);
    if (!systemsUsed.length && legacySystemUsed.length) systemsUsed = legacySystemUsed.slice();
    const systemsCount = systemsUsed.length || Number(getVal("systemsCount")) || 0;

    // SHIP FROM / TO (multi)
    let shipFormLocation = getMulti("shipFormLocation");
    if (!shipFormLocation.length) shipFormLocation = Array.from(document.getElementById("shipFrom")?.selectedOptions || []).map(o => o.value);
    if (!shipFormLocation.length) {
      const v = getVal("shipFrom") || getVal("formLocation");
      if (v) shipFormLocation = [String(v)];
    }

    let shipToLocation = getMulti("shipToLocation");
    if (!shipToLocation.length) shipToLocation = Array.from(document.getElementById("shipTo")?.selectedOptions || []).map(o => o.value);
    if (!shipToLocation.length) {
      const v = getVal("shipTo") || getVal("toLocation");
      if (v) shipToLocation = [String(v)];
    }

    // Shipment screens : checkboxes OU select[name="shipmentScreens"]
    let shipmentScreens = ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"]
      .filter(id => document.getElementById(id)?.checked)
      .map(id => document.getElementById(id).value);
    if (!shipmentScreens.length) {
      shipmentScreens = getMulti("shipmentScreens"); // support select multiple
    }
    const shipmentScreenString = shipmentScreens.join(", ");

    // Contexte optionnel
    const shipToRegion = getVal("shipToRegion") || getVal("region");

    return {
      // champs existants (compat backend)
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

  async function run() {
    // sécurité : appliquer les defaults juste avant la collecte si besoin
    applyDefaultInputs();

    const resultBox = document.getElementById("resultBox");
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

  document.addEventListener("DOMContentLoaded", () => {
    applyDefaultInputs();
    document.getElementById("btnCalc")?.addEventListener("click", (e) => {
      e.preventDefault();
      run();
    });
  });
})();
