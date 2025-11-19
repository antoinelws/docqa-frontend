// script_sow_other.js (internal)
// Requires: config.js, estimation_rules.js

// Configuration Constants
const CONFIG = {
  NORM_FROM: 4.5,
  NORM_TO: 3,
  UNIT_TEST_FACTOR: 0.3,
  SIT_UAT_FACTOR: 0.4,
  GOLIVE_FACTOR: 0.4,
  PM_FACTOR: 0.2
};

// Ratio Mapping Tables
const RATIO_MAPS = {
  enhancements: [
    { max: 15, label: "Low", ratio: 1.0 },
    { max: 40, label: "Medium", ratio: 1.2 },
    { max: 100, label: "High", ratio: 1.3 },
    { max: 130, label: "Very High", ratio: 1.5 },
    { max: Infinity, label: "Extremely High", ratio: 2.0 }
  ],
  ecc: [
    { max: 4.1, label: "Average", ratio: 1.0 },
    { max: Infinity, label: "Good", ratio: 1.0 }
  ],
  ewm: [
    { max: 2.1, label: "Average", ratio: 1.0 },
    { max: Infinity, label: "Good", ratio: 1.0 }
  ],
  testCases: {
    "Yes": { label: "Yes", ratio: 1.0 },
    "No": { label: "No", ratio: 1.5 }
  },
  customerRating: {
    "Bad": { label: "Bad", ratio: 1.5 },
    "Average": { label: "Average", ratio: 1.0 },
    "Good": { label: "Good", ratio: 1.0 }
  }
};

// Helper function to get ratio from range-based maps
function getRatioFromRange(value, mapArray) {
  for (const entry of mapArray) {
    if (value <= entry.max) {
      return { label: entry.label, ratio: entry.ratio };
    }
  }
  return { label: "Unknown", ratio: 1.0 };
}

// Main calculation function
function calculateEstimate(inputs) {
  const {
    shipERP_version_ecc,
    shipERP_version_ewm,
    num_enhancements,
    test_cases,
    customer_rating,
    dev_corrections_patch_application,
    configuration
  } = inputs;

  // Get ratios for each condition
  const enhancementData = getRatioFromRange(num_enhancements, RATIO_MAPS.enhancements);
  const eccData = getRatioFromRange(shipERP_version_ecc, RATIO_MAPS.ecc);
  const ewmData = getRatioFromRange(shipERP_version_ewm, RATIO_MAPS.ewm);
  const testCaseData = RATIO_MAPS.testCases[test_cases] || { label: "Yes", ratio: 1.0 };
  const ratingData = RATIO_MAPS.customerRating[customer_rating] || { label: "Average", ratio: 1.0 };

  // Calculate Total Ratio
  const totalRatio = enhancementData.ratio + eccData.ratio + ewmData.ratio + 
                     testCaseData.ratio + ratingData.ratio;

  // Base calculations
  const unit_test_base = configuration * CONFIG.UNIT_TEST_FACTOR;
  const sumB14B16 = dev_corrections_patch_application + configuration + unit_test_base;

  // Task calculations
  const tasks = {};

  // 1. Development Corrections & Patch Application (from input)
  tasks["Development Corrections & Patch Application"] = [
    dev_corrections_patch_application,
    dev_corrections_patch_application
  ];

  // 2. Configuration
  const configFrom = configuration * (totalRatio / CONFIG.NORM_FROM);
  const configTo = configuration * (totalRatio / CONFIG.NORM_TO);
  tasks["Configuration"] = [
    parseFloat(configFrom.toFixed(2)),
    parseFloat(configTo.toFixed(2))
  ];

  // 3. Unit Test
  const unitTestFrom = configuration * CONFIG.UNIT_TEST_FACTOR * (totalRatio / CONFIG.NORM_FROM);
  const unitTestTo = configuration * CONFIG.UNIT_TEST_FACTOR * (totalRatio / CONFIG.NORM_TO);
  tasks["Unit Test"] = [
    parseFloat(unitTestFrom.toFixed(2)),
    parseFloat(unitTestTo.toFixed(2))
  ];

  // 4. SIT & UAT
  const sitUatFrom = sumB14B16 * CONFIG.SIT_UAT_FACTOR * (totalRatio / CONFIG.NORM_FROM);
  const sitUatTo = sumB14B16 * CONFIG.SIT_UAT_FACTOR * (totalRatio / CONFIG.NORM_TO);
  tasks["SIT & UAT"] = [
    parseFloat(sitUatFrom.toFixed(2)),
    parseFloat(sitUatTo.toFixed(2))
  ];

  // 5. Go Live & HyperCare
  const goLiveFrom = sumB14B16 * CONFIG.GOLIVE_FACTOR * (totalRatio / CONFIG.NORM_FROM);
  const goLiveTo = sumB14B16 * CONFIG.GOLIVE_FACTOR * (totalRatio / CONFIG.NORM_TO);
  tasks["Go Live & HyperCare"] = [
    parseFloat(goLiveFrom.toFixed(2)),
    parseFloat(goLiveTo.toFixed(2))
  ];

  // Calculate subtotals (before PM)
  let subtotalFrom = 0;
  let subtotalTo = 0;
  for (const [, values] of Object.entries(tasks)) {
    subtotalFrom += values[0];
    subtotalTo += values[1];
  }

  // 6. PM Hours
  const pmFrom = subtotalFrom * CONFIG.PM_FACTOR;
  const pmTo = subtotalTo * CONFIG.PM_FACTOR;
  tasks["Project Management"] = [
    parseFloat(pmFrom.toFixed(2)),
    parseFloat(pmTo.toFixed(2))
  ];

  // 7. Grand Totals
  const totalFrom = subtotalFrom + pmFrom;
  const totalTo = subtotalTo + pmTo;

  return {
    tasks,
    totalFrom: parseFloat(totalFrom.toFixed(2)),
    totalTo: parseFloat(totalTo.toFixed(2)),
    ratioBreakdown: {
      enhancements: enhancementData,
      ecc: eccData,
      ewm: ewmData,
      testCases: testCaseData,
      customerRating: ratingData,
      totalRatio: parseFloat(totalRatio.toFixed(2))
    }
  };
}

// Updated calculate function for the UI
async function calculate() {
  const ecc = parseFloat(document.getElementById("ecc_version").value);
  const ewm = parseFloat(document.getElementById("ewm_version").value);
  const enhancements = parseInt(document.getElementById("enhancements").value);
  const testCases = document.getElementById("test_cases").value;
  const rating = document.getElementById("rating").value;
  const corrections = parseFloat(document.getElementById("corrections").value);
  const config = parseFloat(document.getElementById("configuration").value);

  // Validate inputs
  if (isNaN(ecc) || isNaN(ewm) || isNaN(enhancements) || isNaN(corrections) || isNaN(config)) {
    document.getElementById("result").innerHTML = '<p style="color: red;">Please fill in all numeric fields.</p>';
    return;
  }

  const inputs = {
    shipERP_version_ecc: ecc,
    shipERP_version_ewm: ewm,
    num_enhancements: enhancements,
    test_cases: testCases,
    customer_rating: rating,
    dev_corrections_patch_application: corrections,
    configuration: config
  };

  const resultEl = document.getElementById("result");

  try {
    const result = calculateEstimate(inputs);

    let html = `<h3>Estimation Results</h3>
      <div style="margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 5px;">
        <h4>Ratio Breakdown (Total: ${result.ratioBreakdown.totalRatio})</h4>
        <ul style="list-style: none; padding: 0;">
          <li>Enhancements: ${result.ratioBreakdown.enhancements.label} (${result.ratioBreakdown.enhancements.ratio})</li>
          <li>ECC Version: ${result.ratioBreakdown.ecc.label} (${result.ratioBreakdown.ecc.ratio})</li>
          <li>EWM Version: ${result.ratioBreakdown.ewm.label} (${result.ratioBreakdown.ewm.ratio})</li>
          <li>Test Cases: ${result.ratioBreakdown.testCases.label} (${result.ratioBreakdown.testCases.ratio})</li>
          <li>Customer Rating: ${result.ratioBreakdown.customerRating.label} (${result.ratioBreakdown.customerRating.ratio})</li>
        </ul>
      </div>
      <table>
        <tr><th>Task</th><th>From (hrs)</th><th>To (hrs)</th></tr>`;

    for (const [task, values] of Object.entries(result.tasks)) {
      html += `<tr><td>${task}</td><td>${values[0]}</td><td>${values[1]}</td></tr>`;
    }

    html += `<tr style="font-weight: bold; background: #e0e0e0;">
      <td>Grand Total</td>
      <td>${result.totalFrom}</td>
      <td>${result.totalTo}</td>
    </tr></table>`;

    resultEl.innerHTML = html;
  } catch (error) {
    console.error("Error:", error);
    resultEl.innerHTML = '<p style="color: red;">An error occurred during calculation. Check console.</p>';
  }
}