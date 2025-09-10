/* =========================================================================
   script_customer.js — Client pages = Internal logic + EmailJS (UX client)
   ========================================================================= */

const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // template body: <html><body>{{{message_html}}}</body></html>
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com";

// Active le log pour vérifier la valeur envoyée & la réponse serveur
const SOW_DEBUG = true;

/* ------------------ Helpers ------------------ */
const $id = (x) => document.getElementById(x);
const textOrArray = (v) => Array.isArray(v) ? v.join(", ") : (v ?? "");
const toNum = (v, d=0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

/** 
 * Lecture ROBUSTE de zEnhancements en INT, alignée avec l’interne.
 * 1) Si la valeur <option value="..."> est numérique → on la prend (comme l’interne).
 * 2) Sinon, on mappe les textes usuels (“Less than 10”, “More than 50”, “10 to 50”, “50 to 100”, “More than 100”).
 * 3) En dernier recours, on parse les nombres et on déduit:
 *    - “less/under/lower than N” → N-1  (≈ seau inférieur)
 *    - “more/greater/over than N” → max(N*2, N+50)  (≈ seau supérieur)
 *    - “A to B” → B (borne haute)
 */
function readZEnhancementsInt() {
  // source: id ou name
  const sel = $id("zEnhancements") || document.querySelector("[name='zEnhancements']");
  if (!sel) return 0;

  const valRaw = (sel.value ?? "").trim();
  // 1) priorité: valeur numérique si disponible (exactement comme l’interne)
  const numeric = Number(valRaw);
  if (Number.isFinite(numeric)) return numeric;

  // 2) mapping de libellés courants
  const label = (sel.options?.[sel.selectedIndex]?.textContent || valRaw || "").trim();
  const l = label.toLowerCase();

  const directMap = new Map([
    ["less than 10", 9],
    ["< 10", 9],
    ["<10", 9],
    ["1 to 10", 10],
    ["1–10", 10],
    ["1-10", 10],
    ["10 to 50", 50],
    ["10–50", 50],
    ["10-50", 50],
    ["50 to 100", 100],
    ["50–100", 100],
    ["50-100", 100],
    ["more than 50", 100],
    ["> 50", 100],
    [">50", 100],
    ["more than 100", 150],
    ["> 100", 150],
    [">100", 150]
  ]);

  if (directMap.has(l)) return directMap.get(l);

  // 3) heuristique générique
  const nums = (label.match(/\d+/g) || []).map(n => Number(n)).filter(Number.isFinite);
  if (nums.length) {
    if (/(less|under|lower)\s+than/i.test(label)) {
      return Math.max(0, nums[0] - 1);           // ex: “Less than 10” -> 9
    }
    if (/(more|greater|over)\s+than/i.test(label)) {
      const n = Math.max(...nums);
      return Math.max(n * 2, n + 50);            // ex: “More than 50” -> 100 (ou plus)
    }
    if (/\bto\b|–|-/i.test(label) && nums.length >= 2) {
      return Math.max(...nums);                   // ex: “10 to 50” -> 50
    }
    return nums[0];                               // valeur par défaut
  }

  return 0;
}

/* ------------------ Email helpers ------------------ */
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

function renderBreakdownHTML(breakdown) {
  if (!breakdown) return "";
  let rows = "";
  if (Array.isArray(breakdown)) {
    rows = breakdown.map(row => {
      let label="", hours="", note="";
      if (Array.isArray(row)) { [label, hours, note] = row; }
      else if (row && typeof row === "object") {
        label = row.label ?? row.task ?? "";
        hours = row.hours ?? row.time ?? row.value ?? "";
        note  = row.note ?? row.comment ?? "";
      } else { label = String(row); }
      if (typeof hours === "number") hours = `${hours} h`;
      return `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${label || "-"}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${hours || "-"}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${note || ""}</td>
        </tr>`;
    }).join("");
  } else if (typeof breakdown === "object") {
    rows = Object.entries(breakdown).map(([k,v]) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${k}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${textOrArray(v)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;"></td>
      </tr>`).join("");
  }
  if (!rows) return "";
  return `
    <table style="border-collapse:collapse;width:100%;font:14px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:8px 0">
      <thead>
        <tr>
          <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #ddd;">Item</th>
          <th style="text-align:right;padding:6px 10px;border-bottom:2px solid #ddd;">Hours</th>
          <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #ddd;">Notes</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildEmailHTML(formType, fields, est) {
  const who   = fields["Client Name"] || fields["Customer Name"] || fields["clientName"] || "-";
  const reply = fields["Your email address"] || fields["email"] || "-";
  const total =
    (est.hours != null || est.cost != null)
      ? `${est.hours ?? "?"} h${est.rate ? ` · $${est.cost ?? "?"} @ $${est.rate}/h` : ""}`
      : "N/A";
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
      <h2 style="margin:0 0 6px 0;">SOW – ${formType}</h2>
      <p style="margin:4px 0;"><strong>Client:</strong> ${who}</p>
      <p style="margin:4px 0;"><strong>Reply-to:</strong> ${reply}</p>
      <p style="margin:4px 0;"><strong>Estimate (total):</strong> ${total}</p>
      ${renderBreakdownHTML(est.breakdown)}
      <h3 style="margin:12px 0 6px;">Preview (partial)</h3>
      ${answersTable(fields, 18)}
      <p style="margin:10px 0 0;color:#666;">(Attachments disabled to comply with EmailJS size limits.)</p>
    </div>`;
}

/* ------------------ Estimation — New Carrier (interne identique) ------------------ */
/** 
 * On reconstruit le payload **exactement** comme la page interne que tu as collée
 * (mêmes champs, même calcul de features, même affectation shipToVolume).
 */
function buildNewCarrierPayload_InternalExact() {
  const features = Array.from(document.querySelectorAll("input.feature-box:checked")).map(el => el.value);
  const systemUsed = ["sys_ecc", "sys_ewm", "sys_tm"]
    .filter(id => $id(id)?.checked)
    .map(id => $id(id)?.value);
  const shipmentScreens = ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"]
    .filter(id => $id(id)?.checked)
    .map(id => $id(id)?.value);

  const zEnhInt = readZEnhancementsInt(); // <- clé du correctif

  // IMPORTANT : pour coller à ton interne, on garde shipToVolume = #zEnhancements.value (même si c’est étrange)
  const shipToVolume_likeInternal = ($id("zEnhancements")?.value ?? String(zEnhInt));

  return {
    clientName: $id("clientName")?.value,
    featureInterest: $id("featureInterest")?.value,
    email: $id("email")?.value,
    carrierName: $id("carrierName")?.value,
    carrierOther: $id("carrierOther")?.value,
    alreadyUsed: $id("alreadyUsed")?.value,
    zEnhancements: zEnhInt,                       // ENTIER (comme l’interne)
    onlineOrOffline: $id("onlineOrOffline")?.value,
    features,
    sapVersion: $id("sapVersion")?.value,
    abapVersion: $id("abapVersion")?.value,
    shiperpVersion: $id("shiperpVersion")?.value,
    serpcarUsage: $id("serpcarUsage")?.value,
    systemUsed,
    shipmentScreens,
    shipFrom: Array.from($id("shipFrom")?.selectedOptions || []).map(el => el.value),
    shipTo:   Array.from($id("shipTo")?.selectedOptions   || []).map(el => el.value),
    shipToVolume: shipToVolume_likeInternal,       // ← identique à l’interne
    shipmentScreenString: shipmentScreens.join(", ")
  };
}

async function estimateNewCarrier_INTERNAL() {
  const form = buildNewCarrierPayload_InternalExact();
  if (SOW_DEBUG) console.log("[SOW] payload new_carrier:", form);

  const res = await fetch("https://docqa-api.onrender.com/estimate/new_carrier", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  const text = await res.text();
  if (SOW_DEBUG) console.log("[SOW] response new_carrier (raw):", text);

  let json; try { json = JSON.parse(text); } catch { json = null; }
  if (!json || typeof json.total_effort === "undefined") {
    // minimum affichable si la réponse est anormale
    const hours = 24, rate = 180, cost = hours * rate;
    return { hours, rate, cost, breakdown: [{label:"Baseline", hours}] };
  }

  const hours = toNum(json.total_effort, 0);
  const rate  = 180;
  const cost  = Math.round(hours * rate);
  const breakdown = Array.isArray(json.breakdown) ? json.breakdown : null;

  if (SOW_DEBUG) console.log("[SOW] parsed total_effort:", hours);
  return { hours, rate, cost, breakdown };
}

/* ------------------ Estimation — autres types (utilise tes internes si présents) ------------------ */
function normalizeInternalResult(ret) {
  if (ret && typeof ret === "object" && ("hours" in ret || "cost" in ret)) {
    const hours = toNum(ret.hours, null);
    const rate  = toNum(ret.rate,  hours != null ? 180 : null);
    const cost  = toNum(ret.cost,  (hours != null && rate != null) ? hours*rate : null);
    const breakdown = Array.isArray(ret.breakdown) || typeof ret.breakdown === "object" ? ret.breakdown : null;
    return { hours, rate, cost, breakdown };
  }
  const hours = toNum(ret, null);
  const rate  = hours != null ? 180 : null;
  const cost  = (hours != null && rate != null) ? hours*rate : null;
  return { hours, rate, cost, breakdown: null };
}

function estimateRollout_INTERNAL() {
  if (typeof window.estimateRollout === "function") return normalizeInternalResult(window.estimateRollout());
  return { hours:null, rate:null, cost:null, breakdown:null }; // pas de fallback : on veut la parité stricte
}
function estimateUpgrade_INTERNAL() {
  if (typeof window.estimateUpgrade === "function") return normalizeInternalResult(window.estimateUpgrade());
  return { hours:null, rate:null, cost:null, breakdown:null };
}
async function estimateOther_INTERNAL() {
  if (typeof window.estimateOther === "function") {
    const ret = await window.estimateOther();
    return normalizeInternalResult(ret);
  }
  return { hours:null, rate:null, cost:null, breakdown:null };
}

/* ------------------ Routage + EmailJS ------------------ */
async function computeEstimate(typeLabel){
  const t = String(typeLabel||"").toLowerCase();
  if (t.includes("new") && t.includes("carrier")) return await estimateNewCarrier_INTERNAL();
  if (t.includes("rollout"))                      return estimateRollout_INTERNAL();
  if (t.includes("upgrade"))                      return estimateUpgrade_INTERNAL();
  return await estimateOther_INTERNAL();
}

async function sendEmailJS({subject, html, est, toEmail}) {
  const payload = {
    service_id: SERVICE_ID,
    template_id: TEMPLATE_ID,
    user_id: USER_ID,
    template_params: {
      subject,
      to_email: toEmail || TO_EMAIL,
      message_html: html,
      estimate_hours: String(est.hours ?? ""),
      estimate_cost:  String(est.cost ?? ""),
      estimate_rate:  String(est.rate ?? "")
    }
  };
  if (SOW_DEBUG) console.log("[SOW] EmailJS payload:", payload);
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
}

function buildEmailHTML(formType, fields, est) {
  const who   = fields["Client Name"] || fields["Customer Name"] || fields["clientName"] || "-";
  const reply = fields["Your email address"] || fields["email"] || "-";
  const total =
    (est.hours != null || est.cost != null)
      ? `${est.hours ?? "?"} h${est.rate ? ` · $${est.cost ?? "?"} @ $${est.rate}/h` : ""}`
      : "N/A";
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
      <h2 style="margin:0 0 6px 0;">SOW – ${formType}</h2>
      <p style="margin:4px 0;"><strong>Client:</strong> ${who}</p>
      <p style="margin:4px 0;"><strong>Reply-to:</strong> ${reply}</p>
      <p style="margin:4px 0;"><strong>Estimate (total):</strong> ${total}</p>
      ${renderBreakdownHTML(est.breakdown)}
      <h3 style="margin:12px 0 6px;">Preview (partial)</h3>
      ${answersTable(fields, 18)}
      <p style="margin:10px 0 0;color:#666;">(Attachments disabled to comply with EmailJS size limits.)</p>
    </div>`;
}

window.submitCustomerForm = async function (formType) {
  const fields = collectFormFields();
  const est = await computeEstimate(formType);

  const subject = `SOW | ${formType} | ${fields["Client Name"] || fields["Customer Name"] || fields["clientName"] || ""}`;
  const html    = buildEmailHTML(formType, fields, est);

  if (SOW_DEBUG) console.log("[SOW] final estimate:", est);

  try {
    await sendEmailJS({ subject, html, est, toEmail: fields["email"] || fields["Your email address"] });
    alert("Your request has been sent to ShipERP!");
  } catch (e) {
    alert("Error sending email: " + e.message);
  }
};
