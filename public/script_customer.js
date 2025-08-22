// script_customer.js — JSON email (compact), détail d'estimation inclus
// ====== EmailJS config ======
const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // Template body: <html><body>{{{message_html}}}</body></html>
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com"; // destinataire

// ---------- Helpers ----------
const textOrArray = v => Array.isArray(v) ? v.join(", ") : (v ?? "");

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

function normalizeEstimate(estRaw) {
  // Accepte plusieurs variantes depuis la logique interne/API
  const est = estRaw || {};
  // total peut être une string ("38 hours", "From 32 to 40 h") — on la conserve pour l'email
  const totalStr =
    est.total ?? est.total_cost ?? est.totalHours ?? est.total_hours ?? null;

  const hoursNum = Number(est.hours ?? est.totalHours ?? est.total_hours);
  const rateNum  = Number(est.rate ?? est.blendedRate ?? est.blended_rate);
  let   costNum  = Number(est.cost ?? est.total_cost);

  if (!costNum && Number.isFinite(hoursNum) && Number.isFinite(rateNum)) {
    costNum = Math.round(hoursNum * rateNum);
  }

  return {
    totalStr, // si fourni en texte par l’interne/API
    hours: Number.isFinite(hoursNum) ? hoursNum : null,
    rate:  Number.isFinite(rateNum)  ? rateNum  : null,
    cost:  Number.isFinite(costNum)  ? costNum  : null,
    breakdown: est.breakdown || est.details || est.lines || null
  };
}

function renderBreakdownHTML(breakdown) {
  if (!breakdown) return "";
  // breakdown peut être un objet {libellé: "X h"} OU un tableau
  let rows = "";

  if (Array.isArray(breakdown)) {
    rows = breakdown.map(row => {
      let label = "", hours = "", note = "";
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
      </tr>
    `).join("");
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

function buildTinyEmail(formType, fields, estNorm) {
  const pick = (...keys) => {
    for (const k of keys) {
      if (k in fields && fields[k] != null && String(fields[k]).trim() !== "") {
        return Array.isArray(fields[k]) ? fields[k].join(", ") : fields[k];
      }
    }
    return "-";
  };

  const who   = pick("Client Name", "Customer Name", "clientName", "customer", "client", "company");
  const reply = pick("Your email address", "email", "Email", "contactEmail");

  // Choix du libellé "Estimate (total)"
  const estimateLabel =
    estNorm.totalStr ? estNorm.totalStr :
    (estNorm.hours != null || estNorm.cost != null)
      ? `${estNorm.hours ?? "?"} h${estNorm.rate ? ` · $${estNorm.cost ?? "?"} @ $${estNorm.rate}/h` : ""}`
      : "N/A";

  const firstRows = Object.entries(fields).slice(0, 15).map(([k,v]) => `
    <tr>
      <td style="padding:6px;border:1px solid #e5e5e5;"><strong>${k}</strong></td>
      <td style="padding:6px;border:1px solid #e5e5e5;">${textOrArray(v)}</td>
    </tr>
  `).join("");

  const breakdownHTML = renderBreakdownHTML(estNorm.breakdown);

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
      <h2 style="margin:0 0 6px 0;">SOW – ${formType}</h2>
      <p style="margin:4px 0;"><strong>Client:</strong> ${who}</p>
      <p style="margin:4px 0;"><strong>Reply-to:</strong> ${reply}</p>
      <p style="margin:4px 0;"><strong>Estimate (total):</strong> ${estimateLabel}</p>
      ${breakdownHTML}
      <h3 style="margin:12px 0 6px;">Preview (partial)</h3>
      <table style="border-collapse:collapse;width:100%;max-width:820px">${firstRows}</table>
      <p style="margin:10px 0 0;color:#666;">(Attachments temporarily disabled to comply with EmailJS size limits.)</p>
    </div>
  `;
}

// ---------- Estimation (tes fonctions/serveurs existants inchangés) ----------
async function estimateNewCarrier() {
  const features = Array.from(document.querySelectorAll("input[name='features']:checked")).map(x=>x.value);
  const payload = {
    clientName: document.getElementById("clientName")?.value || "",
    email: document.getElementById("email")?.value || "",
    carrierName: document.getElementById("carrierName")?.value || "",
    carrierOther: document.getElementById("carrierOther")?.value || "",
    alreadyUsed: document.getElementById("alreadyUsed")?.value || "",
    zEnhancements: document.getElementById("zEnhancements")?.value || "",
    onlineOrOffline: document.getElementById("onlineOrOffline")?.value || "",
    features,
    sapVersion: document.getElementById("sapVersion")?.value || "",
    abapVersion: document.getElementById("abapVersion")?.value || "",
    shiperpVersion: document.getElementById("shiperpVersion")?.value || "",
    serpcarUsage: document.getElementById("serpcarUsage")?.value || "",
    systemUsed: ["sys_ecc","sys_ewm","sys_tm"].filter(id=>document.getElementById(id)?.checked).map(id=>document.getElementById(id).value),
    shipmentScreens: ["screen_smallparcel","screen_planning","screen_tm","screen_other"].filter(id=>document.getElementById(id)?.checked).map(id=>document.getElementById(id).value),
    shipFrom: Array.from(document.getElementById("shipFrom")?.selectedOptions || []).map(o=>o.value),
    shipTo:   Array.from(document.getElementById("shipTo")?.selectedOptions || []).map(o=>o.value)
  };
  try {
    const res = await fetch("https://docqa-api.onrender.com/estimate/new_carrier", {
      method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload)
    });
    const t = await res.text(); const j = JSON.parse(t);
    if (typeof j.total_effort !== "undefined") {
      // Convertit en forme normalisée
      return normalizeEstimate({
        total: `${j.total_effort} hours`,
        breakdown: j.breakdown || null
      });
    }
    return normalizeEstimate({ total:"N/A", breakdown:{ "Server response": t.slice(0,300)+"..." } });
  } catch(e){ return normalizeEstimate({ total:"N/A", breakdown:{ "Error": e.message } }); }
}

function estimateRollout() {
  const siteCount = document.getElementById("siteCount")?.value;
  const region    = document.getElementById("shipToRegion")?.value;
  const blueprint = document.getElementById("blueprintNeeded")?.value;
  if (blueprint === "No")
    return normalizeEstimate({ total:"Blueprint required (16 hours)", breakdown:{ Note:"A 16 hours Blueprint/Workshop would be required" } });

  let base=0; if (siteCount==="Only 1") base=40; else if(siteCount==="2 to 5") base=120; else if(siteCount==="More than 5") base=200;
  const extra = region==="US" ? 0 : 16;
  return normalizeEstimate({ total:`${base+extra} hours`, breakdown:{ "Base":`${base} h`, "Region adj.":`${extra} h` } });
}

function estimateUpgrade() {
  const v = document.getElementById("shiperpVersionUpgrade")?.value;
  const z = document.getElementById("zenhancementsUpgrade")?.value;
  const c = document.getElementById("onlineCarrierCountUpgrade")?.value;
  const e = document.getElementById("ewmUsageUpgrade")?.value;
  const m = Array.from(document.getElementById("modulesUsedUpgrade")?.selectedOptions||[]).map(el=>el.value);

  const wV = v==="Between 3.6 and 3.9" ? 15 : v==="Lower than 3.6" ? 25 : 0;
  const wZ = ({ "1 to 10":15, "10 to 50":60, "50 to 100":100, "More than 100":150 }[z]) || 0;
  const wC = ({ "1 to 5":60, "6 to 10":200, "More than 10":300 }[c]) || 0;
  const wE = e==="Yes" ? 50 : 0;
  const wM = m.length > 3 ? 40 : 0;

  const base=8, integ=16+0.1*(wC+wE), test=8+0.2*(wC+wM), train=40, doc=32;
  const core = 0.2*(wV+wZ+wC+wE+wM+base+integ+test+train+doc);
  const sum  = core + base + wZ + wC + wE + integ + test + train + doc;
  const rng = v=>`From ${Math.round(v*0.8)} to ${Math.round(v*1.2)} h`;

  return normalizeEstimate({
    total: rng(sum),
    breakdown: {
      "Base Estimation": rng(core), "Foundation Setup": rng(base), "Z Enhancements": rng(wZ+wE),
      "Online Carriers": rng(wC), "Integration": rng(integ), "Testing": rng(test),
      "Training": rng(train), "Documentation": rng(doc)
    }
  });
}

async function estimateOther() {
  const ecc = parseFloat(document.getElementById("ecc_version")?.value);
  const ewm = parseFloat(document.getElementById("ewm_version")?.value);
  const enh = parseInt(document.getElementById("enhancements")?.value || "0", 10);
  const tcs = document.getElementById("test_cases")?.value;
  const rat = document.getElementById("rating")?.value;
  const cor = parseFloat(document.getElementById("corrections")?.value || "0");
  const cfg = parseFloat(document.getElementById("configuration")?.value || "0");

  const payload = { ecc_version:ecc, ewm_version:ewm, enhancements:enh, test_cases:tcs, customer_rating:rat, corrections:cor, configuration:cfg };
  try {
    const res = await fetch("https://docqa-api.onrender.com/sow-estimate", {
      method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload)
    });
    const data = await res.json();
    const br = {};
    if (data.details) Object.entries(data.details).forEach(([k,[a,b]]) => br[k] = `${a} – ${b} h`);
    const total = (data.from!=null && data.to!=null) ? `${data.from} – ${data.to} h` : "N/A";
    return normalizeEstimate({ total, breakdown: br });
  } catch(e){ return normalizeEstimate({ total:"N/A", breakdown:{ "Error": e.message } }); }
}

// ---------- main ----------
window.submitCustomerForm = async function (formType) {
  const fields = collectFormFields();

  // compute estimate (même logique qu’avant)
  let estNorm;
  if (formType==="New Carrier") estNorm = await estimateNewCarrier();
  else if (formType==="Rollout") estNorm = estimateRollout();
  else if (formType==="Upgrade") estNorm = estimateUpgrade();
  else if (formType==="Other")   estNorm = await estimateOther();
  else                           estNorm = normalizeEstimate({ total:"N/A" });

  const messageHtml = buildTinyEmail(formType, fields, estNorm);

  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: SERVICE_ID,
        template_id: TEMPLATE_ID,
        user_id: USER_ID,
        template_params: {
          subject: `SOW | ${formType} | ${fields["Client Name"] || fields["Customer Name"] || fields["clientName"] || ""}`,
          to_email: TO_EMAIL,
          reply_to: fields["Your email address"] || fields["email"] || "",
          message_html: messageHtml,
          // champs supplémentaires si tu veux les exploiter dans le template
          estimate_total: estNorm.totalStr || (estNorm.hours!=null ? `${estNorm.hours} h` : "N/A"),
          estimate_hours: String(estNorm.hours ?? ""),
          estimate_cost:  String(estNorm.cost ?? ""),
          estimate_rate:  String(estNorm.rate ?? "")
        }
      })
    });
    if (!response.ok) throw new Error(await response.text());
    alert("Your request has been sent to ShipERP!");
  } catch(e) {
    alert("Error sending email: " + e.message);
  }
};
