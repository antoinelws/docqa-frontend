document.addEventListener("DOMContentLoaded", () => {
  // (UI code unchanged)
const features = [
  "Shipping & Labeling",
  "Rate quoting",
  "Tracking",
  "Proof of Delivery",
  "Hazmat shipping",
  "End of day manifest",
  "Create Request for Pickup",
  "Cancel Request for Pickup",
  "Address Validation",
  "Electronic Trade Documents"
];

const container = document.getElementById("features");
if (container) {
  features.forEach((feature) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" class="feature-box" value="${feature}"> ${feature}`;
    container.appendChild(label);
  });
}


  window.submitEstimate = async function () {
    const form = {
      // ... same form gathering as before ...
      clientName: document.getElementById("clientName")?.value,
      featureInterest: document.getElementById("featureInterest")?.value,
      email: document.getElementById("email")?.value,
      carrierName: document.getElementById("carrierName")?.value,
      carrierOther: document.getElementById("carrierOther")?.value,
      alreadyUsed: document.getElementById("alreadyUsed")?.value,
      zEnhancements: parseInt(document.getElementById("zEnhancements")?.value) || 0,
      onlineOrOffline: document.getElementById("onlineOrOffline")?.value,
      features: Array.from(document.querySelectorAll("input.feature-box:checked")).map(el => el.value),
      sapVersion: document.getElementById("sapVersion")?.value,
      abapVersion: document.getElementById("abapVersion")?.value,
      shiperpVersion: document.getElementById("shiperpVersion")?.value,
      serpcarUsage: document.getElementById("serpcarUsage")?.value,
      systemUsed: ["sys_ecc", "sys_ewm", "sys_tm"].filter(id => document.getElementById(id)?.checked).map(id => document.getElementById(id)?.value),
      shipmentScreens: ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"].filter(id => document.getElementById(id)?.checked).map(id => document.getElementById(id)?.value),
      shipFrom: Array.from(document.getElementById("shipFrom")?.selectedOptions || []).map(el => el.value),
      shipTo: Array.from(document.getElementById("shipTo")?.selectedOptions || []).map(el => el.value),
      shipToVolume: document.getElementById("zEnhancements")?.value,
      shipmentScreenString: ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"].filter(id => document.getElementById(id)?.checked).map(id => document.getElementById(id)?.value).join(", "),
    };

   // ...
try {
  const result = await SOWRULES.newCarrier(form);   // <-- au lieu d'un fetch direct
  if (result?.total_effort != null) {
    displayResult(`Estimated Effort: ${result.total_effort} hours`);
  } else {
    displayResult("No total_effort returned.");
  }
} catch (err) {
  console.error(err);
  displayResult("Network or server error: " + err.message);
}

  };
});

function displayResult(message) {
  const resultBox = document.getElementById("resultBox");
  if (resultBox) {
    resultBox.textContent = message;
    resultBox.style.color = "green";
  }
}
