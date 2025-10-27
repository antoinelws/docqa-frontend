// script_sow_new_carrier.js (INTERNAL)
// Collect form → call shared SOWRULES.newCarrier → show result
// Requires: config.js, estimation_rules.js

(function () {
  // == Defaults: select first option for selects; first radio per group
  (function applyDefaultInputs() {
    const onReady = () => {
      document.querySelectorAll('select').forEach(sel => {
        const anySelected = Array.from(sel.options).some(o => o.selected);
        if (!anySelected && sel.options.length) {
          // For both single- and multi-selects, ensure at least the first option is selected by default
          sel.options[0].selected = true;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
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
          list[0].dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
    else onReady();
  })();

  // == Getters
  function getVal(idOrName) {
    const byId = document.getElementById(idOrName);
    if (byId) return byId.value ?? '';
    const checked = document.querySelector(`input[name="${idOrName}"]:checked`);
    if (checked) return checked.value ?? '';
    const sel = document.querySelector(`select[name="${idOrName}"]`);
    if (sel) return sel.value ?? '';
    return '';
  }
  function getMulti(idOrName) {
    const el = document.getElementById(idOrName);
    if (el && el.tagName === 'SELECT' && el.multiple) return Array.from(el.selectedOptions).map(o => o.value);
    const sel = document.querySelector(`select[name="${idOrName}"]`);
    if (sel && sel.multiple) return Array.from(sel.selectedOptions).map(o => o.value);
    return Array.from(document.querySelectorAll(`input[name="${idOrName}"]:checked`)).map(c => c.value);
  }

  function collectNewCarrierForm() {
    // FEATURES: keep both legacy checkbox group and name="features"
    const features = Array.from(document.querySelectorAll("input[name='features']:checked")).map(el => el.value)
      .concat(Array.from(document.querySelectorAll('input.feature-box:checked')).map(el => el.value));

    // SYSTEMS: support multi or single input variants
    let systemsUsed = getMulti('systemsUsed');
    if (!systemsUsed.length) systemsUsed = getMulti('systemUsed');
    if (!systemsUsed.length) {
      const one = getVal('whichSystem') || getVal('system') || getVal('erpSystem');
      if (one) systemsUsed = [String(one)];
    }
    // Keep legacy array too, if UI provides explicit SAP boxes
    const legacySystemUsed = ["sys_ecc", "sys_ewm", "sys_tm"]
      .filter(id => document.getElementById(id)?.checked)
      .map(id => document.getElementById(id).value);
    if (!systemsUsed.length && legacySystemUsed.length) systemsUsed = legacySystemUsed.slice();
    const systemsCount = systemsUsed.length || Number(getVal('systemsCount')) || 0;

    // SHIP FROM / TO locations (may be multi)
    let shipFormLocation = getMulti('shipFormLocation');
    if (!shipFormLocation.length) shipFormLocation = Array.from(document.getElementById('shipFrom')?.selectedOptions || []).map(o => o.value);
    if (!shipFormLocation.length) {
      const v = getVal('shipFrom') || getVal('formLocation');
      if (v) shipFormLocation = [String(v)];
    }

    let shipToLocation = getMulti('shipToLocation');
    if (!shipToLocation.length) shipToLocation = Array.from(document.getElementById('shipTo')?.selectedOptions || []).map(o => o.value);
    if (!shipToLocation.length) {
      const v = getVal('shipTo') || getVal('toLocation');
      if (v) shipToLocation = [String(v)];
    }

    // Other optional context
    const shipToRegion = getVal('shipToRegion') || getVal('region');

    return {
      // original fields (kept for symmetry / backend)
      clientName:        document.getElementById("clientName")?.value || "",
      featureInterest:   document.getElementById("featureInterest")?.value || "",
      email:             document.getElementById("email")?.value || "",
      carrierName:       document.getElementById("carrierName")?.value || "",
      carrierOther:      document.getElementById("carrierOther")?.value || "",
      alreadyUsed:       document.getElementById("alreadyUsed")?.value || "",
      zEnhancements:     document.getElementById("zEnhancements")?.value || "",   // keep bucket text
      onlineOrOffline:   document.getElementById("onlineOrOffline")?.value || "",

      features,

      sapVersion:        document.getElementById("sapVersion")?.value || "",
      abapVersion:       document.getElementById("abapVersion")?.value || "",
      shiperpVersion:    document.getElementById("shiperpVersion")?.value || "",
      serpcarUsage:      document.getElementById("serpcarUsage")?.value || "",

      // legacy capture kept
      systemUsed: legacySystemUsed,
      shipmentScreens: ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"]
        .filter(id => document.getElementById(id)?.checked)
        .map(id => document.getElementById(id).value),

      shipFrom: Array.from(document.getElementById("shipFrom")?.selectedOptions || []).map(el => el.value),
      shipTo:   Array.from(document.getElementById("shipTo")?.selectedOptions || []).map(el => el.value),

      // symmetry/customer compatibility
      shipToVolume: document.getElementById("zEnhancements")?.value || "",
      shipmentScreenString: ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"]
        .filter(id => document.getElementById(id)?.checked)
        .map(id => document.getElementById(id).value)
        .join(", "),

      // === NEW standardized fields for rules ===
      systemsUsed,
      systemsCount,
      shipFormLocation,
      shipToLocation,
      shipToRegion,
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
      resultBox.textContent = `Network or server error: ${err.message || err}`;
      resultBox.style.color = "red";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btnCalc")?.addEventListener("click", (e) => {
      e.preventDefault();
      run();
    });
  });
})();
