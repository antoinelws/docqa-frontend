(function () {
  const STORAGE_PREFIX = "sow_rollout_estimation:";
  const STORAGE_INDEX_KEY = "sow_rollout_estimation_index";

  const SOW_EMAILJS = {
    SERVICE_ID: "service_x8qqp19",
    TEMPLATE_ID: "template_7whkrog",
    USER_ID: "PuZpMq1o_LbVO4IMJ",
    TO_EMAIL: window.PORTAL_CONFIG?.email?.sowRecipient || "sow@erp-is.com"
  };

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

  function generateEstimationId(clientName) {
    const safeClient = String(clientName || "Rollout")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_]/g, "")
      .slice(0, 40);

    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${safeClient}_${todayISO()}_${rand}`;
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

  function applyDefaultInputs() {
    document.querySelectorAll("select").forEach(sel => {
      const anySelected = Array.from(sel.options).some(o => o.selected);
      if (!anySelected && sel.options.length) {
        sel.options[0].selected = true;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  const getVal = (idOrName) => {
    const byId = document.getElementById(idOrName);
    if (byId) return byId.value || "";
    const checked = document.querySelector(`input[name="${idOrName}"]:checked`);
    if (checked) return checked.value || "";
    const sel = document.querySelector(`select[name="${idOrName}"]`);
    if (sel) return sel.value || "";
    return "";
  };

  const getMulti = (idOrName) => {
    const el = document.getElementById(idOrName);
    if (el && el.tagName === "SELECT" && el.multiple) {
      return Array.from(el.selectedOptions).map(o => o.value);
    }
    const sel = document.querySelector(`select[name="${idOrName}"]`);
    if (sel && sel.multiple) {
      return Array.from(sel.selectedOptions).map(o => o.value);
    }
    return Array.from(document.querySelectorAll(`input[name="${idOrName}"]:checked`)).map(c => c.value);
  };

  const CARRIERS_LABEL_MAP = {
    "1 to 3": "1 to 3",
    "3 to 10": "3 to 10",
    "More than 10": "More than 10",
  };

  function normalizeCarriersLabel(label) {
    const key = String(label || "").trim();
    return CARRIERS_LABEL_MAP[key] || key;
  }

  function collectRolloutForm() {
    const siteCount = getVal("siteCount") || getVal("sites") || getVal("locationCount");
    const shipToRegion = getVal("shipToRegion") || getVal("region") || getVal("locationRegion");

    let modulesUsed = getMulti("modulesUsed");
    if (!modulesUsed.length) modulesUsed = getMulti("zEnhancementRollout");
    if (!modulesUsed.length) modulesUsed = getMulti("moduleUsed");
    if (!modulesUsed.length) modulesUsed = getMulti("shiperpModule");
    if (!modulesUsed.length) modulesUsed = getMulti("modules");
    if (!modulesUsed.length) modulesUsed = Array.from(document.querySelectorAll(".module-box:checked")).map(x => x.value);
    if (!modulesUsed.length) {
      const s = getVal("shiperpModule") || getVal("modules") || getVal("module");
      if (s) modulesUsed = s.split(/[;,]/).map(x => x.trim()).filter(Boolean);
    }
    modulesUsed = Array.from(new Set(modulesUsed.filter(Boolean)));

    const sameProcess = getVal("sameProcess") || getVal("blueprintNeeded") || getVal("sameRules") || getVal("sameAsExisting") || getVal("sameShipping");

    const carriersRaw = getVal("onlineCarriers") || getVal("carriers") || getVal("carriersCount") || getVal("onlineOfflineRollout");
    const onlineCarriers = normalizeCarriersLabel(carriersRaw);

    let blueprintNeeded = getVal("blueprintNeeded") || getVal("blueprint");
    if (!blueprintNeeded && sameProcess) {
      blueprintNeeded = sameProcess;
    }

    return {
      clientName: "Rollout Estimation",
      siteCount,
      shipToRegion,
      modulesUsed,
      features: modulesUsed.slice(),
      sameProcess,
      blueprintNeeded,
      blueprint_required: String(blueprintNeeded).toLowerCase() === "no",
      onlineCarriers
    };
  }

  function calculateLocalEstimate(payload) {
    const { siteCount, shipToRegion, blueprintNeeded, onlineCarriers, modulesUsed } = payload;

    if (blueprintNeeded === "No") {
      return {
        total_effort: 16,
        breakdown: "A 16 hours Blueprint/Workshop would be required",
        requiresBlueprint: true
      };
    }

    if (onlineCarriers !== "1 to 3") {
      return {
        total_effort: 99,
        breakdown: "Carriers count requires custom estimation",
        customEstimate: true
      };
    }

    let baseHours = 0;
    switch (siteCount) {
      case "Only 1":
        baseHours = 40;
        break;
      case "2 to 5":
        baseHours = 120;
        break;
      case "More than 5":
        baseHours = 200;
        break;
      default:
        baseHours = 99;
    }

    const regionHours = (shipToRegion === "US") ? 0 : 16;
    const moduleCount = modulesUsed ? modulesUsed.length : 0;
    const moduleHours = (moduleCount > 3) ? 40 : 0;
    const total = baseHours + regionHours + moduleHours;

    return {
      total_effort: total,
      breakdown: `Base hours (${siteCount}): ${baseHours}h + Region adjustment: ${regionHours}h + Module complexity (${moduleCount} modules): ${moduleHours}h`,
      baseHours,
      regionHours,
      moduleHours,
      moduleCount
    };
  }

  function collectFormState() {
    const form = $("rolloutForm");
    const state = {};
    if (!form) return state;

    const fields = form.querySelectorAll("input, select, textarea");
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
    const form = $("rolloutForm");
    if (!form || !state) return;

    Object.entries(state).forEach(([key, value]) => {
      const escapedKey = CSS.escape(key);
      const all = form.querySelectorAll(`#${escapedKey}, [name="${escapedKey}"]`);
      if (!all.length) return;

      all.forEach(el => {
        if (el.type === "checkbox") {
          el.checked = !!value;
          const row = el.closest(".checkbox-item");
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

  function renderEstimateResult(payload, est, sharepointUrl = "") {
    const resultBox = $("rolloutResultBox");
    if (!resultBox) return;

    const modules = (payload.modulesUsed || []).length ? payload.modulesUsed.join(", ") : "None";

    let accentBg = "#ecfdf5";
    let accentBorder = "#bbf7d0";
    let accentText = "#166534";
    let note = "";

    if (est.requiresBlueprint) {
      accentBg = "#fdf2f8";
      accentBorder = "#f9a8d4";
      accentText = "#9d174d";
      note = "Blueprint / Workshop required";
    } else if (est.customEstimate) {
      accentBg = "#fff7ed";
      accentBorder = "#fdba74";
      accentText = "#9a3412";
      note = "Custom estimation required";
    }

    resultBox.innerHTML = `
      <div class="estimate-card" style="width:100%;text-align:left;">
        <h3 style="margin-bottom:12px;color:#111827;">Rollout Estimation Result</h3>

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">
            <div style="font-size:12px;color:#64748b;">Locations in scope</div>
            <div style="font-weight:700;color:#111827;">${escapeHtml(payload.siteCount || "—")}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">
            <div style="font-size:12px;color:#64748b;">Region</div>
            <div style="font-weight:700;color:#111827;">${escapeHtml(payload.shipToRegion || "—")}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">
            <div style="font-size:12px;color:#64748b;">Same process as existing location</div>
            <div style="font-weight:700;color:#111827;">${escapeHtml(payload.blueprintNeeded || "—")}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;">
            <div style="font-size:12px;color:#64748b;">Carriers</div>
            <div style="font-weight:700;color:#111827;">${escapeHtml(payload.onlineCarriers || "—")}</div>
          </div>
        </div>

        <div style="background:${accentBg};border:1px solid ${accentBorder};border-radius:10px;padding:14px 16px;margin-bottom:16px;">
          <div style="font-size:13px;color:${accentText};">${escapeHtml(note || "Total estimated effort")}</div>
          <div style="font-size:28px;font-weight:800;color:${accentText};">${escapeHtml(String(est.total_effort))} hours</div>
        </div>

        <div style="margin-bottom:10px;font-size:14px;color:#374151;">
          <strong>Modules:</strong> ${escapeHtml(modules)}
        </div>
        <div style="margin-bottom:10px;font-size:14px;color:#374151;white-space:pre-line;">
          <strong>Breakdown:</strong> ${escapeHtml(est.breakdown || "")}
        </div>

        ${sharepointUrl ? `
          <div style="margin-top:12px;font-size:14px;">
            <strong>SharePoint PDF:</strong>
            <a href="${sharepointUrl}" target="_blank" rel="noopener noreferrer">${sharepointUrl}</a>
          </div>
        ` : ""}
      </div>
    `;

    resultBox.style.display = "block";
    resultBox.style.background = "#ffffff";
    resultBox.style.color = "#111827";
    resultBox.style.whiteSpace = "normal";
    resultBox.style.textAlign = "left";
  }

  async function run() {
    applyDefaultInputs();

    const resultBox = $("rolloutResultBox");
    if (!resultBox) return null;

    const payload = collectRolloutForm();

    try {
      const est = calculateLocalEstimate(payload);
      renderEstimateResult(payload, est);
      return { payload, est };
    } catch (err) {
      console.error(err);
      resultBox.textContent = `Error: ${err.message || err}`;
      resultBox.style.color = "red";
      return null;
    }
  }

  function saveEstimationLocally(payload, est, sharepointUrl = "") {
    const id = generateEstimationId("rollout");
    const label = `Rollout | ${payload.siteCount || "No scope"} | ${todayISO()}`;

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

  async function generateEstimatePdfBase64() {
    const element = document.querySelector(".container") || document.body;
    document.body.classList.add("pdf-export-mode");

    try {
      const canvas = await html2canvas(element, {
        scale: 1.2,
        scrollX: 0,
        scrollY: -window.scrollY,
        useCORS: true
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
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

      const blob = pdf.output("blob");
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result || "";
          resolve(String(result).split(",")[1] || "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      return { pdf, base64 };
    } finally {
      document.body.classList.remove("pdf-export-mode");
    }
  }

  async function uploadEstimatePdfToSharePoint(fileName, pdfBase64) {
    const res = await fetch("/api/upload-quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fileName,
        pdfBase64,
        category: "sow",
        estimationType: "rollout"
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "Failed to upload file to SharePoint");
    }

    return data.sharepointUrl || "";
  }

  async function ensureSowSharepointUrl(payload, est) {
    const fileName =
      `SOW_Rollout_${(payload.siteCount || "Scope").replace(/\s+/g, "_")}_${Date.now()}.pdf`;

    const { pdf, base64 } = await generateEstimatePdfBase64();
    const sharepointUrl = await uploadEstimatePdfToSharePoint(fileName, base64);

    return { pdf, sharepointUrl, fileName };
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

    if (!res.ok) {
      throw new Error(await res.text());
    }
  }

  function buildEstimationEmailHtml(payload, est, sharepointUrl) {
    const requestedBy = localStorage.getItem("shiperp_user_email") || "Unknown user";

    return `
      <div style="font-family:Arial,sans-serif;color:#111827;">
        <h2 style="margin-bottom:8px;">Rollout Estimation</h2>
        <p style="margin-top:0;">A rollout estimation was submitted from the Portal.</p>

        <div style="margin:16px 0;padding:14px;border:1px solid #bbf7d0;background:#ecfdf5;border-radius:8px;">
          <div style="font-size:13px;color:#166534;">Total estimated effort</div>
          <div style="font-size:28px;font-weight:800;color:#166534;">${escapeHtml(String(est.total_effort))} hours</div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tbody>
            <tr><td style="padding:8px;border:1px solid #d1d5db;background:#f8fafc;font-weight:600;">Locations in scope</td><td style="padding:8px;border:1px solid #d1d5db;">${escapeHtml(payload.siteCount || "—")}</td></tr>
            <tr><td style="padding:8px;border:1px solid #d1d5db;background:#f8fafc;font-weight:600;">Region</td><td style="padding:8px;border:1px solid #d1d5db;">${escapeHtml(payload.shipToRegion || "—")}</td></tr>
            <tr><td style="padding:8px;border:1px solid #d1d5db;background:#f8fafc;font-weight:600;">Same process</td><td style="padding:8px;border:1px solid #d1d5db;">${escapeHtml(payload.blueprintNeeded || "—")}</td></tr>
            <tr><td style="padding:8px;border:1px solid #d1d5db;background:#f8fafc;font-weight:600;">Carriers</td><td style="padding:8px;border:1px solid #d1d5db;">${escapeHtml(payload.onlineCarriers || "—")}</td></tr>
            <tr><td style="padding:8px;border:1px solid #d1d5db;background:#f8fafc;font-weight:600;">Modules</td><td style="padding:8px;border:1px solid #d1d5db;">${escapeHtml((payload.modulesUsed || []).join(", ") || "None")}</td></tr>
            <tr><td style="padding:8px;border:1px solid #d1d5db;background:#f8fafc;font-weight:600;">Requested by</td><td style="padding:8px;border:1px solid #d1d5db;">${escapeHtml(requestedBy)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #d1d5db;background:#f8fafc;font-weight:600;">Generated at</td><td style="padding:8px;border:1px solid #d1d5db;">${escapeHtml(new Date().toLocaleString())}</td></tr>
          </tbody>
        </table>

        <p style="white-space:pre-line;"><strong>Breakdown:</strong><br>${escapeHtml(est.breakdown || "")}</p>

        ${sharepointUrl ? `<p><strong>PDF link:</strong> <a href="${sharepointUrl}">${sharepointUrl}</a></p>` : ""}
      </div>
    `;
  }

  async function handleSaveAndDownload() {
    const data = await run();
    if (!data) return;

    const { payload, est } = data;

    showStatus("Generating PDF and uploading to SharePoint...");
    const { pdf, sharepointUrl } = await ensureSowSharepointUrl(payload, est);

    const downloadName =
      `SOW_Rollout_${(payload.siteCount || "Scope").replace(/\s+/g, "_")}_${Date.now()}.pdf`;

    pdf.save(downloadName);
    const record = saveEstimationLocally(payload, est, sharepointUrl);
    renderEstimateResult(payload, est, sharepointUrl);
    showStatus(`Saved locally, downloaded PDF, and uploaded to SharePoint. Record: ${record.label}`);
  }

  async function handleSendToSow() {
    const btn = $("btnSendSow");
    const data = await run();
    if (!data) return;

    const { payload, est } = data;

    try {
      if (btn) btn.disabled = true;
      showStatus("Generating SharePoint PDF and sending email...");

      const { sharepointUrl } = await ensureSowSharepointUrl(payload, est);
      const subject = `SOW Rollout Estimation | ${payload.siteCount || "Unknown Scope"} | ${est.total_effort}h`;
      const messageHtml = buildEstimationEmailHtml(payload, est, sharepointUrl);

      await sendEmailViaEmailJS({
        subject,
        messageHtml,
        extraParams: {
          client: "Rollout estimation",
          estimated_hours: String(est.total_effort || ""),
          requested_by: localStorage.getItem("shiperp_user_email") || "",
          quote_link: sharepointUrl || ""
        }
      });

      renderEstimateResult(payload, est, sharepointUrl);
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
      const data = await run();
      if (data) {
        renderEstimateResult(data.payload, data.est, record.sharepointUrl || "");
      }
      showStatus(`Loaded saved estimation: ${record.label}`);
    });
  }

  window.submitRolloutEstimate = run;

  document.addEventListener("DOMContentLoaded", () => {
    applyDefaultInputs();

    document.querySelectorAll('.checkbox-item input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', function () {
        const item = this.closest('.checkbox-item');
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

    $("rolloutForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await run();
    });

    setupSavedEstimations();
  });
})();
