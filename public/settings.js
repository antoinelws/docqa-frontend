(async function () {
  const editor = document.getElementById("editor");
  const file = document.getElementById("file");
  const saveBtn = document.getElementById("save");
  const loadDef = document.getElementById("loadDefaults");
  const dlBtn = document.getElementById("download");
  const lockBtn = document.getElementById("lockBtn");
  const passInput = document.getElementById("pass");

  // ---- Parity helpers -------------------------------------------------------
  // Only these keys are allowed. Unknown keys are stripped before save.
  const ALLOWED = {
    ui: { rangeFactor: { low: "number", high: "number" } },
    newCarrier: { forceOnlineOffline: ["null","Online","Offline"], fixOnlineSign: "boolean" },
    aliases: {
      rollout: { siteCount: "object", shipToRegion: "object", blueprintNeeded: "object" },
      upgrade: { shiperpVersion: "object", zenhancements: "object", onlineCarriers: "object", ewmUsage: "object" }
    },
    rollout: {
      baseHours: "objectNumMap",
      regionExtra: "objectNumMap",
      blueprintHours: "number"
    },
    upgrade: {
      versionWeights: "objectNumMap",
      zEnhancementsWeights: "objectNumMap",
      onlineCarriersWeights: "objectNumMap",
      ewmWeight: "number",
      modulesThreshold: "number",
      modulesExtra: "number",
      baseEffort: "number",
      integrationBase: "number",
      integrationCoeff: "number",
      testingBase: "number",
      testingCoeff: "number",
      training: "number",
      documentation: "number",
      coreFactor: "number"
    },
    customerEmail: { to: "string", templateId: "string", serviceId: "string", userId: "string" }
  };

  function isPlainObject(v){ return v && typeof v === "object" && !Array.isArray(v); }
  function isNum(n){ return typeof n === "number" && isFinite(n); }
  function ensureNumMap(obj, name){
    if (!isPlainObject(obj)) throw new Error(`${name} must be an object of numbers`);
    for (const [k,v] of Object.entries(obj)) if (!isNum(v)) throw new Error(`${name}["${k}"] must be a number`);
    return obj;
  }

  function pick(obj, spec, path = "") {
    if (!isPlainObject(spec)) return undefined;
    const out = {};
    for (const [key, type] of Object.entries(spec)) {
      const val = obj?.[key];
      const curPath = path ? `${path}.${key}` : key;
      if (val === undefined) continue;

      if (type === "number") {
        if (!isNum(val)) throw new Error(`${curPath} must be a number`);
        out[key] = val;
      } else if (type === "string") {
        if (typeof val !== "string") throw new Error(`${curPath} must be a string`);
        out[key] = val;
      } else if (type === "boolean") {
        if (typeof val !== "boolean") throw new Error(`${curPath} must be a boolean`);
        out[key] = val;
      } else if (type === "object") {
        if (!isPlainObject(val)) throw new Error(`${curPath} must be an object`);
        out[key] = val; // free-form object (aliases only)
      } else if (type === "objectNumMap") {
        out[key] = ensureNumMap(val, curPath);
      } else if (Array.isArray(type)) {
        // enum
        if (val === null && type.includes("null")) { out[key] = null; }
        else if (type.includes(String(val))) { out[key] = val; }
        else throw new Error(`${curPath} must be one of: ${type.join(", ")}`);
      } else if (isPlainObject(type)) {
        out[key] = pick(val, type, curPath);
      }
    }
    return out;
  }

  function withMeta(cfg) {
    const stamp = new Date().toISOString();
    const src = JSON.stringify(cfg);
    // simple checksum
    let sum = 0; for (let i=0;i<src.length;i++) sum = (sum + src.charCodeAt(i)) % 65536;
    return Object.assign({}, cfg, { __meta: { version: 1, savedAt: stamp, checksum: sum } });
  }

  function sanitizeConfig(raw){
    const cleaned = pick(raw, ALLOWED);
    if (!cleaned) throw new Error("Configuration is empty or invalid.");
    // sanity: range bounds
    if (cleaned.ui?.rangeFactor) {
      const { low, high } = cleaned.ui.rangeFactor;
      if (!(low < 1 && high > 1 && low > 0 && high > 0)) {
        throw new Error("ui.rangeFactor.low must be < 1 and high must be > 1");
      }
    }
    return withMeta(cleaned);
  }

  // ---- Lock UI (lightweight deterrent only) ---------------------------------
  let locked = false;
  function setLocked(state) {
    locked = state;
    editor.disabled = locked;
    saveBtn.disabled = locked;
    file.disabled = locked;
    dlBtn.disabled = locked;
    loadDef.disabled = locked;
    lockBtn.textContent = locked ? "Unlock" : "Lock";
  }

  lockBtn.onclick = () => {
    if (!locked) {
      const v = passInput.value.trim();
      if (!v) { alert("Set a passphrase first."); return; }
      sessionStorage.setItem("sow_settings_lock", v);
      setLocked(true);
    } else {
      const v = prompt("Enter passphrase to unlock:");
      if (v === sessionStorage.getItem("sow_settings_lock")) setLocked(false);
      else alert("Wrong passphrase.");
    }
  };

  // ---- Load current (merged) config and show it ------------------------------
  const cfg = await SOWCFG.get();
  editor.value = JSON.stringify(cfg, null, 2);

  // ---- Save (validate + whitelist) ------------------------------------------
  const channel = "sowcfg_broadcast_v1";
  const bc = ("BroadcastChannel" in window) ? new BroadcastChannel(channel) : null;

  saveBtn.onclick = () => {
    try {
      const raw = JSON.parse(editor.value);
      const clean = sanitizeConfig(raw);
      // Save only the sanitized, whitelisted object:
      SOWCFG.setLocalOverride(clean);
      alert("Saved to localStorage (sanitized). Forms will use this after reload.");
      bc?.postMessage({ type: "config-updated" });
    } catch (e) {
      console.error(e);
      alert("Invalid config: " + e.message);
    }
  };

  // ---- Load defaults into editor (without saving) ----------------------------
  loadDef.onclick = async () => {
    const res = await fetch("sow_config.defaults.json", { cache: "no-store" });
    const def = await res.json();
    editor.value = JSON.stringify(def, null, 2);
  };

  // ---- Download current editor content --------------------------------------
  dlBtn.onclick = () => {
    const blob = new Blob([editor.value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "sow_config.json" });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  // ---- Import file into editor (without saving) ------------------------------
  file.onchange = () => {
    const f = file.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { editor.value = r.result; };
    r.readAsText(f);
  };

  // Optional: other tabs auto-reload after a save
  bc?.addEventListener?.("message", (ev) => {
    if (ev?.data?.type === "config-updated") {
      console.log("[SOWCFG] detected update from another tab");
    }
  });
})();
