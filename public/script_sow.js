// script_sow_other.js (internal)
// Requires: config.js, estimation_rules.js

async function calculate() {
  const ecc = parseFloat(document.getElementById("ecc_version").value);
  const ewm = parseFloat(document.getElementById("ewm_version").value);
  const enhancements = parseInt(document.getElementById("enhancements").value);
  const testCases = document.getElementById("test_cases").value;
  const rating = document.getElementById("rating").value;
  const corrections = parseFloat(document.getElementById("corrections").value);
  const config = parseFloat(document.getElementById("configuration").value);

  const payload = {
    ecc_version: ecc,
    ewm_version: ewm,
    enhancements: enhancements,
    test_cases: testCases,
    customer_rating: rating,
    corrections: corrections,
    configuration: config,
  };

  const resultEl = document.getElementById("result");

  try {
    // Uses the shared rule (which reads the URL from SOWCFG)
    // Returns: { total_effort: "from-to" | null, details: { Task: [from, to], ... } | null }
    const res = await SOWRULES.other(payload);

    if (!res) {
      resultEl.innerText = "No response.";
      return;
    }

    const details = res.details || null;

    // Compute totals if details present
    let totalFrom = null, totalTo = null;
    if (details && typeof details === "object") {
      totalFrom = 0; totalTo = 0;
      for (const [, values] of Object.entries(details)) {
        if (Array.isArray(values) && values.length === 2) {
          const f = Number(values[0]) || 0;
          const t = Number(values[1]) || 0;
          totalFrom += f;
          totalTo += t;
        }
      }
    }

    if (details) {
      let html = `<h3>Result</h3>
        <table>
          <tr><th>Task</th><th>From (hrs)</th><th>To (hrs)</th></tr>`;
      for (const [task, values] of Object.entries(details)) {
        const f = Array.isArray(values) ? values[0] : "";
        const t = Array.isArray(values) ? values[1] : "";
        html += `<tr><td>${task}</td><td>${f}</td><td>${t}</td></tr>`;
      }

      // Prefer computed totals; if missing, fall back to string from total_effort
      if (totalFrom != null && totalTo != null) {
        html += `<tr><th>Total</th><th>${totalFrom}</th><th>${totalTo}</th></tr>`;
      } else if (typeof res.total_effort === "string") {
        html += `<tr><th colspan="3">Total: ${res.total_effort}</th></tr>`;
      }

      html += `</table>`;
      resultEl.innerHTML = html;
    } else {
      // No details—just show the rolled-up total if present
      resultEl.innerText = res.total_effort
        ? `Estimated Effort: ${res.total_effort}`
        : "Unexpected error. No data received.";
    }
  } catch (error) {
    console.error("Error:", error);
    resultEl.innerText = "An error occurred. Check console.";
  }
}
