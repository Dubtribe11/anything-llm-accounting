/**
 * Superannuation guarantee, contribution caps, Division 293 and SMSF tax.
 */
const { ratesFor, normalizeFinancialYear } = require("../data");
const {
  round2,
  toAmount,
  toBool,
  collectCaveats,
  DISCLAIMER,
} = require("./helpers");

/**
 * Superannuation guarantee on ordinary time earnings.
 * @param {object} input
 * @param {number} input.ordinaryTimeEarnings - for the period
 * @param {"quarter"|"year"} [input.period]
 * @param {string} [input.financialYear]
 */
function calculateSuperGuarantee(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));
  const cfg = rates.superannuation;
  const ote = toAmount(input.ordinaryTimeEarnings, "ordinaryTimeEarnings");
  const period = input.period === "year" ? "year" : "quarter";

  const cap =
    period === "year"
      ? cfg.maximumContributionBaseQuarterly * 4
      : cfg.maximumContributionBaseQuarterly;
  const cappedEarnings = Math.min(ote, cap);
  const amount = round2(cappedEarnings * cfg.guaranteeRate);

  return {
    calculator: "superannuation-guarantee",
    financialYear: rates.financialYear,
    guaranteeRate: cfg.guaranteeRate,
    period,
    ordinaryTimeEarnings: round2(ote),
    maximumContributionBase: cap,
    earningsSubjectToSG: round2(cappedEarnings),
    superGuaranteeAmount: amount,
    cappedByMaximumContributionBase: ote > cap,
    reminders: [
      "SG is calculated on ordinary time earnings - it excludes overtime but includes most allowances, bonuses, commissions and paid leave.",
      "SG must be received by the fund by the 28th day after the end of the quarter. Late payment means the SG charge (shortfall + nominal interest + administration fee) and the amount is not deductible.",
      "From 1 July 2026 employers must pay super at the same time as salary and wages under Payday Super - confirm the enacted commencement rules.",
      "Contractors paid wholly or principally for their labour are treated as employees for SG purposes.",
    ],
    caveats: collectCaveats(cfg),
    disclaimer: DISCLAIMER,
  };
}

/**
 * Contribution cap position for an individual.
 * @param {object} input
 * @param {number} [input.concessionalContributions] - employer + salary sacrifice + personal deductible
 * @param {number} [input.nonConcessionalContributions]
 * @param {number} [input.totalSuperBalanceAt30June] - prior 30 June balance
 * @param {number} [input.unusedConcessionalCapCarriedForward]
 * @param {number} [input.income] - income for Division 293 purposes (excluding the contributions)
 * @param {number} [input.age]
 * @param {string} [input.financialYear]
 */
function calculateContributionCaps(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));
  const cfg = rates.superannuation;

  const concessional = toAmount(
    input.concessionalContributions,
    "concessionalContributions"
  );
  const nonConcessional = toAmount(
    input.nonConcessionalContributions,
    "nonConcessionalContributions"
  );
  const totalSuperBalance = toAmount(
    input.totalSuperBalanceAt30June,
    "totalSuperBalanceAt30June"
  );
  const carriedForward = toAmount(
    input.unusedConcessionalCapCarriedForward,
    "unusedConcessionalCapCarriedForward"
  );
  const age = toAmount(input.age, "age");

  // Carry-forward is only available where the prior 30 June total super balance
  // is under $500,000.
  const carryForwardAvailable =
    totalSuperBalance < cfg.carryForwardConcessionalTSBLimit;
  const effectiveConcessionalCap =
    cfg.concessionalCap + (carryForwardAvailable ? carriedForward : 0);
  const concessionalExcess = round2(
    Math.max(0, concessional - effectiveConcessionalCap)
  );

  // Non-concessional cap is nil once the total super balance reaches the cap.
  let ncCap;
  let bringForwardYears = 1;
  if (totalSuperBalance >= cfg.totalSuperBalanceThresholdForNCC) {
    ncCap = 0;
  } else if (
    totalSuperBalance <
      cfg.totalSuperBalanceThresholdForNCC - cfg.bringForwardCap &&
    age < 75
  ) {
    ncCap = cfg.bringForwardCap;
    bringForwardYears = 3;
  } else if (
    totalSuperBalance <
      cfg.totalSuperBalanceThresholdForNCC - cfg.nonConcessionalCap &&
    age < 75
  ) {
    ncCap = cfg.nonConcessionalCap * 2;
    bringForwardYears = 2;
  } else {
    ncCap = cfg.nonConcessionalCap;
  }
  const nonConcessionalExcess = round2(Math.max(0, nonConcessional - ncCap));

  // Division 293 - extra 15% on low tax contributions for high income earners.
  const income = toAmount(input.income, "income");
  const div293Income = income + Math.min(concessional, cfg.concessionalCap);
  const div293Excess = Math.max(0, div293Income - cfg.division293Threshold);
  const div293Base = Math.min(
    div293Excess,
    Math.min(concessional, cfg.concessionalCap)
  );
  const div293Tax = round2(div293Base * cfg.division293Rate);

  return {
    calculator: "superannuation-contribution-caps",
    financialYear: rates.financialYear,
    concessional: {
      contributions: round2(concessional),
      standardCap: cfg.concessionalCap,
      carryForwardAvailable,
      carryForwardApplied: carryForwardAvailable ? round2(carriedForward) : 0,
      effectiveCap: round2(effectiveConcessionalCap),
      remaining: round2(Math.max(0, effectiveConcessionalCap - concessional)),
      excess: concessionalExcess,
      excessTreatment:
        concessionalExcess > 0
          ? "Excess concessional contributions are included in assessable income, taxed at marginal rates with a 15% offset, and attract the excess concessional contributions charge. They may be released from super."
          : "Within cap.",
    },
    nonConcessional: {
      contributions: round2(nonConcessional),
      standardCap: cfg.nonConcessionalCap,
      capAvailable: round2(ncCap),
      bringForwardYearsAvailable: bringForwardYears,
      totalSuperBalanceThreshold: cfg.totalSuperBalanceThresholdForNCC,
      totalSuperBalanceAt30June: round2(totalSuperBalance),
      excess: nonConcessionalExcess,
      excessTreatment:
        nonConcessionalExcess > 0
          ? "Excess non-concessional contributions can be released with 85% of the associated earnings included in assessable income, or left in the fund and taxed at 47%."
          : "Within cap.",
    },
    division293: {
      threshold: cfg.division293Threshold,
      incomeForDivision293Purposes: round2(div293Income),
      additionalTax: div293Tax,
      rate: cfg.division293Rate,
      note: "Division 293 doubles the effective contributions tax to 30% on the amount of low tax contributions that pushes income over the threshold.",
    },
    transferBalanceCap: cfg.transferBalanceCap,
    proposedDivision296: cfg.proposedDivision296,
    reminders: [
      "A personal deductible contribution requires a valid notice of intent to claim (s 290-170) acknowledged by the fund before the return is lodged.",
      "Work test requirements apply to personal deductible contributions for individuals aged 67-74.",
      "Contributions are counted in the year the fund RECEIVES them, not when they are paid.",
    ],
    caveats: collectCaveats(cfg),
    disclaimer: DISCLAIMER,
  };
}

/**
 * SMSF / complying superannuation fund income tax.
 * @param {object} input
 * @param {number} [input.concessionalContributionsReceived]
 * @param {number} [input.investmentIncome]
 * @param {number} [input.grossCapitalGains]
 * @param {boolean} [input.capitalGainsHeldOver12Months]
 * @param {number} [input.exemptCurrentPensionIncomePercentage] - 0-100
 * @param {number} [input.deductions]
 * @param {number} [input.frankingCredits]
 * @param {number} [input.nonArmsLengthIncome]
 * @param {string} [input.financialYear]
 */
function calculateSmsfTax(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));
  const cfg = rates.smsf;

  const contributions = toAmount(
    input.concessionalContributionsReceived,
    "concessionalContributionsReceived"
  );
  const investmentIncome = toAmount(input.investmentIncome, "investmentIncome");
  const grossGains = toAmount(input.grossCapitalGains, "grossCapitalGains");
  const heldOver12Months = toBool(input.capitalGainsHeldOver12Months, false);
  const deductions = toAmount(input.deductions, "deductions");
  const frankingCredits = toAmount(input.frankingCredits, "frankingCredits");
  const nali = toAmount(input.nonArmsLengthIncome, "nonArmsLengthIncome");
  const ecpiPercent = Math.min(
    100,
    Math.max(
      0,
      toAmount(
        input.exemptCurrentPensionIncomePercentage,
        "exemptCurrentPensionIncomePercentage"
      )
    )
  );

  const cgtDiscount = heldOver12Months
    ? round2(grossGains * cfg.cgtDiscount)
    : 0;
  const netCapitalGain = round2(grossGains - cgtDiscount);

  // ECPI exempts a proportion of ordinary and statutory income (not contributions).
  const exemptProportion = ecpiPercent / 100;
  const assessableInvestmentIncome = round2(
    (investmentIncome + netCapitalGain + frankingCredits) *
      (1 - exemptProportion)
  );
  const exemptCurrentPensionIncome = round2(
    (investmentIncome + netCapitalGain + frankingCredits) * exemptProportion
  );

  const taxableIncome = round2(
    Math.max(
      0,
      contributions +
        assessableInvestmentIncome -
        deductions * (1 - exemptProportion)
    )
  );
  const concessionalTax = round2(taxableIncome * cfg.accumulationRate);
  const naliTax = round2(nali * cfg.nonArmsLengthIncomeRate);
  const grossTax = round2(concessionalTax + naliTax);
  const balance = round2(grossTax - frankingCredits * (1 - exemptProportion));

  return {
    calculator: "smsf-income-tax",
    financialYear: rates.financialYear,
    rates: {
      accumulationRate: cfg.accumulationRate,
      cgtDiscount: cfg.cgtDiscount,
      effectiveCgtRateOnDiscountedGains:
        round2(cfg.accumulationRate * (1 - cfg.cgtDiscount) * 100) / 100,
      nonArmsLengthIncomeRate: cfg.nonArmsLengthIncomeRate,
    },
    contributionsIncome: round2(contributions),
    netCapitalGain,
    cgtDiscountApplied: cgtDiscount,
    exemptCurrentPensionIncome,
    exemptCurrentPensionIncomePercentage: ecpiPercent,
    taxableIncome,
    tax: {
      concessionalComponent: concessionalTax,
      nonArmsLengthComponent: naliTax,
      total: grossTax,
    },
    frankingCreditsClaimed: round2(frankingCredits * (1 - exemptProportion)),
    estimatedAmountPayable: balance > 0 ? balance : 0,
    estimatedRefund: balance < 0 ? round2(Math.abs(balance)) : 0,
    reminders: [
      "Excess franking credits are refundable to a complying superannuation fund.",
      "ECPI is claimed using the segregated method or an actuarial certificate under the proportionate method.",
      "Non-arm's length income and non-arm's length expenditure are taxed at 45% - review any related-party dealing carefully.",
      "The fund must satisfy the sole purpose test and the in-house asset rule (5% limit) and hold an annual audit by an approved SMSF auditor.",
    ],
    caveats: collectCaveats(cfg),
    disclaimer: DISCLAIMER,
  };
}

module.exports = {
  calculateSuperGuarantee,
  calculateContributionCaps,
  calculateSmsfTax,
};
