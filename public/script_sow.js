async function calculate() {
  const ecc = parseFloat(document.getElementById("ecc").value);
  const ewm = parseFloat(document.getElementById("ewm").value);
  const enhancements = parseInt(document.getElementById("enhancements").value);
  const testCases = document.getElementById("testCases").value.trim();
  const rating = document.getElementById("rating").value.trim();
  const corrections = parseFloat(document.getElementById("corrections").value);
  const configuration = parseFloat(document.getElementById("configuration").value);

  const payload = {
    ecc_version: ecc,
    ewm_version: ewm,
    enhancements,
    test_cases: testCases,
    customer_rating: rating,
    corrections,
    configuration
  };

  const res = await fetch("/sow-estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  document.getElementById("results").innerHTML = `
    <h3>Final Result: ${data.from} to ${data.to} hours</h3>
    <ul>
      ${Object.entries(data.details).map(([k, v]) =>
        `<li>${k}: ${v[0]} to ${v[1]} hrs</li>`).join("")}
    </ul>
  `;
}
