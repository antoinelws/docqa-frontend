// script_sow_new_carrier.js (INTERNAL)
// Collect form → call shared SOWRULES.newCarrier → show result
// Requires: config.js, estimation_rules.js

(function () {
  function collectNewCarrierForm() {
    // Collect features from BOTH styles (name='features' and the legacy .feature-box)
    const features =
      Array.from(document.querySelectorAll("input[name='features']:checked")).map(el => el.value)
      .concat(Array.from(document.querySelectorAll("input.feature-box:checked")).map(el => el.value));

    return {
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

      systemUsed: ["sys_ecc", "sys_ewm", "sys_tm"]
        .filter(id => document.getElementById(id)?.checked)
        .map(id => document.getElementById(id).value),

      shipmentScreens: ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"]
        .filter(id => document.getElementById(id)?.checked)
        .map(id => document.getElementById(id).value),

      shipFrom: Array.from(document.getElementById("shipFrom")?.selectedOptions || []).map(el => el.value),
      shipTo:   Array.from(document.getElementById("shipTo")?.selectedOptions || []).map(el => el.value),

      // Keep symmetry with customer; used for E28 + backend compatibility
      shipToVolume: document.getElementById("zEnhancements")?.value || "",
      shipmentScreenString: ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"]
        .filter(id => document.getElementById(id)?.checked)
        .map(id => document.getElementById(id).value)
        .join(", "),
    };
  }

  function ensureSowrulesReady() {
    if (window.SOWRULES && typeof SOWRULES.newCarrier === "function") return Promise.resolve();
    return new Promise(resolve => {
      const onReady = () => resolve();
      window.addEventListener("sowrules-ready", onReady, { once: true });
      // Safety: if the event never fires but SOWRULES appears later
      const iv = setInterval(() => {
        if (window.SOWRULES && typeof SOWRULES.newCarrier === "function") {
          clearInterval(iv);
          window.removeEventListener("sowrules-ready", onReady);
          resolve();
        }
      }, 50);
      // Failsafe timeout (5s)
      setTimeout(() => {
        clearInterval(iv);
        resolve();
      }, 5000);
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
