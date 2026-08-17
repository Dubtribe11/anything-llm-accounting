/**
 * Capital allowances (Division 40) and capital works (Division 43).
 */
const {
  ratesFor,
  normalizeFinancialYear,
  COMMON_EFFECTIVE_LIVES,
  CAPITAL_WORKS_RATES,
} = require("../data");
const {
  round2,
  toAmount,
  toBool,
  collectCaveats,
  DISCLAIMER,
} = require("./helpers");

/**
 * @param {object} input
 * @param {number} input.cost
 * @param {number} [input.effectiveLifeYears] - or supply assetDescription for a lookup
 * @param {string} [input.assetDescription]
 * @param {"diminishing-value"|"prime-cost"} [input.method]
 * @param {number} [input.daysHeldInFirstYear]
 * @param {number} [input.businessUsePercentage] - 0-100
 * @param {number} [input.years] - how many years of the schedule to produce
 * @param {number} [input.openingAdjustableValue] - continue an existing schedule
 * @param {boolean} [input.isCar] - applies the car depreciation cost limit
 * @param {boolean} [input.smallBusinessEntity] - enables instant asset write-off testing
 * @param {number} [input.aggregatedTurnover]
 * @param {string} [input.financialYear]
 */
function calculateDepreciation(input = {}) {
  const rates = ratesFor(normalizeFinancialYear(input.financialYear));
  const cfg = rates.deductions;

  let cost = toAmount(input.cost, "cost");
  const isCar = toBool(input.isCar, false);
  let carLimitApplied = false;
  if (isCar && cost > cfg.carDepreciationLimit) {
    cost = cfg.carDepreciationLimit;
    carLimitApplied = true;
  }

  const businessUsePercentage =
    input.businessUsePercentage === undefined ||
    input.businessUsePercentage === null
      ? 100
      : toAmount(input.businessUsePercentage, "businessUsePercentage");

  const lookupKey = String(input.assetDescription ?? "")
    .trim()
    .toLowerCase();
  const effectiveLife =
    input.effectiveLifeYears !== undefined && input.effectiveLifeYears !== null
      ? toAmount(input.effectiveLifeYears, "effectiveLifeYears")
      : COMMON_EFFECTIVE_LIVES[lookupKey] ?? null;

  // Instant asset write-off check first - it removes the need for a schedule.
  const iawo = cfg.instantAssetWriteOff;
  const smallBusinessEntity = toBool(input.smallBusinessEntity, false);
  const aggregatedTurnover = toAmount(
    input.aggregatedTurnover,
    "aggregatedTurnover"
  );
  const iawoEligible =
    smallBusinessEntity &&
    cost < iawo.amount &&
    (aggregatedTurnover === 0 ||
      aggregatedTurnover < iawo.aggregatedTurnoverThreshold);

  if (iawoEligible) {
    return {
      calculator: "depreciation",
      financialYear: rates.financialYear,
      outcome: "instant-asset-write-off",
      cost: round2(cost),
      threshold: iawo.amount,
      immediateDeduction: round2(cost * (businessUsePercentage / 100)),
      businessUsePercentage,
      note: `The asset costs less than the $${iawo.amount.toLocaleString("en-AU")} instant asset write-off threshold, so the taxable purpose portion is deductible immediately in the year it is first used or installed ready for use.`,
      caveats: collectCaveats(iawo),
      disclaimer: DISCLAIMER,
    };
  }

  if (!effectiveLife || effectiveLife <= 0) {
    return {
      calculator: "depreciation",
      financialYear: rates.financialYear,
      outcome: "effective-life-required",
      cost: round2(cost),
      message:
        "An effective life is required. Supply `effectiveLifeYears`, or use an asset description from the bundled list, or look up the Commissioner's effective life in the current taxation ruling (and note that self-assessment of effective life is also permitted under s 40-105).",
      knownAssetDescriptions: Object.keys(COMMON_EFFECTIVE_LIVES),
      disclaimer: DISCLAIMER,
    };
  }

  const method =
    input.method === "prime-cost" ? "prime-cost" : "diminishing-value";
  const daysFirstYear =
    input.daysHeldInFirstYear === undefined ||
    input.daysHeldInFirstYear === null
      ? 365
      : toAmount(input.daysHeldInFirstYear, "daysHeldInFirstYear");
  const years = Math.max(
    1,
    Math.min(20, toAmount(input.years, "years") || Math.ceil(effectiveLife))
  );

  const openingAdjustableValue =
    input.openingAdjustableValue !== undefined &&
    input.openingAdjustableValue !== null
      ? toAmount(input.openingAdjustableValue, "openingAdjustableValue")
      : cost;

  const schedule = [];
  let adjustableValue = openingAdjustableValue;

  for (let year = 1; year <= years; year++) {
    const daysHeld = year === 1 ? daysFirstYear : 365;
    let decline;
    if (method === "prime-cost") {
      decline = cost * (daysHeld / 365) * (1 / effectiveLife);
    } else {
      decline = adjustableValue * (daysHeld / 365) * (2 / effectiveLife);
    }
    decline = Math.min(decline, adjustableValue);
    const deductible = decline * (businessUsePercentage / 100);
    const closing = round2(adjustableValue - decline);

    schedule.push({
      year,
      openingAdjustableValue: round2(adjustableValue),
      declineInValue: round2(decline),
      deductibleAmount: round2(deductible),
      closingAdjustableValue: closing,
    });

    adjustableValue = closing;
    if (adjustableValue <= 0) break;
  }

  return {
    calculator: "depreciation",
    financialYear: rates.financialYear,
    outcome: "schedule",
    method,
    formula:
      method === "prime-cost"
        ? "Cost x (days held / 365) x (100% / effective life)"
        : "Base value x (days held / 365) x (200% / effective life)",
    cost: round2(cost),
    carDepreciationLimitApplied: carLimitApplied,
    carDepreciationLimit: isCar ? cfg.carDepreciationLimit : undefined,
    effectiveLifeYears: effectiveLife,
    effectiveLifeSource:
      input.effectiveLifeYears !== undefined &&
      input.effectiveLifeYears !== null
        ? "supplied"
        : "bundled common effective life list - confirm against the current taxation ruling",
    businessUsePercentage,
    schedule,
    firstYearDeduction: schedule[0]?.deductibleAmount ?? 0,
    reminders: [
      "A depreciating asset starts to decline in value from its start time - when it is first used or installed ready for use for any purpose.",
      "Only the taxable purpose proportion is deductible; the private portion still reduces the adjustable value.",
      "On disposal, compare termination value with adjustable value: the difference is a balancing adjustment (assessable or deductible).",
      "Second-hand depreciating assets in residential rental properties acquired after 9 May 2017 are generally not deductible.",
      "Low-value pooling (assets under $1,000) is available at 18.75% in the first year and 37.5% thereafter.",
    ],
    caveats: collectCaveats(cfg),
    disclaimer: DISCLAIMER,
  };
}

/**
 * Division 43 capital works deduction.
 * @param {object} input
 * @param {number} input.constructionCost
 * @param {number} [input.rate] - 0.025 or 0.04; inferred from assetType when omitted
 * @param {string} [input.assetType]
 * @param {number} [input.daysIncomeProducing]
 */
function calculateCapitalWorks(input = {}) {
  const constructionCost = toAmount(input.constructionCost, "constructionCost");
  const match = CAPITAL_WORKS_RATES.find(
    (r) =>
      r.assetType.toLowerCase() ===
      String(input.assetType ?? "")
        .trim()
        .toLowerCase()
  );
  const rate =
    input.rate !== undefined && input.rate !== null
      ? toAmount(input.rate, "rate")
      : match?.rate ?? 0.025;
  const normalizedRate = rate > 1 ? rate / 100 : rate;
  const days =
    input.daysIncomeProducing === undefined ||
    input.daysIncomeProducing === null
      ? 365
      : toAmount(input.daysIncomeProducing, "daysIncomeProducing");

  const annual = round2(constructionCost * normalizedRate * (days / 365));

  return {
    calculator: "capital-works",
    constructionCost: round2(constructionCost),
    rate: normalizedRate,
    writeOffPeriodYears: match?.years ?? (normalizedRate === 0.04 ? 25 : 40),
    daysIncomeProducing: days,
    annualDeduction: annual,
    availableRates: CAPITAL_WORKS_RATES,
    reminders: [
      "Capital works deductions are claimed on construction cost, not on the purchase price or land value.",
      "Capital works deductions claimed reduce the cost base of the property for CGT purposes.",
      "Where actual construction costs are unknown, a quantity surveyor's report is the accepted method of estimating them.",
    ],
    disclaimer: DISCLAIMER,
  };
}

module.exports = { calculateDepreciation, calculateCapitalWorks };
