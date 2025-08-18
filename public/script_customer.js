// script_customer.js — Customer forms (EmailJS + Estimation + Excel attachment, compact email)

// ====== EmailJS config ======
const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // template body should be: <html><body>{{{message_html}}}</body></html>
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com";

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

  // Small, safe email body (always < 50KB)
  function buildTinyEmail(formType, fields, estimate) {
    const who = fields["Client Name"] || fields["Customer Name"] || "";
    const reply = fields["Your email address"] || "";
    const total = estimate?.total ?? "N/A";
    return `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
        <h2 style="margin:0 0 8px 0;">SOW – ${formType}</h2>
        <p style="margin:6px 0;"><strong>Client:</strong> ${who || "-"}</p>
        <p style="margin:6px 0;"><strong>Reply-to:</strong> ${reply || "-"}</p>
        <p style="margin:6px 0;"><strong>Estimate (total):</strong> ${total}</p>
        <p style="margin:10px 0 0;">Full Q&amp;A and detailed breakdown are attached in the Excel file.</p>
      </div>
    `;
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

  // ---------- estimation logic (same as your version) ----------
  async function estimateNewCarrier() {
    const features = Array.from(document.querySelectorAll("input[name='features']:checked")).map(x => x.value);
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
      systemUsed: ["sys_ecc","sys_ewm","sys_tm"].filter(id => document.getElementById(id)?.checked).map(id => document.getElementById(id).value),
      shipmentScreens: ["screen_smallparcel","screen_planning","screen_tm","screen_other"].filter(id => document.getElementById(id)?.checked).map(id => document.getElementById(id).value),
      shipFrom: Array.from(document.getElementById("shipFrom")?.selectedOptions || []).map(o => o.value),
      shipTo:   Array.from(document.getElementById("shipTo")?.selectedOptions || []).map(o => o.value)
    };

    try {
      const res = await fetch("https://docqa-api.onrender.com/estimate/new_carrier", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload)
      });
      const txt = await res.text();
      const json = JSON.parse(txt);
      if (typeof json.total_effort !== "undefined") {
        return { total: `${json.total_effort} hours`, breakdown: json.breakdown || {} };
      }
      return { total: "N/A", breakdown: { "Server response": txt.slice(0,300) + "..." } };
    } catch (e) {
      return { total: "N/A", breakdown: { "Error": e.message } };
    }
  }

  function estimateRollout() {
    const siteCount = document.getElementById("siteCount")?.value;
    const shipToRegion = document.getElementById("shipToRegion")?.value;
    const blueprintNeeded = document.getElementById("blueprintNeeded")?.value;

    if (blueprintNeeded === "No") {
      return {
        total: "Blueprint required (16 hours)",
        breakdown: { Note: "A 16 hours Blueprint/Workshop would be required" }
      };
    }

    let baseHours = 0;
    if (siteCount === "Only 1") baseHours = 40;
    else if (siteCount === "2 to 5") baseHours = 120;
    else if (siteCount === "More than 5") baseHours = 200;

    const regionalExtra = shipToRegion === "US" ? 0 : 16;
    const total = baseHours + regionalExtra;

    return {
      total: `${total} hours`,
      breakdown: { "Base": `${baseHours} h`, "Region adj.": `${regionalExtra} h` }
    };
  }

  function estimateUpgrade() {
    const shiperpVersion = document.getElementById("shiperpVersionUpgrade")?.value;
    const zenhancements  = document.getElementById("zenhancementsUpgrade")?.value;
    const onlineCarriers = document.getElementById("onlineCarrierCountUpgrade")?.value;
    const ewmUsage       = document.getElementById("ewmUsageUpgrade")?.value;
    const modulesUsed    = Array.from(document.getElementById("modulesUsedUpgrade")?.selectedOptions || []).map(el => el.value);

    const weightVersion  = shiperpVersion === "Between 3.6 and 3.9" ? 15 : shiperpVersion === "Lower than 3.6" ? 25 : 0;
    const weightZ        = ({ "1 to 10":15, "10 to 50":60, "50 to 100":100, "More than 100":150 }[zenhancements]) || 0;
    const weightCarrier  = ({ "1 to 5":60, "6 to 10":200, "More than 10":300 }[onlineCarriers]) || 0;
    const weightEWM      = ewmUsage === "Yes" ? 50 : 0;
    const weightModules  = modulesUsed.length > 3 ? 40 : 0;

    const baseEffort         = 8;
    const integrationEffort  = 16 + 0.1 * (weightCarrier + weightEWM);
    const testingEffort      = 8 + 0.2 * (weightCarrier + weightModules);
    const trainingEffort     = 40;
    const documentationEffort= 32;
    const totalEffort        = 0.2 * (weightVersion + weightZ + weightCarrier + weightEWM + weightModules + baseEffort + integrationEffort + testingEffort + trainingEffort + documentationEffort);
    const sum                = totalEffort + baseEffort + weightZ + weightCarrier + weightEWM + integrationEffort + testingEffort + trainingEffort + documentationEffort;

    const rng = v => `From ${Math.round(v*0.8)} to ${Math.round(v*1.2)} h`;

    return {
      total: rng(sum),
      breakdown: {
        "Base Estimation":   rng(totalEffort),
        "Foundation Setup":  rng(baseEffort),
        "Z Enhancements":    rng(weightZ + weightEWM),
        "Online Carriers":   rng(weightCarrier),
        "Integration":       rng(integrationEffort),
        "Testing":           rng(testingEffort),
        "Training":          rng(trainingEffort),
        "Documentation":     rng(documentationEffort)
      }
    };
  }

  async function estimateOther() {
    const ecc          = parseFloat(document.getElementById("ecc_version")?.value);
    const ewm          = parseFloat(document.getElementById("ewm_version")?.value);
    const enhancements = parseInt(document.getElementById("enhancements")?.value || "0", 10);
    const testCases    = document.getElementById("test_cases")?.value;
    const rating       = document.getElementById("rating")?.value;
    const corrections  = parseFloat(document.getElementById("corrections")?.value || "0");
    const config       = parseFloat(document.getElementById("configuration")?.value || "0");

    const payload = {
      ecc_version: ecc,
      ewm_version: ewm,
      enhancements,
      test_cases: testCases,
      customer_rating: rating,
      corrections,
      configuration: config
    };

    try {
      const res  = await fetch("https://docqa-api.onrender.com/sow-estimate", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      const breakdown = {};
      if (data.details) {
        for (const [task, range] of Object.entries(data.details)) {
          breakdown[task] = `${range[0]} – ${range[1]} h`;
        }
      }
      const total = (typeof data.from !== "undefined" && typeof data.to !== "undefined")
        ? `${data.from} – ${data.to} h` : "N/A";

      return { total, breakdown };
    } catch (e) {
      return { total: "N/A", breakdown: { "Error": e.message } };
    }
  }

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

    // 2) Tiny HTML (guaranteed small)
    const messageHtml = buildTinyEmail(formType, fields, estimate);

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
    fd.append("template_params[message_html]", messageHtml);

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
