/**
 * Individual (and sole trader) income tax estimate.
 *
 * Covers the pieces that make up a notice of assessment for most individuals:
 * income tax on the relevant scale, the low income tax offset, Medicare levy
 * (including the low-income shade-in), the Medicare levy surcharge, compulsory
 * study and training loan repayments, franking credits, and PAYG credits.
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

const RESIDENCY = {
  resident: "residentBrackets",
  "foreign-resident": "foreignResidentBrackets",
  "working-holiday-maker": "workingHolidayMakerBrackets",
};

/**
 * Low income tax offset (non-refundable).
 * @param {number} taxableIncome
 * @param {object} lito
 * @returns {number}
 */
function lowIncomeTaxOffset(taxableIncome, lito) {
  if (!lito || taxableIncome <= 0) return 0;
  if (taxableIncome <= lito.fullThreshold) return lito.max;

  const { firstTaper, secondTaper } = lito;
  if (taxableIncome <= firstTaper.to) {
    return round2(
      lito.max - (taxableIncome - firstTaper.from) * firstTaper.rate
    );
  }
  const atSecondStart =
    lito.max - (firstTaper.to - firstTaper.from) * firstTaper.rate;
  if (taxableIncome <= secondTaper.to) {
    return round2(
      Math.max(
        0,
        atSecondStart - (taxableIncome - secondTaper.from) * secondTaper.rate
      )
    );
  }
  return 0;
}

/**
 * Medicare levy with the low-income shade-in.
 * Below the threshold no levy is payable; between the threshold and the upper
 * limit the levy is 10c per dollar over the threshold; above it the full 2%.
 */
function medicareLevy(taxableIncome, rates, opts) {
  const cfg = rates.medicareLevy;
  const {
    hasSpouseOrDependants,
    dependentChildren,
    seniorOrPensioner,
    exemption,
  } = opts;

  if (exemption === "full")
    return {
      amount: 0,
      basis: "Full Medicare levy exemption claimed",
      threshold: null,
    };

  let band;
  if (hasSpouseOrDependants) {
    band = seniorOrPensioner ? cfg.seniorFamily : cfg.family;
  } else {
    band = seniorOrPensioner ? cfg.seniorSingle : cfg.single;
  }

  const perChild = band.perDependentChild ?? cfg.family.perDependentChild ?? 0;
  const threshold =
    band.threshold +
    (hasSpouseOrDependants ? perChild * Math.max(0, dependentChildren) : 0);
  // The published upper limit is the threshold divided by (1 - rate/shadeInRate).
  const upper = threshold / (1 - cfg.rate / cfg.shadeInRate);

  let amount;
  let basis;
  if (taxableIncome <= threshold) {
    amount = 0;
    basis = `Income is at or below the ${hasSpouseOrDependants ? "family" : "single"} low-income threshold of $${threshold.toLocaleString("en-AU")}`;
  } else if (taxableIncome <= upper) {
    amount = (taxableIncome - threshold) * cfg.shadeInRate;
    basis = `Shade-in: ${cfg.shadeInRate * 100}c per dollar above $${threshold.toLocaleString("en-AU")}`;
  } else {
    amount = taxableIncome * cfg.rate;
    basis = `Full levy at ${cfg.rate * 100}% of taxable income`;
  }

  if (exemption === "half") {
    amount = amount / 2;
    basis += " (halved for a half Medicare levy exemption)";
  }

  return {
    amount: round2(amount),
    basis,
    threshold: round2(threshold),
    upperLimit: round2(upper),
  };
}

/**
 * Medicare levy surcharge - payable when there is no private *hospital* cover
 * and income for surcharge purposes exceeds the base tier.
 */
function medicareLevySurcharge(incomeForSurcharge, rates, opts) {
  const cfg = rates.medicareLevySurcharge;
  const { hasSpouseOrDependants, dependentChildren, privateHospitalCover } =
    opts;

  if (privateHospitalCover)
    return {
      amount: 0,
      rate: 0,
      tier: "Not applicable",
      basis: "Private hospital cover held for the full year",
    };

  const childAdjustment =
    hasSpouseOrDependants && dependentChildren > 1
      ? (dependentChildren - 1) * cfg.familyThresholdIncreasePerChildAfterFirst
      : 0;

  for (const tier of cfg.tiers) {
    const limit = hasSpouseOrDependants
      ? tier.familyTo === null
        ? null
        : tier.familyTo + childAdjustment
      : tier.singleTo;
    if (limit === null || incomeForSurcharge <= limit) {
      return {
        amount: round2(incomeForSurcharge * tier.rate),
        rate: tier.rate,
        tier: tier.name,
        basis:
          tier.rate === 0
            ? "Income for surcharge purposes is within the base tier"
            : `${(tier.rate * 100).toFixed(2)}% of income for surcharge purposes (${tier.name})`,
      };
    }
  }
  return {
    amount: 0,
    rate: 0,
    tier: "Unknown",
    basis: "No surcharge tier matched",
  };
}

/**
 * Compulsory study and training loan repayment (HELP, VETSL, SFSS, SSL, ABSTUDY SSL, TSL).
 */
function studyLoanRepayment(repaymentIncome, rates, loanBalance) {
  const cfg = rates.studyLoan;
  if (repaymentIncome < cfg.minimumRepaymentIncome)
    return {
      amount: 0,
      system: cfg.system,
      basis: `Repayment income is below the minimum threshold of $${cfg.minimumRepaymentIncome.toLocaleString("en-AU")}`,
    };

  let amount = 0;
  let basis = "";

  if (cfg.system === "marginal") {
    const rows = [];
    for (const band of cfg.marginalBands) {
      const upper = band.to === null ? Infinity : band.to;
      if (repaymentIncome <= band.from) continue;
      const slice = Math.min(repaymentIncome, upper) - band.from;
      amount += slice * band.rate;
      rows.push(
        `${(band.rate * 100).toFixed(0)}% of $${round2(slice).toLocaleString("en-AU")}`
      );
    }
    basis = `Marginal system: ${rows.join(" + ")}`;
  } else {
    const band = cfg.bands.find(
      (b) =>
        repaymentIncome >= b.from && (b.to === null || repaymentIncome < b.to)
    );
    const rate = band?.rate ?? 0;
    amount = repaymentIncome * rate;
    basis = `${(rate * 100).toFixed(1)}% of total repayment income`;
  }

  // The compulsory repayment can never exceed the outstanding balance.
  if (Number.isFinite(loanBalance) && loanBalance > 0 && amount > loanBalance) {
    amount = loanBalance;
    basis += " (capped at the outstanding loan balance)";
  }

  return { amount: round2(amount), system: cfg.system, basis };
}

/**
 * @param {object} input
 * @param {string} [input.financialYear] - e.g. "2025-26"; defaults to the year currently being lodged
 * @param {number} [input.taxableIncome] - supply this, or assessableIncome + deductions
 * @param {number} [input.assessableIncome]
 * @param {number} [input.deductions]
 * @param {"resident"|"foreign-resident"|"working-holiday-maker"} [input.residency]
 * @param {boolean} [input.hasSpouseOrDependants]
 * @param {number} [input.dependentChildren]
 * @param {boolean} [input.seniorOrPensioner]
 * @param {"none"|"half"|"full"} [input.medicareLevyExemption]
 * @param {boolean} [input.privateHospitalCover]
 * @param {number} [input.reportableFringeBenefits]
 * @param {number} [input.reportableSuperContributions]
 * @param {number} [input.netInvestmentLosses]
 * @param {number} [input.exemptForeignEmploymentIncome]
 * @param {boolean} [input.hasStudyLoan]
 * @param {number} [input.studyLoanBalance]
 * @param {number} [input.frankingCredits] - refundable
 * @param {number} [input.otherRefundableOffsets]
 * @param {number} [input.otherNonRefundableOffsets]
 * @param {number} [input.paygWithheld]
 * @param {number} [input.paygInstalmentsPaid]
 */
function calculateIndividualTax(input = {}) {
  const financialYear = normalizeFinancialYear(input.financialYear);
  const rates = ratesFor(financialYear);

  const residency = RESIDENCY[input.residency] ? input.residency : "resident";
  const bracketKey = RESIDENCY[residency];

  const assessableIncome = toAmount(input.assessableIncome, "assessableIncome");
  const deductions = toAmount(input.deductions, "deductions");
  const taxableIncome =
    input.taxableIncome !== undefined && input.taxableIncome !== null
      ? toAmount(input.taxableIncome, "taxableIncome")
      : Math.max(0, assessableIncome - deductions);

  const hasSpouseOrDependants = toBool(input.hasSpouseOrDependants, false);
  const dependentChildren = Math.max(
    0,
    toAmount(input.dependentChildren, "dependentChildren")
  );
  const seniorOrPensioner = toBool(input.seniorOrPensioner, false);
  const privateHospitalCover = toBool(input.privateHospitalCover, false);
  const medicareLevyExemption = ["none", "half", "full"].includes(
    input.medicareLevyExemption
  )
    ? input.medicareLevyExemption
    : "none";

  const reportableFringeBenefits = toAmount(
    input.reportableFringeBenefits,
    "reportableFringeBenefits"
  );
  const reportableSuperContributions = toAmount(
    input.reportableSuperContributions,
    "reportableSuperContributions"
  );
  const netInvestmentLosses = toAmount(
    input.netInvestmentLosses,
    "netInvestmentLosses"
  );
  const exemptForeignEmploymentIncome = toAmount(
    input.exemptForeignEmploymentIncome,
    "exemptForeignEmploymentIncome"
  );

  // Income tax on the applicable scale.
  const scale = applyBrackets(taxableIncome, rates.individual[bracketKey]);

  // LITO is only available to residents.
  const lito =
    residency === "resident"
      ? lowIncomeTaxOffset(taxableIncome, rates.individual.lito)
      : 0;
  const otherNonRefundableOffsets = toAmount(
    input.otherNonRefundableOffsets,
    "otherNonRefundableOffsets"
  );
  const nonRefundableOffsets = round2(lito + otherNonRefundableOffsets);
  const taxAfterOffsets = round2(Math.max(0, scale.tax - nonRefundableOffsets));

  // Foreign residents and working holiday makers are generally not liable for
  // the Medicare levy or the surcharge.
  const medicareApplies = residency === "resident";
  const levy = medicareApplies
    ? medicareLevy(taxableIncome, rates, {
        hasSpouseOrDependants,
        dependentChildren,
        seniorOrPensioner,
        exemption: medicareLevyExemption,
      })
    : {
        amount: 0,
        basis:
          "Foreign residents and working holiday makers are generally not liable for the Medicare levy",
        threshold: null,
      };

  const incomeForSurchargePurposes = round2(
    taxableIncome +
      reportableFringeBenefits +
      reportableSuperContributions +
      netInvestmentLosses +
      exemptForeignEmploymentIncome
  );
  const surcharge =
    medicareApplies && medicareLevyExemption !== "full"
      ? medicareLevySurcharge(incomeForSurchargePurposes, rates, {
          hasSpouseOrDependants,
          dependentChildren,
          privateHospitalCover,
        })
      : {
          amount: 0,
          rate: 0,
          tier: "Not applicable",
          basis: "Not liable for the Medicare levy",
        };

  // Repayment income for study and training loans.
  const repaymentIncome = round2(
    taxableIncome +
      reportableFringeBenefits +
      reportableSuperContributions +
      netInvestmentLosses +
      exemptForeignEmploymentIncome
  );
  const hasStudyLoan =
    toBool(input.hasStudyLoan, false) ||
    toAmount(input.studyLoanBalance, "studyLoanBalance") > 0;
  const studyLoan = hasStudyLoan
    ? studyLoanRepayment(
        repaymentIncome,
        rates,
        toAmount(input.studyLoanBalance, "studyLoanBalance")
      )
    : {
        amount: 0,
        system: rates.studyLoan.system,
        basis: "No study or training loan",
      };

  const totalLiability = round2(
    taxAfterOffsets + levy.amount + surcharge.amount + studyLoan.amount
  );

  const frankingCredits = toAmount(input.frankingCredits, "frankingCredits");
  const otherRefundableOffsets = toAmount(
    input.otherRefundableOffsets,
    "otherRefundableOffsets"
  );
  const paygWithheld = toAmount(input.paygWithheld, "paygWithheld");
  const paygInstalmentsPaid = toAmount(
    input.paygInstalmentsPaid,
    "paygInstalmentsPaid"
  );
  const totalCredits = round2(
    frankingCredits +
      otherRefundableOffsets +
      paygWithheld +
      paygInstalmentsPaid
  );

  const balance = round2(totalLiability - totalCredits);

  return {
    calculator: "individual-income-tax",
    financialYear: rates.financialYear,
    residency,
    inputs: {
      taxableIncome: round2(taxableIncome),
      assessableIncome: round2(assessableIncome) || undefined,
      deductions: round2(deductions) || undefined,
      hasSpouseOrDependants,
      dependentChildren,
      privateHospitalCover,
      medicareLevyExemption,
    },
    incomeTax: {
      amount: scale.tax,
      marginalRate: scale.marginalRate,
      breakdown: scale.breakdown,
    },
    offsets: {
      lowIncomeTaxOffset: lito,
      otherNonRefundableOffsets,
      totalNonRefundable: nonRefundableOffsets,
      note: "Non-refundable offsets can reduce tax payable to nil but are not refunded.",
    },
    taxAfterOffsets,
    medicareLevy: levy,
    medicareLevySurcharge: { ...surcharge, incomeForSurchargePurposes },
    studyAndTrainingLoanRepayment: { ...studyLoan, repaymentIncome },
    credits: {
      frankingCredits,
      otherRefundableOffsets,
      paygWithheld,
      paygInstalmentsPaid,
      total: totalCredits,
    },
    totals: {
      totalTaxLiability: totalLiability,
      totalCredits,
      estimatedRefund: balance < 0 ? round2(Math.abs(balance)) : 0,
      estimatedAmountPayable: balance > 0 ? balance : 0,
      averageTaxRate:
        taxableIncome > 0
          ? round2((totalLiability / taxableIncome) * 100) / 100
          : 0,
      marginalRate: scale.marginalRate,
    },
    caveats: collectCaveats(
      rates.medicareLevy,
      rates.studyLoan,
      financialYear ? rates : null
    ),
    disclaimer: DISCLAIMER,
  };
}

module.exports = {
  calculateIndividualTax,
  lowIncomeTaxOffset,
  medicareLevy,
  medicareLevySurcharge,
  studyLoanRepayment,
};
