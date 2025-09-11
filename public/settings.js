(async function () {
  const editor = document.getElementById("editor");
  const file = document.getElementById("file");
  const saveBtn = document.getElementById("save");
  const loadDef = document.getElementById("loadDefaults");
  const dlBtn = document.getElementById("download");
  const lockBtn = document.getElementById("lockBtn");
  const passInput = document.getElementById("pass");

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

  // Load current (merged) config to start editing
  const cfg = await SOWCFG.get();
  editor.value = JSON.stringify(cfg, null, 2);

  saveBtn.onclick = () => {
    try {
      const obj = JSON.parse(editor.value);
      SOWCFG.setLocalOverride(obj);
      alert("Saved to localStorage. Forms will use this after reload.");
    } catch (e) {
      alert("Invalid JSON: " + e.message);
    }
  };

  loadDef.onclick = async () => {
    const res = await fetch("sow_config.defaults.json");
    editor.value = JSON.stringify(await res.json(), null, 2);
  };

  dlBtn.onclick = () => {
    const blob = new Blob([editor.value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "sow_config.json" });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  file.onchange = () => {
    const f = file.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { editor.value = r.result; };
    r.readAsText(f);
  };
})();
