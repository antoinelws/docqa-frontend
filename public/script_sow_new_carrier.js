// script_sow_new_carrier.js (INTERNAL)
// Collect form → compute internal estimate → show result
// Requires: config.js, estimation_rules.js (for other features, but not needed here)

(function () {
  // ---------- Defaults (1st non-disabled <option> / 1st radio per group) ----------
  function applyDefaultInputs() {
    document.querySelectorAll("select").forEach(sel => {
      const anySelected = Array.from(sel.options).some(o => o.selected);
      if (!anySelected && sel.options.length) {
        const firstUsable = Array.from(sel.options).find(o => !o.disabled);
        if (firstUsable) firstUsable.selected = true;
        else sel.options[0].selected = true;
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

  // --- Collect form into payload ---
  function collectNewCarrierForm() {
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

    // FEATURES (name="features")
    let features = []
      .concat(Array.from(document.querySelectorAll(`input[name="features"]:checked`)).map(el => el.value))
      .concat(getMulti("features"));
    features = cleanList(features);

    // SYSTEMS (multi/single + legacy checkboxes)
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

    const SYSTEM_LABEL_MAP = {
      "ECC": "ECC", "SAP ECC": "ECC",
      "EWM": "EWM", "SAP EWM": "EWM",
      "TM":  "TM",  "SAP TM":  "TM"
    };
    const systemsUsedNorm = systemsUsed.map(x => SYSTEM_LABEL_MAP[x] || x);
    const systemsCount = systemsUsedNorm.length || Number(getVal("systemsCount")) || 0;

    // SHIP FROM
    let shipFormLocation = []
      .concat(getMulti("shipFormLocation"))
      .concat(Array.from(document.getElementById("shipFrom")?.selectedOptions || []).map(o => o.value));
    if (!shipFormLocation.length) {
      const v = getVal("shipFrom") || getVal("formLocation");
      if (v) shipFormLocation = [String(v)];
    }
    shipFormLocation = cleanList(shipFormLocation);

    // SHIP TO
    let shipToLocation = []
      .concat(getMulti("shipToLocation"))
      .concat(Array.from(document.getElementById("shipTo")?.selectedOptions || []).map(o => o.value));
    if (!shipToLocation.length) {
      const v = getVal("shipTo") || getVal("toLocation");
      if (v) shipToLocation = [String(v)];
    }
    shipToLocation = cleanList(shipToLocation);

    // Shipment screens
    let shipmentScreens = ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"]
      .filter(id => document.getElementById(id)?.checked)
      .map(id => document.getElementById(id).value);
    if (!shipmentScreens.length) shipmentScreens = getMulti("shipmentScreens");
    shipmentScreens = cleanList(shipmentScreens);
    const shipmentScreenString = shipmentScreens.join(", ");

    const shipToRegion = getVal("shipToRegion") || getVal("region");

    const base = {
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

      systemUsed: legacySystemUsed,
      shipFrom:  Array.from(document.getElementById("shipFrom")?.selectedOptions || []).map(el => el.value),
      shipTo:    Array.from(document.getElementById("shipTo")?.selectedOptions || []).map(el => el.value),
      shipToVolume: document.getElementById("zEnhancements")?.value || "",
      shipmentScreenString,
    };

    return {
      ...base,
      features,
      systemsUsed: systemsUsedNorm,
      systems:     systemsUsedNorm,
      systemUsed:  systemsUsedNorm,
      whichSystem: systemsUsedNorm.join(", "),
      system:      systemsUsedNorm[0] || "",
      systemsCount,
      shipFormLocation,
      shipFromLocation: shipFormLocation,
      shipFromLocations: shipFormLocation,
      fromLocation: shipFormLocation,
      shipToLocation,
      shipToLocations: shipToLocation,
      toLocation: shipToLocation,
      shipToRegion,
      shipmentScreens,
    };
  }

  // ---------- Simple internal estimator for New Carrier INTERNAL ----------
    // ---------- Simple internal estimator for New Carrier INTERNAL ----------
  function computeInternalEstimate(payload) {
    let hours = 0;
    const breakdown = [];

    function addPart(label, value, note) {
      breakdown.push({ label, value, note });
      hours += value;
    }

    // 1) Carrier base
    // if the carrier is not listed on the carrier name it should return 40hours
    // and if carrier selected is in the dropdown return 60hours
    const carrierName = (payload.carrierName || "").trim();
    if (carrierName) {
      addPart("Carrier base (listed in dropdown)", 60, carrierName);
    } else {
      addPart("Carrier base (not listed)", 40, "No carrier selected in dropdown");
    }

    // 2) Do you already use this carrier with ShipERP on another plant?
    // if yes return minus 16hours, if no return 0
    const alreadyUsed = (payload.alreadyUsed || "").trim();
    if (alreadyUsed === "Yes") {
      addPart("Already used with ShipERP on another plant", -16, "Answer: Yes");
    } else {
      addPart("Already used with ShipERP on another plant", 0, `Answer: ${alreadyUsed || "No/I do not know"}`);
    }

    // 3) Online or Offline
    // if online should return 0, then if offline minus 32 hours
    const onlineOrOffline = (payload.onlineOrOffline || "").trim();
    if (onlineOrOffline === "Offline") {
      addPart("Online vs Offline", -32, "Offline");
    } else {
      addPart("Online vs Offline", 0, onlineOrOffline || "Online / I do not know");
    }

    // 4) What type of feature will you use?
    // if selected more than 3 return 16hours, else return 0
    const features = Array.isArray(payload.features) ? payload.features : [];
    if (features.length > 3) {
      addPart("Features used (more than 3)", 16, `${features.length} selected`);
    } else {
      addPart("Features used (3 or fewer)", 0, `${features.length} selected`);
    }

    // 5) Which system will be used?
    // if more than 1 return 16 hours else, return 0
    const systems = Array.isArray(payload.systemUsed) ? payload.systemUsed : [];
    if (systems.length > 1) {
      addPart("Systems used (more than 1)", 16, systems.join(", ") || "None");
    } else {
      addPart("Systems used (1 or 0)", 0, systems.join(", ") || "None");
    }

    // 6) Shiperp current version
    // "Above 4.5" → result is 0
    // "Between 4.0 and 4.5" → result is 0
    // "Between 3.6 and 3.9" → result is 8 hours
    // "Lower than 3.6" → result is 12hours
    const shiperpVersion = (payload.shiperpVersion || "").trim();
    if (shiperpVersion === "Between 3.6 and 3.9") {
      addPart("ShipERP version impact", 8, shiperpVersion);
    } else if (shiperpVersion === "Lower than 3.6") {
      addPart("ShipERP version impact", 12, shiperpVersion);
    } else {
      addPart("ShipERP version impact", 0, shiperpVersion || "Above 4.5 / Between 4.0 and 4.5");
    }

    // 7) Screen used to create shipment
    // if selected more than 1 return 8 hours, else return 0
    const screens = Array.isArray(payload.shipmentScreens) ? payload.shipmentScreens : [];
    if (screens.length > 1) {
      addPart("Screens used (more than 1)", 8, screens.join(", ") || "None");
    } else {
      addPart("Screens used (1 or 0)", 0, screens.join(", ") || "None");
    }

    // 8) Do you currently use or have used a SERPCAR carrier?
    // if yes should minus 16hours, if no 0
    const serpcarUsage = (payload.serpcarUsage || "").trim();
    if (serpcarUsage === "Yes") {
      addPart("SERPCAR carrier usage", -16, "Answer: Yes");
    } else {
      addPart("SERPCAR carrier usage", 0, `Answer: ${serpcarUsage || "No/I do not know"}`);
    }

    // optional: prevent negative totals
    // if (hours < 0) hours = 0;

    return { total_effort: hours, breakdown };
  }


  // ---------- Validation ----------
  function clearValidationUI() {
    document.querySelectorAll(".has-error").forEach(el => el.classList.remove("has-error"));
    document.querySelectorAll(".error-text").forEach(el => el.textContent = "");
    const summary = document.getElementById("validationSummary");
    if (summary) {
      summary.style.display = "none";
      summary.innerHTML = "";
    }
  }

  function showValidationErrors(errors) {
    const summary = document.getElementById("validationSummary");
    if (summary && Object.keys(errors).length) {
      summary.style.display = "block";
      const list = Object.values(errors).map(msg => `<li>${msg}</li>`).join("");
      summary.innerHTML = `<strong>Please fix the following:</strong><ul>${list}</ul>`;
    }

    // Per-field errors
    if (errors.clientName) {
      const label = document.getElementById("field-clientName");
      label?.classList.add("has-error");
      const errEl = document.querySelector('[data-error-for="clientName"]');
      if (errEl) errEl.textContent = errors.clientName;
    }
    if (errors.sapVersion) {
      const label = document.getElementById("field-sapVersion");
      label?.classList.add("has-error");
      const errEl = document.querySelector('[data-error-for="sapVersion"]');
      if (errEl) errEl.textContent = errors.sapVersion;
    }
    if (errors.abapVersion) {
      const label = document.getElementById("field-abapVersion");
      label?.classList.add("has-error");
      const errEl = document.querySelector('[data-error-for="abapVersion"]');
      if (errEl) errEl.textContent = errors.abapVersion;
    }
    if (errors.systems) {
      const fs = document.getElementById("field-systems");
      fs?.classList.add("has-error");
      const errEl = document.querySelector('[data-error-for="systems"]');
      if (errEl) errEl.textContent = errors.systems;
    }
    if (errors.screens) {
      const fs = document.getElementById("field-screens");
      fs?.classList.add("has-error");
      const errEl = document.querySelector('[data-error-for="screens"]');
      if (errEl) errEl.textContent = errors.screens;
    }
  }

  function validateNewCarrier(payload) {
    const errors = {};

    if (!payload.clientName) {
      errors.clientName = "Client Name is required.";
    }
    if (!payload.sapVersion || !payload.sapVersion.trim()) {
      errors.sapVersion = "SAP Version is required.";
    }
    if (!payload.abapVersion || !payload.abapVersion.trim()) {
      errors.abapVersion = "ABAP Version is required.";
    }
    const systems = Array.isArray(payload.systemUsed) ? payload.systemUsed : [];
    if (!systems.length) {
      errors.systems = "Select at least one system.";
    }
    const screens = Array.isArray(payload.shipmentScreens) ? payload.shipmentScreens : [];
    if (!screens.length) {
      errors.screens = "Select at least one screen used to create shipment.";
    }

    return errors;
  }

  // ---------- Main run ----------
  async function run() {
    applyDefaultInputs();
    clearValidationUI();

    const resultBox = document.getElementById("resultBox") || document.getElementById("carrierResultBox");
    if (!resultBox) return;

    const payload = collectNewCarrierForm();
    console.log("[NC INTERNAL] payload:", payload);

    const errors = validateNewCarrier(payload);
    if (Object.keys(errors).length) {
      showValidationErrors(errors);
      resultBox.style.display = "none";
      return;
    }

    try {
      const est = computeInternalEstimate(payload);
      console.log("[NC INTERNAL] computed:", est);

      if (est && est.total_effort != null) {
        resultBox.textContent = `Estimated Effort: ${est.total_effort} hours`;
        resultBox.style.display = "block";
        resultBox.style.color = "#166534";
      } else {
        resultBox.textContent = "No total_effort returned.";
        resultBox.style.display = "block";
        resultBox.style.color = "#b91c1c";
      }
    } catch (err) {
      console.error(err);
      resultBox.textContent = `Calculation error: ${err.message || err}`;
      resultBox.style.display = "block";
      resultBox.style.color = "#b91c1c";
    }
  }

  // expose for inline
  window.submitCarrierEstimate = run;
  window.submitNewCarrierEstimate = run;

  document.addEventListener("DOMContentLoaded", () => {
    applyDefaultInputs();
    document.getElementById("btnCalc")?.addEventListener("click", (e) => {
      e.preventDefault();
      run();
    });
    document.querySelector('#formNewCarrierInternal')?.addEventListener('submit', (e) => {
      e.preventDefault();
      run();
    });
  });
})();
