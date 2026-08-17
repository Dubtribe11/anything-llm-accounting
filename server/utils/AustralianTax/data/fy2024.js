/**
 * Australian tax parameters for the 2023-24 income year (1 July 2023 - 30 June 2024).
 *
 * `confidence` values:
 *  - "legislated" : enacted law, safe to rely on
 *  - "announced"  : announced/introduced but not yet enacted at time of writing
 *  - "estimated"  : indexed figure projected forward - MUST be verified before use
 */
module.exports = {
  financialYear: "2023-24",
  startDate: "2023-07-01",
  endDate: "2024-06-30",
  confidence: "legislated",

  individual: {
    // Pre "Stage 3" scales.
    residentBrackets: [
      { from: 0, to: 18200, rate: 0, base: 0 },
      { from: 18200, to: 45000, rate: 0.19, base: 0 },
      { from: 45000, to: 120000, rate: 0.325, base: 5092 },
      { from: 120000, to: 180000, rate: 0.37, base: 29467 },
      { from: 180000, to: null, rate: 0.45, base: 51667 },
    ],
    foreignResidentBrackets: [
      { from: 0, to: 120000, rate: 0.325, base: 0 },
      { from: 120000, to: 180000, rate: 0.37, base: 39000 },
      { from: 180000, to: null, rate: 0.45, base: 61200 },
    ],
    workingHolidayMakerBrackets: [
      { from: 0, to: 45000, rate: 0.15, base: 0 },
      { from: 45000, to: 120000, rate: 0.325, base: 6750 },
      { from: 120000, to: 180000, rate: 0.37, base: 31125 },
      { from: 180000, to: null, rate: 0.45, base: 53325 },
    ],
    // Division 6AA - unearned income of a minor (under 18) not "excepted".
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
    // Shade-in applies between `threshold` and `phaseInUpper` at 10c per dollar.
    single: { threshold: 24276, phaseInUpper: 30345 },
    family: { threshold: 40939, phaseInUpper: 51173, perDependentChild: 3760 },
    seniorSingle: { threshold: 38365, phaseInUpper: 47956 },
    seniorFamily: {
      threshold: 53406,
      phaseInUpper: 66757,
      perDependentChild: 3760,
    },
    shadeInRate: 0.1,
  },

  medicareLevySurcharge: {
    familyThresholdIncreasePerChildAfterFirst: 1500,
    tiers: [
      { name: "Base", singleTo: 93000, familyTo: 186000, rate: 0 },
      { name: "Tier 1", singleTo: 108000, familyTo: 216000, rate: 0.01 },
      { name: "Tier 2", singleTo: 144000, familyTo: 288000, rate: 0.0125 },
      { name: "Tier 3", singleTo: null, familyTo: null, rate: 0.015 },
    ],
  },

  studyLoan: {
    system: "banded", // whole-of-income percentage applied to repayment income
    minimumRepaymentIncome: 51550,
    bands: [
      { from: 51550, to: 59518, rate: 0.01 },
      { from: 59518, to: 63089, rate: 0.02 },
      { from: 63089, to: 66875, rate: 0.025 },
      { from: 66875, to: 70888, rate: 0.03 },
      { from: 70888, to: 75140, rate: 0.035 },
      { from: 75140, to: 79649, rate: 0.04 },
      { from: 79649, to: 84429, rate: 0.045 },
      { from: 84429, to: 89494, rate: 0.05 },
      { from: 89494, to: 94865, rate: 0.055 },
      { from: 94865, to: 100557, rate: 0.06 },
      { from: 100557, to: 106590, rate: 0.065 },
      { from: 106590, to: 112985, rate: 0.07 },
      { from: 112985, to: 119764, rate: 0.075 },
      { from: 119764, to: 126950, rate: 0.08 },
      { from: 126950, to: 134568, rate: 0.085 },
      { from: 134568, to: 142642, rate: 0.09 },
      { from: 142642, to: 151200, rate: 0.095 },
      { from: 151200, to: null, rate: 0.1 },
    ],
  },

  company: {
    baseRateEntityRate: 0.25,
    standardRate: 0.3,
    baseRateEntityTurnoverThreshold: 50000000,
    baseRateEntityPassiveIncomeCap: 0.8,
  },

  div7a: {
    benchmarkInterestRate: 0.0827,
    maxTermUnsecuredYears: 7,
    maxTermSecuredYears: 25,
    confidence: "legislated",
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
    foreignResidentWithholding: { rate: 0.125, propertyThreshold: 750000 },
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
    // FBT year runs 1 April - 31 March.
    yearLabel: "1 April 2023 - 31 March 2024",
    rate: 0.47,
    type1GrossUp: 2.0802,
    type2GrossUp: 1.8868,
    statutoryFormulaRate: 0.2,
    minorBenefitThreshold: 300,
    reportableFringeBenefitThreshold: 2000,
    recordKeepingExemptionThreshold: 9786,
  },

  superannuation: {
    guaranteeRate: 0.11,
    maximumContributionBaseQuarterly: 62270,
    concessionalCap: 27500,
    nonConcessionalCap: 110000,
    bringForwardCap: 330000,
    totalSuperBalanceThresholdForNCC: 1900000,
    carryForwardConcessionalTSBLimit: 500000,
    division293Threshold: 250000,
    division293Rate: 0.15,
    transferBalanceCap: 1900000,
    coContributionMaxIncome: 58445,
    coContributionLowerIncome: 43445,
    preservationAge: 60,
  },

  deductions: {
    centsPerKilometre: 0.85,
    centsPerKilometreMaxKm: 5000,
    carDepreciationLimit: 68108,
    workingFromHomeFixedRatePerHour: 0.67,
    selfEducationExpenseNonDeductibleThreshold: 0,
    instantAssetWriteOff: {
      amount: 20000,
      aggregatedTurnoverThreshold: 10000000,
      confidence: "legislated",
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
