document.addEventListener("DOMContentLoaded", () => {
  // Compact, professional styles (top area tightened)
  (function injectSOWStyles() {
    if (document.getElementById("sow-upgrade-styles")) return;
    const css = `
      .sow-wrap{display:flex;justify-content:center;align-items:flex-start;width:100%}
      .sow-card{max-width:900px;width:100%;background:#fff;border:1px solid #e6e6e6;border-radius:12px;
                padding:12px 14px;box-shadow:0 2px 10px rgba(0,0,0,0.04);text-align:center}
      /* Tight top spacing */
      .sow-title{margin:0 0 4px;font-size:20px;line-height:1.15;color:#1f2937;font-weight:700}
      .sow-sub{margin:0 0 8px;font-size:12.5px;color:#6b7280}
      .sow-kv{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px auto 8px;max-width:860px}
      .sow-kv .item{background:#fafafa;border:1px solid #f0f0f0;border-radius:8px;padding:6px 8px}
      .sow-kv .k{font-size:11px;color:#6b7280;margin-bottom:1px}
      .sow-kv .v{font-size:14px;color:#111827;font-weight:600}

      .sow-table{width:100%;border-collapse:collapse;margin:6px auto 0}
      .sow-table th,.sow-table td{padding:8px 10px;border-bottom:1px solid #f0f0f0}
      .sow-table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;background:#fafafa}
      .sow-table td{font-size:14px;color:#374151}

      .sow-total{margin-top:10px;padding-top:10px;border-top:2px solid #eaeaea;font-size:16px;color:#111827}
      .sow-total strong{font-size:18px}

      @media (max-width:680px){
        .sow-kv{grid-template-columns:1fr}
        .sow-card{padding:10px 12px}
        .sow-table th,.sow-table td{padding:7px}
      }
    `;
    const style = document.createElement("style");
    style.id = "sow-upgrade-styles";
    style.innerHTML = css;
    document.head.appendChild(style);
  })();

  window.submitUpgradeEstimate = function () {
    const resultBox = document.getElementById("upgradeResultBox");

    // Helpers
    const trim2 = (n) => {
      // round to 2 decimals, then strip trailing zeros and optional dot
      const s = (Math.round(n * 100) / 100).toFixed(2);
      return s.replace(/\.?0+$/,'');
    };
    const range = (v) => ({ from: trim2(v * 0.8), to: trim2(v * 1.2) });
    const fmt   = (r) => `From ${r.from} To ${r.to} hours`; // wording

    try {
      // Read inputs safely
      const shiperpVersion = (document.getElementById("shiperpVersionUpgrade")?.value || "").trim();
      const zenhancements   = (document.getElementById("zenhancementsUpgrade")?.value || "").trim();
      const onlineCarriers  = (document.getElementById("onlineCarrierCountUpgrade")?.value || "").trim();
      const ewmUsage        = (document.getElementById("ewmUsageUpgrade")?.value || "").trim();

      const modulesUsed = Array.from(
        document.querySelectorAll('input[name="modulesUsed"]:checked')
      ).map(cb => cb.value);

      // 1) ShipERP Version
      let versionHours = 0;
      switch (shiperpVersion) {
        case "Above 4.5":
        case "Between 4.0 and 4.5": versionHours = 0; break;
        case "Between 3.6 and 3.9": versionHours = 15; break;
        case "Lower than 3.6":      versionHours = 50; break;
        default:                    versionHours = 0;
      }

      // 2) Z Enhancements
      let zenhancementHours = 0;
      switch (zenhancements) {
        case "1 to 10":        zenhancementHours = 15;  break;
        case "10 to 50":       zenhancementHours = 60;  break;
        case "50 to 100":      zenhancementHours = 100; break;
        case "More than 100":  zenhancementHours = 150; break;
        default:               zenhancementHours = 0;
      }

      // 3) ONLINE carriers
      let carriersHours = 0;
      switch (onlineCarriers) {
        case "1 to 5":          carriersHours = 60;  break;
        case "6 to 10":         carriersHours = 200; break;
        case "More than 10":    carriersHours = 300; break;
        default:                carriersHours = 0;
      }

      // 4) ShipEWM
      const ewmHours = (ewmUsage.toLowerCase() === "yes") ? 50 : 0;

      // 5) Modules: more than 3 adds 40
      const modulesHours = (modulesUsed.length > 3) ? 40 : 0;

      // Fixed items
      const identifyEnhancements = 8;
      const uat = 40;
      const goLiveHypercare = 32;

      // Unit Testing & SIT (corrected)
      const unitTesting = 16 + (0.1 * (carriersHours + ewmHours));
      const sit         = 8  + (0.2 * (carriersHours + ewmHours));

      // Sum before PM
      const sumBeforePM =
        versionHours +
        zenhancementHours +
        carriersHours +
        ewmHours +
        modulesHours +
        identifyEnhancements +
        unitTesting +
        sit +
        uat +
        goLiveHypercare;

      // PM and Total
      const projectManagement = 0.2 * sumBeforePM;
      const totalHours = sumBeforePM + projectManagement;

      // Ranges (now using trimmed numbers)
      const pmRange        = range(projectManagement);
      const identifyRange  = range(identifyEnhancements);
      const technicalRange = range(zenhancementHours + ewmHours);
      const carriersRange  = range(carriersHours);
      const unitRange      = range(unitTesting);
      const sitRange       = range(sit);
      const uatRange       = range(uat);
      const goLiveRange    = range(goLiveHypercare);
      const totalRange     = range(totalHours);

      // Quick facts (compact top area)
      const chips = [
        {k: "ShipERP Version",  v: shiperpVersion || "—"},
        {k: "Z Enhancements",   v: zenhancements   || "—"},
        {k: "Online Carriers",  v: onlineCarriers  || "—"},
        {k: "ShipEWM",          v: ewmUsage        || "—"},
        {k: "Modules Selected", v: modulesUsed.length}
      ];

      // Table rows
      const rows = [
        ["Project Management",                              fmt(pmRange)],
        ["Identify existing enhancements",                  fmt(identifyRange)],
        ["Technical installation / enhancement corrections",fmt(technicalRange)],
        ["Carrier configuration (by band)",                 fmt(carriersRange)],
        ["Unit testing & development corrections",          fmt(unitRange)],
        ["QAS cutover & integration testing (SIT)",         fmt(sitRange)],
        ["UAT support for end-user testing",                fmt(uatRange)],
        ["Go-Live & Hypercare (1 week)",                    fmt(goLiveRange)],
      ];

      // Render
      resultBox.innerHTML = `
        <div class="sow-wrap">
          <div class="sow-card" role="region" aria-label="Upgrade Estimation Results">
            <h3 class="sow-title">Upgrade Estimation Results</h3>
            <p class="sow-sub">All values shown as effort ranges (±20%).</p>

            <div class="sow-kv">
              ${chips.map(c => `
                <div class="item">
                  <div class="k">${c.k}</div>
                  <div class="v">${c.v}</div>
                </div>
              `).join("")}
            </div>

            <table class="sow-table" aria-label="Estimation detail">
              <thead><tr><th style="text-align:left;">Work Package</th><th style="text-align:right;">Range (hrs)</th></tr></thead>
              <tbody>
                ${rows.map(([name,val]) => `
                  <tr>
                    <td style="text-align:left;">${name}</td>
                    <td style="text-align:right;">${val}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <div class="sow-total">
              <strong>Total Estimate:</strong>
              <span> ${fmt(totalRange)}</span>
            </div>
          </div>
        </div>
      `;

      // Keep container neutral & centered
      resultBox.style.display = "block";
      resultBox.style.background = "transparent";
      resultBox.style.color = "inherit";
      resultBox.style.padding = "0";
      resultBox.style.textAlign = "center";

    } catch (err) {
      console.error(err);
      const resultBox = document.getElementById("upgradeResultBox");
      resultBox.textContent = `❌ Error: ${err.message}`;
      resultBox.style.display = "block";
      resultBox.style.background = "#ffebee";
      resultBox.style.color = "#c62828";
      resultBox.style.textAlign = "center";
    }
  };
});
