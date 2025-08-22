<script>
// --- CONFIG (reprend celles que tu mets en <script> au-dessus des JS) ---
const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // Template body in Code Editor must be: <html><body>{{{message_html}}}</body></html>
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com";   // recipient
const FULL_DETAILS_POST_URL = window.FULL_DETAILS_POST_URL || "";

// ---------- UTIL ----------
function normalizeTypeKey(label){
  const s = String(label || "").toLowerCase();
  if (s.includes("new") && s.includes("carrier")) return "new_carrier";
  if (s.includes("rollout")) return "rollout";
  if (s.includes("upgrade")) return "upgrade";
  return "other";
}

function collectAnswers(root=document){
  const out = {};
  root.querySelectorAll("[data-name]").forEach(el => {
    const k = el.getAttribute("data-name");
    let v = el.value;
    if (el.type === "checkbox") v = el.checked;
    out[k] = v;
  });
  return out;
}

function answersTable(answers, limit=18){
  const rows = Object.entries(answers).slice(0, limit).map(([q,a]) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;"><strong>${q}</strong></td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;">${String(a ?? "-")}</td>
    </tr>`).join("");
  return `<table style="border-collapse:collapse;width:100%;font:14px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <tbody>${rows}</tbody></table>`;
}

// ---------- ESTIMATION (pont vers la logique interne) ----------
function normalizeEstimate(raw, typeKey){
  // On accepte plusieurs formes de retour depuis les scripts internes
  // ex: { total }, { totalHours, rate }, { hours, cost, rate, breakdown }, etc.
  const est = raw || {};
  const hours =
    Number(est.hours ?? est.totalHours ?? est.total_hours ?? 0) || 0;
  const rate =
    Number(est.rate ?? est.blendedRate ?? est.blended_rate ?? 0) || 0;
  let cost = Number(est.cost ?? est.total ?? est.total_cost ?? 0) || 0;

  // Si pas de cost explicite mais hours/rate présents → calcule
  if (!cost && hours && rate) cost = Math.round(hours * rate);

  return {
    type: typeKey,
    hours,
    rate,
    cost,
    // On passe au mail si dispo (tableau de lignes détaillées)
    breakdown: Array.isArray(est.breakdown || est.details || est.lines)
      ? (est.breakdown || est.details || est.lines)
      : null
  };
}

function fallbackEstimate(typeKey){
  const BASELINE = { new_carrier: 24, rollout: 40, upgrade: 16, other: 12 };
  const rate = 180;
  const hours = BASELINE[typeKey] ?? BASELINE.other;
  return { type: typeKey, hours, rate, cost: hours * rate, breakdown: null };
}

function computeEstimate(typeKey, answers){
  try{
    if (typeKey === "new_carrier" && typeof window.estimateNewCarrier === "function"){
      return normalizeEstimate(window.estimateNewCarrier(answers), typeKey);
    }
    if (typeKey === "rollout" && typeof window.estimateRollout === "function"){
      return normalizeEstimate(window.estimateRollout(answers), typeKey);
    }
    if (typeKey === "upgrade" && typeof window.estimateUpgrade === "function"){
      return normalizeEstimate(window.estimateUpgrade(answers), typeKey);
    }
    if (typeKey === "other" && typeof window.estimateOther === "function"){
      return normalizeEstimate(window.estimateOther(answers), typeKey);
    }
  }catch(e){
    console.warn("Erreur logique interne (computeEstimate):", e);
  }
  return fallbackEstimate(typeKey);
}

// Rendu identique à l’interne si un breakdown est fourni.
// Formats acceptés pour breakdown:
//   - Array d’objets {label, hours, note} ou {task, hours, note}
//   - Array de tuples ["Libellé", "x h", "note"] (on s’adapte)
function renderEstimateHTML(est){
  const head = `
    <div style="margin:6px 0 10px">
      <strong>Estimate (total):</strong> ${est.hours} h · $${est.cost} @ $${est.rate}/h
    </div>`;

  if (!est.breakdown || !est.breakdown.length) return head;

  const rows = est.breakdown.map((row) => {
    let label, hours, note;
    if (Array.isArray(row)) {
      [label, hours, note] = row;
    } else if (row && typeof row === "object") {
      label = row.label ?? row.task ?? "";
      hours = row.hours ?? row.time ?? "";
      note  = row.note ?? row.comment ?? "";
    }
    // heures au format "12 h" si number
    if (typeof hours === "number") hours = `${hours} h`;
    return `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${label || "-"}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${hours || "-"}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${note || ""}</td>
      </tr>`;
  }).join("");

  return `
    ${head}
    <table style="border-collapse:collapse;width:100%;font:14px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:6px 0 10px">
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

// ---------- ENVOI ----------
async function postFullDetails(payload){
  if(!FULL_DETAILS_POST_URL) return null;
  try{
    const res = await fetch(FULL_DETAILS_POST_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error(String(res.status));
    const data = await res.json().catch(() => ({}));
    return data && data.url ? data.url : null;
  }catch(e){
    console.warn("Full details POST failed:", e);
    return null;
  }
}

async function sendEmailJS({subject, html, estimate, toEmail}){
  const payload = {
    service_id: SERVICE_ID,
    template_id: TEMPLATE_ID,
    user_id: USER_ID,
    template_params: {
      subject,
      to_email: toEmail || DEFAULT_TO || "",
      message_html: html,
      // >>> Ces champs garantissent que "Estimate (total)" ne reste jamais vide
      estimate_total: String(estimate.cost || estimate.hours || ""), // pour templates existants
      estimate_hours: String(estimate.hours ?? ""),
      estimate_cost:  String(estimate.cost  ?? ""),
      estimate_rate:  String(estimate.rate  ?? ""),
      estimate_type:  String(estimate.type  ?? "")
    }
  };
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: {"Content-Type":"application/json","Accept":"application/json"},
    body: JSON.stringify(payload)
  });
  if(!res.ok){
    const t = await res.text().catch(()=> "");
    throw new Error(`EmailJS HTTP ${res.status}: ${t}`);
  }
}

window.submitCustomerForm = async function(formType){
  const typeKey = normalizeTypeKey(formType);
  const answers = collectAnswers(document);

  // Cas “Other” : on n’envoie pas le fichier, juste le nom (ou via FULL_DETAILS_POST_URL)
  const fileInput = document.querySelector('[data-name="Spec File"]');
  if (fileInput?.files?.[0]) answers["Spec File (name)"] = fileInput.files[0].name;

  const est = computeEstimate(typeKey, answers);

  let html = `
    <div style="font:14px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif">
      <h2 style="margin:0 0 6px">SOW – ${formType}</h2>
      <p style="margin:4px 0"><strong>Client:</strong> ${answers["Customer Company"] || answers["clientName"] || "-"}</p>
      ${renderEstimateHTML(est)}
      <h3 style="margin:10px 0 6px">Preview (partial)</h3>
      ${answersTable(answers, 18)}
    </div>`;

  const detailsUrl = await postFullDetails({ type: typeKey, answers, estimate: est, createdAt: new Date().toISOString() });
  if (detailsUrl) html += `<p style="margin-top:10px">Full details: <a href="${detailsUrl}">${detailsUrl}</a></p>`;

  const subject = `SOW | ${formType} | ${answers["Customer Company"] || answers["clientName"] || ""}`;

  try{
    await sendEmailJS({ subject, html, estimate: est, toEmail: answers["Contact Email"] || answers["email"] || "" });
    alert("Your request has been sent to ShipERP!");
  }catch(e){
    alert("Error sending email: " + e.message);
  }
};
</script>
