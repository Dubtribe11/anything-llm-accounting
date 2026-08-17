/**
 * Capital gains tax - net capital gain, the discount and indexation methods,
 * and the four small business CGT concessions in Division 152.
 */
const { ratesFor, normalizeFinancialYear } = require("../data");
const {
  round2,
  toAmount,
  toBool,
  collectCaveats,
  DISCLAIMER,
} = require("./helpers");

const DISCOUNT_KEY = {
  individual: "individualDiscount",
  trust: "trustDiscount",
  "super-fund": "complyingSuperFundDiscount",
  smsf: "complyingSuperFundDiscount",
  company: "companyDiscount",
  partnership: "individualDiscount",
};

/**
 * @param {object} input
 * @param {string} [input.financialYear]
 * @param {"individual"|"trust"|"company"|"smsf"|"super-fund"|"partnership"} [input.entityType]
 * @param {number} input.capitalProceeds
 * @param {number} input.costBase - includes incidental costs and (for non-depreciating assets) holding costs where not otherwise deducted
 * @param {number} [input.improvementCosts]
 * @param {number} [input.acquisitionDate] - ISO date string; used for the 12 month test
 * @param {string} [input.disposalDate]
 * @param {boolean} [input.heldMoreThan12Months] - overrides the date test
 * @param {number} [input.currentYearCapitalLosses]
 * @param {number} [input.priorYearCapitalLosses]
 * @param {object} [input.smallBusinessConcessions]
 * @param {boolean} [input.smallBusinessConcessions.fifteenYearExemption]
 * @param {boolean} [input.smallBusinessConcessions.activeAssetReduction]
 * @param {number} [input.smallBusinessConcessions.retirementExemptionAmount]
 * @param {number} [input.smallBusinessConcessions.rolloverAmount]
 * @param {number} [input.smallBusinessConcessions.retirementExemptionAlreadyUsed]
 */
function calculateCapitalGain(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));
  const entityType = DISCOUNT_KEY[input.entityType]
    ? input.entityType
    : "individual";

  const capitalProceeds = toAmount(input.capitalProceeds, "capitalProceeds");
  const costBase =
    toAmount(input.costBase, "costBase") +
    toAmount(input.improvementCosts, "improvementCosts");

  const grossGain = round2(capitalProceeds - costBase);
  const steps = [
    {
      step: "Capital proceeds less cost base",
      amount: grossGain,
      detail: `$${round2(capitalProceeds).toLocaleString("en-AU")} - $${round2(costBase).toLocaleString("en-AU")}`,
    },
  ];

  if (grossGain <= 0) {
    return {
      calculator: "capital-gains-tax",
      financialYear: rates.financialYear,
      entityType,
      capitalProceeds: round2(capitalProceeds),
      costBase: round2(costBase),
      capitalLoss: round2(Math.abs(grossGain)),
      netCapitalGain: 0,
      steps,
      note: "A capital loss can only be offset against capital gains - current year gains first, then carried forward indefinitely. It cannot be offset against ordinary income.",
      disclaimer: DISCLAIMER,
    };
  }

  // 1. Apply capital losses BEFORE the discount.
  const currentYearLosses = toAmount(
    input.currentYearCapitalLosses,
    "currentYearCapitalLosses"
  );
  const priorYearLosses = toAmount(
    input.priorYearCapitalLosses,
    "priorYearCapitalLosses"
  );
  const totalLosses = currentYearLosses + priorYearLosses;
  let running = Math.max(0, grossGain - totalLosses);
  if (totalLosses > 0)
    steps.push({
      step: "Less capital losses (applied before any discount)",
      amount: round2(-Math.min(totalLosses, grossGain)),
      detail: `Current year $${round2(currentYearLosses).toLocaleString("en-AU")} + carried forward $${round2(priorYearLosses).toLocaleString("en-AU")}`,
      runningTotal: round2(running),
    });

  const sb = input.smallBusinessConcessions ?? {};
  const sbCfg = rates.cgt.smallBusiness;
  const concessionsApplied = [];

  // 2. 15-year exemption disregards the whole gain - nothing else applies.
  if (toBool(sb.fifteenYearExemption, false)) {
    concessionsApplied.push({
      concession: "Subdiv 152-B 15-year exemption",
      amountDisregarded: round2(running),
      note: "The entire gain is disregarded. The 15-year exemption is applied before the CGT discount and before any other concession, and the proceeds can be contributed to super under the CGT cap.",
    });
    return {
      calculator: "capital-gains-tax",
      financialYear: rates.financialYear,
      entityType,
      capitalProceeds: round2(capitalProceeds),
      costBase: round2(costBase),
      grossCapitalGain: grossGain,
      steps: [
        ...steps,
        {
          step: "15-year exemption - entire gain disregarded",
          amount: round2(-running),
          runningTotal: 0,
        },
      ],
      concessionsApplied,
      netCapitalGain: 0,
      caveats: collectCaveats(rates.cgt),
      disclaimer: DISCLAIMER,
    };
  }

  // 3. CGT discount.
  const holdingQualifies =
    input.heldMoreThan12Months !== undefined &&
    input.heldMoreThan12Months !== null
      ? toBool(input.heldMoreThan12Months, false)
      : qualifiesForDiscountByDate(
          input.acquisitionDate,
          input.disposalDate,
          rates
        );
  const discountRate = holdingQualifies
    ? rates.cgt[DISCOUNT_KEY[entityType]]
    : 0;
  const discountAmount = round2(running * discountRate);
  if (discountAmount > 0) {
    running = round2(running - discountAmount);
    steps.push({
      step: `CGT discount (${(discountRate * 100).toFixed(2).replace(/\.00$/, "")}%)`,
      amount: round2(-discountAmount),
      runningTotal: running,
      detail:
        "Requires the asset to have been held for at least 12 months. Companies get no discount.",
    });
  } else if (!holdingQualifies) {
    steps.push({
      step: "CGT discount not available",
      amount: 0,
      runningTotal: running,
      detail: "Asset held for 12 months or less (or the entity is a company).",
    });
  }

  // 4. 50% active asset reduction.
  if (toBool(sb.activeAssetReduction, false)) {
    const reduction = round2(running * sbCfg.activeAssetReduction);
    running = round2(running - reduction);
    concessionsApplied.push({
      concession: "Subdiv 152-C 50% active asset reduction",
      amountDisregarded: reduction,
    });
    steps.push({
      step: "50% active asset reduction",
      amount: round2(-reduction),
      runningTotal: running,
    });
  }

  // 5. Retirement exemption (lifetime cap).
  const alreadyUsed = toAmount(
    sb.retirementExemptionAlreadyUsed,
    "retirementExemptionAlreadyUsed"
  );
  const requestedRetirement = toAmount(
    sb.retirementExemptionAmount,
    "retirementExemptionAmount"
  );
  if (requestedRetirement > 0) {
    const capRemaining = Math.max(
      0,
      sbCfg.retirementExemptionLifetimeCap - alreadyUsed
    );
    const applied = round2(
      Math.min(requestedRetirement, capRemaining, running)
    );
    running = round2(running - applied);
    concessionsApplied.push({
      concession: "Subdiv 152-D retirement exemption",
      amountDisregarded: applied,
      lifetimeCap: sbCfg.retirementExemptionLifetimeCap,
      lifetimeCapRemaining: round2(capRemaining - applied),
      note: "If the individual is under 55 at the time of the choice, the amount must be paid into a complying superannuation fund or RSA.",
    });
    steps.push({
      step: "Retirement exemption",
      amount: round2(-applied),
      runningTotal: running,
    });
  }

  // 6. Rollover.
  const requestedRollover = toAmount(sb.rolloverAmount, "rolloverAmount");
  if (requestedRollover > 0) {
    const applied = round2(Math.min(requestedRollover, running));
    running = round2(running - applied);
    concessionsApplied.push({
      concession: "Subdiv 152-E small business rollover",
      amountDeferred: applied,
      note: "A replacement asset must be acquired within the replacement asset period (one year before to two years after the CGT event) or the deferred gain crystallises.",
    });
    steps.push({
      step: "Small business rollover",
      amount: round2(-applied),
      runningTotal: running,
    });
  }

  const netCapitalGain = round2(Math.max(0, running));

  return {
    calculator: "capital-gains-tax",
    financialYear: rates.financialYear,
    entityType,
    capitalProceeds: round2(capitalProceeds),
    costBase: round2(costBase),
    grossCapitalGain: grossGain,
    discountEligible: holdingQualifies,
    discountRate,
    steps,
    concessionsApplied,
    netCapitalGain,
    note: "The net capital gain is added to assessable income - it is not taxed at a separate rate.",
    eligibilityReminders: [
      "Small business CGT concessions require the basic conditions in Subdiv 152-A: the $2m aggregated turnover test or the $6m maximum net asset value test, and the asset must satisfy the active asset test.",
      "For shares in a company or interests in a trust there are extra conditions, including the 90% test and the 80% active asset test on the underlying entity.",
      "The main residence exemption, the 6-year absence rule and partial exemptions for income-producing use are separate rules that apply before these concessions.",
    ],
    caveats: collectCaveats(rates.cgt),
    disclaimer: DISCLAIMER,
  };
}

function qualifiesForDiscountByDate(acquisitionDate, disposalDate, rates) {
  if (!acquisitionDate) return false;
  const acquired = new Date(acquisitionDate);
  const disposed = disposalDate ? new Date(disposalDate) : new Date();
  if (Number.isNaN(acquired.getTime()) || Number.isNaN(disposed.getTime()))
    return false;
  const days = (disposed - acquired) / (1000 * 60 * 60 * 24);
  return days > rates.cgt.minimumHoldingDays;
}

module.exports = { calculateCapitalGain };
