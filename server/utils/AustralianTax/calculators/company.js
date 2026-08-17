/**
 * Company tax, franking/imputation and Division 7A calculations.
 */
const { ratesFor, normalizeFinancialYear } = require("../data");
const { round2, toAmount, toBool, collectCaveats, DISCLAIMER } = require("./helpers");

/**
 * Works out whether a company is a base rate entity for the year.
 * A base rate entity has aggregated turnover under the threshold AND no more
 * than 80% of its assessable income as base rate entity passive income.
 */
function baseRateEntityTest(input, rates) {
  const aggregatedTurnover = toAmount(input.aggregatedTurnover, "aggregatedTurnover");
  const assessableIncome = toAmount(input.assessableIncome, "assessableIncome");
  const passiveIncome = toAmount(input.passiveIncome, "passiveIncome");
  const cfg = rates.company;

  const turnoverPasses = aggregatedTurnover < cfg.baseRateEntityTurnoverThreshold;
  const passiveRatio = assessableIncome > 0 ? passiveIncome / assessableIncome : 0;
  const passivePasses = passiveRatio <= cfg.baseRateEntityPassiveIncomeCap;
  const isBaseRateEntity = turnoverPasses && passivePasses;

  return {
    isBaseRateEntity,
    rate: isBaseRateEntity ? cfg.baseRateEntityRate : cfg.standardRate,
    turnoverTest: {
      passed: turnoverPasses,
      aggregatedTurnover: round2(aggregatedTurnover),
      threshold: cfg.baseRateEntityTurnoverThreshold,
    },
    passiveIncomeTest: {
      passed: passivePasses,
      passiveIncomeRatio: round2(passiveRatio * 100) / 100,
      cap: cfg.baseRateEntityPassiveIncomeCap,
      note: "Base rate entity passive income includes dividends (other than non-portfolio), franking credits, interest, royalties, rent, net capital gains and certain trust/partnership distributions.",
    },
  };
}

/**
 * @param {object} input
 * @param {string} [input.financialYear]
 * @param {number} input.taxableIncome
 * @param {number} [input.aggregatedTurnover] - drives the base rate entity test
 * @param {number} [input.assessableIncome]
 * @param {number} [input.passiveIncome]
 * @param {boolean} [input.forceStandardRate]
 * @param {number} [input.frankingCreditsReceived]
 * @param {number} [input.otherRefundableOffsets] - e.g. refundable R&D tax offset
 * @param {number} [input.paygInstalmentsPaid]
 * @param {number} [input.priorYearLossesApplied]
 */
function calculateCompanyTax(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));
  const test = baseRateEntityTest(input, rates);
  const forceStandard = toBool(input.forceStandardRate, false);
  const rate = forceStandard ? rates.company.standardRate : test.rate;

  const priorYearLossesApplied = toAmount(
    input.priorYearLossesApplied,
    "priorYearLossesApplied"
  );
  const rawTaxableIncome = toAmount(input.taxableIncome, "taxableIncome");
  const taxableIncome = Math.max(0, rawTaxableIncome - priorYearLossesApplied);

  const grossTax = round2(taxableIncome * rate);

  const frankingCreditsReceived = toAmount(
    input.frankingCreditsReceived,
    "frankingCreditsReceived"
  );
  const otherRefundableOffsets = toAmount(input.otherRefundableOffsets, "otherRefundableOffsets");
  const paygInstalmentsPaid = toAmount(input.paygInstalmentsPaid, "paygInstalmentsPaid");
  const totalCredits = round2(
    frankingCreditsReceived + otherRefundableOffsets + paygInstalmentsPaid
  );
  const balance = round2(grossTax - totalCredits);

  return {
    calculator: "company-tax",
    financialYear: rates.financialYear,
    baseRateEntity: { ...test, rateApplied: rate, forcedStandardRate: forceStandard },
    taxableIncome: round2(taxableIncome),
    priorYearLossesApplied: round2(priorYearLossesApplied),
    taxRate: rate,
    grossTax,
    credits: {
      frankingCreditsReceived,
      otherRefundableOffsets,
      paygInstalmentsPaid,
      total: totalCredits,
    },
    estimatedRefund: balance < 0 ? round2(Math.abs(balance)) : 0,
    estimatedAmountPayable: balance > 0 ? balance : 0,
    reminders: [
      "Franking credits received by a company are not refundable - excess credits convert to a tax loss under s 36-55 ITAA 1997.",
      "Carry-forward losses need to satisfy the continuity of ownership test or the business continuity (similar business) test before they can be applied.",
      "The rate for franking purposes uses the *previous* year's aggregated turnover with the current year's passive income assumptions - it can differ from the rate the company actually pays.",
    ],
    caveats: collectCaveats(rates.company),
    disclaimer: DISCLAIMER,
  };
}

/**
 * Franking credit / gross-up calculations for a distribution.
 * @param {object} input
 * @param {number} input.distributionAmount - the cash dividend
 * @param {number} [input.frankingPercentage] - 0-100, defaults to 100
 * @param {number} [input.corporateTaxRateForImputation] - defaults to the base rate entity rate
 * @param {string} [input.financialYear]
 */
function calculateFranking(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));
  const distribution = toAmount(input.distributionAmount, "distributionAmount");
  const frankingPercentage =
    input.frankingPercentage === undefined || input.frankingPercentage === null
      ? 100
      : toAmount(input.frankingPercentage, "frankingPercentage");
  const rate =
    input.corporateTaxRateForImputation !== undefined &&
    input.corporateTaxRateForImputation !== null
      ? toAmount(input.corporateTaxRateForImputation, "corporateTaxRateForImputation")
      : rates.company.baseRateEntityRate;

  const normalizedRate = rate > 1 ? rate / 100 : rate;
  const maximumFrankingCredit = round2(distribution * (normalizedRate / (1 - normalizedRate)));
  const frankingCredit = round2(maximumFrankingCredit * (frankingPercentage / 100));
  const grossedUp = round2(distribution + frankingCredit);

  return {
    calculator: "franking",
    financialYear: rates.financialYear,
    distributionAmount: round2(distribution),
    frankingPercentage,
    corporateTaxRateForImputation: normalizedRate,
    maximumFrankingCredit,
    frankingCredit,
    grossedUpAmount: grossedUp,
    formula:
      "Franking credit = distribution x (corporate tax rate for imputation purposes / (1 - that rate)) x franking %",
    reminders: [
      "The recipient includes the grossed-up amount in assessable income and claims the franking credit as a tax offset.",
      "The holding period rule (45 days, or 90 days for preference shares) must be met unless the small shareholder exemption (franking credits of $5,000 or less) applies.",
      "Franking a distribution above the company's benchmark franking percentage for the period breaches the benchmark rule.",
    ],
    disclaimer: DISCLAIMER,
  };
}

/**
 * Division 7A minimum yearly repayment on a complying loan.
 *
 * MYR = (opening balance x benchmark rate) / (1 - (1 + benchmark rate)^-remaining term)
 *
 * @param {object} input
 * @param {number} input.openingLoanBalance - amount not repaid at the end of the previous income year
 * @param {number} [input.loanTermYears] - 7 (unsecured) or 25 (secured over real property)
 * @param {number} [input.yearsElapsed] - complete income years since the loan was made
 * @param {number} [input.benchmarkInterestRate] - overrides the bundled rate
 * @param {string} [input.financialYear]
 */
function calculateDiv7AMinimumRepayment(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));
  const cfg = rates.div7a;

  const openingBalance = toAmount(input.openingLoanBalance, "openingLoanBalance");
  const loanTermYears = input.loanTermYears
    ? toAmount(input.loanTermYears, "loanTermYears")
    : cfg.maxTermUnsecuredYears;
  const yearsElapsed = toAmount(input.yearsElapsed, "yearsElapsed");
  const suppliedRate =
    input.benchmarkInterestRate !== undefined && input.benchmarkInterestRate !== null
      ? toAmount(input.benchmarkInterestRate, "benchmarkInterestRate")
      : null;
  const rate =
    suppliedRate === null
      ? cfg.benchmarkInterestRate
      : suppliedRate > 1
        ? suppliedRate / 100
        : suppliedRate;

  const remainingTerm = Math.max(0, loanTermYears - yearsElapsed);
  if (remainingTerm <= 0) {
    return {
      calculator: "division-7a-minimum-repayment",
      financialYear: rates.financialYear,
      openingLoanBalance: round2(openingBalance),
      remainingTermYears: 0,
      minimumYearlyRepayment: round2(openingBalance),
      interestComponent: 0,
      principalComponent: round2(openingBalance),
      note: "The loan term has expired - the whole outstanding balance must be repaid in this income year or it is treated as a dividend.",
      disclaimer: DISCLAIMER,
    };
  }

  const denominator = 1 - Math.pow(1 + rate, -remainingTerm);
  const minimumYearlyRepayment = denominator === 0 ? openingBalance : (openingBalance * rate) / denominator;
  const interestComponent = round2(openingBalance * rate);

  return {
    calculator: "division-7a-minimum-repayment",
    financialYear: rates.financialYear,
    openingLoanBalance: round2(openingBalance),
    benchmarkInterestRate: rate,
    loanTermYears,
    yearsElapsed,
    remainingTermYears: remainingTerm,
    minimumYearlyRepayment: round2(minimumYearlyRepayment),
    interestComponent,
    principalComponent: round2(minimumYearlyRepayment - interestComponent),
    formula:
      "MYR = (opening balance x benchmark rate) / (1 - (1 + benchmark rate)^-remaining term)",
    reminders: [
      "The minimum yearly repayment must be made by 30 June. Missing it means the shortfall is a deemed unfranked dividend, assessable to the shareholder or associate.",
      "A written loan agreement must be in place before the company's lodgment day for the year the loan was made.",
      "Repayments funded by a dividend from the same private company are generally disregarded (s 109R).",
      "An unpaid present entitlement owed by a trust to a corporate beneficiary can be treated as a Division 7A loan - see TD 2022/11 and the sub-trust guidance.",
    ],
    caveats: collectCaveats(cfg),
    disclaimer: DISCLAIMER,
  };
}

module.exports = {
  calculateCompanyTax,
  calculateFranking,
  calculateDiv7AMinimumRepayment,
  baseRateEntityTest,
};
