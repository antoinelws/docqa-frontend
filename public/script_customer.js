/* =========================================================================
   script_customer.js — Client pages = Internal logic + EmailJS (UX client)
   -------------------------------------------------------------------------
   - Maintient les différences client (pas de display à l'écran, email compact)
   - Aligne le CALCUL sur l'interne (même payload & endpoint pour New Carrier)
   - Si des fonctions internes existent (rollout/upgrade/other), on les appelle
   - Sinon, fallback simple pour ne rien casser
   ========================================================================= */

/* ===================== 1) CONFIG EmailJS ===================== */
const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // template body: <html><body>{{{message_html}}}</body></html>
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com";

/* ===================== 2) DEBUG (console) ===================== */
const SOW_DEBUG = false;

/* ===================== 3) HELPERS ===================== */
const $id = (x) => document.getElementById(x);
const textOrArray = (v) => Array.isArray(v) ? v.join(", ") : (v ?? "");
const toNum = (v, d=0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

// Mappe la sélection “Z Enhancements” (texte ou valeur) -> entier (comme interne)
function readZEnhancementsInt() {
  let raw = $id("zEnhancements")?.value;
  if (!raw) raw = document.querySelector("[name='zEnhancements']")?.value;
  if (!raw) {
    const sel = $id("zEnhancements") || document.querySelector("[name='zEnhancements']");
    const opt = sel?.options?.[sel.selectedIndex];
    raw = (opt?.value || opt?.textContent || "").trim();
  }
  raw = String(raw || "").trim();

  const n = Number(raw);
  if (Number.isFinite(n)) return n;

  const map = {
    "Less than 10": 9,
    "1 to 10": 10,
    "10 to 50": 50,
    "50 to 100": 100,
    "More than 100": 150
  };
  return map[raw] ?? 0;
}

// Q&A compact (premières ~18 lignes pour rester < 50KB)
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

/* ===================== 4) LOGIQUE INTERNE — ADAPTATEURS ===================== */
/* ---- A) New Carrier — payload & fetch IDENTIQUES à l’interne ----
   (reprend ton code partagé; NB: ta version interne met shipToVolume = zEnhancements)
*/
function buildNewCarrierPayload_InternalExact() {
  // Génération des features identique à l’interne (checkboxes .feature-box)
  const features = Array.from(document.querySelectorAll("input.feature-box:checked")).map(el => el.value);

  const systemUsed = ["sys_ecc", "sys_ewm", "sys_tm"]
    .filter(id => $id(id)?.checked)
    .map(id => $id(id)?.value);

  const shipmentScreens = ["screen_smallparcel", "screen_planning", "screen_tm", "screen_other"]
    .filter(id => $id(id)?.checked)
    .map(id => $id(id)?.value);

  // IMPORTANT : interne parseInt(zEnhancements)
  const zEnhancementsInt = readZEnhancementsInt();

  // *** IMPORTANT ***
  // Ton code interne fait ceci:
  //   shipToVolume: document.getElementById("zEnhancements")?.value,
  // (donc envoie la valeur "zEnhancements" comme shipToVolume).
  // Pour obtenir le MÊME résultat que l'interne, on reproduit tel quel :
  const shipToVolume_likeInternal = $id("zEnhancements")?.value ?? String(zEnhancementsInt);

  return {
    clientName: $id("clientName")?.value,
    featureInterest: $id("featureInterest")?.value,
    email: $id("email")?.value,
    carrierName: $id("carrierName")?.value,
    carrierOther: $id("carrierOther")?.value,
    alreadyUsed: $id("alreadyUsed")?.value,
    zEnhancements: zEnhancementsInt,                 // entier (comme interne)
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
    // >>> EXACTEMENT comme l’interne :
    shipToVolume: shipToVolume_likeInternal,
    shipmentScreenString: shipmentScreens.join(", ")
  };
}

async function estimateNewCarrier_INTERNAL() {
  const form = buildNewCarrierPayload_InternalExact();
  if (SOW_DEBUG) console.log("[SOW] new_carrier payload (INTERNAL exact):", form);

  const res = await fetch("https://docqa-api.onrender.com/estimate/new_carrier", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });

  const text = await res.text();
  if (SOW_DEBUG) console.log("[SOW] API response text:", text);

  let json; try { json = JSON.parse(text); } catch { json = null; }

  if (!json || typeof json.total_effort === "undefined") {
    // Comportement interne : on afficherait une erreur; côté client, on renvoie un minimum affichable
    const hours = 24, rate = 180, cost = hours * rate;
    return { hours, rate, cost, breakdown: [{label:"Baseline", hours}] };
  }

  // Normalisation identique pour l’email
  const hours = toNum(json.total_effort, 0);
  const rate  = 180;
  const cost  = Math.round(hours * rate);
  const breakdown = Array.isArray(json.breakdown) ? json.breakdown : null;

  return { hours, rate, cost, breakdown };
}

/* ---- B) Rollout / Upgrade / Other -----------------------------------------
   Si tes fichiers internes sont chargés (ex. window.estimateRollout existe),
   on les appelle directement et on normalise la sortie.

   Sinon, on garde un fallback simple pour ne rien casser.
*/
function normalizeInternalResult(ret) {
  // accepte {hours, rate, cost, breakdown} OU juste nombre d'heures
  if (ret && typeof ret === "object" && ("hours" in ret || "cost" in ret)) {
    const hours = toNum(ret.hours, null);
    const rate  = toNum(ret.rate,  hours != null ? 180 : null);
    const cost  = toNum(ret.cost,  (hours != null && rate != null) ? hours*rate : null);
    const breakdown = Array.isArray(ret.breakdown) || typeof ret.breakdown === "object" ? ret.breakdown : null;
    return { hours, rate, cost, breakdown };
  }
  // nombre
  const hours = toNum(ret, null);
  const rate  = hours != null ? 180 : null;
  const cost  = (hours != null && rate != null) ? hours*rate : null;
  return { hours, rate, cost, breakdown: null };
}

function estimateRollout_INTERNAL() {
  if (typeof window.estimateRollout === "function") {
    return normalizeInternalResult(window.estimateRollout());
  }
  // Fallback simple si la fonction interne n'est pas chargée côté client
  const siteCount = $id("siteCount")?.value;
  const region    = $id("shipToRegion")?.value;
  if (!siteCount) return { hours: null, rate: null, cost: null, breakdown: null };
  let base = (siteCount==="Only 1") ? 40 : (siteCount==="2 to 5") ? 120 : 200;
  const extra = (region==="US") ? 0 : 16;
  const hours = base + extra, rate = 180, cost = hours * rate;
  return { hours, rate, cost, breakdown: [{label:"Base", hours:base},{label:"Region adj.", hours:extra}] };
}

function estimateUpgrade_INTERNAL() {
  if (typeof window.estimateUpgrade === "function") {
    return normalizeInternalResult(window.estimateUpgrade());
  }
  // Fallback simple
  const v = $id("shiperpVersionUpgrade")?.value;
  const z = $id("zenhancementsUpgrade")?.value;
  const c = $id("onlineCarrierCountUpgrade")?.value;
  const e = $id("ewmUsageUpgrade")?.value;
  const m = Array.from($id("modulesUsedUpgrade")?.selectedOptions||[]).map(el=>el.value);

  const wV = v==="Between 3.6 and 3.9" ? 15 : v==="Lower than 3.6" ? 25 : 0;
  const wZ = ({ "1 to 10":15, "10 to 50":60, "50 to 100":100, "More than 100":150 }[z]) || 0;
  const wC = ({ "1 to 5":60, "6 to 10":200, "More than 10":300 }[c]) || 0;
  const wE = e==="Yes" ? 50 : 0;
  const wM = m.length > 3 ? 40 : 0;

  const base=8, integ=16+0.1*(wC+wE), test=8+0.2*(wC+wM), train=40, doc=32;
  const core = 0.2*(wV+wZ+wC+wE+wM+base+integ+test+train+doc);
  const sum  = core + base + wZ + wC + wE + integ + test + train + doc;
  const hours = Math.round(sum), rate = 180, cost = hours * rate;
  return { hours, rate, cost, breakdown: [
    { label:"Base Estimation", hours: Math.round(core) },
    { label:"Foundation Setup", hours: base },
    { label:"Z Enhancements", hours: Math.round(wZ+wE) },
    { label:"Online Carriers", hours: Math.round(wC) },
    { label:"Integration", hours: Math.round(integ) },
    { label:"Testing", hours: Math.round(test) },
    { label:"Training", hours: Math.round(train) },
    { label:"Documentation", hours: Math.round(doc) }
  ]};
}

async function estimateOther_INTERNAL() {
  if (typeof window.estimateOther === "function") {
    const ret = await window.estimateOther();
    return normalizeInternalResult(ret);
  }
  // Fallback sur endpoint existant
  const ecc = toNum($id("ecc_version")?.value, NaN);
  const ewm = toNum($id("ewm_version")?.value, NaN);
  const enh = toNum($id("enhancements")?.value, 0);
  const tcs = $id("test_cases")?.value;
  const rat = $id("rating")?.value;
  const cor = toNum($id("corrections")?.value, 0);
  const cfg = toNum($id("configuration")?.value, 0);

  const payload = { ecc_version:ecc, ewm_version:ewm, enhancements:enh, test_cases:tcs, customer_rating:rat, corrections:cor, configuration:cfg };
  try {
    const res = await fetch("https://docqa-api.onrender.com/sow-estimate", {
      method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload)
    });
    const data = await res.json();
    const hours = (data && data.from!=null && data.to!=null) ? Math.round((Number(data.from)+Number(data.to))/2) : null;
    const rate = hours ? 180 : null;
    const cost = hours ? hours * rate : null;
    const breakdown = (data && data.details)
      ? Object.entries(data.details).map(([k,[a,b]]) => ({label:k, hours:`${a}–${b} h`}))
      : null;
    return { hours, rate, cost, breakdown };
  } catch(e){
    return { hours:null, rate:null, cost:null, breakdown:null };
  }
}

/* ===================== 5) ROUTAGE ===================== */
async function computeEstimate(typeLabel){
  const t = String(typeLabel||"").toLowerCase();
  if (t.includes("new") && t.includes("carrier")) return await estimateNewCarrier_INTERNAL();
  if (t.includes("rollout"))                      return estimateRollout_INTERNAL();
  if (t.includes("upgrade"))                      return estimateUpgrade_INTERNAL();
  return await estimateOther_INTERNAL(); // "Other"
}

/* ===================== 6) EMAILJS ===================== */
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

/* ===================== 7) ENTRÉE BOUTON (UX client) ===================== */
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
