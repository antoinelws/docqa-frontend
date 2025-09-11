// script_customer.js — Customer = Internal calculators (as-is) + EmailJS
// ---------------------------------------------------------------
// - Appelle tes scripts internes tels quels (mêmes calculs, mêmes API)
// - Intercepte displayResult(...) pour récupérer la valeur finale
// - UX client: rien n'est affiché; on envoie un email compact via EmailJS

/* ========= EmailJS config ========= */
const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // Body du template EmailJS: <html><body>{{{message_html}}}</body></html>
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com";

/* ========= Debug (console) ========= */
const SOW_DEBUG = false; // passe à true pour tracer les appels/noms de fonctions trouvés

/* ========= Helpers génériques ========= */
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

function renderBreakdownHTML(breakdown) {
  // Si tes internes n'écrivent pas un breakdown DOM dédié, on garde vide
  if (!breakdown) return "";
  // Si un jour tu veux injecter un détail HTML, tu peux le passer ici.
  return "";
}

function buildEmailHTML(formType, fields, estimateText, breakdownHtml) {
  const who   = fields["Client Name"] || fields["Customer Name"] || fields["clientName"] || "-";
  const reply = fields["Your email address"] || fields["email"] || "-";
  const preview = answersTable(fields, 18);

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
      <h2 style="margin:0 0 6px 0;">SOW – ${formType}</h2>
      <p style="margin:4px 0;"><strong>Client:</strong> ${who}</p>
      <p style="margin:4px 0;"><strong>Reply-to:</strong> ${reply}</p>
      <p style="margin:4px 0;"><strong>Estimate (total):</strong> ${estimateText}</p>

      ${breakdownHtml ? `<h3 style="margin:12px 0 6px;">Detail</h3>${breakdownHtml}` : ""}

      <h3 style="margin:12px 0 6px;">Preview (partial)</h3>
      ${preview}
      <p style="margin:10px 0 0;color:#666;">(Attachments disabled to respect EmailJS size limits.)</p>
    </div>
  `;
}

/* ========= Capture du résultat interne =========
   On monkey-patche window.displayResult(msg) utilisé par les pages internes.
   On appelle la même fonction interne (submit/calculate/estimate...) et
   on attend qu'elle appelle displayResult → on récupère le texte EXACT.
*/
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
          // on RÉTABLIT l'original immédiatement
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
      // Lance la fonction interne
      const ret = invoke();
      // garde-fou si rien n'arrive
      setTimeout(() => {
        if (!settled) {
          settled = true;
          window.displayResult = original;
          resolve(null);
        }
      }, 15000); // 15s max (API call inclus)
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
  if (!rawText) return "N/A";
  // Exemples attendus des internes :
  // "Estimated Effort: 56 hours"
  // "From 20 to 30 h"
  const reHours = /Estimated\s*Effort:\s*([0-9]+)\s*hours?/i;
  const reRange = /(From|De)\s*([0-9]+)\s*(?:to|à)\s*([0-9]+)\s*h/iu;

  const m1 = rawText.match(reHours);
  if (m1) return `${m1[1]} hours`;

  const m2 = rawText.match(reRange);
  if (m2) return `From ${m2[2]} to ${m2[3]} h`;

  // fallback: renvoyer le texte brut si non parsable
  return rawText;
}

async function computeUsingInternal(formType) {
  // Liste de noms probables par type (on essaie dans cet ordre)
  const map = {
    "new carrier": [
      "submitEstimateNewCarrier", "calculateNewCarrier", "estimateNewCarrier", "submitEstimate"
    ],
    "rollout": [
      "submitEstimateRollout", "calculateRollout", "estimateRollout", "submitEstimate"
    ],
    "upgrade": [
      "submitEstimateUpgrade", "calculateUpgrade", "estimateUpgrade", "submitEstimate"
    ],
    "other": [
      "submitEstimateOther", "calculateOther", "estimateOther", "submitEstimate"
    ]
  };
  const key = String(formType||"").toLowerCase();
  const bucket =
    key.includes("new") && key.includes("carrier") ? "new carrier" :
    key.includes("rollout") ? "rollout" :
    key.includes("upgrade") ? "upgrade" : "other";

  const fn = callIfExists(map[bucket] || []);
  if (!fn) throw new Error(`Internal calculator function not found for '${formType}'.`);

  const raw = await captureInternalEstimate(() => fn());
  if (SOW_DEBUG) console.log("[SOW] captured displayResult:", raw);

  const estimateText = parseEstimateText(raw);
  return { estimateText, breakdownHtml: "" };
}

/* ========= EmailJS envoi JSON ========= */
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
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
}

/* ========= Entrée bouton (UX client) ========= */
window.submitCustomerForm = async function (formType) {
  const fields = collectFormFields();

  let estimateText = "N/A", breakdownHtml = "";
  try {
    const r = await computeUsingInternal(formType);
    estimateText  = r.estimateText;
    breakdownHtml = r.breakdownHtml;
  } catch (e) {
    console.error("[SOW] internal compute failed:", e);
    estimateText = "N/A";
    breakdownHtml = "";
  }

  const subject = `SOW | ${formType} | ${fields["Client Name"] || fields["Customer Name"] || fields["clientName"] || ""}`;
  const html    = buildEmailHTML(formType, fields, estimateText, breakdownHtml);

  try {
    await sendEmailJS({ subject, html, replyTo: fields["Your email address"] || fields["email"] || "" });
    alert("Your request has been sent to ShipERP!");
  } catch (e) {
    alert("Error sending email: " + e.message);
  }
};
