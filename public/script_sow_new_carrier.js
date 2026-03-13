(() => {
  const STORAGE_PREFIX = "sow_new_carrier_estimation:";
  const STORAGE_INDEX_KEY = "sow_new_carrier_estimation_index";

  const SOW_EMAILJS = {
    SERVICE_ID: "service_x8qqp19",
    TEMPLATE_ID: "template_7whkrog",
    USER_ID: "PuZpMq1o_LbVO4IMJ",
    TO_EMAIL: "sow@erp-is.com"
  };

  // ---------- Helpers ----------
  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function showStatus(message, isError = false) {
    const el = $("actionStatus");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    el.style.background = isError ? "#fef2f2" : "#f8fafc";
    el.style.color = isError ? "#b91c1c" : "#475569";
    el.style.border = isError ? "1px solid #fecaca" : "1px solid #e2e8f0";
  }

  function cleanList(values) {
    return (values || [])
      .map(v => String(v || "").trim())
      .filter(Boolean);
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

  function generateEstimationId(clientName, carrierName) {
    const safeClient = String(clientName || "NoClient")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_]/g, "")
      .slice(0, 30);

    const safeCarrier = String(carrierName || "NoCarrier")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_]/g, "")
      .slice(0, 30);

    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${safeClient}_${safeCarrier}_${todayISO()}_${rand}`;
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

  // ---------- Defaults ----------
  function applyDefaultInputs() {
    // placeholder if later needed
  }

  // ---------- Form collection ----------
  function collectNewCarrierForm() {
    const features = cleanList(getMultiChecked("features"));
    const systemsUsedNorm = cleanList(getMultiChecked("systems"));
    const shipmentScreens = cleanList(getMultiChecked("screens"));

    let shipFormLocation = Array.from($("shipFrom")?.selectedOptions || []).map(o => o.value);
    if (!shipFormLocation.length && $("shipFrom")?.value) {
      shipFormLocation = [String($("shipFrom").value)];
    }
    shipFormLocation = cleanList(shipFormLocation);

    let shipToLocation = Array.from($("shipTo")?.selectedOptions || []).map(o => o.value);
    if (!shipToLocation.length && $("shipTo")?.value) {
      shipToLocation = [String($("shipTo").value)];
    }
    shipToLocation = cleanList(shipToLocation);

    const shipmentScreenString = shipmentScreens.join(", ");

    return {
      clientName: $("clientName")?.value || "",
      carrierName: $("carrierName")?.value || "",
      carrierOther: $("carrierOther")?.value || "",
      alreadyUsed: $("alreadyUsed")?.value || "",
      zEnhancements: $("zEnhancements")?.value || "",
      onlineOrOffline: $("onlineOrOffline")?.value || "",
      sapVersion: $("sapVersion")?.value || "",
      abapVersion: $("abapVersion")?.value || "",
      shiperpVersion: $("shiperpVersion")?.value || "",
      serpcarUsage: $("serpcarUsage")?.value || "",
      features,
      systemsUsed: systemsUsedNorm,
      systems: systemsUsedNorm,
      systemUsed: systemsUsedNorm,
      whichSystem: systemsUsedNorm.join(", "),
      system: systemsUsedNorm[0] || "",
      systemsCount: systemsUsedNorm.length,
      shipFrom: shipFormLocation,
      shipTo: shipToLocation,
      shipFormLocation,
      shipFromLocation: shipFormLocation,
      shipFromLocations: shipFormLocation,
      fromLocation: shipFormLocation,
      shipToLocation,
      shipToLocations: shipToLocation,
      toLocation: shipToLocation,
      shipmentScreens,
      shipmentScreenString
    };
  }

  function collectFormState() {
    const form = $("formNewCarrierInternal");
    const fields = form.querySelectorAll("input, select, textarea");
    const state = {};

    fields.forEach(el => {
      const key = el.id || el.name;
      if (!key) return;

      if (el.type === "checkbox") {
        state[key] = el.checked;
      } else if (el.type === "radio") {
        if (el.checked) state[key] = el.value;
      } else {
        state[key] = el.value;
      }
    });

    return state;
  }

  function applyFormState(state) {
    const form = $("formNewCarrierInternal");
    if (!form || !state) return;

    Object.entries(state).forEach(([key, value]) => {
      const escapedKey = CSS.escape(key);
      const all = form.querySelectorAll(`#${escapedKey}, [name="${escapedKey}"]`);
      if (!all.length) return;

      all.forEach(el => {
        if (el.type === "checkbox") {
          el.checked = !!value;
          const row = el.closest(".checkbox-row");
          row?.classList.toggle("checked", !!value);
        } else if (el.type === "radio") {
          el.checked = el.value === value;
        } else {
          el.value = value ?? "";
        }

        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  // ---------- Estimate ----------
  function computeInternalEstimate(payload) {
    let hours = 0;
    const breakdown = [];

    function addPart(label, value, note) {
      breakdown.push({ label, value, note });
      hours += value;
    }

    const carrierName = (payload.carrierName || "").trim();
    if (carrierName) {
      addPart("Carrier base (listed in dropdown)", 60, carrierName);
    } else {
      addPart("Carrier base (not listed)", 40, "No carrier selected in dropdown");
    }

    const alreadyUsed = (payload.alreadyUsed || "").trim();
    if (alreadyUsed === "Yes") {
      addPart("Already used with ShipERP on another plant", -16, "Answer: Yes");
    } else {
      addPart("Already used with ShipERP on another plant", 0, `Answer: ${alreadyUsed || "No/I do not know"}`);
    }

    const onlineOrOffline = (payload.onlineOrOffline || "").trim();
    if (onlineOrOffline === "Offline") {
      addPart("Online vs Offline", -32, "Offline");
    } else {
      addPart("Online vs Offline", 0, onlineOrOffline || "Online / I do not know");
    }

    const zEnhancements = (payload.zEnhancements || "").trim();
    if (zEnhancements === "Between 10 and 50") {
      addPart("Z-Enhancements (10-50)", 16, zEnhancements);
    } else if (zEnhancements === "More than 50") {
      addPart("Z-Enhancements (more than 50)", 32, zEnhancements);
    } else if (zEnhancements === "I'm not sure") {
      addPart("Z-Enhancements (uncertain)", 8, zEnhancements);
    } else {
      addPart("Z-Enhancements (less than 10)", 0, zEnhancements || "Less than 10");
    }

    const features = Array.isArray(payload.features) ? payload.features : [];
    if (features.length > 3) {
      addPart("Features used (more than 3)", 16, `${features.length} selected`);
    } else {
      addPart("Features used (3 or fewer)", 0, `${features.length} selected`);
    }

    const systems = Array.isArray(payload.systemUsed) ? payload.systemUsed : [];
    if (systems.length > 1) {
      addPart("Systems used (more than 1)", 16, systems.join(", ") || "None");
    } else {
      addPart("Systems used (1 or 0)", 0, systems.join(", ") || "None");
    }

    const shiperpVersion = (payload.shiperpVersion || "").trim();
    if (shiperpVersion === "Between 3.6 and 3.9") {
      addPart("ShipERP version impact", 8, shiperpVersion);
    } else if (shiperpVersion === "Lower than 3.6") {
      addPart("ShipERP version impact", 12, shiperpVersion);
    } else {
      addPart("ShipERP version impact", 0, shiperpVersion || "Above 4.5 / Between 4.0 and 4.5");
    }

    const screens = Array.isArray(payload.shipmentScreens) ? payload.shipmentScreens : [];
    if (screens.length > 1) {
      addPart("Screens used (more than 1)", 8, screens.join(", ") || "None");
    } else {
      addPart("Screens used (1 or 0)", 0, screens.join(", ") || "None");
    }

    const serpcarUsage = (payload.serpcarUsage || "").trim();
    if (serpcarUsage === "Yes") {
      addPart("SERPCAR carrier usage", -16, "Answer: Yes");
    } else {
      addPart("SERPCAR carrier usage", 0, `Answer: ${serpcarUsage || "No/I do not know"}`);
    }

    const shipFrom = Array.isArray(payload.shipFromLocation) ? payload.shipFromLocation : [];
    const hasNonUSFrom = shipFrom.some(loc => loc !== "US" && String(loc).trim() !== "");
    if (hasNonUSFrom) {
      addPart("Shipping FROM (non-US location)", 8, shipFrom.join(", "));
    } else {
      addPart("Shipping FROM (US or not specified)", 0, shipFrom.join(", ") || "Not specified");
    }

    const shipTo = Array.isArray(payload.shipToLocation) ? payload.shipToLocation : [];
    const hasNonUSTo = shipTo.some(loc => loc !== "US" && String(loc).trim() !== "");
    if (hasNonUSTo) {
      addPart("Shipping TO (non-US location)", 8, shipTo.join(", "));
    } else {
      addPart("Shipping TO (US or not specified)", 0, shipTo.join(", ") || "Not specified");
    }

    return { total_effort: hours, breakdown };
  }

  // ---------- Validation ----------
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
      const list = Object.values(errors).map(msg => `<li>${escapeHtml(msg)}</li>`).join("");
      summary.innerHTML = `<strong>Please fix the following:</strong><ul>${list}</ul>`;
      summary.style.display = "block";
    }

    if (errors.clientName) {
      $("field-clientName")?.classList.add("has-error");
      const errEl = document.querySelector('[data-error-for="clientName"]');
      if (errEl) errEl.textContent = errors.clientName;
    }
    if (errors.sapVersion) {
      $("field-sapVersion")?.classList.add("has-error");
      const errEl = document.querySelector('[data-error-for="sapVersion"]');
      if (errEl) errEl.textContent = errors.sapVersion;
    }
    if (errors.abapVersion) {
      $("field-abapVersion")?.classList.add("has-error");
      const errEl = document.querySelector('[data-error-for="abapVersion"]');
      if (errEl) errEl.textContent = errors.abapVersion;
    }
    if (errors.systems) {
      $("field-systems")?.classList.add("has-error");
      const errEl = document.querySelector('[data-error-for="systems"]');
      if (errEl) errEl.textContent = errors.systems;
    }
    if (errors.screens) {
      $("field-screens")?.classList.add("has-error");
      const errEl = document.querySelector('[data-error-for="screens"]');
      if (errEl) errEl.textContent = errors.screens;
    }
  }

  function validateNewCarrier(payload) {
    const errors = {};

    if (!payload.clientName) {
      errors.clientName = "Client Name is required.";
    }
    if (!payload.sapVersion || !payload.sapVersion.trim()) {
      errors.sapVersion = "SAP Version is required.";
    }
    if (!payload.abapVersion || !payload.abapVersion.trim()) {
      errors.abapVersion = "ABAP Version is required.";
    }
    const systems = Array.isArray(payload.systemUsed) ? payload.systemUsed : [];
    if (!systems.length) {
      errors.systems = "Select at least one system.";
    }
    const screens = Array.isArray(payload.shipmentScreens) ? payload.shipmentScreens : [];
    if (!screens.length) {
      errors.screens = "Select at least one screen used to create shipment.";
    }

    return errors;
  }

  // ---------- Rendering ----------
  function renderEstimateResult(payload, est) {
    const resultBox = $("resultBox");
    if (!resultBox) return;

    const breakdownRows = (est.breakdown || [])
      .map(item => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:left;">${escapeHtml(item.label)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(String(item.value))} h</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:left;">${escapeHtml(item.note || "")}</td>
        </tr>
      `)
      .join("");

    resultBox.innerHTML = `
      <div class="estimate-card" style="width:100%;text-align:left;">
        <h3 style="margin-bottom:12px;color:#111827;">Estimation Result</h3>

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">
            <div style="font-size:12px;color:#64748b;">Client</div>
            <div style="font-weight:700;color:#111827;">${escapeHtml(payload.clientName || "—")}</div>
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
      </div>
    `;

    resultBox.style.display = "block";
    resultBox.classList.add("show");
    resultBox.style.color = "#111827";
    resultBox.style.background = "#ffffff";
    resultBox.style.textAlign = "left";
  }

  // ---------- Main run ----------
  async function run() {
    applyDefaultInputs();
    clearValidationUI();

    const resultBox = $("resultBox");
    if (!resultBox) return null;

    const payload = collectNewCarrierForm();
    const errors = validateNewCarrier(payload);

    if (Object.keys(errors).length) {
      showValidationErrors(errors);
      resultBox.style.display = "none";
      return null;
    }

    try {
      const est = computeInternalEstimate(payload);
      renderEstimateResult(payload, est);
      return { payload, est };
    } catch (err) {
      console.error(err);
      resultBox.textContent = `Calculation error: ${err.message || err}`;
      resultBox.style.display = "block";
      resultBox.style.color = "#b91c1c";
      return null;
    }
  }

  // ---------- Local save ----------
  function saveEstimationLocally(payload, est) {
    const carrierLabel = payload.carrierName || "Carrier not listed";
    const id = generateEstimationId(payload.clientName, carrierLabel);
    const label = `${payload.clientName || "No client"} | ${carrierLabel} | ${todayISO()}`;

    const record = {
      id,
      label,
      savedAt: new Date().toISOString(),
      formState: collectFormState(),
      estimateResult: est
    };

    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(record));

    const index = loadIndex();
    index.unshift({ id, label, savedAt: record.savedAt });
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

  // ---------- PDF ----------
  async function generateEstimatePdf(filename = "ShipERP_New_Carrier_Estimation.pdf") {
    const element = document.querySelector(".container") || document.body;
    document.body.classList.add("pdf-export-mode");

    try {
      const canvas = await html2canvas(element, {
        scale: 1.2,
        scrollX: 0,
        scrollY: -window.scrollY,
        useCORS: true
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.9);
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
        pdf.addPage();
        position -= pageHeight;
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(filename);
    } finally {
      document.body.classList.remove("pdf-export-mode");
    }
  }

  // ---------- Email ----------
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

    if (!res.ok) {
      throw new Error(await res.text());
    }
  }

  function buildEstimationEmailHtml(payload, est) {
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

    const breakdownRows = (est.breakdown || [])
      .map(item => `
        <tr>
          <td style="padding:8px;border:1px solid #d1d5db;">${escapeHtml(item.label)}</td>
          <td style="padding:8px;border:1px solid #d1d5db;text-align:right;">${escapeHtml(String(item.value))} h</td>
          <td style="padding:8px;border:1px solid #d1d5db;">${escapeHtml(item.note || "")}</td>
        </tr>
      `)
      .join("");

    return `
      <div style="font-family:Arial,sans-serif;color:#111827;">
        <h2 style="margin-bottom:8px;">New Carrier Estimation</h2>
        <p style="margin-top:0;">A new internal estimation was submitted from the Portal.</p>

        <div style="margin:16px 0;padding:14px;border:1px solid #bbf7d0;background:#ecfdf5;border-radius:8px;">
          <div style="font-size:13px;color:#166534;">Total estimated effort</div>
          <div style="font-size:28px;font-weight:800;color:#166534;">${escapeHtml(String(est.total_effort))} hours</div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tbody>
            ${rows.map(([k, v]) => `
              <tr>
                <td style="padding:8px;border:1px solid #d1d5db;background:#f8fafc;font-weight:600;width:260px;">${escapeHtml(k)}</td>
                <td style="padding:8px;border:1px solid #d1d5db;">${escapeHtml(v || "—")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <h3 style="margin-bottom:8px;">Breakdown</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:8px;border:1px solid #d1d5db;text-align:left;">Rule</th>
              <th style="padding:8px;border:1px solid #d1d5db;text-align:right;">Hours</th>
              <th style="padding:8px;border:1px solid #d1d5db;text-align:left;">Note</th>
            </tr>
          </thead>
          <tbody>${breakdownRows}</tbody>
        </table>
      </div>
    `;
  }

  async function sendToSowTeam(payload, est) {
    const subject = `New Carrier Estimation | ${payload.clientName || "Unknown Client"} | ${payload.carrierName || "Carrier not listed"} | ${est.total_effort}h`;
    const messageHtml = buildEstimationEmailHtml(payload, est);

    await sendEmailViaEmailJS({
      subject,
      messageHtml,
      extraParams: {
        client: payload.clientName || "",
        carrier: payload.carrierName || "Carrier not listed",
        estimated_hours: String(est.total_effort || ""),
        requested_by: localStorage.getItem("shiperp_user_email") || ""
      }
    });
  }

  // ---------- Actions ----------
  async function handleSaveAndDownload() {
    const data = await run();
    if (!data) return;

    const { payload, est } = data;
    const record = saveEstimationLocally(payload, est);

    const fileName =
      `NewCarrier_${(payload.clientName || "Client").replace(/\s+/g, "_")}_` +
      `${(payload.carrierName || "CarrierNotListed").replace(/\s+/g, "_")}_` +
      `${Date.now()}.pdf`;

    await generateEstimatePdf(fileName);
    showStatus(`Saved locally and downloaded PDF. Record: ${record.label}`);
  }

  async function handleSendToSow() {
    const btn = $("btnSendSow");
    const data = await run();
    if (!data) return;

    const { payload, est } = data;

    try {
      if (btn) btn.disabled = true;
      showStatus("Sending email to SOW team...");
      await sendToSowTeam(payload, est);
      showStatus("Email sent to sow@erp-is.com.");
    } catch (err) {
      console.error(err);
      showStatus(`Error sending email: ${err.message || err}`, true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function setupSavedEstimations() {
    refreshSavedEstimationsDropdown();

    $("btnLoadEstimation")?.addEventListener("click", async () => {
      const id = $("savedEstimations")?.value;
      if (!id) {
        showStatus("Please select a saved estimation to load.", true);
        return;
      }

      const record = loadEstimationById(id);
      if (!record) {
        showStatus("Saved estimation not found.", true);
        return;
      }

      applyFormState(record.formState || {});
      await run();
      showStatus(`Loaded saved estimation: ${record.label}`);
    });
  }

  // ---------- Expose ----------
  window.submitCarrierEstimate = run;
  window.submitNewCarrierEstimate = run;

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", () => {
    applyDefaultInputs();

    document.querySelectorAll('.checkbox-row input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', function () {
        const item = this.closest('.checkbox-row');
        item?.classList.toggle('checked', this.checked);
      });
    });

    $("btnCalc")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await run();
    });

    $("btnSaveDownload")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await handleSaveAndDownload();
    });

    $("btnSendSow")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await handleSendToSow();
    });

    $("formNewCarrierInternal")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await run();
    });

    setupSavedEstimations();
  });
})();
