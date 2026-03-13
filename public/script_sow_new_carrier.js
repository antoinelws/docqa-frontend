(() => {
  const STORAGE_PREFIX = "sow_new_carrier_estimation:";
  const STORAGE_INDEX_KEY = "sow_new_carrier_estimation_index";

  const SOW_EMAILJS = {
    SERVICE_ID: "service_x8qqp19",
    TEMPLATE_ID: "template_7whkrog",
    USER_ID: "PuZpMq1o_LbVO4IMJ",
    TO_EMAIL: "sow@erp-is.com"
  };

  function $(id) { return document.getElementById(id); }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  function showStatus(message, isError = false) {
    const el = $("actionStatus");
    if (!el) return;
    el.innerHTML = message;
    el.classList.add("show");
    el.style.background = isError ? "#fef2f2" : "#f8fafc";
    el.style.color = isError ? "#b91c1c" : "#475569";
    el.style.border = isError ? "1px solid #fecaca" : "1px solid #e2e8f0";
  }

  function cleanList(values) {
    return Array.from(new Set((values || []).map(v => String(v || "").trim()).filter(Boolean)));
  }

  function getMultiChecked(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
  }

  function loadIndex() {
    try {
      const raw = localStorage.getItem(STORAGE_INDEX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveIndex(index) {
    localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(index));
  }

  function refreshSavedEstimationsDropdown() {
    const select = $("savedEstimations");
    if (!select) return;
    const index = loadIndex();
    select.innerHTML = '<option value="">-- Select saved estimation --</option>';
    index.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = item.label;
      select.appendChild(opt);
    });
  }

  function generateEstimationId(clientName, carrierName) {
    const safeClient = String(clientName || "NoClient").trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "").slice(0, 30);
    const safeCarrier = String(carrierName || "NoCarrier").trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "").slice(0, 30);
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${safeClient}_${safeCarrier}_${todayISO()}_${rand}`;
  }

  function applyDefaultInputs() {
    document.querySelectorAll("select").forEach(sel => {
      const anySelected = Array.from(sel.options).some(o => o.selected);
      if (!anySelected && sel.options.length) {
        const firstUsable = Array.from(sel.options).find(o => !o.disabled);
        if (firstUsable) firstUsable.selected = true;
        else sel.options[0].selected = true;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  function collectNewCarrierForm() {
    const features = cleanList(getMultiChecked("features"));
    const systems = cleanList(getMultiChecked("systems"));
    const screens = cleanList(getMultiChecked("screens"));

    const shipFrom = $("shipFrom")?.value ? [$("shipFrom").value] : [];
    const shipTo = $("shipTo")?.value ? [$("shipTo").value] : [];

    return {
      clientName: $("clientName")?.value || "",
      carrierName: $("carrierName")?.value || "",
      alreadyUsed: $("alreadyUsed")?.value || "",
      zEnhancements: $("zEnhancements")?.value || "",
      onlineOrOffline: $("onlineOrOffline")?.value || "",
      sapVersion: $("sapVersion")?.value || "",
      abapVersion: $("abapVersion")?.value || "",
      shiperpVersion: $("shiperpVersion")?.value || "",
      serpcarUsage: $("serpcarUsage")?.value || "",
      features,
      systemsUsed: systems,
      systems,
      systemUsed: systems,
      shipmentScreens: screens,
      shipFromLocation: shipFrom,
      shipToLocation: shipTo
    };
  }

  function collectFormState() {
    const form = $("formNewCarrierInternal");
    const fields = form.querySelectorAll("input, select, textarea");
    const state = {};
    fields.forEach(el => {
      const key = el.id || el.name;
      if (!key) return;
      if (el.type === "checkbox") state[key] = el.checked;
      else state[key] = el.value;
    });
    return state;
  }

  function applyFormState(state) {
    const form = $("formNewCarrierInternal");
    if (!form || !state) return;
    Object.entries(state).forEach(([key, value]) => {
      const byId = form.querySelector(`#${CSS.escape(key)}`);
      if (byId) {
        if (byId.type === "checkbox") {
          byId.checked = !!value;
          byId.closest(".checkbox-row")?.classList.toggle("checked", !!value);
        } else {
          byId.value = value ?? "";
        }
        byId.dispatchEvent(new Event("input", { bubbles: true }));
        byId.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      form.querySelectorAll(`[name="${CSS.escape(key)}"]`).forEach(el => {
        if (el.type === "checkbox") {
          el.checked = !!value;
          el.closest(".checkbox-row")?.classList.toggle("checked", !!value);
        } else {
          el.value = value ?? "";
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  function computeInternalEstimate(payload) {
    let hours = 0;
    const breakdown = [];
    function addPart(label, value, note) {
      breakdown.push({ label, value, note });
      hours += value;
    }

    const carrierName = (payload.carrierName || "").trim();
    if (carrierName) addPart("Carrier base (listed in dropdown)", 60, carrierName);
    else addPart("Carrier base (not listed)", 40, "No carrier selected in dropdown");

    const alreadyUsed = (payload.alreadyUsed || "").trim();
    if (alreadyUsed === "Yes") addPart("Already used with ShipERP on another plant", -16, "Answer: Yes");
    else addPart("Already used with ShipERP on another plant", 0, `Answer: ${alreadyUsed || "No/I do not know"}`);

    const onlineOrOffline = (payload.onlineOrOffline || "").trim();
    if (onlineOrOffline === "Offline") addPart("Online vs Offline", -32, "Offline");
    else addPart("Online vs Offline", 0, onlineOrOffline || "Online / I do not know");

    const zEnhancements = (payload.zEnhancements || "").trim();
    if (zEnhancements === "Between 10 and 50") addPart("Z-Enhancements (10-50)", 16, zEnhancements);
    else if (zEnhancements === "More than 50") addPart("Z-Enhancements (more than 50)", 32, zEnhancements);
    else if (zEnhancements === "I'm not sure") addPart("Z-Enhancements (uncertain)", 8, zEnhancements);
    else addPart("Z-Enhancements (less than 10)", 0, zEnhancements || "Less than 10");

    if ((payload.features || []).length > 3) addPart("Features used (more than 3)", 16, `${payload.features.length} selected`);
    else addPart("Features used (3 or fewer)", 0, `${(payload.features || []).length} selected`);

    if ((payload.systemUsed || []).length > 1) addPart("Systems used (more than 1)", 16, payload.systemUsed.join(", ") || "None");
    else addPart("Systems used (1 or 0)", 0, payload.systemUsed.join(", ") || "None");

    const shiperpVersion = (payload.shiperpVersion || "").trim();
    if (shiperpVersion === "Between 3.6 and 3.9") addPart("ShipERP version impact", 8, shiperpVersion);
    else if (shiperpVersion === "Lower than 3.6") addPart("ShipERP version impact", 12, shiperpVersion);
    else addPart("ShipERP version impact", 0, shiperpVersion || "Above 4.5 / Between 4.0 and 4.5");

    if ((payload.shipmentScreens || []).length > 1) addPart("Screens used (more than 1)", 8, payload.shipmentScreens.join(", ") || "None");
    else addPart("Screens used (1 or 0)", 0, payload.shipmentScreens.join(", ") || "None");

    const serpcarUsage = (payload.serpcarUsage || "").trim();
    if (serpcarUsage === "Yes") addPart("SERPCAR carrier usage", -16, "Answer: Yes");
    else addPart("SERPCAR carrier usage", 0, `Answer: ${serpcarUsage || "No/I do not know"}`);

    const hasNonUSFrom = (payload.shipFromLocation || []).some(loc => loc !== "US" && String(loc).trim() !== "");
    if (hasNonUSFrom) addPart("Shipping FROM (non-US location)", 8, (payload.shipFromLocation || []).join(", "));
    else addPart("Shipping FROM (US or not specified)", 0, (payload.shipFromLocation || []).join(", ") || "Not specified");

    const hasNonUSTo = (payload.shipToLocation || []).some(loc => loc !== "US" && String(loc).trim() !== "");
    if (hasNonUSTo) addPart("Shipping TO (non-US location)", 8, (payload.shipToLocation || []).join(", "));
    else addPart("Shipping TO (US or not specified)", 0, (payload.shipToLocation || []).join(", ") || "Not specified");

    return { total_effort: hours, breakdown };
  }

  function clearValidationUI() {
    document.querySelectorAll(".has-error").forEach(el => el.classList.remove("has-error"));
    document.querySelectorAll(".error-text").forEach(el => { el.textContent = ""; });
    const summary = $("validationSummary");
    if (summary) {
      summary.style.display = "none";
      summary.innerHTML = "";
    }
  }

  function showValidationErrors(errors) {
    const summary = $("validationSummary");
    if (summary && Object.keys(errors).length) {
      summary.innerHTML = `<strong>Please fix the following:</strong><ul>${Object.values(errors).map(msg => `<li>${escapeHtml(msg)}</li>`).join("")}</ul>`;
      summary.style.display = "block";
    }
    if (errors.clientName) {
      $("field-clientName")?.classList.add("has-error");
      const el = document.querySelector('[data-error-for="clientName"]');
      if (el) el.textContent = errors.clientName;
    }
    if (errors.sapVersion) {
      $("field-sapVersion")?.classList.add("has-error");
      const el = document.querySelector('[data-error-for="sapVersion"]');
      if (el) el.textContent = errors.sapVersion;
    }
    if (errors.abapVersion) {
      $("field-abapVersion")?.classList.add("has-error");
      const el = document.querySelector('[data-error-for="abapVersion"]');
      if (el) el.textContent = errors.abapVersion;
    }
    if (errors.systems) {
      $("field-systems")?.classList.add("has-error");
      const el = document.querySelector('[data-error-for="systems"]');
      if (el) el.textContent = errors.systems;
    }
    if (errors.screens) {
      $("field-screens")?.classList.add("has-error");
      const el = document.querySelector('[data-error-for="screens"]');
      if (el) el.textContent = errors.screens;
    }
  }

  function validateNewCarrier(payload) {
    const errors = {};
    if (!payload.clientName) errors.clientName = "Client Name is required.";
    if (!payload.sapVersion || !payload.sapVersion.trim()) errors.sapVersion = "SAP Version is required.";
    if (!payload.abapVersion || !payload.abapVersion.trim()) errors.abapVersion = "ABAP Version is required.";
    if (!(payload.systemUsed || []).length) errors.systems = "Select at least one system.";
    if (!(payload.shipmentScreens || []).length) errors.screens = "Select at least one screen used to create shipment.";
    return errors;
  }

  function renderEstimateResult(payload, est, sharepointUrl = "") {
    const resultBox = $("resultBox");
    if (!resultBox) return;

    const breakdownRows = (est.breakdown || []).map(item => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:left;">${escapeHtml(item.label)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(String(item.value))} h</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:left;">${escapeHtml(item.note || "")}</td>
      </tr>
    `).join("");

    const linkBlock = sharepointUrl ? `
      <div style="margin-top:16px;padding:12px;border:1px solid #dbeafe;background:#eff6ff;border-radius:8px;">
        <div style="font-size:13px;color:#1d4ed8;margin-bottom:4px;">SharePoint PDF</div>
        <a href="${sharepointUrl}" target="_blank" rel="noopener noreferrer">Open saved PDF</a>
      </div>` : "";

    resultBox.innerHTML = `
      <div class="estimate-card" style="width:100%;text-align:left;">
        <h3 style="margin-bottom:12px;color:#111827;">Estimation Result</h3>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">
            <div style="font-size:12px;color:#64748b;">Client</div>
            <div style="font-weight:700;color:#111827;">${escapeHtml(payload.clientName || "-")}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">
            <div style="font-size:12px;color:#64748b;">Carrier</div>
            <div style="font-weight:700;color:#111827;">${escapeHtml(payload.carrierName || "Carrier not listed")}</div>
          </div>
        </div>
        <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin-bottom:16px;">
          <div style="font-size:13px;color:#166534;">Total estimated effort</div>
          <div style="font-size:28px;font-weight:800;color:#166534;">${escapeHtml(String(est.total_effort))} hours</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e5e7eb;">Rule</th>
              <th style="padding:8px 10px;text-align:right;border-bottom:1px solid #e5e7eb;">Hours</th>
              <th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e5e7eb;">Note</th>
            </tr>
          </thead>
          <tbody>${breakdownRows}</tbody>
        </table>
        ${linkBlock}
      </div>`;

    resultBox.style.display = "block";
    resultBox.classList.add("show");
    resultBox.style.color = "#111827";
    resultBox.style.background = "#ffffff";
    resultBox.style.textAlign = "left";
  }

  async function run() {
    applyDefaultInputs();
    clearValidationUI();
    const payload = collectNewCarrierForm();
    const errors = validateNewCarrier(payload);
    if (Object.keys(errors).length) {
      showValidationErrors(errors);
      $("resultBox").style.display = "none";
      return null;
    }
    const est = computeInternalEstimate(payload);
    renderEstimateResult(payload, est);
    return { payload, est };
  }

  function saveEstimationLocally(payload, est, sharepointUrl = "") {
    const carrierLabel = payload.carrierName || "Carrier not listed";
    const id = generateEstimationId(payload.clientName, carrierLabel);
    const label = `${payload.clientName || "No client"} | ${carrierLabel} | ${todayISO()}`;
    const record = {
      id,
      label,
      savedAt: new Date().toISOString(),
      formState: collectFormState(),
      estimateResult: est,
      sharepointUrl
    };
    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(record));
    const index = loadIndex();
    index.unshift({ id, label, savedAt: record.savedAt, sharepointUrl });
    saveIndex(index);
    refreshSavedEstimationsDropdown();
    return record;
  }

  function loadEstimationById(id) {
    if (!id) return null;
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + id);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function createPdfForDownload(filename) {
    const root = document.getElementById("estimation-root") || document.querySelector(".container") || document.body;
    document.body.classList.add("pdf-export-mode");
    try {
      const canvas = await html2canvas(root, { scale: 1, scrollX: 0, scrollY: -window.scrollY, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.82);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "pt", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(filename);
    } finally {
      document.body.classList.remove("pdf-export-mode");
    }
  }

  async function generateEstimatePdfBase64() {
    const root = document.getElementById("estimation-root") || document.querySelector(".container") || document.body;
    document.body.classList.add("pdf-export-mode");
    try {
      const canvas = await html2canvas(root, { scale: 1, scrollX: 0, scrollY: -window.scrollY, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.82);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "pt", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      return pdf.output("datauristring").split(",")[1];
    } finally {
      document.body.classList.remove("pdf-export-mode");
    }
  }

  async function uploadEstimatePdfToSharePoint(fileName, pdfBase64) {
    const uploadRes = await fetch("/api/upload-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName,
        pdfBase64,
        category: "sow",
        estimationType: "new-carrier"
      })
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error("Upload failed: " + errText);
    }
    const data = await uploadRes.json();
    if (!data.sharepointUrl) throw new Error("No SharePoint URL returned from upload.");
    return data.sharepointUrl;
  }

  function getLastSavedRecord() {
    const select = $("savedEstimations");
    if (!select || !select.value) return null;
    return loadEstimationById(select.value);
  }

  async function ensureSowSharepointUrl(payload, est) {
    const currentId = $("savedEstimations")?.value || "";
    const existingRecord = currentId ? loadEstimationById(currentId) : null;
    if (existingRecord?.sharepointUrl) return { sharepointUrl: existingRecord.sharepointUrl, record: existingRecord };

    const ts = Date.now();
    const fileName = `SOW_NewCarrier_${(payload.clientName || "Client").replace(/\s+/g, "_")}_${(payload.carrierName || "CarrierNotListed").replace(/\s+/g, "_")}_${ts}.pdf`;
    const pdfBase64 = await generateEstimatePdfBase64();
    const sharepointUrl = await uploadEstimatePdfToSharePoint(fileName, pdfBase64);
    const record = saveEstimationLocally(payload, est, sharepointUrl);
    return { sharepointUrl, record };
  }

  async function sendEmailViaEmailJS({ subject, messageHtml, extraParams = {} }) {
    const payload = {
      service_id: SOW_EMAILJS.SERVICE_ID,
      template_id: SOW_EMAILJS.TEMPLATE_ID,
      user_id: SOW_EMAILJS.USER_ID,
      template_params: {
        subject,
        to_email: SOW_EMAILJS.TO_EMAIL,
        message_html: messageHtml || "",
        ...extraParams
      }
    };
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
  }

  function buildEstimationEmailHtml(payload, est, sharepointUrl) {
    const requestedBy = localStorage.getItem("shiperp_user_email") || "Unknown user";
    const rows = [
      ["Client", payload.clientName],
      ["Carrier", payload.carrierName || "Carrier not listed"],
      ["Already used on another plant", payload.alreadyUsed],
      ["Z-enhancements", payload.zEnhancements],
      ["Online / Offline", payload.onlineOrOffline],
      ["SAP Version", payload.sapVersion],
      ["ABAP Version", payload.abapVersion],
      ["Current ShipERP version", payload.shiperpVersion],
      ["SERPCAR usage", payload.serpcarUsage],
      ["Features", (payload.features || []).join(", ") || "None"],
      ["Systems", (payload.systemUsed || []).join(", ") || "None"],
      ["Shipment screens", (payload.shipmentScreens || []).join(", ") || "None"],
      ["Shipping FROM", (payload.shipFromLocation || []).join(", ") || "Not specified"],
      ["Shipping TO", (payload.shipToLocation || []).join(", ") || "Not specified"],
      ["Requested by", requestedBy],
      ["Generated at", new Date().toLocaleString()]
    ];
    const breakdownRows = (est.breakdown || []).map(item => `
      <tr>
        <td style="padding:8px;border:1px solid #d1d5db;">${escapeHtml(item.label)}</td>
        <td style="padding:8px;border:1px solid #d1d5db;text-align:right;">${escapeHtml(String(item.value))} h</td>
        <td style="padding:8px;border:1px solid #d1d5db;">${escapeHtml(item.note || "")}</td>
      </tr>`).join("");

    return `
      <div style="font-family:Arial,sans-serif;color:#111827;">
        <h2 style="margin-bottom:8px;">New Carrier Estimation</h2>
        <p style="margin-top:0;">A new internal estimation was submitted from the Portal.</p>
        <div style="margin:16px 0;padding:14px;border:1px solid #bbf7d0;background:#ecfdf5;border-radius:8px;">
          <div style="font-size:13px;color:#166534;">Total estimated effort</div>
          <div style="font-size:28px;font-weight:800;color:#166534;">${escapeHtml(String(est.total_effort))} hours</div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;"><tbody>
          ${rows.map(([k, v]) => `<tr><td style="padding:8px;border:1px solid #d1d5db;background:#f8fafc;font-weight:600;width:260px;">${escapeHtml(k)}</td><td style="padding:8px;border:1px solid #d1d5db;">${escapeHtml(v || "-")}</td></tr>`).join("")}
        </tbody></table>
        <h3 style="margin-bottom:8px;">Breakdown</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:8px;border:1px solid #d1d5db;text-align:left;">Rule</th>
              <th style="padding:8px;border:1px solid #d1d5db;text-align:right;">Hours</th>
              <th style="padding:8px;border:1px solid #d1d5db;text-align:left;">Note</th>
            </tr>
          </thead>
          <tbody>${breakdownRows}</tbody>
        </table>
        <p style="margin-top:20px;"><strong>SharePoint PDF:</strong><br><a href="${sharepointUrl}">Open estimation PDF in SharePoint</a></p>
      </div>`;
  }

  async function handleSaveAndDownload() {
    const data = await run();
    if (!data) return;
    const { payload, est } = data;
    const ts = Date.now();
    const fileName = `SOW_NewCarrier_${(payload.clientName || "Client").replace(/\s+/g, "_")}_${(payload.carrierName || "CarrierNotListed").replace(/\s+/g, "_")}_${ts}.pdf`;

    showStatus("Generating PDF, downloading, and uploading to SharePoint...");
    await createPdfForDownload(fileName);
    const pdfBase64 = await generateEstimatePdfBase64();
    const sharepointUrl = await uploadEstimatePdfToSharePoint(fileName, pdfBase64);
    const record = saveEstimationLocally(payload, est, sharepointUrl);
    $("savedEstimations").value = record.id;
    renderEstimateResult(payload, est, sharepointUrl);
    showStatus(`Saved locally, downloaded, and uploaded to SharePoint. <a href="${sharepointUrl}" target="_blank" rel="noopener noreferrer">Open PDF</a>`);
  }

  async function handleSendToSow() {
    const btn = $("btnSendSow");
    const data = await run();
    if (!data) return;
    const { payload, est } = data;
    try {
      if (btn) btn.disabled = true;
      showStatus("Ensuring SharePoint PDF exists and sending email to SOW team...");
      const { sharepointUrl, record } = await ensureSowSharepointUrl(payload, est);
      const subject = `SOW New Carrier Estimation | ${payload.clientName || "Unknown Client"} | ${payload.carrierName || "Carrier not listed"} | ${est.total_effort}h`;
      const messageHtml = buildEstimationEmailHtml(payload, est, sharepointUrl);
      await sendEmailViaEmailJS({
        subject,
        messageHtml,
        extraParams: {
          client: payload.clientName || "",
          carrier: payload.carrierName || "Carrier not listed",
          estimated_hours: String(est.total_effort || ""),
          requested_by: localStorage.getItem("shiperp_user_email") || "",
          quote_link: sharepointUrl
        }
      });
      if ($("savedEstimations")) $("savedEstimations").value = record.id;
      renderEstimateResult(payload, est, sharepointUrl);
      showStatus(`Email sent to sow@erp-is.com. <a href="${sharepointUrl}" target="_blank" rel="noopener noreferrer">Open PDF</a>`);
    } catch (err) {
      console.error(err);
      showStatus(`Error: ${escapeHtml(err.message || String(err))}`, true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyDefaultInputs();
    refreshSavedEstimationsDropdown();

    document.querySelectorAll('.checkbox-row input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', function() {
        this.closest('.checkbox-row')?.classList.toggle('checked', this.checked);
      });
    });

    $("btnCalc")?.addEventListener("click", async (e) => { e.preventDefault(); await run(); });
    $("btnSaveDownload")?.addEventListener("click", async (e) => {
      e.preventDefault();
      try { await handleSaveAndDownload(); }
      catch (err) {
        console.error(err);
        showStatus(`Error: ${escapeHtml(err.message || String(err))}`, true);
      }
    });
    $("btnSendSow")?.addEventListener("click", async (e) => { e.preventDefault(); await handleSendToSow(); });
    $("btnLoadEstimation")?.addEventListener("click", async () => {
      const id = $("savedEstimations")?.value;
      if (!id) return showStatus("Please select a saved estimation.", true);
      const record = loadEstimationById(id);
      if (!record) return showStatus("Saved estimation not found.", true);
      applyFormState(record.formState || {});
      await run();
      if (record.sharepointUrl) {
        const data = await run();
        if (data) renderEstimateResult(data.payload, data.est, record.sharepointUrl);
      }
      showStatus(`Loaded: ${record.label}${record.sharepointUrl ? ` - <a href="${record.sharepointUrl}" target="_blank" rel="noopener noreferrer">Open PDF</a>` : ""}`);
    });
  });
})();
