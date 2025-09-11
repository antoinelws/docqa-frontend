// script_customer.js — Customer pages = Parité stricte New Carrier (payload miroir) + Capture interne pour autres + EmailJS

/* ===== EmailJS ===== */
const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // Body du template: <html><body>{{{message_html}}}</body></html>
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com";

/* ===== Debug ===== */
const SOW_DEBUG = false;

/* ===== Helpers ===== */
const $id = (x) => document.getElementById(x);
const textOrArray = (v) => Array.isArray(v) ? v.join(", ") : (v ?? "");

function collectFormFields() {
  const inputs = document.querySelectorAll("input, select, textarea");
  const out = {};
  inputs.forEach(el => {
    if (el.type === "button" || el.type === "submit") return;
    const key =
      (el.id && document.querySelector(`label[for='${el.id}']`)?.textContent?.trim()) ||
      el.name || el.id;
    if (!key) return;
    if (el.type === "checkbox") {
      if (el.checked) { (out[key] ||= []).push(el.value); }
    } else if (el.multiple) {
      out[key] = Array.from(el.selectedOptions).map(o => o.value);
    } else {
      out[key] = el.value || "";
    }
  });
  return out;
}

function answersTable(fields, limit=18) {
  const rows = Object.entries(fields).slice(0, limit).map(([k,v]) => `
    <tr>
      <td style="padding:6px;border:1px solid #e5e5e5;"><strong>${k}</strong></td>
      <td style="padding:6px;border:1px solid #e5e5e5;">${textOrArray(v)}</td>
    </tr>
  `).join("");
  return `<table style="border-collapse:collapse;width:100%;max-width:820px">${rows}</table>`;
}

function buildEmailHTML(formType, fields, estimateText) {
  const who   = fields["Client Name"] || fields["Customer Name"] || fields["clientName"] || "-";
  const reply = fields["Your email address"] || fields["email"] || "-";
  const preview = answersTable(fields, 18);

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
      <h2 style="margin:0 0 6px 0;">SOW – ${formType}</h2>
      <p style="margin:4px 0;"><strong>Client:</strong> ${who}</p>
      <p style="margin:4px 0;"><strong>Reply-to:</strong> ${reply}</p>
      <p style="margin:4px 0;"><strong>Estimate (total):</strong> ${estimateText}</p>
      <h3 style="margin:12px 0 6px;">Preview (partial)</h3>
      ${preview}
      <p style="margin:10px 0 0;color:#666;">(Attachments disabled to respect EmailJS size limits.)</p>
    </div>
  `;
}

/* ====== Fallback New Carrier: payload IDENTIQUE à l’interne ======
   - zEnhancements: ENTIER si value numérique, sinon on laisse le texte; l’API se base sur shipToVolume.
   - shipToVolume: valeur **brute** du select zEnhancements (exactement comme l’interne).
*/
function buildNewCarrierPayload_INTERNAL_exact_like() {
  // features: accepte .feature-box ou name='features' selon tes pages
  const features = Array.from(document.querySelectorAll("input.feature-box:checked")).map(el => el.value)
    .concat(Array.from(document.querySelectorAll("input[name='features']:checked")).map(el => el.value));

  const systemUsed = ["sys_ecc","sys_ewm","sys_tm"]
    .filter(id => $id(id)?.checked)
    .map(id => $id(id).value);

  const shipmentScreens = ["screen_smallparcel","screen_planning","screen_tm","screen_other"]
    .filter(id => $id(id)?.checked)
    .map(id => $id(id).value);

  const zSel = $id("zEnhancements") || document.querySelector("[name='zEnhancements']");
  const zRaw = String(zSel?.value ?? "").trim(); // valeur BRUTE (ex: "Less than 10")
  const zInt = Number(zRaw);
  const zEnhancements = Number.isFinite(zInt) ? zInt : (
    { "Less than 10":9, "Between 10 and 50":50, "More than 50":100, "I'm not sure":0 }[zRaw] ?? 0
  );

  // >>> DÉTAIL CLÉ: identique à l’interne
  const shipToVolume_likeInternal = zRaw;

  return {
    clientName: $id("clientName")?.value || "",
    featureInterest: $id("featureInterest")?.value || "",
    email: $id("email")?.value || "",
    carrierName: $id("carrierName")?.value || "",
    carrierOther: $id("carrierOther")?.value || "",
    alreadyUsed: $id("alreadyUsed")?.value || "",
    zEnhancements, // entier si possible (peu importe si l’API ne l’utilise pas)
    onlineOrOffline: $id("onlineOrOffline")?.value || "",
    features,
    sapVersion: $id("sapVersion")?.value || "",
    abapVersion: $id("abapVersion")?.value || "",
    shiperpVersion: $id("shiperpVersion")?.value || "",
    serpcarUsage: $id("serpcarUsage")?.value || "",
    systemUsed,
    shipmentScreens,
    shipFrom: Array.from($id("shipFrom")?.selectedOptions || []).map(o => o.value),
    shipTo:   Array.from($id("shipTo")?.selectedOptions   || []).map(o => o.value),
    shipToVolume: shipToVolume_likeInternal, // <<< exactement comme l’interne
    shipmentScreenString: shipmentScreens.join(", ")
  };
}

async function fallbackNewCarrierEstimateText() {
  const payload = buildNewCarrierPayload_INTERNAL_exact_like();
  if (SOW_DEBUG) console.log("[SOW] Fallback payload (internal-like):", payload);

  const res = await fetch("https://docqa-api.onrender.com/estimate/new_carrier", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  if (SOW_DEBUG) console.log("[SOW] Fallback API raw:", text);

  let json = null;
  try { json = JSON.parse(text); } catch {}
  const hours = (json && typeof json.total_effort !== "undefined") ? Number(json.total_effort) : null;
  return (Number.isFinite(hours) ? `${hours} hours` : "N/A");
}

/* ====== Capture interne (pour Rollout/Upgrade/Other) ====== */
function callIfExists(names) {
  for (const n of names) {
    const fn = window[n];
    if (typeof fn === "function") {
      if (SOW_DEBUG) console.log("[SOW] using internal fn:", n);
      return fn;
    }
  }
  return null;
}
async function captureInternalEstimate(invoke) {
  return new Promise((resolve) => {
    const original = window.displayResult;
    let settled = false, captured = null;
    window.displayResult = function (message) {
      try { captured = (typeof message === "string") ? message : String(message ?? ""); } catch {}
      if (!settled) { settled = true; window.displayResult = original; resolve(captured); }
    };
    try {
      invoke();
      setTimeout(() => { if (!settled) { settled = true; window.displayResult = original; resolve(null); } }, 15000);
    } catch {
      if (!settled) { settled = true; window.displayResult = original; resolve(null); }
    }
  });
}
function parseEstimateText(rawText) {
  if (!rawText) return null;
  const reHours = /Estimated\s*Effort:\s*([0-9]+)\s*hours?/i;
  const reRange = /(From|De)\s*([0-9]+)\s*(?:to|à)\s*([0-9]+)\s*h/iu;
  const m1 = rawText.match(reHours); if (m1) return `${m1[1]} hours`;
  const m2 = rawText.match(reRange); if (m2) return `From ${m2[2]} to ${m2[3]} h`;
  return null;
}

/* ====== Routeur calcul ====== */
async function computeEstimateText(formType) {
  const t = String(formType||"").toLowerCase();

  // 🚨 Parité stricte New Carrier: on FORCE le payload miroir (pas de capture)
  if (t.includes("new") && t.includes("carrier")) {
    if (SOW_DEBUG) console.warn("[SOW] Forcing payload-identical fallback for New Carrier.");
    return await fallbackNewCarrierEstimateText();
  }

  // Autres types: on tente de réutiliser la logique interne (capture)
  let fn = null;
  if (t.includes("rollout")) {
    fn = callIfExists(["submitEstimateRollout","calculateRollout","estimateRollout","submitEstimate"]);
  } else if (t.includes("upgrade")) {
    fn = callIfExists(["submitEstimateUpgrade","calculateUpgrade","estimateUpgrade","submitEstimate"]);
  } else {
    fn = callIfExists(["submitEstimateOther","calculateOther","estimateOther","submitEstimate"]);
  }
  if (fn) {
    const raw = await captureInternalEstimate(() => fn());
    const parsed = parseEstimateText(raw);
    return parsed || "N/A";
  }
  return "N/A";
}

/* ====== EmailJS Send ====== */
async function sendEmailJS({subject, html, replyTo}) {
  const payload = {
    service_id: SERVICE_ID,
    template_id: TEMPLATE_ID,
    user_id: USER_ID,
    template_params: {
      subject,
      to_email: TO_EMAIL,
      reply_to: replyTo || "",
      message_html: html
    }
  };
  if (SOW_DEBUG) console.log("[SOW] EmailJS payload:", payload);

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
}

/* ====== Entrée bouton ====== */
window.submitCustomerForm = async function (formType) {
  const fields = collectFormFields();

  // Calcul
  let estimateText = "N/A";
  try {
    estimateText = await computeEstimateText(formType);
  } catch (e) {
    if (SOW_DEBUG) console.error("[SOW] compute failed:", e);
    estimateText = "N/A";
  }

  // Email
  const subject = `SOW | ${formType} | ${fields["Client Name"] || fields["Customer Name"] || fields["clientName"] || ""}`;
  const html    = buildEmailHTML(formType, fields, estimateText);

  try {
    await sendEmailJS({ subject, html, replyTo: fields["Your email address"] || fields["email"] || "" });
    alert("Your request has been sent to ShipERP!");
  } catch (e) {
    alert("Error sending email: " + e.message);
  }
};
