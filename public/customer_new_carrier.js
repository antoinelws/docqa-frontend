// customer_new_carrier.js — copie logique interne + email

/* 1) Collect: identique à ton script interne */
function collectNewCarrierForm() {
  const features =
    Array.from(document.querySelectorAll("input.feature-box:checked")).map(el => el.value)
    .concat(Array.from(document.querySelectorAll("input[name='features']:checked")).map(el => el.value));

  return {
    clientName: document.getElementById("clientName")?.value,
    featureInterest: document.getElementById("featureInterest")?.value,
    email: document.getElementById("email")?.value,
    carrierName: document.getElementById("carrierName")?.value,
    carrierOther: document.getElementById("carrierOther")?.value,
    alreadyUsed: document.getElementById("alreadyUsed")?.value,
    zEnhancements: parseInt(document.getElementById("zEnhancements")?.value) || 0,
    onlineOrOffline: document.getElementById("onlineOrOffline")?.value,
    features,
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
    shipTo:   Array.from(document.getElementById("shipTo")?.selectedOptions || []).map(el => el.value),

    // ⚠️ Comme l’interne : valeur brute du select
    shipToVolume: document.getElementById("zEnhancements")?.value,

    shipmentScreenString: ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"]
      .filter(id => document.getElementById(id)?.checked)
      .map(id => document.getElementById(id)?.value)
      .join(", "),
  };
}

/* 2) Estimation: identique à l’interne (appel API & parsing) */
// customer_new_carrier.js
async function estimateNewCarrier_INTERNAL(payload) {
  const cfg = await SOWCFG.get();
  const url = cfg?.api?.newCarrierUrl || "https://docqa-api.onrender.com/estimate/new_carrier";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  // API might return text or JSON; be defensive
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return {
      total_effort: json?.total_effort ?? null,
      details: json?.details || null
    };
  } catch {
    return { total_effort: null, details: null };
  }
}


/* 3) Breakdown (optionnel) */
function ncBreakdownHtml(est) {
  if (!est || !est.details) return "";
  const rows = Object.entries(est.details).slice(0, 8).map(([k,v]) => `
    <tr><td style="padding:4px;border:1px solid #eee;">${k}</td><td style="padding:4px;border:1px solid #eee;">${v}</td></tr>`).join("");
  return `
    <h3 style="margin:12px 0 6px;">Estimation breakdown (partial)</h3>
    <table style="border-collapse:collapse;width:100%;max-width:700px">${rows}</table>`;
}

/* 4) Bouton */
window.submitCustomer_NewCarrier = async function () {
  await runCustomerFlow({
    formType: "New Carrier",
    collectFn: collectNewCarrierForm,
    estimateFn: estimateNewCarrier_INTERNAL,
    composeBreakdownHtml: ncBreakdownHtml
  });
};
