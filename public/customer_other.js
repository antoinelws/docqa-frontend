// customer_other.js — copie logique Other + email (appel API)

/* 1) Collect */
function collectOtherForm() {
  return {
    ecc_version: parseFloat(document.getElementById("ecc_version").value),
    ewm_version: parseFloat(document.getElementById("ewm_version").value),
    enhancements: parseInt(document.getElementById("enhancements").value),
    test_cases: document.getElementById("test_cases").value,
    customer_rating: document.getElementById("rating").value,
    corrections: parseFloat(document.getElementById("corrections").value),
    configuration: parseFloat(document.getElementById("configuration").value),
  };
}

/* 2) Estimation: identique à ton script (API /sow-estimate) */
// customer_other.js
async function estimateOther_INTERNAL(payload) {
  const url = (await SOWCFG.get())?.api?.otherUrl || "https://docqa-api.onrender.com/sow-estimate";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => null);
  if (!data) return { total_effort: null, details: null };

  return {
    total_effort: (data?.from != null && data?.to != null) ? `${data.from}-${data.to}` : null,
    details: data?.details || null
  };
}


/* 3) Breakdown (compact) */
function otherBreakdownHtml(est) {
  if (!est || !est.details) return "";
  const rows = Object.entries(est.details).slice(0, 8).map(([task, vals]) =>
    `<tr><td style="padding:4px;border:1px solid #eee;">${task}</td><td style="padding:4px;border:1px solid #eee;">${vals?.[0]} – ${vals?.[1]} h</td></tr>`
  ).join("");
  return `
    <h3 style="margin:12px 0 6px;">Estimation breakdown (partial)</h3>
    <table style="border-collapse:collapse;width:100%;max-width:700px">${rows}</table>`;
}

/* 4) Bouton */
window.submitCustomer_Other = async function () {
  await runCustomerFlow({
    formType: "Other",
    collectFn: collectOtherForm,
    estimateFn: estimateOther_INTERNAL,
    composeBreakdownHtml: otherBreakdownHtml
  });
};
