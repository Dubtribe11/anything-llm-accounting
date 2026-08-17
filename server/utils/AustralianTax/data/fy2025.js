/**
 * Australian tax parameters for the 2024-25 income year (1 July 2024 - 30 June 2025).
 * First year of the revised "Stage 3" personal income tax scale.
 */
module.exports = {
  financialYear: "2024-25",
  startDate: "2024-07-01",
  endDate: "2025-06-30",
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
      { name: "Base", singleTo: 97000, familyTo: 194000, rate: 0 },
      { name: "Tier 1", singleTo: 113000, familyTo: 226000, rate: 0.01 },
      { name: "Tier 2", singleTo: 151000, familyTo: 302000, rate: 0.0125 },
      { name: "Tier 3", singleTo: null, familyTo: null, rate: 0.015 },
    ],
  },

  studyLoan: {
    system: "banded",
    minimumRepaymentIncome: 54435,
    bands: [
      { from: 54435, to: 62850, rate: 0.01 },
      { from: 62850, to: 66620, rate: 0.02 },
      { from: 66620, to: 70618, rate: 0.025 },
      { from: 70618, to: 74855, rate: 0.03 },
      { from: 74855, to: 79346, rate: 0.035 },
      { from: 79346, to: 84107, rate: 0.04 },
      { from: 84107, to: 89154, rate: 0.045 },
      { from: 89154, to: 94503, rate: 0.05 },
      { from: 94503, to: 100174, rate: 0.055 },
      { from: 100174, to: 106185, rate: 0.06 },
      { from: 106185, to: 112556, rate: 0.065 },
      { from: 112556, to: 119309, rate: 0.07 },
      { from: 119309, to: 126467, rate: 0.075 },
      { from: 126467, to: 134056, rate: 0.08 },
      { from: 134056, to: 142100, rate: 0.085 },
      { from: 142100, to: 150626, rate: 0.09 },
      { from: 150626, to: 159663, rate: 0.095 },
      { from: 159663, to: null, rate: 0.1 },
    ],
  },

  company: {
    baseRateEntityRate: 0.25,
    standardRate: 0.3,
    baseRateEntityTurnoverThreshold: 50000000,
    baseRateEntityPassiveIncomeCap: 0.8,
  },

  div7a: {
    benchmarkInterestRate: 0.0877,
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
    // Rate/threshold changed for acquisitions from 1 January 2025.
    foreignResidentWithholding: {
      rate: 0.15,
      propertyThreshold: 0,
      note: "From 1 Jan 2025 the rate is 15% and the $750,000 threshold is removed. Contracts entered before 1 Jan 2025 use 12.5% / $750,000.",
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
    yearLabel: "1 April 2024 - 31 March 2025",
    rate: 0.47,
    type1GrossUp: 2.0802,
    type2GrossUp: 1.8868,
    statutoryFormulaRate: 0.2,
    minorBenefitThreshold: 300,
    reportableFringeBenefitThreshold: 2000,
    recordKeepingExemptionThreshold: 9936,
  },

  superannuation: {
    guaranteeRate: 0.115,
    maximumContributionBaseQuarterly: 65070,
    concessionalCap: 30000,
    nonConcessionalCap: 120000,
    bringForwardCap: 360000,
    totalSuperBalanceThresholdForNCC: 1900000,
    carryForwardConcessionalTSBLimit: 500000,
    division293Threshold: 250000,
    division293Rate: 0.15,
    transferBalanceCap: 1900000,
    coContributionMaxIncome: 60400,
    coContributionLowerIncome: 45400,
    preservationAge: 60,
  },

  deductions: {
    centsPerKilometre: 0.88,
    centsPerKilometreMaxKm: 5000,
    carDepreciationLimit: 69674,
    workingFromHomeFixedRatePerHour: 0.7,
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
