/**
 * GST and business activity statement calculations.
 */
const { ratesFor, normalizeFinancialYear } = require("../data");
const { round2, toAmount, toBool, DISCLAIMER } = require("./helpers");

/**
 * Add, extract or strip GST from an amount.
 * @param {object} input
 * @param {number} input.amount
 * @param {"add"|"extract"|"remove"} [input.mode] - "extract" pulls the GST out of a GST-inclusive amount
 * @param {string} [input.financialYear]
 */
function calculateGst(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));
  const rate = rates.gst.rate;
  const amount = toAmount(input.amount, "amount");
  const mode = ["add", "extract", "remove"].includes(input.mode)
    ? input.mode
    : "extract";

  let exclusive;
  let gst;
  let inclusive;

  if (mode === "add") {
    exclusive = amount;
    gst = round2(amount * rate);
    inclusive = round2(amount + gst);
  } else {
    inclusive = amount;
    // GST on a GST-inclusive amount is one eleventh.
    gst = round2(amount / (1 + 1 / rate));
    exclusive = round2(amount - gst);
  }

  return {
    calculator: "gst",
    financialYear: rates.financialYear,
    rate,
    mode,
    gstExclusiveAmount: round2(exclusive),
    gstAmount: gst,
    gstInclusiveAmount: round2(inclusive),
    formula:
      mode === "add"
        ? "GST = GST-exclusive price x 10%"
        : "GST = GST-inclusive price / 11 (i.e. one eleventh)",
    disclaimer: DISCLAIMER,
  };
}

/**
 * Estimate the key BAS labels for a period.
 * @param {object} input
 * @param {number} input.totalSales - G1, GST inclusive
 * @param {number} [input.gstFreeSales] - G3
 * @param {number} [input.exportSales] - G2
 * @param {number} [input.inputTaxedSales]
 * @param {number} input.totalPurchases - G11, GST inclusive, creditable acquisitions
 * @param {number} [input.capitalPurchases] - G10, GST inclusive
 * @param {number} [input.nonCreditablePurchases] - purchases with no GST credit entitlement
 * @param {number} [input.wagesPaid] - W1
 * @param {number} [input.paygWithheld] - W2
 * @param {number} [input.paygInstalment] - T7/5A
 * @param {number} [input.fbtInstalment] - F1/6A
 * @param {boolean} [input.cashBasis]
 */
function calculateBas(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));
  const rate = rates.gst.rate;
  const divisor = 1 + 1 / rate; // 11 when the rate is 10%

  const totalSales = toAmount(input.totalSales, "totalSales");
  const gstFreeSales = toAmount(input.gstFreeSales, "gstFreeSales");
  const exportSales = toAmount(input.exportSales, "exportSales");
  const inputTaxedSales = toAmount(input.inputTaxedSales, "inputTaxedSales");
  const taxableSales = Math.max(
    0,
    totalSales - gstFreeSales - exportSales - inputTaxedSales
  );

  const totalPurchases = toAmount(input.totalPurchases, "totalPurchases");
  const capitalPurchases = toAmount(input.capitalPurchases, "capitalPurchases");
  const nonCreditablePurchases = toAmount(
    input.nonCreditablePurchases,
    "nonCreditablePurchases"
  );
  const creditableAcquisitions = Math.max(
    0,
    totalPurchases - nonCreditablePurchases
  );

  const gstOnSales = round2(taxableSales / divisor); // 1A
  const gstOnPurchases = round2(creditableAcquisitions / divisor); // 1B

  const paygWithheld = toAmount(input.paygWithheld, "paygWithheld");
  const paygInstalment = toAmount(input.paygInstalment, "paygInstalment");
  const fbtInstalment = toAmount(input.fbtInstalment, "fbtInstalment");

  const netGst = round2(gstOnSales - gstOnPurchases);
  const netAmount = round2(
    netGst + paygWithheld + paygInstalment + fbtInstalment
  );

  return {
    calculator: "business-activity-statement",
    financialYear: rates.financialYear,
    accountingBasis: toBool(input.cashBasis, false)
      ? "cash"
      : "accruals (non-cash)",
    labels: {
      G1: { label: "Total sales (GST inclusive)", amount: round2(totalSales) },
      G2: { label: "Export sales", amount: round2(exportSales) },
      G3: { label: "Other GST-free sales", amount: round2(gstFreeSales) },
      G10: {
        label: "Capital purchases (GST inclusive)",
        amount: round2(capitalPurchases),
      },
      G11: {
        label: "Non-capital purchases (GST inclusive)",
        amount: round2(totalPurchases - capitalPurchases),
      },
      "1A": { label: "GST on sales", amount: gstOnSales },
      "1B": { label: "GST on purchases", amount: gstOnPurchases },
      W1: {
        label: "Total salary, wages and other payments",
        amount: round2(toAmount(input.wagesPaid, "wagesPaid")),
      },
      W2: {
        label: "Amounts withheld from payments at W1",
        amount: round2(paygWithheld),
      },
      T7: {
        label: "PAYG income tax instalment",
        amount: round2(paygInstalment),
      },
      F1: { label: "FBT instalment", amount: round2(fbtInstalment) },
    },
    netGst,
    netGstPosition:
      netGst >= 0 ? "payable to the ATO" : "refundable from the ATO",
    totalAmountPayableOrRefundable: netAmount,
    summary:
      netAmount >= 0
        ? `Estimated $${Math.abs(netAmount).toLocaleString("en-AU")} payable (label 9).`
        : `Estimated $${Math.abs(netAmount).toLocaleString("en-AU")} refund (label 9).`,
    reminders: [
      "A valid tax invoice is required to claim a GST credit on a purchase over $82.50 (GST inclusive).",
      "No GST credit is available on input taxed supplies (residential rent, most financial supplies) or on private-use portions.",
      "GST-free supplies include most basic food, medical and health services, education, exports and going concerns - these are reported at G3 but carry no GST.",
      "GST credits must generally be claimed within four years of the due date of the BAS for the period in which they arose.",
    ],
    disclaimer: DISCLAIMER,
  };
}

/**
 * Registration and reporting-cycle guidance based on turnover.
 * @param {object} input
 * @param {number} input.gstTurnover
 * @param {boolean} [input.isNonProfit]
 * @param {boolean} [input.providesTaxiOrRideSourcing]
 * @param {string} [input.financialYear]
 */
function gstRegistrationCheck(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));
  const cfg = rates.gst;
  const turnover = toAmount(input.gstTurnover, "gstTurnover");
  const isNonProfit = toBool(input.isNonProfit, false);
  const rideSourcing = toBool(input.providesTaxiOrRideSourcing, false);

  const threshold = isNonProfit
    ? cfg.nonProfitRegistrationThreshold
    : cfg.registrationTurnoverThreshold;

  const mustRegister = rideSourcing || turnover >= threshold;
  const reportingCycle =
    turnover >= cfg.monthlyReportingTurnoverThreshold
      ? "monthly (mandatory - GST turnover of $20 million or more)"
      : "quarterly (monthly is optional)";

  return {
    calculator: "gst-registration-check",
    financialYear: rates.financialYear,
    gstTurnover: round2(turnover),
    registrationThreshold: threshold,
    mustRegister,
    reason: rideSourcing
      ? "Taxi travel and ride-sourcing require GST registration regardless of turnover."
      : mustRegister
        ? `GST turnover of $${round2(turnover).toLocaleString("en-AU")} meets or exceeds the $${threshold.toLocaleString("en-AU")} registration threshold.`
        : `GST turnover is below the $${threshold.toLocaleString("en-AU")} threshold - registration is optional.`,
    reportingCycle,
    reminders: [
      "GST turnover is projected turnover for the current month plus the next 11 months, or current turnover for this month plus the previous 11 - registration is required if either test is met.",
      "Registration must occur within 21 days of becoming required to register.",
      "Voluntary registration lets a business claim GST credits but commits it to lodging activity statements.",
    ],
    disclaimer: DISCLAIMER,
  };
}

module.exports = { calculateGst, calculateBas, gstRegistrationCheck };
