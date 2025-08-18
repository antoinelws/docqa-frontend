// script_customer.js — Customer forms (EmailJS + Estimation + Excel attachment)

// ====== EmailJS config ======
const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // doit avoir {{{message_html}}} dans le corps
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com";   // destinataire final

document.addEventListener("DOMContentLoaded", () => {

  // ---------- SheetJS loader (auto) ----------
  async function ensureSheetJS() {
    if (window.XLSX) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ---------- utils ----------
  function textOrArray(val) {
    return Array.isArray(val) ? val.join(", ") : (val ?? "");
  }

  function collectFormFields() {
    const inputs = document.querySelectorAll("input, select, textarea");
    const fields = {};
    inputs.forEach(el => {
      if (el.type === "button" || el.type === "submit") return;

      const key =
        (el.id && document.querySelector(`label[for='${el.id}']`)?.textContent?.trim()) ||
        el.name || el.id;

      if (!key) return;

      if (el.type === "checkbox") {
        if (el.checked) {
          if (!fields[key]) fields[key] = [];
          fields[key].push(el.value);
        }
      } else if (el.multiple) {
        fields[key] = Array.from(el.selectedOptions).map(o => o.value);
      } else {
        fields[key] = el.value || "";
      }
    });
    return fields;
  }

  function buildHtmlSummary(formType, formFields, estimate) {
    const rows = Object.entries(formFields)
      .map(([k,v]) =>
        `<tr>
           <td style="padding:8px;border:1px solid #ddd;"><strong>${k}</strong></td>
           <td style="padding:8px;border:1px solid #ddd;">${textOrArray(v)}</td>
         </tr>`
      ).join("");

    let breakdownRows = "";
    if (estimate?.breakdown) {
      breakdownRows = Object.entries(estimate.breakdown)
        .map(([k,v]) =>
          `<tr>
             <td style="padding:6px;border:1px solid #eee;">${k}</td>
             <td style="padding:6px;border:1px solid #eee;">${v}</td>
           </tr>`
        ).join("");
    }

    return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
      <h2 style="margin:0 0 12px 0;">SOW – ${formType}</h2>

      <h3 style="margin:16px 0 8px;">Summary</h3>
      <table style="border-collapse:collapse;width:100%;max-width:820px">${rows}</table>

      <h3 style="margin:16px 0 8px;">Estimate</h3>
      <p style="margin:6px 0;"><strong>Total:</strong> ${estimate?.total ?? "N/A"}</p>
      ${breakdownRows ? `<table style="border-collapse:collapse;width:100%;max-width:820px">${breakdownRows}</table>` : ""}
    </div>`;
  }

  async function buildExcelFile(formType, formFields, estimate) {
    await ensureSheetJS();
    const wb = XLSX.utils.book_new();

    // Q&A sheet
    const qaRows = [["Question", "Answer"]];
    Object.entries(formFields).forEach(([k, v]) => {
      qaRows.push([k, Array.isArray(v) ? v.join(", ") : v]);
    });
    const wsQA = XLSX.utils.aoa_to_sheet(qaRows);
    XLSX.utils.book_append_sheet(wb, wsQA, "Q&A");

    // Estimate sheet
    const estRows = [["Field", "Value"]];
    estRows.push(["Form Type", formType]);
    estRows.push(["Total", estimate?.total ?? "N/A"]);
    if (estimate?.breakdown) {
      Object.entries(estimate.breakdown).forEach(([k,v]) => estRows.push([k, v]));
    }
    const wsEst = XLSX.utils.aoa_to_sheet(estRows);
    XLSX.utils.book_append_sheet(wb, wsEst, "Estimate");

    const arrayBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new File([arrayBuf], `SOW_${formType.replace(/\s+/g,'_')}.xlsx`, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
  }

  // ---------- estimation logic (unchanged) ----------
  async function estimateNewCarrier() { /* ... unchanged ... */ }
  function estimateRollout() { /* ... unchanged ... */ }
  function estimateUpgrade() { /* ... unchanged ... */ }
  async function estimateOther() { /* ... unchanged ... */ }

  // ---------- main send ----------
  window.submitCustomerForm = async function (formType) {
    const specInput = document.getElementById("specFile"); // présent sur "Other"
    const fields    = collectFormFields();

    // 1) calcul
    let estimate = { total: "N/A", breakdown: {} };
    if (formType === "New Carrier") {
      estimate = await estimateNewCarrier();
    } else if (formType === "Rollout") {
      estimate = estimateRollout();
    } else if (formType === "Upgrade") {
      estimate = estimateUpgrade();
    } else if (formType === "Other") {
      estimate = await estimateOther();
    }

    // 2) HTML lisible
    let html = buildHtmlSummary(formType, fields, estimate);

    // 2b) Safeguard: trim if >50KB
    function byteLen(str) { return new Blob([str]).size; }
    const MAX_SIZE = 45 * 1024; // leave margin
    if (byteLen(html) > MAX_SIZE) {
      const briefRows = Object.entries(fields)
        .slice(0, 12)
        .map(([k,v]) =>
          `<tr>
             <td style="padding:6px;border:1px solid #ddd;"><strong>${k}</strong></td>
             <td style="padding:6px;border:1px solid #ddd;">${textOrArray(v)}</td>
           </tr>`
        ).join("");

      html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
        <h2>SOW – ${formType}</h2>
        <p>Full details are in the attached Excel file.</p>
        <h3>Estimate</h3>
        <p><strong>Total:</strong> ${estimate?.total ?? "N/A"}</p>
        <h3>Preview (partial)</h3>
        <table style="border-collapse:collapse;width:100%;max-width:820px">${briefRows}</table>
      </div>`;
    }

    // 3) Excel (Q&A + Estimate)
    const excelFile = await buildExcelFile(formType, fields, estimate);

    // 4) EmailJS (send-form) + pièces jointes
    const fd = new FormData();
    fd.append("service_id", SERVICE_ID);
    fd.append("template_id", TEMPLATE_ID);
    fd.append("user_id", USER_ID);

    const subjName = fields["Client Name"] || fields["Customer Name"] || "";
    fd.append("template_params[subject]", `SOW | ${formType} | ${subjName}`.trim());
    fd.append("template_params[to_email]", TO_EMAIL);
    fd.append("template_params[reply_to]", fields["Your email address"] || "");
    fd.append("template_params[message_html]", html);

    // Spec file (si présent)
    if (specInput && specInput.files && specInput.files.length > 0) {
      const f = specInput.files[0];
      if (f.size > 10 * 1024 * 1024) { alert("The file exceeds 10MB."); return; }
      fd.append("attachments", f, f.name);
    }

    // Excel généré
    fd.append("attachments", excelFile, excelFile.name);

    try {
      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send-form", {
        method: "POST",
        body: fd
      });
      if (!res.ok) throw new Error(await res.text());
      alert("Your request has been sent to ShipERP!");
    } catch (e) {
      alert("Error sending email: " + e.message);
    }
  };
});
