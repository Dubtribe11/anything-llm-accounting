/**
 * Trust net income (s 95 ITAA 1936) and beneficiary distribution calculations,
 * including streaming of franked distributions (Subdiv 207-B) and capital gains
 * (Subdiv 115-C), Division 6AA minor rates and s 99A on undistributed income.
 */
const { ratesFor, normalizeFinancialYear } = require("../data");
const {
  round2,
  toAmount,
  toBool,
  applyBrackets,
  collectCaveats,
  DISCLAIMER,
} = require("./helpers");
const { calculateIndividualTax } = require("./individual");

/**
 * Division 6AA tax on the "eligible" (unearned) income of a minor.
 * @param {number} eligibleIncome
 * @param {object} rates
 */
function minorEligibleIncomeTax(eligibleIncome, rates) {
  const result = applyBrackets(
    eligibleIncome,
    rates.individual.minorUnearnedIncome
  );
  return {
    eligibleIncome: round2(eligibleIncome),
    tax: result.tax,
    breakdown: result.breakdown,
    note: "Division 6AA applies penalty rates to a minor's unearned income (including most trust distributions) unless it is 'excepted' income - for example, employment income, income from a deceased estate, or income of a disabled or full-time working minor.",
  };
}

/**
 * @param {object} input
 * @param {string} [input.financialYear]
 * @param {number} [input.trustNetIncome] - s 95 net income; derived from components when omitted
 * @param {object} [input.components]
 * @param {number} [input.components.ordinaryIncome]
 * @param {number} [input.components.frankedDistributions] - cash amount
 * @param {number} [input.components.frankingCredits]
 * @param {number} [input.components.grossCapitalGains] - before any CGT discount
 * @param {number} [input.components.capitalLossesApplied]
 * @param {boolean} [input.components.capitalGainsDiscountEligible]
 * @param {number} [input.components.foreignIncome]
 * @param {number} [input.components.foreignIncomeTaxOffsets]
 * @param {number} [input.components.deductions]
 * @param {Array<object>} input.beneficiaries
 *   { name, entityType, sharePercent | shareAmount, isMinor, otherTaxableIncome,
 *     streamedFrankedDistributions, streamedCapitalGains, residency }
 */
function calculateTrustDistribution(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));
  const c = input.components ?? {};

  const ordinaryIncome = toAmount(c.ordinaryIncome, "ordinaryIncome");
  const frankedDistributions = toAmount(
    c.frankedDistributions,
    "frankedDistributions"
  );
  const frankingCredits = toAmount(c.frankingCredits, "frankingCredits");
  const grossCapitalGains = toAmount(c.grossCapitalGains, "grossCapitalGains");
  const capitalLossesApplied = toAmount(
    c.capitalLossesApplied,
    "capitalLossesApplied"
  );
  const foreignIncome = toAmount(c.foreignIncome, "foreignIncome");
  const foreignIncomeTaxOffsets = toAmount(
    c.foreignIncomeTaxOffsets,
    "foreignIncomeTaxOffsets"
  );
  const deductions = toAmount(c.deductions, "deductions");
  const discountEligible = toBool(c.capitalGainsDiscountEligible, true);

  const gainsAfterLosses = Math.max(
    0,
    grossCapitalGains - capitalLossesApplied
  );
  const discountAmount = discountEligible
    ? round2(gainsAfterLosses * rates.cgt.trustDiscount)
    : 0;
  const netCapitalGain = round2(gainsAfterLosses - discountAmount);

  const derivedNetIncome = round2(
    ordinaryIncome +
      frankedDistributions +
      frankingCredits +
      netCapitalGain +
      foreignIncome -
      deductions
  );
  const trustNetIncome =
    input.trustNetIncome !== undefined && input.trustNetIncome !== null
      ? round2(toAmount(input.trustNetIncome, "trustNetIncome"))
      : derivedNetIncome;

  const beneficiaries = Array.isArray(input.beneficiaries)
    ? input.beneficiaries
    : [];
  const results = [];
  let distributedTotal = 0;

  for (const b of beneficiaries) {
    const sharePercent =
      b.sharePercent !== undefined && b.sharePercent !== null
        ? toAmount(b.sharePercent, "sharePercent")
        : null;
    const shareAmount =
      b.shareAmount !== undefined && b.shareAmount !== null
        ? toAmount(b.shareAmount, "shareAmount")
        : null;

    const streamedFranked = toAmount(
      b.streamedFrankedDistributions,
      "streamedFrankedDistributions"
    );
    const streamedGains = toAmount(
      b.streamedCapitalGains,
      "streamedCapitalGains"
    );

    // Franking credits follow the streamed franked distribution proportionally.
    const streamedCredits =
      frankedDistributions > 0
        ? round2((streamedFranked / frankedDistributions) * frankingCredits)
        : 0;

    const proportionalShare =
      shareAmount !== null
        ? shareAmount
        : sharePercent !== null
          ? round2((sharePercent / 100) * trustNetIncome)
          : 0;

    const share = round2(
      streamedFranked + streamedCredits + streamedGains + proportionalShare
    );
    distributedTotal += share;

    const entry = {
      name: b.name ?? "Beneficiary",
      entityType: b.entityType ?? "individual",
      sharePercent,
      streamedFrankedDistributions: streamedFranked || undefined,
      attachedFrankingCredits: streamedCredits || undefined,
      streamedCapitalGains: streamedGains || undefined,
      proportionalShare: proportionalShare || undefined,
      assessableShare: share,
      isMinor: toBool(b.isMinor, false),
    };

    if (entry.isMinor && entry.entityType === "individual") {
      entry.division6AA = minorEligibleIncomeTax(share, rates);
      entry.estimatedTax = entry.division6AA.tax;
    } else if (entry.entityType === "individual") {
      const otherIncome = toAmount(b.otherTaxableIncome, "otherTaxableIncome");
      const estimate = calculateIndividualTax({
        financialYear: rates.financialYear,
        taxableIncome: share + otherIncome,
        residency: b.residency ?? "resident",
        frankingCredits: streamedCredits,
      });
      entry.estimatedTax = estimate.totals.totalTaxLiability;
      entry.estimatedTaxDetail = {
        taxableIncomeIncludingOtherIncome: round2(share + otherIncome),
        totalTaxLiability: estimate.totals.totalTaxLiability,
        frankingCreditsClaimed: streamedCredits,
        estimatedRefund: estimate.totals.estimatedRefund,
        estimatedAmountPayable: estimate.totals.estimatedAmountPayable,
      };
    } else if (entry.entityType === "company") {
      const rate = rates.company.baseRateEntityRate;
      entry.estimatedTax = round2(share * rate);
      entry.estimatedTaxDetail = {
        rateAssumed: rate,
        note: "Assumes the corporate beneficiary is a base rate entity. An unpaid present entitlement to a corporate beneficiary can trigger Division 7A - see TD 2022/11.",
      };
    } else if (
      entry.entityType === "smsf" ||
      entry.entityType === "super-fund"
    ) {
      entry.estimatedTax = round2(share * rates.smsf.accumulationRate);
      entry.estimatedTaxDetail = {
        rateAssumed: rates.smsf.accumulationRate,
        note: "A distribution to a fund from a related trust may be non-arm's length income taxed at 45% unless the fixed trust and arm's length requirements are met.",
      };
    } else {
      entry.estimatedTax = null;
      entry.estimatedTaxDetail = {
        note: "Tax is assessed in the hands of the receiving entity - flow the share through to that entity's own return.",
      };
    }

    results.push(entry);
  }

  const undistributed = round2(trustNetIncome - distributedTotal);
  const trusteeAssessment =
    undistributed > 0
      ? {
          amount: undistributed,
          rate: rates.trust.section99ARate,
          tax: round2(undistributed * rates.trust.section99ARate),
          basis:
            "Income to which no beneficiary is presently entitled is assessed to the trustee under s 99A at the top marginal rate (no tax-free threshold, no Medicare levy).",
        }
      : {
          amount: 0,
          rate: 0,
          tax: 0,
          basis: "All net income is distributed - no s 99A trustee assessment.",
        };

  return {
    calculator: "trust-distribution",
    financialYear: rates.financialYear,
    netIncome: {
      trustNetIncome,
      derivedFromComponents:
        input.trustNetIncome === undefined || input.trustNetIncome === null,
      components: {
        ordinaryIncome: round2(ordinaryIncome),
        frankedDistributions: round2(frankedDistributions),
        frankingCredits: round2(frankingCredits),
        grossCapitalGains: round2(grossCapitalGains),
        capitalLossesApplied: round2(capitalLossesApplied),
        cgtDiscountApplied: discountAmount,
        netCapitalGain,
        foreignIncome: round2(foreignIncome),
        foreignIncomeTaxOffsets: round2(foreignIncomeTaxOffsets),
        deductions: round2(deductions),
      },
    },
    beneficiaries: results,
    distributedTotal: round2(distributedTotal),
    trusteeAssessment,
    complianceReminders: [
      "A valid resolution making beneficiaries presently entitled must be made by 30 June (or the earlier date the trust deed requires) and be recorded in writing.",
      "Check the trust deed actually permits the distribution - including whether the intended beneficiary is within the class of eligible beneficiaries.",
      "Streaming franked distributions or capital gains requires the deed to permit it and the entitlement to be recorded specifically (by 30 June for capital gains, 31 August for franked distributions).",
      "Distributions outside the family group of a family trust election attract family trust distribution tax at 47%.",
      "Section 100A (reimbursement agreements) - review PCG 2022/2 risk zones where the beneficiary is not the person who benefits from the funds.",
      "Trust losses are trapped in the trust and cannot be distributed; they must satisfy the trust loss tests in Schedule 2F to be recouped.",
    ],
    caveats: collectCaveats(rates.trust),
    disclaimer: DISCLAIMER,
  };
}

module.exports = { calculateTrustDistribution, minorEligibleIncomeTax };
