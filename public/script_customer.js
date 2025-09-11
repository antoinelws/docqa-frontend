// script_customer.js — Customer pages = Internal calculators (capture) + Fallback (payload identique) + EmailJS

/* ===== EmailJS ===== */
const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // Body: <html><body>{{{message_html}}}</body></html>
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com";

/* ===== Debug ===== */
const SOW_DEBUG = false;

/* ===== Helpers ===== */
const $id = (x) => document.getElementById(x);
const textOrArray = (v) => Array.isArray(v) ? v.join(", ") : (v ?? "");
const toNum = (v, d=0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

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

/* ====== Capture de l’interne (si présent) ====== */
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
    let settled = false;
    let captured = null;

    window.displayResult = function (message) {
      try {
        const s = (typeof message === "string") ? message : String(message ?? "");
        if (!settled) {
          captured = s;
          settled = true;
          window.displayResult = original;
          resolve(captured);
        }
      } catch {
        if (!settled) {
          settled = true;
          window.displayResult = original;
          resolve(null);
        }
      }
    };

    try {
      const ret = invoke();
      setTimeout(() => {
        if (!settled) {
          settled = true;
          window.displayResult = original;
          resolve(null);
        }
      }, 15000);
      return ret;
    } catch {
      if (!settled) {
        settled = true;
        window.displayResult = original;
        resolve(null);
      }
    }
  });
}

function parseEstimateText(rawText) {
  if (!rawText) return null;
  const reHours = /Estimated\s*Effort:\s*([0-9]+)\s*hours?/i;
  const reRange = /(From|De)\s*([0-9]+)\s*(?:to|à)\s*([0-9]+)\s*h/iu;
  const m1 = rawText.match(reHours);
  if (m1) return `${m1[1]} hours`;
  const m2 = rawText.match(reRange);
  if (m2) return `From ${m2[2]} to ${m2[3]} h`;
  return null; // on ne garde pas des textes ambigus pour éviter les confusions
}

/* ====== Fallback New Carrier: payload IDENTIQUE à l’interne ======
   - zEnhancements: ENTIER (si value numérique), sinon mappage libellés → nombres
   - shipToVolume: valeur **brute** du select zEnhancements (exactement comme l’interne)
   - mêmes champs, mêmes listes
*/
function readZEnhancementsIntAndRawValue() {
  const sel = $id("zEnhancements") || document.querySelector("[name='zEnhancements']");
  if (!sel) return { intVal: 0, rawVal: "0" };

  const rawVal = String(sel.value ?? "").trim();

  const n = Number(rawVal);
  if (Number.isFinite(n)) return { intVal: n, rawVal };

  const label = String(sel.options?.[sel.selectedIndex]?.textContent || rawVal || "").trim();
  const l = label.toLowerCase();
  const map = {
    "less than 10": 9,
    "1 to 10": 10,
    "10 to 50": 50,
    "50 to 100": 100,
    "more than 50": 100,
    "more than 100": 150
  };
  const intVal = map[l] ?? (label.match(/\d+/) ? Number(label.match(/\d+/)[0]) : 0);
  return { intVal, rawVal: rawVal || String(intVal) };
}

function buildNewCarrierPayload_INTERNAL_exact_like() {
  // features comme l’interne (checkboxes .feature-box si utilisés)
  const features = Array.from(document.querySelectorAll("input.feature-box:checked")).map(el => el.value)
    .concat(Array.from(document.querySelectorAll("input[name='features']:checked")).map(el => el.value));

  const systemUsed = ["sys_ecc","sys_ewm","sys_tm"]
    .filter(id => $id(id)?.checked)
    .map(id => $id(id).value);

  const shipmentScreens = ["screen_smallparcel","screen_planning","screen_tm","screen_other"]
    .filter(id => $id(id)?.checked)
    .map(id => $id(id).value);

  const { intVal: zEnhancementsInt, rawVal: zEnhRaw } = readZEnhancementsIntAndRawValue();

  // *** DÉTAIL CLÉ ***
  // L’interne (ton snippet) envoyait shipToVolume = value brute du select zEnhancements (même si c’est étrange)
  const shipToVolume_likeInternal = zEnhRaw;

  return {
    clientName: $id("clientName")?.value || "",
    featureInterest: $id("featureInterest")?.value || "",
    email: $id("email")?.value || "",
    carrierName: $id("carrierName")?.value || "",
    carrierOther: $id("carrierOther")?.value || "",
    alreadyUsed: $id("alreadyUsed")?.value || "",
    zEnhancements: zEnhancementsInt, // ENTIER
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
    shipToVolume: shipToVolume_likeInternal, // <<< identique à l’interne
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

/* ====== Routeur calcul ====== */
async function computeEstimateText(formType) {
  const t = String(formType||"").toLowerCase();

  // 1) Essaye la logique INTERNE si elle est chargée (capture displayResult)
  let fn = null;
  if (t.includes("new") && t.includes("carrier")) {
    fn = callIfExists(["submitEstimateNewCarrier","calculateNewCarrier","estimateNewCarrier","submitEstimate"]);
  } else if (t.includes("rollout")) {
    fn = callIfExists(["submitEstimateRollout","calculateRollout","estimateRollout","submitEstimate"]);
  } else if (t.includes("upgrade")) {
    fn = callIfExists(["submitEstimateUpgrade","calculateUpgrade","estimateUpgrade","submitEstimate"]);
  } else {
    fn = callIfExists(["submitEstimateOther","calculateOther","estimateOther","submitEstimate"]);
  }

  if (fn) {
    const raw = await captureInternalEstimate(() => fn());
    const parsed = parseEstimateText(raw);
    if (parsed) return parsed;

    // Si c'est New Carrier et parsing KO → on tente le fallback payload identique inter.
    if (t.includes("new") && t.includes("carrier")) {
      if (SOW_DEBUG) console.warn("[SOW] Capture found but unparsable. Falling back to payload-identical call.");
      return await fallbackNewCarrierEstimateText();
    }
    return "N/A";
  }

  // 2) Pas de fonction interne : fallback uniquement pour New Carrier
  if (t.includes("new") && t.includes("carrier")) {
    if (SOW_DEBUG) console.warn("[SOW] No internal function found. Using payload-identical fallback.");
    return await fallbackNewCarrierEstimateText();
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
