/**
 * Australian tax parameters for the 2025-26 income year (1 July 2025 - 30 June 2026).
 *
 * Notable changes from 2024-25:
 *  - Superannuation Guarantee reaches 12%.
 *  - General transfer balance cap indexed to $2.0m (and so the total super
 *    balance threshold for non-concessional contributions is $2.0m).
 *  - Student loan (HELP/VETSL/etc.) repayments move to a *marginal* system with
 *    a $67,000 threshold, replacing the old whole-of-income banded percentages.
 */
module.exports = {
  financialYear: "2025-26",
  startDate: "2025-07-01",
  endDate: "2026-06-30",
  confidence: "legislated",

  individual: {
    residentBrackets: [
      { from: 0, to: 18200, rate: 0, base: 0 },
      { from: 18200, to: 45000, rate: 0.16, base: 0 },
      { from: 45000, to: 135000, rate: 0.3, base: 4288 },
      { from: 135000, to: 190000, rate: 0.37, base: 31288 },
      { from: 190000, to: null, rate: 0.45, base: 51638 },
    ],
    foreignResidentBrackets: [
      { from: 0, to: 135000, rate: 0.3, base: 0 },
      { from: 135000, to: 190000, rate: 0.37, base: 40500 },
      { from: 190000, to: null, rate: 0.45, base: 60850 },
    ],
    workingHolidayMakerBrackets: [
      { from: 0, to: 45000, rate: 0.15, base: 0 },
      { from: 45000, to: 135000, rate: 0.3, base: 6750 },
      { from: 135000, to: 190000, rate: 0.37, base: 33750 },
      { from: 190000, to: null, rate: 0.45, base: 54100 },
    ],
    minorUnearnedIncome: [
      { from: 0, to: 416, rate: 0, base: 0, note: "Nil" },
      {
        from: 416,
        to: 1307,
        rate: 0.66,
        base: 0,
        note: "66% of the excess over $416",
      },
      {
        from: 1307,
        to: null,
        rate: 0.45,
        base: 0,
        wholeAmount: true,
        note: "45% of the entire amount of eligible income",
      },
    ],
    lito: {
      max: 700,
      fullThreshold: 37500,
      firstTaper: { from: 37500, to: 45000, rate: 0.05 },
      secondTaper: { from: 45000, to: 66667, rate: 0.015 },
    },
  },

  medicareLevy: {
    rate: 0.02,
    // The low-income thresholds are indexed annually and announced with the
    // Budget. The figures below are carried forward from 2024-25 and are NOT
    // confirmed - always confirm against ato.gov.au before relying on them.
    confidence: "estimated",
    verifyNote:
      "Medicare levy low-income thresholds are indexed each year. Confirm the 2025-26 figures on ato.gov.au before using them in an assessment.",
    single: { threshold: 27222, phaseInUpper: 34027 },
    family: { threshold: 45907, phaseInUpper: 57383, perDependentChild: 4216 },
    seniorSingle: { threshold: 43020, phaseInUpper: 53775 },
    seniorFamily: {
      threshold: 59886,
      phaseInUpper: 74857,
      perDependentChild: 4216,
    },
    shadeInRate: 0.1,
  },

  medicareLevySurcharge: {
    familyThresholdIncreasePerChildAfterFirst: 1500,
    tiers: [
      { name: "Base", singleTo: 101000, familyTo: 202000, rate: 0 },
      { name: "Tier 1", singleTo: 118000, familyTo: 236000, rate: 0.01 },
      { name: "Tier 2", singleTo: 158000, familyTo: 316000, rate: 0.0125 },
      { name: "Tier 3", singleTo: null, familyTo: null, rate: 0.015 },
    ],
  },

  studyLoan: {
    // From 1 July 2025 repayments are calculated on income ABOVE the threshold
    // at marginal rates, rather than a flat percentage of the whole income.
    system: "marginal",
    minimumRepaymentIncome: 67000,
    marginalBands: [
      { from: 67000, to: 125000, rate: 0.15 },
      { from: 125000, to: null, rate: 0.17 },
    ],
    note: "A one-off 20% reduction was applied to outstanding study and training loan balances as at 1 June 2025 (applied by the ATO, not claimed by the taxpayer).",
  },

  company: {
    baseRateEntityRate: 0.25,
    standardRate: 0.3,
    baseRateEntityTurnoverThreshold: 50000000,
    baseRateEntityPassiveIncomeCap: 0.8,
  },

  div7a: {
    benchmarkInterestRate: 0.0837,
    maxTermUnsecuredYears: 7,
    maxTermSecuredYears: 25,
    confidence: "published",
    verifyNote:
      "The Division 7A benchmark interest rate is published by the ATO before the start of each income year. Confirm the 2025-26 rate on ato.gov.au.",
  },

  trust: {
    section99ARate: 0.45,
    nonResidentBeneficiaryWithholding: 0.3,
  },

  smsf: {
    accumulationRate: 0.15,
    cgtDiscount: 1 / 3,
    nonArmsLengthIncomeRate: 0.45,
    pensionPhaseRate: 0,
  },

  cgt: {
    individualDiscount: 0.5,
    trustDiscount: 0.5,
    complyingSuperFundDiscount: 1 / 3,
    companyDiscount: 0,
    minimumHoldingDays: 365,
    smallBusiness: {
      turnoverThreshold: 2000000,
      maximumNetAssetValue: 6000000,
      retirementExemptionLifetimeCap: 500000,
      activeAssetReduction: 0.5,
    },
    foreignResidentWithholding: {
      rate: 0.15,
      propertyThreshold: 0,
      note: "15% withholding applies to all taxable Australian real property disposals unless the vendor provides a clearance certificate.",
    },
  },

  gst: {
    rate: 0.1,
    registrationTurnoverThreshold: 75000,
    nonProfitRegistrationThreshold: 150000,
    taxiOrRideSourcingThreshold: 0,
    monthlyReportingTurnoverThreshold: 20000000,
    annualReportingEligibilityThreshold: 75000,
  },

  fbt: {
    yearLabel: "1 April 2025 - 31 March 2026",
    rate: 0.47,
    type1GrossUp: 2.0802,
    type2GrossUp: 1.8868,
    statutoryFormulaRate: 0.2,
    minorBenefitThreshold: 300,
    reportableFringeBenefitThreshold: 2000,
    recordKeepingExemptionThreshold: 9936,
    recordKeepingConfidence: "estimated",
    note: "The FBT exemption for plug-in hybrid electric vehicles ended on 1 April 2025 (transitional rules apply to pre-existing binding commitments). Battery electric and hydrogen fuel cell vehicles under the luxury car tax fuel-efficient threshold remain exempt.",
  },

  superannuation: {
    guaranteeRate: 0.12,
    // From 2025-26 the maximum contribution base is set so that SG on the base
    // equals the concessional cap ($62,500 x 12% x 4 quarters = $30,000).
    maximumContributionBaseQuarterly: 62500,
    concessionalCap: 30000,
    nonConcessionalCap: 120000,
    bringForwardCap: 360000,
    totalSuperBalanceThresholdForNCC: 2000000,
    carryForwardConcessionalTSBLimit: 500000,
    division293Threshold: 250000,
    division293Rate: 0.15,
    transferBalanceCap: 2000000,
    coContributionMaxIncome: 62488,
    coContributionLowerIncome: 47488,
    coContributionConfidence: "estimated",
    preservationAge: 60,
    proposedDivision296: {
      status: "announced - not enacted at time of writing",
      thresholdBalance: 3000000,
      additionalRate: 0.15,
      note: "Better Targeted Superannuation Concessions (Division 296). Design and start date have been revised more than once. Do not apply it to a return without confirming the enacted law.",
    },
  },

  deductions: {
    centsPerKilometre: 0.88,
    centsPerKilometreMaxKm: 5000,
    carDepreciationLimit: 69674,
    carDepreciationLimitConfidence: "estimated",
    workingFromHomeFixedRatePerHour: 0.7,
    instantAssetWriteOff: {
      amount: 20000,
      aggregatedTurnoverThreshold: 10000000,
      confidence: "announced",
      note: "The $20,000 instant asset write-off for small business was extended to 30 June 2026. Confirm enactment before relying on it; otherwise the threshold reverts to $1,000.",
    },
  },

  smallBusiness: {
    aggregatedTurnoverThreshold: 10000000,
    cgtConcessionTurnoverThreshold: 2000000,
    simplifiedDepreciationPoolRateFirstYear: 0.15,
    simplifiedDepreciationPoolRate: 0.3,
  },

  rd: {
    refundableOffsetPremium: 0.185,
    refundableTurnoverThreshold: 20000000,
    nonRefundableTiers: [
      { intensityUpTo: 0.02, premium: 0.085 },
      { intensityUpTo: null, premium: 0.165 },
    ],
    minimumNotionalDeductions: 20000,
  },
};
