/* =========================================================================
   script_customer.js — Customer = Internal logic (as-is) + EmailJS
   -------------------------------------------------------------------------
   - N'utilise PAS de logique custom: appelle vos scripts internes tels quels
   - Intercepte displayResult(message) pour CAPTURER l'estimation
   - Conserve l'UX client : pas d'affichage, email compact (≤50KB)
   ========================================================================= */

const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // body: <html><body>{{{message_html}}}</body></html>
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com";
const SOW_DEBUG   = false; // true => logs

// --------- Q&A helpers (email compact) ----------
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
function renderBreakdownHTML(breakdown) {
  if (!breakdown) return "";
  let rows = "";
  if (Array.isArray(breakdown)) {
    rows = breakdown.map(row => {
      let label="", hours="", note="";
      if (Array.isArray(row)) { [label, hours, note] = row; }
      else if (row && typeof row === "object") {
        label = row.label ?? row.task ?? "";
        hours = row.hours ?? row.time ?? row.value ?? "";
        note  = row.note ?? row.comment ?? "";
      } else { label = String(row); }
      if (typeof hours === "number") hours = `${hours} h`;
      return `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${label || "-"}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${hours || "-"}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${note || ""}</td>
        </tr>`;
    }).join("");
  } else if (typeof breakdown === "object") {
    rows = Object.entries(breakdown).map(([k,v]) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${k}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${textOrArray(v)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;"></td>
      </tr>`).join("");
  }
  if (!rows) return "";
  return `
    <table style="border-collapse:collapse;width:100%;font:14px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:8px 0">
      <thead>
        <tr>
          <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #ddd;">Item</th>
          <th style="text-align:right;padding:6px 10px;border-bottom:2px solid #ddd;">Hours</th>
          <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #ddd;">Notes</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
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
function buildEmailHTML(formType, fields, est) {
  const who   = fields["Client Name"] || fields["Customer Name"] || fields["clientName"] || "-";
  const reply = fields["Your email address"] || fields["email"] || "-";
  const total =
    (est.hours != null || est.cost != null)
      ? `${est.hours ?? "?"} h${est.rate ? ` · $${est.cost ?? "?"} @ $${est.rate}/h` : ""}`
      : "N/A";
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">
      <h2 style="margin:0 0 6px 0;">SOW – ${formType}</h2>
      <p style="margin:4px 0;"><strong>Client:</strong> ${who}</p>
      <p style="margin:4px 0;"><strong>Reply-to:</strong> ${reply}</p>
      <p style="margin:4px 0;"><strong>Estimate (total):</strong> ${total}</p>
      ${renderBreakdownHTML(est.breakdown)}
      <h3 style="margin:12px 0 6px;">Preview (partial)</h3>
      ${answersTable(fields, 18)}
      <p style="margin:10px 0 0;color:#666;">(Attachments disabled to comply with EmailJS size limits.)</p>
    </div>`;
}

// --------- Capture du résultat interne ----------
/*
  Hypothèse (vérifiée sur ton code) :
  - les scripts internes appellent `displayResult("Estimated Effort: X hours")` après calcul
  - ou y passent un texte similaire
  On va monkeypatcher `window.displayResult` pour capter "X"
*/
function captureInternalEstimateOnce(invokeInternal) {
  return new Promise((resolve) => {
    const original = window.displayResult;
    let settled = false;

    window.displayResult = function (message) {
      try {
        if (SOW_DEBUG) console.log("[SOW] intercepted displayResult:", message);
        // Cherche un nombre d'heures dans le message
        // ex: "Estimated Effort: 56 hours"
        const m = String(message || "").match(/(-?\d+(?:\.\d+)?)\s*hour/i);
        const hours = m ? Math.round(parseFloat(m[1])) : null;
        if (!settled) {
          settled = true;
          // On restaure l'original sans jamais afficher au client
          window.displayResult = original;
          resolve({ hours, raw: String(message || "") });
        }
      } catch (e) {
        if (!settled) {
          settled = true;
          window.displayResult = original;
          resolve({ hours:null, raw:String(message||"") });
        }
      }
    };

    // Appelle la fonction interne qui déclenche le calcul
    try {
      const ret = invokeInternal();
      // si c'est async, on laisse displayResult résoudre. Sinon on met un garde-fou
      setTimeout(() => {
        if (!settled) {
          // Si jamais le script interne n'a pas appelé displayResult
          window.displayResult = original;
          resolve({ hours:null, raw:"(no displayResult called)" });
        }
      }, 8000);
      return ret;
    } catch (e) {
      window.displayResult = original;
      resolve({ hours:null, raw:"(internal threw)" });
    }
  });
}

// --------- Routeur : appelle la logique interne telle quelle ----------
async function computeFromInternal(type) {
  const t = String(type||"").toLowerCase();
  const rate = 180;

  if (t.includes("new") && t.includes("carrier")) {
    // La page interne New Carrier expose `window.submitEstimate()` qui:
    // - construit le payload
    // - fait le fetch API
    // - appelle displayResult("Estimated Effort: X hours") au retour
    const { hours } = await captureInternalEstimateOnce(() => {
      if (typeof window.submitEstimate === "function") {
        return window.submitEstimate();
      }
      throw new Error("submitEstimate() not found (load script_sow_new_carrier.js)");
    });
    const cost = hours != null ? hours * rate : null;
    return { hours, rate: hours!=null ? rate : null, cost, breakdown: null };
  }

  if (t.includes("rollout")) {
    const { hours } = await captureInternalEstimateOnce(() => {
      if (typeof window.calculateRollout === "function") return window.calculateRollout();
      if (typeof window.submitEstimate === "function")   return window.submitEstimate();
      throw new Error("rollout calculator not found (load script_sow_rollout.js)");
    });
    const cost = hours != null ? hours * rate : null;
    return { hours, rate: hours!=null ? rate : null, cost, breakdown: null };
  }

  if (t.includes("upgrade")) {
    const { hours } = await captureInternalEstimateOnce(() => {
      if (typeof window.calculateUpgrade === "function") return window.calculateUpgrade();
      if (typeof window.submitEstimate === "function")   return window.submitEstimate();
      throw new Error("upgrade calculator not found (load script_sow_upgrade.js)");
    });
    const cost = hours != null ? hours * rate : null;
    return { hours, rate: hours!=null ? rate : null, cost, breakdown: null };
  }

  // Other
  const { hours } = await captureInternalEstimateOnce(() => {
    if (typeof window.calculateOther === "function") return window.calculateOther();
    if (typeof window.submitEstimate === "function") return window.submitEstimate();
    throw new Error("other calculator not found (load script_sow.js)");
  });
  const cost = hours != null ? hours * rate : null;
  return { hours, rate: hours!=null ? rate : null, cost, breakdown: null };
}

// --------- EmailJS ----------
async function sendEmailJS({subject, html, est, toEmail}) {
  const payload = {
    service_id: SERVICE_ID,
    template_id: TEMPLATE_ID,
    user_id: USER_ID,
    template_params: {
      subject,
      to_email: toEmail || TO_EMAIL,
      message_html: html,
      estimate_hours: String(est.hours ?? ""),
      estimate_cost:  String(est.cost ?? ""),
      estimate_rate:  String(est.rate ?? "")
    }
  };
  if (SOW_DEBUG) console.log("[SOW] EmailJS payload:", payload);
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(await res.text());
}

// --------- Entrée bouton (UX client) ----------
window.submitCustomerForm = async function (formType) {
  const fields = collectFormFields();

  // 1) Calcul par la logique INTERNE (capturée via displayResult)
  const est = await computeFromInternal(formType);

  // 2) Email compact
  const subject = `SOW | ${formType} | ${fields["Client Name"] || fields["Customer Name"] || fields["clientName"] || ""}`;
  const html    = buildEmailHTML(formType, fields, est);

  if (SOW_DEBUG) console.log("[SOW] final estimate (from internal):", est);

  try {
    await sendEmailJS({ subject, html, est, toEmail: fields["email"] || fields["Your email address"] });
    alert("Your request has been sent to ShipERP!");
  } catch (e) {
    alert("Error sending email: " + e.message);
  }
};

/* ---- Mode test optionnel (pas d'email) ---- */
window.__SOW_TEST_MODE = window.__SOW_TEST_MODE ?? false;
if (window.__SOW_TEST_MODE) {
  // Monkeypatch: on bypass l'envoi
  const origSubmit = window.submitCustomerForm;
  window.submitCustomerForm = async function (formType) {
    const fields = collectFormFields();
    const est = await computeFromInternal(formType);
    if (SOW_DEBUG) console.log("[SOW][TEST] estimate only:", { formType, est, fields });
    // pas d'email dans ce mode
  };
}
