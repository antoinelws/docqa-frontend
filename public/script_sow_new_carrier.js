// script_sow_new_carrier.js (INTERNAL)
// Collect form → call shared SOWRULES.newCarrier → show result

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnCalc")?.addEventListener("click", async () => {
    const resultBox = document.getElementById("resultBox");

    const payload = {
      clientName: document.getElementById("clientName")?.value || "",
      featureInterest: document.getElementById("featureInterest")?.value || "",
      email: document.getElementById("email")?.value || "",
      carrierName: document.getElementById("carrierName")?.value || "",
      carrierOther: document.getElementById("carrierOther")?.value || "",
      alreadyUsed: document.getElementById("alreadyUsed")?.value || "",
      zEnhancements: document.getElementById("zEnhancements")?.value || "",
      onlineOrOffline: document.getElementById("onlineOrOffline")?.value || "",

      // ✅ same as customer: read the statically-coded checkboxes
      features: Array.from(document.querySelectorAll("input[name='features']:checked")).map(el => el.value),

      sapVersion: document.getElementById("sapVersion")?.value || "",
      abapVersion: document.getElementById("abapVersion")?.value || "",
      shiperpVersion: document.getElementById("shiperpVersion")?.value || "",
      serpcarUsage: document.getElementById("serpcarUsage")?.value || "",

      systemUsed: ["sys_ecc", "sys_ewm", "sys_tm"]
        .filter(id => document.getElementById(id)?.checked)
        .map(id => document.getElementById(id)?.value),

      shipmentScreens: ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"]
        .filter(id => document.getElementById(id)?.checked)
        .map(id => document.getElementById(id)?.value),

      shipFrom: Array.from(document.getElementById("shipFrom")?.selectedOptions || []).map(el => el.value),
      shipTo:   Array.from(document.getElementById("shipTo")?.selectedOptions || []).map(el => el.value),

      // keep symmetry with customer
      shipToVolume: document.getElementById("zEnhancements")?.value || "",
      shipmentScreenString: ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"]
        .filter(id => document.getElementById(id)?.checked)
        .map(id => document.getElementById(id)?.value)
        .join(", "),
    };

    try {
      const est = await SOWRULES.newCarrier(payload); // shared normalization + API
      if (est?.total_effort != null) {
        resultBox.textContent = `Estimated Effort: ${est.total_effort} hours`;
        resultBox.style.color = "green";
      } else {
        resultBox.textContent = "No total_effort returned.";
        resultBox.style.color = "red";
      }
    } catch (e) {
      console.error(e);
      resultBox.textContent = "Network or server error.";
      resultBox.style.color = "red";
    }
  });
});
