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

  try {
    const response = await fetch("/sow-estimate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.details) {
      let html = `<h3>Result</h3>
      <table>
        <tr><th>Task</th><th>From (hrs)</th><th>To (hrs)</th></tr>`;
      for (const [task, values] of Object.entries(data.details)) {
        html += `<tr><td>${task}</td><td>${values[0]}</td><td>${values[1]}</td></tr>`;
      }
      html += `<tr><th>Total</th><th>${data.from}</th><th>${data.to}</th></tr></table>`;
      document.getElementById("result").innerHTML = html;
    } else {
      document.getElementById("result").innerText = "Unexpected error. No data received.";
    }
  } catch (error) {
    console.error("Error:", error);
    document.getElementById("result").innerText = "An error occurred. Check console.";
  }
}
