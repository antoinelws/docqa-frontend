// script_customer.js — Parité 1:1 avec les pages internes (fetch intercept) + EmailJS
// - Pas de logique dupliquée: on appelle la même fonction interne que vos pages internes
// - Avant l'appel, on "synchronise" le DOM customer pour refléter ce que l'interne lit (hidden inputs si manquants)
// - On intercepte le fetch /estimate/* pour lire le payload VRAI et la réponse VRAIE (total_effort) => email identique

/* ===== EmailJS ===== */
const SERVICE_ID  = "service_x8qqp19";
const TEMPLATE_ID = "template_j3fkvg4"; // Body du template: <html><body>{{{message_html}}}</body></html>
const USER_ID     = "PuZpMq1o_LbVO4IMJ";
const TO_EMAIL    = "alauwens@erp-is.com";

/* ===== Debug ===== */
const SOW_DEBUG   = false;             // passe à true pour voir les payloads/retours
const NC_ENDPOINT = /\/estimate\/new_carrier$/i;

/* ===== Helpers ===== */
const $id = (x) => document.getElementById(x);
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

/* ============================================================
   SYNC DOM POUR PARITÉ (ajoute/remplit les champs que l'interne lit)
   ============================================================ */

/** New Carrier: s'assure que le DOM customer présente les mêmes signaux que l'interne */
function syncDomForNewCarrier() {
  // 1) featureInterest (souvent un <select> côté interne)
  //    - si absent côté customer, on le crée en hidden
  //    - valeur = priorité aux cases cochées "features", sinon déduit de l'écran "Small Parcel"
  let fi = $id("featureInterest");
  if (!fi) {
    fi = document.createElement("input");
    fi.type = "hidden";
    fi.id   = "featureInterest";
    document.body.appendChild(fi);
  }
  // déduction features -> featureInterest
  const featuresChecked = Array.from(document.querySelectorAll("input.feature-box:checked, input[name='features']:checked"))
    .map(el=>String(el.value).trim());
  const hasShippingLabeling = featuresChecked.includes("Shipping & Labeling");

  const hasSmallParcelScreen =
    ($id("screen_smallparcel") && $id("screen_smallparcel").checked) ||
    Array.from(document.querySelectorAll("input[value='Small Parcel Screen']")).some(el => el.checked);

  if (hasShippingLabeling) {
    fi.value = "Shipping & Labeling";
  } else if (hasSmallParcelScreen) {
    // règle interne typique: Small Parcel -> Shipping & Labeling
    fi.value = "Shipping & Labeling";
  } else if (featuresChecked.length) {
    // sinon, prend la 1ère feature cochée
    fi.value = featuresChecked[0];
  } else {
    fi.value = ""; // pas d'inférence si rien n'est choisi
  }

  // 2) zEnhancements / shipToVolume: l'interne lit souvent la valeur brute du select
  //    s'il n'y a pas de select numérique, on laisse les libellés ("Less than 10", etc.)
  const zSel = $id("zEnhancements") || document.querySelector("[name='zEnhancements']");
  if (!zSel) {
    // si vraiment absent, on crée un hidden pour éviter un undefined côté interne
    const z = document.createElement("input");
    z.type = "hidden"; z.id = "zEnhancements"; z.value = "I'm not sure";
    document.body.appendChild(z);
  }

  // 3) resultBox: certaines internes écrivent dedans -> on met un div caché
  if (!$id("resultBox")) {
    const rb = document.createElement("div");
    rb.id = "resultBox";
    rb.style.cssText = "visibility:hidden;height:0;overflow:hidden;";
    document.body.appendChild(rb);
  }
}

/** (optionnel) Rollout / Upgrade / Other: ajoute juste un resultBox caché */
function ensureResultBox() {
  if (!$id("resultBox")) {
    const rb = document.createElement("div");
    rb.id = "resultBox";
    rb.style.cssText = "visibility:hidden;height:0;overflow:hidden;";
    document.body.appendChild(rb);
  }
}

/* ============================================================
   CAPTURE displayResult (secours) + INTERCEPT FETCH (source fiable)
   ============================================================ */

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

/** Exécute la fonction interne et intercepte la requête/réponse réelle (New Carrier) */
async function runInternalNewCarrierAndIntercept() {
  // 0) aligner le DOM customer sur ce que lit l'interne
  syncDomForNewCarrier();

  // 1) wrap fetch
  const origFetch = window.fetch;
  let capturedBody = null;
  let capturedResponseText = null;

  window.fetch = async function(input, init) {
    const url = (typeof input === "string") ? input : (input?.url || "");
    const match = NC_ENDPOINT.test(url);
    if (match) {
      try {
        capturedBody = init?.body ? JSON.parse(init.body) : null;
        if (SOW_DEBUG) console.log("[SOW][NC] request body:", capturedBody);
      } catch (e) {
        if (SOW_DEBUG) console.warn("[SOW][NC] body parse error:", e);
      }
    }
    const res = await origFetch.apply(this, arguments);
    if (match) {
      try {
        const clone = res.clone();
        capturedResponseText = await clone.text();
        if (SOW_DEBUG) console.log("[SOW][NC] raw response:", capturedResponseText);
      } catch (e) {
        if (SOW_DEBUG) console.warn("[SOW][NC] response read error:", e);
      }
    }
    return res;
  };

  // 2) appeler la même fonction interne que la page interne
  const internalFns = [
    "submitEstimateNewCarrier",
    "calculateNewCarrier",
    "estimateNewCarrier",
    "submitEstimate" // nom générique dans pas mal de builds
  ];
  const fn = internalFns.map(n => window[n]).find(f => typeof f === "function");
  if (!fn) {
    window.fetch = origFetch;
    throw new Error("Internal New Carrier function not found. Load script_sow_new_carrier.js before this script.");
  }

  // on capture aussi displayResult (secours si la réponse n'est pas JSON)
  const drPromise = captureDisplayResultOnce(() => fn());

  // 3) attendre la réponse
  const start = Date.now();
  while (!capturedResponseText && Date.now() - start < 15000) {
    await new Promise(r => setTimeout(r, 100));
  }

  // 4) restore fetch
  window.fetch = origFetch;

  // 5) préférer total_effort depuis la réponse JSON
  let hoursText = null;
  if (capturedResponseText) {
    try {
      const j = JSON.parse(capturedResponseText);
      if (typeof j.total_effort !== "undefined") hoursText = `${j.total_effort} hours`;
      if (SOW_DEBUG) console.log("[SOW][NC] parsed:", j);
    } catch {}
  }

  // sinon, fallback displayResult intercepté
  if (!hoursText) {
    const drText = await drPromise;
    hoursText = parseEstimateText(drText) || "N/A";
  }

  if (SOW_DEBUG) {
    console.log("[SOW][NC] FINAL hoursText:", hoursText);
    console.log("[SOW][NC] FINAL request body (seen by backend):", capturedBody);
  }

  return hoursText || "N/A";
}

/** Rollout/Upgrade/Other: réutiliser l'interne (displayResult) */
async function runInternalByTypeAndCapture(formType) {
  ensureResultBox();
  const t = String(formType||"").toLowerCase();
  const candidates =
    t.includes("rollout") ? ["submitEstimateRollout","calculateRollout","estimateRollout","submitEstimate"] :
    t.includes("upgrade") ? ["submitEstimateUpgrade","calculateUpgrade","estimateUpgrade","submitEstimate"] :
                            ["submitEstimateOther","calculateOther","estimateOther","submitEstimate"];

  const fn = candidates.map(n => window[n]).find(f => typeof f === "function");
  if (!fn) return "N/A";
  const raw = await captureDisplayResultOnce(() => fn());
  return parseEstimateText(raw) || "N/A";
}

/* ============================================================
   Router calcul
   ============================================================ */
async function computeEstimateText(formType) {
  const t = String(formType||"").toLowerCase();

  if (t.includes("new") && t.includes("carrier")) {
    return await runInternalNewCarrierAndIntercept();
  }
  return await runInternalByTypeAndCapture(formType);
}

/* ============================================================
   EmailJS
   ============================================================ */
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

/* ============================================================
   Entrée bouton
   ============================================================ */
window.submitCustomerForm = async function (formType) {
  const fields = collectFormFields();

  let estimateText = "N/A";
  try {
    estimateText = await computeEstimateText(formType);
  } catch (e) {
    if (SOW_DEBUG) console.error("[SOW] compute failed:", e);
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
