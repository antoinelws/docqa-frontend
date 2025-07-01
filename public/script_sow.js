async function calculateSOW() {
  const ecc = parseFloat(document.getElementById("ecc").value);
  const ewm = parseFloat(document.getElementById("ewm").value);
  const enhancements = parseInt(document.getElementById("enhancements").value);
  const testCases = document.getElementById("testCases").value;
  const rating = document.getElementById("rating").value;
  const corrections = parseFloat(document.getElementById("corrections").value);
  const configuration = parseFloat(document.getElementById("configuration").value);

  const response = await fetch("/sow-estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ecc_version: ecc,
      ewm_version: ewm,
      enhancements,
      test_cases: testCases,
      customer_rating: rating,
      corrections,
      configuration
    })
  });

  const result = await response.json();

  let html = `
    <h2>Estimated Hours</h2>
    <table>
      <tr><th>Task</th><th>From (hrs)</th><th>To (hrs)</th></tr>
  `;

  for (const [task, [from, to]] of Object.entries(result.details)) {
    html += `<tr><td>${task}</td><td>${from}</td><td>${to}</td></tr>`;
  }

  html += `<tr><th>Total</th><th>${result.from}</th><th>${result.to}</th></tr>`;
  html += `</table>`;

  document.getElementById("results").innerHTML = html;
}
