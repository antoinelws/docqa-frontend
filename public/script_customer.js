// script_customer.js — Use internal calculator end-to-end (fetch intercept) + EmailJS

/* ===== EmailJS config ===== */
const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // Body: <html><body>{{{message_html}}}</body></html>
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com";

/* ===== Debug ===== */
const SOW_DEBUG   = true;    // keep true until you confirm parity
const NC_ENDPOINT = /\/estimate\/new_carrier$/i;

/* ===== Small helpers ===== */
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
      if (el.checked) (out[key] ||= []).push(el.value);
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

/* ===== displayResult capture (secondary source of truth) ===== */
function captureDisplayResultOnce(invoke) {
  return new Promise((resolve) => {
    const original = window.displayResult;
    let settled = false;
    window.displayResult = function (msg) {
      const s = (typeof msg === "string") ? msg : String(msg ?? "");
      if (SOW_DEBUG) console.log("[SOW] displayResult intercepted:", s);
      if (!settled) {
        settled = true;
        window.displayResult = original;
        resolve(s);
      }
    };
    try {
      invoke();
      setTimeout(() => {
        if (!settled) {
          settled = true;
          window.displayResult = original;
          resolve(null);
        }
      }, 15000);
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
  const m1 = rawText.match(reHours); if (m1) return `${m1[1]} hours`;
  const m2 = rawText.match(reRange); if (m2) return `From ${m2[2]} to ${m2[3]} h`;
  return null;
}

/* ===== fetch intercept around the internal call (primary source of truth) ===== */
async function runInternalNewCarrierAndIntercept() {
  // wrap fetch
  const origFetch = window.fetch;
  let capturedBody = null;
  let capturedResponseText = null;

  window.fetch = async function(input, init) {
    const url = (typeof input === "string") ? input : (input?.url || "");
    const match = NC_ENDPOINT.test(url);
    if (match) {
      try {
        capturedBody = init?.body ? JSON.parse(init.body) : null;
        if (SOW_DEBUG) console.log("[SOW][NC] captured request body:", capturedBody);
      } catch (e) {
        if (SOW_DEBUG) console.warn("[SOW][NC] body parse error:", e);
      }
    }
    const res = await origFetch.apply(this, arguments);
    if (match) {
      try {
        const clone = res.clone();
        capturedResponseText = await clone.text();
        if (SOW_DEBUG) console.log("[SOW][NC] captured raw response:", capturedResponseText);
      } catch (e) {
        if (SOW_DEBUG) console.warn("[SOW][NC] response read error:", e);
      }
    }
    return res;
  };

  // call the same internal entry your internal page uses
  // (we try common names; add more if your internal uses a different one)
  const internalFns = [
    "submitEstimateNewCarrier",
    "calculateNewCarrier",
    "estimateNewCarrier",
    "submitEstimate" // many builds use this generic name
  ];
  const fn = internalFns.map(n => window[n]).find(f => typeof f === "function");
  if (!fn) {
    // restore fetch before throwing
    window.fetch = origFetch;
    throw new Error("Internal New Carrier function not found. Make sure internal scripts are loaded before script_customer.js");
  }

  // we also keep displayResult as a backup
  const drPromise = captureDisplayResultOnce(() => fn());

  // wait a little for network + displayResult
  const waitFor = async () => {
    const start = Date.now();
    while (Date.now() - start < 15000) {
      if (capturedResponseText) break;
      await new Promise(r => setTimeout(r, 100));
    }
  };
  await waitFor();

  // restore fetch
  window.fetch = origFetch;

  // prefer response JSON → total_effort
  let hoursText = null;
  if (capturedResponseText) {
    try {
      const j = JSON.parse(capturedResponseText);
      if (typeof j.total_effort !== "undefined") hoursText = `${j.total_effort} hours`;
    } catch {}
  }

  // else, try displayResult
  if (!hoursText) {
    const drText = await drPromise;
    hoursText = parseEstimateText(drText) || "N/A";
  }

  // show the captured payload/response for parity debugging
  if (SOW_DEBUG) {
    console.log("[SOW][NC] FINAL hoursText:", hoursText);
    console.log("[SOW][NC] FINAL request payload used by internal:", capturedBody);
  }

  return hoursText || "N/A";
}

/* ===== Router ===== */
async function computeEstimateText(formType) {
  const t = String(formType||"").toLowerCase();

  if (t.includes("new") && t.includes("carrier")) {
    // PRIMARY: run internal path and intercept the real request/response
    return await runInternalNewCarrierAndIntercept();
  }

  // For other types, reuse the internal displayResult path (no fetch intercept needed)
  const map = t.includes("rollout") ? ["submitEstimateRollout","calculateRollout","estimateRollout","submitEstimate"]
           : t.includes("upgrade") ? ["submitEstimateUpgrade","calculateUpgrade","estimateUpgrade","submitEstimate"]
           :                         ["submitEstimateOther","calculateOther","estimateOther","submitEstimate"];

  const fn = map.map(n => window[n]).find(f => typeof f === "function");
  if (!fn) return "N/A";
  const raw = await captureDisplayResultOnce(() => fn());
  return parseEstimateText(raw) || "N/A";
}

/* ===== EmailJS ===== */
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

/* ===== Button entry ===== */
window.submitCustomerForm = async function (formType) {
  const fields = collectFormFields();

  let estimateText = "N/A";
  try {
    estimateText = await computeEstimateText(formType);
  } catch (e) {
    console.error("[SOW] compute failed:", e);
    estimateText = "N/A";
  }

  const subject = `SOW | ${formType} | ${fields["Client Name"] || fields["Customer Name"] || fields["clientName"] || ""}`;
  const html    = buildEmailHTML(formType, fields, estimateText);

  try {
    await sendEmailJS({ subject, html, replyTo: fields["Your email address"] || fields["email"] || "" });
    alert("Your request has been sent to ShipERP!");
  } catch (e) {
    alert("Error sending email: " + e.message);
  }
};
