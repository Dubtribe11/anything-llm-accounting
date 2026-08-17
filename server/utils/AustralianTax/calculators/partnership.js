/**
 * Partnership net income distribution (Division 5 ITAA 1936).
 *
 * A partnership lodges a return but is not itself a taxpaying entity - each
 * partner includes their share of the partnership net income (or loss) in their
 * own return.
 */
const { ratesFor, normalizeFinancialYear } = require("../data");
const { round2, toAmount, DISCLAIMER } = require("./helpers");
const { calculateIndividualTax } = require("./individual");

/**
 * @param {object} input
 * @param {string} [input.financialYear]
 * @param {number} [input.partnershipNetIncome] - or supply income/deductions
 * @param {number} [input.assessableIncome]
 * @param {number} [input.deductions]
 * @param {Array<object>} input.partners
 *   { name, sharePercent, salaryOrDrawings, otherTaxableIncome, entityType }
 */
function calculatePartnershipDistribution(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));

  const assessableIncome = toAmount(input.assessableIncome, "assessableIncome");
  const deductions = toAmount(input.deductions, "deductions");
  const netIncome =
    input.partnershipNetIncome !== undefined &&
    input.partnershipNetIncome !== null
      ? round2(toAmount(input.partnershipNetIncome, "partnershipNetIncome"))
      : round2(assessableIncome - deductions);

  const partners = Array.isArray(input.partners) ? input.partners : [];
  const results = [];
  let allocated = 0;

  for (const p of partners) {
    const sharePercent = toAmount(p.sharePercent, "sharePercent");
    const share = round2((sharePercent / 100) * netIncome);
    allocated += share;

    const entry = {
      name: p.name ?? "Partner",
      entityType: p.entityType ?? "individual",
      sharePercent,
      shareOfNetIncome: share,
    };

    if (entry.entityType === "individual") {
      const otherIncome = toAmount(p.otherTaxableIncome, "otherTaxableIncome");
      const estimate = calculateIndividualTax({
        financialYear: rates.financialYear,
        taxableIncome: Math.max(0, share + otherIncome),
      });
      entry.estimatedTaxOnTotalIncome = estimate.totals.totalTaxLiability;
      entry.marginalRate = estimate.totals.marginalRate;
    } else if (entry.entityType === "company") {
      entry.estimatedTax = round2(
        Math.max(0, share) * rates.company.baseRateEntityRate
      );
    }

    results.push(entry);
  }

  const unallocated = round2(netIncome - allocated);

  return {
    calculator: "partnership-distribution",
    financialYear: rates.financialYear,
    partnershipNetIncome: netIncome,
    partners: results,
    allocatedTotal: round2(allocated),
    unallocated,
    isLoss: netIncome < 0,
    reminders: [
      "A partnership is not a taxpayer - it lodges a return, obtains a TFN and (if required) an ABN and GST registration, but the partners are assessed on their shares.",
      "Partnership losses flow through to the partners, subject to the non-commercial loss rules in Division 35 for individual partners.",
      "So-called 'partner salaries' are not deductible to the partnership - they are just a way of describing a share of profits.",
      "Personal services income rules can attribute income back to the individual who performed the services regardless of the partnership agreement.",
      unallocated !== 0
        ? "The partner shares do not add up to 100% of the net income - check the partnership agreement."
        : null,
    ].filter(Boolean),
    disclaimer: DISCLAIMER,
  };
}

module.exports = { calculatePartnershipDistribution };
