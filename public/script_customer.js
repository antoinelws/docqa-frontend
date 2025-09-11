// customer_core.js — helpers + EmailJS + email compact

/************ EmailJS ************/
const EMAILJS = {
  SERVICE_ID:  "service_x8qqp19",
  TEMPLATE_ID: "template_j3fkvg4", // body: <html><body>{{{message_html}}}</body></html>
  USER_ID:     "PuZpMq1o_LbVO4IMJ",
  TO_EMAIL:    "alauwens@erp-is.com",
};

async function sendEmailViaEmailJS({ subject, replyTo, messageHtml }) {
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS.SERVICE_ID,
      template_id: EMAILJS.TEMPLATE_ID,
      user_id: EMAILJS.USER_ID,
      template_params: {
        subject,
        to_email: EMAILJS.TO_EMAIL,
        reply_to: replyTo || "",
        message_html: messageHtml
      }
    })
  });
  if (!res.ok) throw new Error(await res.text());
}

/************ Helpers ************/
const textOrArray = v => Array.isArray(v) ? v.join(", ") : (v ?? "");

function collectAllFieldsForEmail() {
  const inputs = document.querySelectorAll("input, select, textarea");
  const out = {};
  inputs.forEach(el => {
    if (el.type === "button" || el.type === "submit") return;
    const key =
      (el.id && document.querySelector(`label[for='${el.id}']`)?.textContent?.trim()) ||
      el.name || el.id;
    if (!key) return;
    if (el.type === "checkbox") {
      if (el.checked) (out[key] ||= []).push(el.value);
    } else if (el.multiple) {
      out[key] = Array.from(el.selectedOptions).map(o => o.value);
    } else {
      out[key] = el.value || "";
    }
  });
  return out;
}

function firstNonEmpty(fields, ...keys) {
  for (const k of keys) {
    const v = fields[k];
    if (v != null && String(v).trim() !== "") return Array.isArray(v) ? v.join(", ") : v;
  }
  return "-";
}

function buildCompactEmailHtml(formType, fields, estimateText, breakdownHtml = "") {
  const who   = firstNonEmpty(fields, "Client Name", "Customer Name", "clientName");
  const reply = firstNonEmpty(fields, "Your email address", "email", "Email");
  const rows = Object.entries(fields).slice(0, 18).map(([k,v]) => `
    <tr>
      <td style="padding:6px;border:1px solid #e5e5e5;"><strong>${k}</strong></td>
      <td style="padding:6px;border:1px solid #e5e5e5;">${textOrArray(v)}</td>
    </tr>`).join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
      <h2 style="margin:0 0 6px 0;">SOW – ${formType}</h2>
      <p style="margin:4px 0;"><strong>Client:</strong> ${who}</p>
      <p style="margin:4px 0;"><strong>Reply-to:</strong> ${reply}</p>
      <p style="margin:4px 0;"><strong>Estimate (total):</strong> ${estimateText}</p>
      ${breakdownHtml}
      <h3 style="margin:12px 0 6px;">Preview (partial)</h3>
      <table style="border-collapse:collapse;width:100%;max-width:820px">${rows}</table>
      <p style="margin:10px 0 0;color:#666;">(Attachments disabled to respect EmailJS size limits.)</p>
    </div>`;
}

/************ Exécution générique ************/
async function runCustomerFlow({ formType, collectFn, estimateFn, composeBreakdownHtml }) {
  const fields = collectAllFieldsForEmail();    // pour l'email (libellés jolis)
  const payload = collectFn();                  // pour le calcul (objet structuré)

  const est = await estimateFn(payload);        // string OU {hours / total_effort / details}
  const estimateText =
    typeof est === "string" ? est :
    (est?.hours != null ? `${est.hours} hours` :
     est?.total_effort != null ? `${est.total_effort} hours` : "N/A");

  const breakdownHtml = composeBreakdownHtml ? composeBreakdownHtml(est) : "";

  const subject = `SOW | ${formType} | ${fields["Client Name"] || fields["Customer Name"] || fields["clientName"] || ""}`;
  const messageHtml = buildCompactEmailHtml(formType, fields, estimateText, breakdownHtml);

  await sendEmailViaEmailJS({
    subject,
    replyTo: fields["Your email address"] || fields["email"] || "",
    messageHtml
  });

  alert("Your request has been sent to ShipERP!");
}
