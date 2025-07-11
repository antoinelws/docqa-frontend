function submitEstimate() {
  const form = {
    clientName: document.getElementById("clientName").value,
    featureInterest: document.getElementById("featureInterest").value,
    email: document.getElementById("email").value,
    carrierName: document.getElementById("carrierName").value,
    carrierOther: document.getElementById("carrierOther").value,
    alreadyUsed: document.getElementById("alreadyUsed").value,
    zEnhancements: document.getElementById("zEnhancements").value,
    onlineOrOffline: document.getElementById("onlineOrOffline").value,
    features: Array.from(document.querySelectorAll("input.feature-box:checked")).map(el => el.value),
    sapVersion: document.getElementById("sapVersion").value,
    abapVersion: document.getElementById("abapVersion").value,
    systemUsed: [
      document.getElementById("sys_ecc").checked ? "ECC" : null,
      document.getElementById("sys_ewm").checked ? "EWM" : null,
      document.getElementById("sys_tm").checked ? "TM" : null
    ].filter(Boolean),
    shiperpVersion: document.getElementById("shiperpVersion").value,
    serpcarUsage: document.getElementById("serpcarUsage").value,
    shipmentScreens: [
      document.getElementById("screen_smallparcel").checked ? "Small Parcel Screen" : null,
      document.getElementById("screen_planning").checked ? "Planning or TUV Screen" : null,
      document.getElementById("screen_tm").checked ? "SAP TM Screen" : null,
      document.getElementById("screen_other").checked ? "Other" : null
    ].filter(Boolean),
    shipFrom: Array.from(document.getElementById("shipFrom").selectedOptions).map(el => el.value),
    shipTo: Array.from(document.getElementById("shipTo").selectedOptions).map(el => el.value)
  };

  fetch("/api/estimate/new_carrier", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  })
    .then(res => res.json())
    .then(data => {
      alert(`Estimated Effort: ${data.total_effort} days`);
    })
    .catch(err => alert("Error: " + err));
}

document.addEventListener("DOMContentLoaded", () => {
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
  features.forEach((feature) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" class="feature-box" value="${feature}" /> ${feature}`;
    container.appendChild(label);
  });
});
