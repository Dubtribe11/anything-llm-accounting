/**
 * Fringe benefits tax. The FBT year runs 1 April - 31 March, which does NOT
 * line up with the income year.
 */
const { ratesFor, normalizeFinancialYear } = require("../data");
const { round2, toAmount, toBool, collectCaveats, DISCLAIMER } = require("./helpers");

/**
 * @param {object} input
 * @param {number} [input.type1AggregateAmount] - taxable value of benefits where the employer was entitled to a GST credit
 * @param {number} [input.type2AggregateAmount] - taxable value of all other benefits
 * @param {number} [input.rebatableEmployerRebate] - 0-1, for rebatable employers
 * @param {number} [input.fbtInstalmentsPaid]
 * @param {string} [input.financialYear]
 */
function calculateFbt(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));
  const cfg = rates.fbt;

  const type1 = toAmount(input.type1AggregateAmount, "type1AggregateAmount");
  const type2 = toAmount(input.type2AggregateAmount, "type2AggregateAmount");

  const grossedUpType1 = round2(type1 * cfg.type1GrossUp);
  const grossedUpType2 = round2(type2 * cfg.type2GrossUp);
  const fringeBenefitsTaxableAmount = round2(grossedUpType1 + grossedUpType2);
  const fbtPayable = round2(fringeBenefitsTaxableAmount * cfg.rate);

  const instalments = toAmount(input.fbtInstalmentsPaid, "fbtInstalmentsPaid");
  const balance = round2(fbtPayable - instalments);

  return {
    calculator: "fringe-benefits-tax",
    fbtYear: cfg.yearLabel,
    rate: cfg.rate,
    type1: {
      taxableValue: round2(type1),
      grossUpRate: cfg.type1GrossUp,
      grossedUpValue: grossedUpType1,
      note: "Type 1 benefits are those for which the employer was entitled to a GST credit.",
    },
    type2: {
      taxableValue: round2(type2),
      grossUpRate: cfg.type2GrossUp,
      grossedUpValue: grossedUpType2,
      note: "Type 2 benefits are all others - GST-free, input taxed, or acquired from an unregistered supplier.",
    },
    fringeBenefitsTaxableAmount,
    fbtPayable,
    fbtInstalmentsPaid: round2(instalments),
    estimatedAmountPayable: balance > 0 ? balance : 0,
    estimatedRefund: balance < 0 ? round2(Math.abs(balance)) : 0,
    reminders: [
      `Minor benefits under $${cfg.minorBenefitThreshold} that are provided infrequently and irregularly are generally exempt.`,
      "Otherwise deductible: where the employee would have been entitled to a once-only income tax deduction for the expense, the taxable value is reduced accordingly.",
      `Reportable fringe benefits are shown on an employee's income statement when their grossed-up total exceeds $${cfg.reportableFringeBenefitThreshold} - reported using the Type 2 factor regardless of the benefit type.`,
      "Work-related portable electronic devices, protective clothing, tools of trade and briefcases are exempt (small business employers can provide multiple similar devices).",
      "The FBT return is due 21 May (25 June if lodged by a tax agent through the FBT lodgment program).",
      cfg.note,
    ].filter(Boolean),
    caveats: collectCaveats(cfg),
    disclaimer: DISCLAIMER,
  };
}

/**
 * Car fringe benefit taxable value under both methods.
 * @param {object} input
 * @param {"statutory"|"operating-cost"} [input.method]
 * @param {number} [input.baseValue] - cost of the car (statutory formula)
 * @param {number} [input.daysAvailable] - days the car was available for private use
 * @param {number} [input.totalOperatingCosts]
 * @param {number} [input.businessUsePercentage] - 0-100, requires a valid logbook
 * @param {number} [input.employeeContributions]
 * @param {boolean} [input.isExemptElectricVehicle]
 */
function calculateCarFringeBenefit(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));
  const cfg = rates.fbt;

  const baseValue = toAmount(input.baseValue, "baseValue");
  const daysAvailable =
    input.daysAvailable === undefined || input.daysAvailable === null
      ? 365
      : toAmount(input.daysAvailable, "daysAvailable");
  const employeeContributions = toAmount(input.employeeContributions, "employeeContributions");
  const totalOperatingCosts = toAmount(input.totalOperatingCosts, "totalOperatingCosts");
  const businessUsePercentage = toAmount(input.businessUsePercentage, "businessUsePercentage");

  const statutoryValue = round2(
    Math.max(0, baseValue * cfg.statutoryFormulaRate * (daysAvailable / 365) - employeeContributions)
  );
  const operatingCostValue = round2(
    Math.max(
      0,
      totalOperatingCosts * (1 - businessUsePercentage / 100) - employeeContributions
    )
  );

  const method =
    input.method === "operating-cost"
      ? "operating-cost"
      : input.method === "statutory"
        ? "statutory"
        : statutoryValue <= operatingCostValue || totalOperatingCosts === 0
          ? "statutory"
          : "operating-cost";

  const taxableValue = method === "statutory" ? statutoryValue : operatingCostValue;
  const exempt = toBool(input.isExemptElectricVehicle, false);

  return {
    calculator: "car-fringe-benefit",
    fbtYear: cfg.yearLabel,
    methodUsed: method,
    statutoryFormula: {
      formula: "Base value x 20% x (days available / 365) - employee contributions",
      baseValue: round2(baseValue),
      statutoryRate: cfg.statutoryFormulaRate,
      daysAvailable,
      taxableValue: statutoryValue,
    },
    operatingCost: {
      formula: "(Total operating costs x private use %) - employee contributions",
      totalOperatingCosts: round2(totalOperatingCosts),
      businessUsePercentage,
      taxableValue: operatingCostValue,
      note: "The operating cost method requires a valid logbook kept for a continuous 12-week period, valid for 5 years.",
    },
    taxableValue: exempt ? 0 : taxableValue,
    exemptElectricVehicle: exempt,
    grossUpType: "Type 1 (a GST credit is normally available on car expenses)",
    reminders: [
      "Even where a car benefit is FBT exempt (eligible zero or low emissions vehicles), the value is still counted towards reportable fringe benefits.",
      "The FBT exemption for plug-in hybrid electric vehicles ended on 1 April 2025 unless a pre-existing binding financial commitment continues.",
      "Employee contributions reduce the taxable value but are assessable income to the employer and may attract GST.",
    ],
    disclaimer: DISCLAIMER,
  };
}

module.exports = { calculateFbt, calculateCarFringeBenefit };
