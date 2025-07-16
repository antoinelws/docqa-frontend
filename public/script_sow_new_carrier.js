document.addEventListener("DOMContentLoaded", () => {
  // Dynamically render feature checkboxes
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
      label.innerHTML = `<input type="checkbox" class="feature-box" value="${feature}" /> ${feature}`;
      container.appendChild(label);
    });
  }

  // Submit function for the form
  window.submitEstimate = function () {
    const form = {
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
      systemUsed: ["sys_ecc", "sys_ewm", "sys_tm"]
        .filter(id => document.getElementById(id)?.checked)
        .map(id => document.getElementById(id)?.value),
      shipmentScreens: ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"]
        .filter(id => document.getElementById(id)?.checked)
        .map(id => document.getElementById(id)?.value),
      shipFrom: Array.from(document.getElementById("shipFrom")?.selectedOptions || []).map(el => el.value),
      shipTo: Array.from(document.getElementById("shipTo")?.selectedOptions || []).map(el => el.value),
      shipToVolume: document.getElementById("zEnhancements")?.value, // assumed same dropdown used for shipToVolume
      shipmentScreenString: ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"]
        .filter(id => document.getElementById(id)?.checked)
        .map(id => document.getElementById(id)?.value)
        .join(", "),
    };

    fetch("https://docqa-api.onrender.com/estimate/new_carrier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
      .then(async (res) => {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          console.log("Backend response:", json);
          if (json.total_effort !== undefined) {
            displayResult(`Estimated Effort: ${json.total_effort} hours`);
          } else {
            alert("No total_effort returned:\n\n" + JSON.stringify(json, null, 2));
          }
        } catch (err) {
          console.error("Invalid JSON from server:", text);
          alert("Error: Backend did not return valid JSON.\n\n" + text);
        }
      })
      .catch((err) => {
        console.error("Fetch failed:", err);
        alert("Network or server error: " + err.message);
      });
  };
});
