// script_customer.js — Compact EmailJS vars + Excel attachment + hard fallback

const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // Template body in Code Editor: <html><body>{{{message_html}}}</body></html>
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com";

document.addEventListener("DOMContentLoaded", () => {

  // --------- Load SheetJS on demand ----------
  async function ensureSheetJS() {
    if (window.XLSX) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
  }

  // --------- Helpers ----------
  function textOrArray(v){ return Array.isArray(v) ? v.join(", ") : (v ?? ""); }

  function collectFormFields() {
    const inputs = document.querySelectorAll("input, select, textarea");
    const out = {};
    inputs.forEach(el => {
      if (el.type === "button" || el.type === "submit") return;
      const key = (el.id && document.querySelector(`label[for='${el.id}']`)?.textContent?.trim()) || el.name || el.id;
      if (!key) return;
      if (el.type === "checkbox") {
        if (el.checked) { (out[key] ||= []).push(el.value); }
      } else if (el.multiple) {
        out[key] = Array.from(el.selectedOptions).map(o=>o.value);
      } else {
        out[key] = el.value || "";
      }
    });
    return out;
  }

  function buildTinyEmail(formType, fields, estimate) {
    const who = fields["Client Name"] || fields["Customer Name"] || "";
    const reply = fields["Your email address"] || "";
    const total = estimate?.total ?? "N/A";
    // super small body (few hundred bytes)
    return `<div style="font-family:Arial,sans-serif;font-size:14px">
      <h3 style="margin:0 0 6px">SOW – ${formType}</h3>
      <p style="margin:4px 0"><b>Client:</b> ${who || "-"}</p>
      <p style="margin:4px 0"><b>Reply-to:</b> ${reply || "-"}</p>
      <p style="margin:4px 0"><b>Estimate (total):</b> ${total}</p>
      <p style="margin:6px 0 0">Full Q&amp;A + breakdown in the attached Excel.</p>
    </div>`;
  }

  async function buildExcelFile(formType, formFields, estimate) {
    await ensureSheetJS();
    const wb = XLSX.utils.book_new();
    const qa = [["Question","Answer"]];
    Object.entries(formFields).forEach(([k,v]) => qa.push([k, textOrArray(v)]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(qa), "Q&A");

    const est = [["Field","Value"]];
    est.push(["Form Type", formType]);
    est.push(["Total", estimate?.total ?? "N/A"]);
    if (estimate?.breakdown) Object.entries(estimate.breakdown).forEach(([k,v]) => est.push([k,v]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(est), "Estimate");

    const buf = XLSX.write(wb, { bookType:"xlsx", type:"array" });
    return new File([buf], `SOW_${formType.replace(/\s+/g,'_')}.xlsx`, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
  }

  // --------- Estimation (same logic you approved) ----------
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
      if (typeof j.total_effort !== "undefined") return { total: `${j.total_effort} hours`, breakdown: j.breakdown || {} };
      return { total:"N/A", breakdown:{ "Server response": t.slice(0,300)+"..." } };
    } catch(e){ return { total:"N/A", breakdown:{ "Error": e.message } }; }
  }

  function estimateRollout() {
    const siteCount = document.getElementById("siteCount")?.value;
    const region    = document.getElementById("shipToRegion")?.value;
    const blueprint = document.getElementById("blueprintNeeded")?.value;
    if (blueprint === "No") return { total:"Blueprint required (16 hours)", breakdown:{ Note:"A 16 hours Blueprint/Workshop would be required" } };
    let base=0; if (siteCount==="Only 1") base=40; else if(siteCount==="2 to 5") base=120; else if(siteCount==="More than 5") base=200;
    const extra = region==="US" ? 0 : 16;
    return { total:`${base+extra} hours`, breakdown:{ "Base":`${base} h`, "Region adj.":`${extra} h` } };
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

    return { total: rng(sum), breakdown: {
      "Base Estimation": rng(core), "Foundation Setup": rng(base), "Z Enhancements": rng(wZ+wE),
      "Online Carriers": rng(wC), "Integration": rng(integ), "Testing": rng(test),
      "Training": rng(train), "Documentation": rng(doc)
    }};
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
      const br = {}; if (data.details) Object.entries(data.details).forEach(([k,[a,b]]) => br[k] = `${a} – ${b} h`);
      const total = (data.from!=null && data.to!=null) ? `${data.from} – ${data.to} h` : "N/A";
      return { total, breakdown: br };
    } catch(e){ return { total:"N/A", breakdown:{ "Error": e.message } }; }
  }

  // --------- Main send (compact vars + retry fallback) ----------
  window.submitCustomerForm = async function(formType){
    const specInput = document.getElementById("specFile");
    const fields    = collectFormFields();

    // compute estimate
    let estimate = { total:"N/A", breakdown:{} };
    if (formType==="New Carrier") estimate = await estimateNewCarrier();
    else if (formType==="Rollout") estimate = estimateRollout();
    else if (formType==="Upgrade") estimate = estimateUpgrade();
    else if (formType==="Other")   estimate = await estimateOther();

    // tiny body
    const messageHtml = buildTinyEmail(formType, fields, estimate);

    // Excel attachment
    const excelFile = await buildExcelFile(formType, fields, estimate);

    // build FormData with ONLY minimal vars (no template_params[...] nesting)
    async function sendEmail(useMessageHtml = true) {
      const fd = new FormData();
      fd.append("service_id", SERVICE_ID);
      fd.append("template_id", TEMPLATE_ID);
      fd.append("user_id", USER_ID);

      const subjName = fields["Client Name"] || fields["Customer Name"] || "";
      fd.append("subject", `SOW | ${formType} | ${subjName}`.trim());
      fd.append("to_email", TO_EMAIL);
      fd.append("reply_to", fields["Your email address"] || "");

      if (useMessageHtml) fd.append("message_html", messageHtml);

      if (specInput && specInput.files && specInput.files.length > 0) {
        const f = specInput.files[0];
        if (f.size > 10 * 1024 * 1024) { alert("The file exceeds 10MB."); return { ok:false }; }
        fd.append("attachments", f, f.name);
      }
      fd.append("attachments", excelFile, excelFile.name);

      const res = await fetch("https://api.emailjs.com/api/v1.0/email/send-form", { method:"POST", body: fd });
      return { ok: res.ok, text: await res.text() };
    }

    // try with tiny html; if still 50KB error, retry without message_html at all
    let result = await sendEmail(true);
    if (!result.ok && /Variables size limit/i.test(result.text)) {
      result = await sendEmail(false); // subject + attachments only
    }

    if (result.ok) alert("Your request has been sent to ShipERP!");
    else alert("Error sending email: " + result.text);
  };
});
