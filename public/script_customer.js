// script_customer.js — JSON email (compact) with estimation breakdown
// ================================================================
// EmailJS config (replace with your real values)
const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // EmailJS template: <html><body>{{{message_html}}}</body></html>
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com"; // recipient

// ================================================================
// Helpers
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

function mapZEnhancementsToInt(label) {
  const map = {
    "Less than 10": 9,
    "1 to 10": 10,
    "10 to 50": 50,
    "50 to 100": 100,
    "More than 100": 150
  };
  const n = Number(label);
  if (Number.isFinite(n)) return n;
  return map[label] ?? 0;
}
function coerceInt(v, d=0){ const n = Number(v); return Number.isFinite(n) ? n : d; }

// ================================================================
// Local fallback (so email NEVER shows “N/A” if the API rejects)
// Includes Z-enhancements effect (this was the missing piece)
function newCarrierLocalHeuristic({ featuresCount=0, siteCount=1, region="US", volume=0, zEnhancements=0, alreadyUsed="No" }) {
  let hours = 24; // baseline

  // Features contribution (cap to avoid runaway)
  const hFeatures = Math.min(featuresCount * 4, 20);
  hours += hFeatures;

  // Sites contribution (if you later add a site field)
  const hSites = Math.min(Math.max(0, siteCount - 1) * 3, 30);
  hours += hSites;

  // Volume thresholds (cumulative)
  let hVolume = 0;
  if (volume >= 5000)  hVolume += 6;
  if (volume >= 20000) hVolume += 8;
  if (volume >= 50000) hVolume += 10;
  hours += hVolume;

  // Region (non-US coordination)
  const hRegion = (region && region.toUpperCase() !== "US") ? 6 : 0;
  hours += hRegion;

  // >>> Z-enhancements bump (new)
  // Calibrated so that changing the bucket changes the estimate noticeably
  let hZenh = 0;
  if (zEnhancements <= 10)       hZenh = 2;
  else if (zEnhancements <= 50)  hZenh = 8;
  else if (zEnhancements <= 100) hZenh = 18;
  else                           hZenh = 32;
  hours += hZenh;

  // If the carrier already exists elsewhere, small reduction
  const hReuse = (String(alreadyUsed).toLowerCase() === "yes") ? -4 : 0;
  hours += hReuse;

  hours = Math.max(8, Math.round(hours)); // clamp to sane minimum
  const rate = 180;
  const cost = Math.round(hours * rate);

  return {
    hours, rate, cost,
    breakdown: [
      { label: "Baseline",        hours: 24 },
      { label: "Features",        hours: hFeatures, note: `${featuresCount} selected` },
      { label: "Sites (extra)",   hours: hSites,    note: `${siteCount} site(s)` },
      { label: "Volume adj.",     hours: hVolume,   note: `${volume} / day` },
      { label: "Region adj.",     hours: hRegion,   note: region || "US" },
      { label: "Z-enhancements",  hours: hZenh,     note: `${zEnhancements}` },
      { label: "Reuse (if any)",  hours: hReuse }
    ]
  };
}

function normalizeEstimate(estRaw) {
  const est = estRaw || {};
  const totalStr = est.total ?? est.total_cost ?? est.totalHours ?? est.total_hours ?? null;

  const hoursNum = Number(est.hours ?? est.totalHours ?? est.total_hours);
  const rateNum  = Number(est.rate  ?? est.blendedRate ?? est.blended_rate);
  let   costNum  = Number(est.cost  ?? est.total_cost);

  if (!costNum && Number.isFinite(hoursNum) && Number.isFinite(rateNum)) {
    costNum = Math.round(hoursNum * rateNum);
  }

  return {
    totalStr,
    hours: Number.isFinite(hoursNum) ? hoursNum : null,
    rate:  Number.isFinite(rateNum)  ? rateNum  : null,
    cost:  Number.isFinite(costNum)  ? costNum  : null,
    breakdown: est.breakdown || est.details || est.lines || null
  };
}

function renderBreakdownHTML(breakdown) {
  if (!breakdown) return "";
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

  const estimateLabel =
    estNorm.totalStr ? estNorm.totalStr :
    (estNorm.hours != null || estNorm.cost != null)
      ? `${estNorm.hours ?? "?"} h${estNorm.rate ? ` · $${estNorm.cost ?? "?"} @ $${estNorm.rate}/h` : ""}`
      : "N/A";

  const firstRows = Object.entries(fields).slice(0, 15).map(([k,v]) => `
    <tr>
      <td style="padding:6px;border:1px solid #e5e5e5;"><strong>${k}</strong></td>
      <td style="padding:6px;border:1px solid #e5e5e5;">${textOrArray(v)}</td>
    </tr>`).join("");

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
    </div>`;
}

// ================================================================
// Estimation (New Carrier via API + fallback; others local as before)
async function estimateNewCarrier() {
  const features = Array.from(document.querySelectorAll("input[name='features']:checked")).map(x=>x.value);
  const systemUsed = ["sys_ecc","sys_ewm","sys_tm"].filter(id=>document.getElementById(id)?.checked).map(id=>document.getElementById(id).value);
  const shipmentScreens = ["screen_smallparcel","screen_planning","screen_tm","screen_other"]
    .filter(id=>document.getElementById(id)?.checked).map(id=>document.getElementById(id).value);

  const zEnhancementsRaw = document.getElementById("zEnhancements")?.value || "";
  const zEnhancements = mapZEnhancementsToInt(zEnhancementsRaw); // API expects integer

  const volumeCandidate =
    document.getElementById("dailyVolume")?.value ||
    document.getElementById("transactions")?.value || 0; // use if present
  const shipToVolume = coerceInt(volumeCandidate, 1000); // default > 0 to pass validation

  const alreadyUsed = document.getElementById("alreadyUsed")?.value || "No";
  const region = document.getElementById("shipToRegion")?.value || "US";

  const payload = {
    clientName:      document.getElementById("clientName")?.value || "",
    email:           document.getElementById("email")?.value || "",
    carrierName:     document.getElementById("carrierName")?.value || "",
    carrierOther:    document.getElementById("carrierOther")?.value || "",
    alreadyUsed,
    zEnhancements, // integer
    onlineOrOffline: document.getElementById("onlineOrOffline")?.value || "",
    features,
    sapVersion:      document.getElementById("sapVersion")?.value || "",
    abapVersion:     document.getElementById("abapVersion")?.value || "",
    shiperpVersion:  document.getElementById("shiperpVersion")?.value || "",
    serpcarUsage:    document.getElementById("serpcarUsage")?.value || "",
    systemUsed,
    shipmentScreens,
    shipFrom: Array.from(document.getElementById("shipFrom")?.selectedOptions || []).map(o=>o.value),
    shipTo:   Array.from(document.getElementById("shipTo")?.selectedOptions   || []).map(o=>o.value),
    shipToVolume // required by API
  };

  try {
    const res = await fetch("https://docqa-api.onrender.com/estimate/new_carrier", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    const json = JSON.parse(text);
    if (json && typeof json.total_effort !== "undefined") {
      return normalizeEstimate({
        total: `${json.total_effort} hours`,
        breakdown: Array.isArray(json.breakdown) ? json.breakdown : null,
        hours: Number(json.total_effort),
        rate: 180,
        cost: Number(json.total_effort) ? Math.round(Number(json.total_effort) * 180) : null
      });
    }
    // Unexpected response -> fallback (includes zEnhancements)
    return normalizeEstimate(newCarrierLocalHeuristic({
      featuresCount: features.length,
      siteCount: Math.max(1, coerceInt(document.getElementById("siteCount")?.value, 1)),
      region,
      volume: shipToVolume,
      zEnhancements,
      alreadyUsed
    }));
  } catch(e) {
    // Network/validation error -> fallback (includes zEnhancements)
    return normalizeEstimate(newCarrierLocalHeuristic({
      featuresCount: features.length,
      siteCount: Math.max(1, coerceInt(document.getElementById("siteCount")?.value, 1)),
      region,
      volume: shipToVolume,
      zEnhancements,
      alreadyUsed
    }));
  }
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
  } catch(e){
    return normalizeEstimate({ total:"N/A", breakdown: null }); // no server error dump
  }
}

// ================================================================
// Main entry point
window.submitCustomerForm = async function (formType) {
  const fields = collectFormFields();

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
