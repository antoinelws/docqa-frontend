// script_customer.js — Customer submission that reuses internal calculators 1:1
// Sends compact HTML email via EmailJS JSON API (no attachments)

// ====== EmailJS config ======
const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // Template body: <html><body>{{{message_html}}}</body></html>
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com"; // recipient

document.addEventListener("DOMContentLoaded", () => {
  // ---------- small helpers ----------
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

  const pickField = (fields, ...keys) => {
    for (const k of keys) {
      if (k in fields && fields[k] != null && String(fields[k]).trim() !== "") {
        return Array.isArray(fields[k]) ? fields[k].join(", ") : fields[k];
      }
    }
    return "-";
  };

  function buildTinyEmail(formType, fields, estimateText, breakdownHtml) {
    const who   = pickField(fields, "Client Name", "Customer Name", "clientName", "customer", "client", "company");
    const reply = pickField(fields, "Your email address", "email", "Email", "contactEmail");

    // compact preview (first 15 lines)
    const rows = Object.entries(fields).slice(0, 15).map(([k,v]) => `
      <tr>
        <td style="padding:6px;border:1px solid #e5e5e5;"><strong>${k}</strong></td>
        <td style="padding:6px;border:1px solid #e5e5e5;">${textOrArray(v)}</td>
      </tr>
    `).join("");

    return `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
        <h2 style="margin:0 0 6px 0;">SOW – ${formType}</h2>
        <p style="margin:4px 0;"><strong>Client:</strong> ${who}</p>
        <p style="margin:4px 0;"><strong>Reply-to:</strong> ${reply}</p>
        <p style="margin:4px 0;"><strong>Estimate (total):</strong> ${estimateText}</p>

        ${breakdownHtml ? `<h3 style="margin:12px 0 6px;">Detail</h3>${breakdownHtml}` : ""}

        <h3 style="margin:12px 0 6px;">Preview (partial)</h3>
        <table style="border-collapse:collapse;width:100%;max-width:820px">${rows}</table>
        <p style="margin:10px 0 0;color:#666;">(Attachments disabled to respect EmailJS size limits.)</p>
      </div>
    `;
  }

  // ---------- PARITY LAYER with internal pages ----------
  // Strategy:
  // 1) Temporarily wrap window.displayResult(msg) used by internal scripts
  // 2) Trigger the same submit function as internal (e.g. submitEstimate())
  // 3) Wait until displayResult is called → capture message → parse "XX hours"
  // 4) Produce a minimal HTML breakdown by reading what internal code put on screen (if any)

  async function computeUsingInternalAndCapture(formType) {
    // ensure #resultBox exists (internal expects it)
    let resultBox = document.getElementById("resultBox");
    const createdResultBox = !resultBox;
    if (!resultBox) {
      resultBox = document.createElement("div");
      resultBox.id = "resultBox";
      resultBox.style.cssText = "visibility:hidden; height:0; overflow:hidden;";
      document.body.appendChild(resultBox);
    }

    // capture calls to displayResult
    const originalDisplay = window.displayResult;
    let capturedMsg = null;

    window.displayResult = function (msg) {
      try {
        capturedMsg = typeof msg === "string" ? msg : String(msg ?? "");
      } catch {}
      // also pass through to the original if it exists
      if (typeof originalDisplay === "function") {
        try { originalDisplay(msg); } catch {}
      } else {
        // minimal fallback for internal scripts that expect textContent write
        const rb = document.getElementById("resultBox");
        if (rb) {
          rb.textContent = capturedMsg || "";
        }
      }
    };

    // trigger internal computation per form type
    try {
      if (formType === "New Carrier" && typeof window.submitEstimate === "function") {
        window.submitEstimate(); // internal new carrier
      } else if (formType === "Rollout" && typeof window.submitEstimateRollout === "function") {
        window.submitEstimateRollout();
      } else if (formType === "Upgrade" && typeof window.submitEstimateUpgrade === "function") {
        window.submitEstimateUpgrade();
      } else if (formType === "Other" && typeof window.submitEstimateOther === "function") {
        window.submitEstimateOther();
      } else if (typeof window.submitEstimate === "function") {
        // some internal builds reuse one generic name
        window.submitEstimate();
      } else {
        throw new Error("Internal calculator function not found on this page.");
      }
    } catch (e) {
      // restore wrapper before throwing
      window.displayResult = originalDisplay;
      throw e;
    }

    // Wait for result: race between “displayResult called” and timeout
    const waitForResult = () => new Promise(resolve => {
      let waited = 0;
      const step = 100;
      const max  = 15000; // 15s max (covers network fetch in internal code)
      const timer = setInterval(() => {
        if (capturedMsg && capturedMsg.trim().length > 0) {
          clearInterval(timer); resolve(capturedMsg);
        } else if (waited >= max) {
          clearInterval(timer); resolve(null);
        }
        waited += step;
      }, step);
    });

    const message = await waitForResult();

    // restore displayResult
    window.displayResult = originalDisplay;

    // cleanup the hidden box if we created it
    if (createdResultBox) {
      try { resultBox.remove(); } catch {}
    }

    if (!message) throw new Error("No estimation result captured from internal calculator.");

    // Extract total "XX hours" from the captured message
    // Examples the internals show:
    // "Estimated Effort: 56 hours" OR "From 20 to 30 h", etc.
    let estimateText = "N/A";
    let breakdownHtml = "";

    const hoursRe = /Estimated\s*Effort:\s*([0-9]+)\s*hours?/i;
    const rangeRe = /(From|De)\s*([0-9]+)\s*(?:to|à)\s*([0-9]+)\s*h/iu;

    const m1 = message.match(hoursRe);
    const m2 = message.match(rangeRe);

    if (m1) {
      estimateText = `${m1[1]} hours`;
    } else if (m2) {
      estimateText = `From ${m2[2]} to ${m2[3]} h`;
    } else {
      // fallback: use entire message as estimate
      estimateText = message;
    }

    // Optional: if internal scripts render a DOM breakdown, we could clone it here.
    // For now, keep it minimal to stay under EmailJS limits.
    return { estimateText, breakdownHtml };
  }

  // ---------- main entry ----------
  window.submitCustomerForm = async function (formType) {
    const fields = collectFormFields();

    let estimateText = "N/A", breakdownHtml = "";
    try {
      const res = await computeUsingInternalAndCapture(formType);
      estimateText  = res.estimateText || "N/A";
      breakdownHtml = res.breakdownHtml || "";
    } catch (e) {
      // we still allow sending, but mark the estimate as unknown
      console.error("Estimation capture failed:", e);
      estimateText = "N/A";
      breakdownHtml = "";
    }

    const messageHtml = buildTinyEmail(formType, fields, estimateText, breakdownHtml);

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
            message_html: messageHtml
          }
        })
      });
      if (!response.ok) throw new Error(await response.text());
      alert("Your request has been sent to ShipERP!");
    } catch (e) {
      alert("Error sending email: " + e.message);
    }
  };
});
