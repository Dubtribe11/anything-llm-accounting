/**
 * State and territory payroll tax estimate.
 *
 * Payroll tax is administered by each state and territory revenue office, not
 * the ATO. Grouping provisions mean related businesses share a single threshold,
 * and the threshold is apportioned where wages are paid in more than one
 * jurisdiction. Treat the result as an indicative estimate only.
 */
const { payrollTaxFor, normalizeFinancialYear } = require("../data");
const { round2, toAmount, toBool, DISCLAIMER } = require("./helpers");

/**
 * @param {object} input
 * @param {string} input.state - NSW, VIC, QLD, SA, WA, TAS, ACT, NT
 * @param {number} input.annualAustralianWages - total wages across all jurisdictions (drives the threshold)
 * @param {number} [input.taxableWagesInState] - wages in this jurisdiction; defaults to annualAustralianWages
 * @param {boolean} [input.regionalEmployer]
 * @param {string} [input.financialYear]
 */
function calculatePayrollTax(input = {}) {
  const table = payrollTaxFor(normalizeFinancialYear(input.financialYear));
  const state = String(input.state ?? "")
    .trim()
    .toUpperCase();
  const jurisdiction = table.jurisdictions[state];

  if (!jurisdiction) {
    return {
      calculator: "payroll-tax",
      error: `Unknown jurisdiction "${input.state}".`,
      supportedJurisdictions: Object.keys(table.jurisdictions),
      disclaimer: DISCLAIMER,
    };
  }

  const annualAustralianWages = toAmount(
    input.annualAustralianWages,
    "annualAustralianWages"
  );
  const taxableWagesInState =
    input.taxableWagesInState === undefined ||
    input.taxableWagesInState === null
      ? annualAustralianWages
      : toAmount(input.taxableWagesInState, "taxableWagesInState");
  const regional = toBool(input.regionalEmployer, false);

  // Apportion the threshold by the share of wages paid in this jurisdiction.
  const proportion =
    annualAustralianWages > 0
      ? Math.min(1, taxableWagesInState / annualAustralianWages)
      : 1;
  let threshold = jurisdiction.annualThreshold * proportion;

  // Phase-out jurisdictions reduce the deduction as wages rise.
  if (
    jurisdiction.thresholdType === "phase-out" &&
    jurisdiction.phaseOutUpper
  ) {
    const phaseStart = jurisdiction.annualThreshold;
    const phaseEnd = jurisdiction.phaseOutUpper;
    if (annualAustralianWages >= phaseEnd) threshold = 0;
    else if (annualAustralianWages > phaseStart) {
      const remaining =
        1 - (annualAustralianWages - phaseStart) / (phaseEnd - phaseStart);
      threshold = jurisdiction.annualThreshold * remaining * proportion;
    }
  }

  const taxableAbove = Math.max(0, taxableWagesInState - threshold);

  let rate =
    regional && jurisdiction.regionalRate
      ? jurisdiction.regionalRate
      : jurisdiction.rate;
  if (
    jurisdiction.higherRate &&
    annualAustralianWages > jurisdiction.higherRateAppliesAbove
  )
    rate = jurisdiction.higherRate;
  for (const tier of jurisdiction.tiers ?? []) {
    if (annualAustralianWages > tier.above) rate = tier.rate;
  }
  if (regional && jurisdiction.regionalDiscount)
    rate = Math.max(0, rate - jurisdiction.regionalDiscount);

  const baseTax = round2(taxableAbove * rate);

  const surcharges = [];
  let surchargeTotal = 0;
  for (const surcharge of jurisdiction.surcharges ?? []) {
    if (annualAustralianWages > surcharge.appliesAbove) {
      const amount = round2(
        Math.max(0, taxableWagesInState - surcharge.appliesAbove * proportion) *
          surcharge.rate
      );
      surcharges.push({ ...surcharge, amount });
      surchargeTotal += amount;
    }
  }

  return {
    calculator: "payroll-tax",
    financialYear: input.financialYear ?? "current",
    jurisdiction: jurisdiction.name,
    revenueOffice: jurisdiction.revenueOffice,
    annualAustralianWages: round2(annualAustralianWages),
    taxableWagesInState: round2(taxableWagesInState),
    thresholdApplied: round2(threshold),
    thresholdType: jurisdiction.thresholdType,
    rateApplied: rate,
    regionalEmployer: regional,
    payrollTaxBeforeSurcharges: baseTax,
    surcharges,
    estimatedAnnualPayrollTax: round2(baseTax + surchargeTotal),
    reminders: [
      "Grouping provisions treat related businesses as one employer sharing a single threshold - check them before relying on this estimate.",
      "Taxable wages include salaries, wages, superannuation, most contractor payments, fringe benefits (grossed up), bonuses, commissions, allowances and shares/options.",
      "Apprentice and trainee wages, and certain exempt employers, may be excluded in some jurisdictions.",
      ...(jurisdiction.notes ?? []),
    ],
    caveats: [table.verifyNote].filter(Boolean),
    disclaimer: DISCLAIMER,
  };
}

module.exports = { calculatePayrollTax };
