/**
 * The figures asserted here are the published ATO amounts, not whatever the
 * code happens to produce. If a rate table is edited and one of these fails,
 * the table is what needs checking.
 */
const AustralianTax = require("../../../utils/AustralianTax");

const run = (name, args) => AustralianTax.runCalculator(name, args);

describe("individual income tax", () => {
  it("matches the published 2025-26 resident scale", () => {
    // $4,288 + 30c per $1 over $45,000.
    expect(run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 100000 }).incomeTax.amount).toBe(20788);
    // $51,638 + 45c per $1 over $190,000.
    expect(run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 200000 }).incomeTax.amount).toBe(56138);
    // Bracket boundaries.
    expect(run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 45000 }).incomeTax.amount).toBe(4288);
    expect(run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 135000 }).incomeTax.amount).toBe(31288);
    expect(run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 190000 }).incomeTax.amount).toBe(51638);
  });

  it("charges nothing at or below the tax-free threshold", () => {
    const result = run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 18200 });
    expect(result.incomeTax.amount).toBe(0);
    expect(result.totals.totalTaxLiability).toBe(0);
  });

  it("applies the 2023-24 scale for that year", () => {
    // $5,092 + 32.5c per $1 over $45,000.
    expect(run("individual_income_tax", { financialYear: "2023-24", taxableIncome: 100000 }).incomeTax.amount).toBe(22967);
  });

  it("applies the legislated 15% second bracket from 2026-27", () => {
    // $4,020 + 30c per $1 over $45,000.
    expect(run("individual_income_tax", { financialYear: "2026-27", taxableIncome: 100000 }).incomeTax.amount).toBe(20520);
    expect(run("individual_income_tax", { financialYear: "2026-27", taxableIncome: 45000 }).incomeTax.amount).toBe(4020);
  });

  it("tapers the low income tax offset", () => {
    const at37500 = run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 37500 });
    const at45000 = run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 45000 });
    const at70000 = run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 70000 });
    expect(at37500.offsets.lowIncomeTaxOffset).toBe(700);
    // 700 - 5% of (45,000 - 37,500)
    expect(at45000.offsets.lowIncomeTaxOffset).toBe(325);
    // Cuts out at $66,667.
    expect(at70000.offsets.lowIncomeTaxOffset).toBe(0);
  });

  it("shades in the Medicare levy and caps it at 2%", () => {
    const belowThreshold = run("individual_income_tax", { financialYear: "2024-25", taxableIncome: 27000 });
    const inShadeIn = run("individual_income_tax", { financialYear: "2024-25", taxableIncome: 30000 });
    const aboveShadeIn = run("individual_income_tax", { financialYear: "2024-25", taxableIncome: 60000 });

    expect(belowThreshold.medicareLevy.amount).toBe(0);
    // 10c per $1 over the $27,222 single threshold.
    expect(inShadeIn.medicareLevy.amount).toBeCloseTo(277.8, 1);
    expect(aboveShadeIn.medicareLevy.amount).toBe(1200);
  });

  it("halves the Medicare levy for a half exemption and waives it for a full one", () => {
    const half = run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 100000, medicareLevyExemption: "half" });
    const full = run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 100000, medicareLevyExemption: "full" });
    expect(half.medicareLevy.amount).toBe(1000);
    expect(full.medicareLevy.amount).toBe(0);
  });

  it("charges the Medicare levy surcharge only without private hospital cover", () => {
    const noCover = run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 200000 });
    const withCover = run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 200000, privateHospitalCover: true });
    expect(noCover.medicareLevySurcharge.amount).toBe(3000); // Tier 3, 1.5%
    expect(noCover.medicareLevySurcharge.tier).toBe("Tier 3");
    expect(withCover.medicareLevySurcharge.amount).toBe(0);
  });

  it("keeps a single earner under the base tier out of the surcharge", () => {
    const result = run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 100000 });
    expect(result.medicareLevySurcharge.amount).toBe(0);
    expect(result.medicareLevySurcharge.tier).toBe("Base");
  });

  it("uses the marginal study loan system from 2025-26", () => {
    // 15% of (125,000 - 67,000) + 17% of (200,000 - 125,000)
    const result = run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 200000, hasStudyLoan: true });
    expect(result.studyAndTrainingLoanRepayment.system).toBe("marginal");
    expect(result.studyAndTrainingLoanRepayment.amount).toBe(21450);
  });

  it("charges no study loan repayment below the threshold", () => {
    const result = run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 60000, hasStudyLoan: true });
    expect(result.studyAndTrainingLoanRepayment.amount).toBe(0);
  });

  it("caps the study loan repayment at the outstanding balance", () => {
    const result = run("individual_income_tax", {
      financialYear: "2025-26",
      taxableIncome: 200000,
      studyLoanBalance: 5000,
    });
    expect(result.studyAndTrainingLoanRepayment.amount).toBe(5000);
  });

  it("uses the banded study loan system for 2024-25", () => {
    const result = run("individual_income_tax", { financialYear: "2024-25", taxableIncome: 100000, hasStudyLoan: true });
    expect(result.studyAndTrainingLoanRepayment.system).toBe("banded");
    // $100,000 sits in the $94,503-$100,174 band: 5.5% of total repayment income.
    expect(result.studyAndTrainingLoanRepayment.amount).toBe(5500);
  });

  it("gives foreign residents no tax-free threshold and no Medicare levy", () => {
    const result = run("individual_income_tax", {
      financialYear: "2025-26",
      taxableIncome: 50000,
      residency: "foreign-resident",
    });
    expect(result.incomeTax.amount).toBe(15000); // 30% from the first dollar
    expect(result.medicareLevy.amount).toBe(0);
    expect(result.offsets.lowIncomeTaxOffset).toBe(0);
  });

  it("taxes working holiday makers at 15% to $45,000", () => {
    const result = run("individual_income_tax", {
      financialYear: "2025-26",
      taxableIncome: 45000,
      residency: "working-holiday-maker",
    });
    expect(result.incomeTax.amount).toBe(6750);
  });

  it("nets PAYG and franking credits off the liability", () => {
    const result = run("individual_income_tax", {
      financialYear: "2025-26",
      taxableIncome: 100000,
      paygWithheld: 30000,
    });
    expect(result.totals.totalTaxLiability).toBe(22788);
    expect(result.totals.estimatedRefund).toBe(7212);
    expect(result.totals.estimatedAmountPayable).toBe(0);
  });

  it("derives taxable income from assessable income less deductions", () => {
    const result = run("individual_income_tax", {
      financialYear: "2025-26",
      assessableIncome: 110000,
      deductions: 10000,
    });
    expect(result.inputs.taxableIncome).toBe(100000);
    expect(result.incomeTax.amount).toBe(20788);
  });
});

describe("company tax", () => {
  it("applies 25% to a base rate entity", () => {
    const result = run("company_tax", {
      financialYear: "2025-26",
      taxableIncome: 200000,
      aggregatedTurnover: 2000000,
      assessableIncome: 2000000,
      passiveIncome: 0,
    });
    expect(result.baseRateEntity.isBaseRateEntity).toBe(true);
    expect(result.taxRate).toBe(0.25);
    expect(result.grossTax).toBe(50000);
  });

  it("fails the passive income test for an investment company", () => {
    const result = run("company_tax", {
      financialYear: "2025-26",
      taxableIncome: 200000,
      aggregatedTurnover: 200000,
      assessableIncome: 200000,
      passiveIncome: 200000,
    });
    expect(result.baseRateEntity.isBaseRateEntity).toBe(false);
    expect(result.baseRateEntity.passiveIncomeTest.passed).toBe(false);
    expect(result.taxRate).toBe(0.3);
    expect(result.grossTax).toBe(60000);
  });

  it("fails the turnover test above $50m", () => {
    const result = run("company_tax", {
      financialYear: "2025-26",
      taxableIncome: 1000000,
      aggregatedTurnover: 60000000,
      assessableIncome: 60000000,
      passiveIncome: 0,
    });
    expect(result.baseRateEntity.turnoverTest.passed).toBe(false);
    expect(result.taxRate).toBe(0.3);
  });

  it("applies prior year losses before calculating tax", () => {
    const result = run("company_tax", {
      financialYear: "2025-26",
      taxableIncome: 200000,
      priorYearLossesApplied: 50000,
      aggregatedTurnover: 1000000,
      assessableIncome: 1000000,
      passiveIncome: 0,
    });
    expect(result.taxableIncome).toBe(150000);
    expect(result.grossTax).toBe(37500);
  });
});

describe("franking", () => {
  it("grosses up a fully franked dividend at 30%", () => {
    const result = run("franking", {
      distributionAmount: 7000,
      frankingPercentage: 100,
      corporateTaxRateForImputation: 0.3,
    });
    expect(result.frankingCredit).toBe(3000);
    expect(result.grossedUpAmount).toBe(10000);
  });

  it("grosses up a fully franked dividend at 25%", () => {
    const result = run("franking", {
      distributionAmount: 7500,
      corporateTaxRateForImputation: 0.25,
    });
    expect(result.frankingCredit).toBe(2500);
    expect(result.grossedUpAmount).toBe(10000);
  });

  it("scales the credit by the franking percentage", () => {
    const result = run("franking", {
      distributionAmount: 7000,
      frankingPercentage: 50,
      corporateTaxRateForImputation: 0.3,
    });
    expect(result.maximumFrankingCredit).toBe(3000);
    expect(result.frankingCredit).toBe(1500);
  });
});

describe("Division 7A", () => {
  it("uses the annuity formula for the minimum yearly repayment", () => {
    // 100,000 x 0.0837 / (1 - 1.0837^-6)
    const result = run("division_7a_minimum_repayment", {
      financialYear: "2025-26",
      openingLoanBalance: 100000,
      loanTermYears: 7,
      yearsElapsed: 1,
    });
    expect(result.benchmarkInterestRate).toBe(0.0837);
    expect(result.remainingTermYears).toBe(6);
    expect(result.minimumYearlyRepayment).toBeCloseTo(21874.92, 2);
    expect(result.interestComponent).toBe(8370);
  });

  it("requires the whole balance once the term has expired", () => {
    const result = run("division_7a_minimum_repayment", {
      openingLoanBalance: 40000,
      loanTermYears: 7,
      yearsElapsed: 7,
    });
    expect(result.minimumYearlyRepayment).toBe(40000);
    expect(result.remainingTermYears).toBe(0);
  });

  it("accepts a benchmark rate given as a percentage", () => {
    const asDecimal = run("division_7a_minimum_repayment", {
      openingLoanBalance: 100000,
      yearsElapsed: 1,
      benchmarkInterestRate: 0.0877,
    });
    const asPercent = run("division_7a_minimum_repayment", {
      openingLoanBalance: 100000,
      yearsElapsed: 1,
      benchmarkInterestRate: 8.77,
    });
    expect(asPercent.minimumYearlyRepayment).toBe(asDecimal.minimumYearlyRepayment);
  });
});

describe("trust distributions", () => {
  it("allocates by percentage and taxes each beneficiary at its own rate", () => {
    const result = run("trust_distribution", {
      financialYear: "2025-26",
      components: { ordinaryIncome: 200000 },
      beneficiaries: [
        { name: "Adult", sharePercent: 50 },
        { name: "Company", entityType: "company", sharePercent: 50 },
      ],
    });
    expect(result.netIncome.trustNetIncome).toBe(200000);
    expect(result.beneficiaries[0].assessableShare).toBe(100000);
    expect(result.beneficiaries[1].estimatedTax).toBe(25000); // 25% base rate entity
    expect(result.trusteeAssessment.tax).toBe(0);
  });

  it("applies Division 6AA penalty rates to a minor", () => {
    const result = run("trust_distribution", {
      financialYear: "2025-26",
      components: { ordinaryIncome: 10000 },
      beneficiaries: [{ name: "Child", sharePercent: 100, isMinor: true }],
    });
    // Above $1,307 the 45% rate applies to the entire amount.
    expect(result.beneficiaries[0].division6AA.tax).toBe(4500);
  });

  it("leaves a minor's first $416 untaxed", () => {
    const result = run("trust_distribution", {
      financialYear: "2025-26",
      components: { ordinaryIncome: 416 },
      beneficiaries: [{ name: "Child", sharePercent: 100, isMinor: true }],
    });
    expect(result.beneficiaries[0].division6AA.tax).toBe(0);
  });

  it("assesses undistributed income to the trustee at 45%", () => {
    const result = run("trust_distribution", {
      financialYear: "2025-26",
      components: { ordinaryIncome: 100000 },
      beneficiaries: [{ name: "Adult", sharePercent: 60 }],
    });
    expect(result.trusteeAssessment.amount).toBe(40000);
    expect(result.trusteeAssessment.rate).toBe(0.45);
    expect(result.trusteeAssessment.tax).toBe(18000);
  });

  it("discounts capital gains and streams franking credits with the dividend", () => {
    const result = run("trust_distribution", {
      financialYear: "2025-26",
      components: {
        frankedDistributions: 7000,
        frankingCredits: 3000,
        grossCapitalGains: 100000,
        capitalGainsDiscountEligible: true,
      },
      beneficiaries: [
        { name: "Streamed", streamedFrankedDistributions: 7000 },
        { name: "Rest", sharePercent: 100 },
      ],
    });
    // 50% discount on the gross gain.
    expect(result.netIncome.components.netCapitalGain).toBe(50000);
    // The full credit follows the full franked distribution.
    expect(result.beneficiaries[0].attachedFrankingCredits).toBe(3000);
    expect(result.beneficiaries[0].assessableShare).toBe(10000);
  });
});

describe("capital gains tax", () => {
  it("halves a discounted gain for an individual", () => {
    const result = run("capital_gains_tax", {
      financialYear: "2025-26",
      entityType: "individual",
      capitalProceeds: 800000,
      costBase: 500000,
      heldMoreThan12Months: true,
    });
    expect(result.grossCapitalGain).toBe(300000);
    expect(result.netCapitalGain).toBe(150000);
  });

  it("gives a company no discount", () => {
    const result = run("capital_gains_tax", {
      entityType: "company",
      capitalProceeds: 800000,
      costBase: 500000,
      heldMoreThan12Months: true,
    });
    expect(result.discountRate).toBe(0);
    expect(result.netCapitalGain).toBe(300000);
  });

  it("gives a complying super fund one third", () => {
    const result = run("capital_gains_tax", {
      entityType: "smsf",
      capitalProceeds: 400000,
      costBase: 100000,
      heldMoreThan12Months: true,
    });
    expect(result.netCapitalGain).toBe(200000);
  });

  it("denies the discount when held 12 months or less", () => {
    const result = run("capital_gains_tax", {
      capitalProceeds: 800000,
      costBase: 500000,
      heldMoreThan12Months: false,
    });
    expect(result.netCapitalGain).toBe(300000);
  });

  it("applies losses before the discount", () => {
    const result = run("capital_gains_tax", {
      capitalProceeds: 800000,
      costBase: 500000,
      heldMoreThan12Months: true,
      priorYearCapitalLosses: 100000,
    });
    // (300,000 - 100,000) x 50%, not 150,000 - 100,000.
    expect(result.netCapitalGain).toBe(100000);
  });

  it("reports a capital loss rather than a negative gain", () => {
    const result = run("capital_gains_tax", { capitalProceeds: 100000, costBase: 150000 });
    expect(result.capitalLoss).toBe(50000);
    expect(result.netCapitalGain).toBe(0);
  });

  it("disregards the whole gain under the 15-year exemption", () => {
    const result = run("capital_gains_tax", {
      capitalProceeds: 2000000,
      costBase: 500000,
      heldMoreThan12Months: true,
      smallBusinessConcessions: { fifteenYearExemption: true },
    });
    expect(result.netCapitalGain).toBe(0);
    expect(result.concessionsApplied[0].concession).toMatch(/15-year/);
  });

  it("stacks the discount, active asset reduction and retirement exemption", () => {
    const result = run("capital_gains_tax", {
      capitalProceeds: 1000000,
      costBase: 200000,
      heldMoreThan12Months: true,
      smallBusinessConcessions: {
        activeAssetReduction: true,
        retirementExemptionAmount: 200000,
      },
    });
    // 800,000 -> 400,000 (discount) -> 200,000 (active asset) -> 0 (retirement)
    expect(result.netCapitalGain).toBe(0);
  });

  it("caps the retirement exemption at the $500,000 lifetime limit", () => {
    const result = run("capital_gains_tax", {
      capitalProceeds: 3000000,
      costBase: 0,
      heldMoreThan12Months: true,
      smallBusinessConcessions: {
        retirementExemptionAmount: 500000,
        retirementExemptionAlreadyUsed: 400000,
      },
    });
    const retirement = result.concessionsApplied.find((c) => c.concession.match(/retirement/));
    expect(retirement.amountDisregarded).toBe(100000);
    expect(retirement.lifetimeCapRemaining).toBe(0);
  });

  it("uses the acquisition and disposal dates for the 12 month test", () => {
    const held = run("capital_gains_tax", {
      capitalProceeds: 200000,
      costBase: 100000,
      acquisitionDate: "2020-01-01",
      disposalDate: "2024-01-01",
    });
    const notHeld = run("capital_gains_tax", {
      capitalProceeds: 200000,
      costBase: 100000,
      acquisitionDate: "2023-07-01",
      disposalDate: "2024-01-01",
    });
    expect(held.discountEligible).toBe(true);
    expect(notHeld.discountEligible).toBe(false);
  });
});

describe("GST", () => {
  it("extracts one eleventh from a GST-inclusive amount", () => {
    const result = run("gst", { amount: 1100, mode: "extract" });
    expect(result.gstAmount).toBe(100);
    expect(result.gstExclusiveAmount).toBe(1000);
  });

  it("adds 10% to a GST-exclusive amount", () => {
    const result = run("gst", { amount: 1000, mode: "add" });
    expect(result.gstAmount).toBe(100);
    expect(result.gstInclusiveAmount).toBe(1100);
  });

  it("computes the net BAS position", () => {
    const result = run("business_activity_statement", {
      totalSales: 110000,
      totalPurchases: 55000,
      paygWithheld: 5000,
    });
    expect(result.labels["1A"].amount).toBe(10000);
    expect(result.labels["1B"].amount).toBe(5000);
    expect(result.netGst).toBe(5000);
    expect(result.totalAmountPayableOrRefundable).toBe(10000);
  });

  it("excludes GST-free and export sales from GST on sales", () => {
    const result = run("business_activity_statement", {
      totalSales: 110000,
      gstFreeSales: 55000,
      totalPurchases: 0,
    });
    expect(result.labels["1A"].amount).toBe(5000);
  });

  it("reports a refund when credits exceed GST on sales", () => {
    const result = run("business_activity_statement", { totalSales: 11000, totalPurchases: 110000 });
    expect(result.netGst).toBeLessThan(0);
    expect(result.netGstPosition).toMatch(/refundable/);
  });

  it("requires registration at the $75,000 threshold", () => {
    expect(run("gst_registration_check", { gstTurnover: 74999 }).mustRegister).toBe(false);
    expect(run("gst_registration_check", { gstTurnover: 75000 }).mustRegister).toBe(true);
    expect(run("gst_registration_check", { gstTurnover: 100000, isNonProfit: true }).mustRegister).toBe(false);
    expect(run("gst_registration_check", { gstTurnover: 100, providesTaxiOrRideSourcing: true }).mustRegister).toBe(true);
  });

  it("makes monthly reporting mandatory at $20m turnover", () => {
    expect(run("gst_registration_check", { gstTurnover: 25000000 }).reportingCycle).toMatch(/monthly/);
    expect(run("gst_registration_check", { gstTurnover: 1000000 }).reportingCycle).toMatch(/quarterly/);
  });
});

describe("FBT", () => {
  it("grosses up Type 1 and Type 2 amounts at the right factors", () => {
    const result = run("fringe_benefits_tax", {
      financialYear: "2025-26",
      type1AggregateAmount: 10000,
      type2AggregateAmount: 10000,
    });
    expect(result.type1.grossedUpValue).toBe(20802);
    expect(result.type2.grossedUpValue).toBe(18868);
    // (20,802 + 18,868) x 47%
    expect(result.fbtPayable).toBeCloseTo(18644.9, 1);
  });

  it("applies the 20% statutory formula pro-rated by days available", () => {
    const result = run("car_fringe_benefit", {
      method: "statutory",
      baseValue: 50000,
      daysAvailable: 365,
    });
    expect(result.taxableValue).toBe(10000);

    const halfYear = run("car_fringe_benefit", {
      method: "statutory",
      baseValue: 50000,
      daysAvailable: 182.5,
    });
    expect(halfYear.taxableValue).toBe(5000);
  });

  it("reduces the taxable value by employee contributions", () => {
    const result = run("car_fringe_benefit", {
      method: "statutory",
      baseValue: 50000,
      employeeContributions: 3000,
    });
    expect(result.taxableValue).toBe(7000);
  });

  it("uses private use percentage under the operating cost method", () => {
    const result = run("car_fringe_benefit", {
      method: "operating-cost",
      totalOperatingCosts: 15000,
      businessUsePercentage: 80,
    });
    expect(result.taxableValue).toBe(3000);
  });

  it("picks the cheaper method when none is specified", () => {
    const result = run("car_fringe_benefit", {
      baseValue: 50000,
      totalOperatingCosts: 15000,
      businessUsePercentage: 80,
    });
    expect(result.methodUsed).toBe("operating-cost");
    expect(result.taxableValue).toBe(3000);
  });

  it("zeroes the value for an exempt electric vehicle", () => {
    const result = run("car_fringe_benefit", {
      baseValue: 60000,
      isExemptElectricVehicle: true,
    });
    expect(result.taxableValue).toBe(0);
  });
});

describe("superannuation", () => {
  it("uses the 12% guarantee rate from 2025-26", () => {
    const result = run("superannuation_guarantee", {
      financialYear: "2025-26",
      ordinaryTimeEarnings: 100000,
      period: "year",
    });
    expect(result.guaranteeRate).toBe(0.12);
    expect(result.superGuaranteeAmount).toBe(12000);
  });

  it("caps quarterly SG at the maximum contribution base", () => {
    const result = run("superannuation_guarantee", {
      financialYear: "2025-26",
      ordinaryTimeEarnings: 100000,
      period: "quarter",
    });
    // $62,500 x 12% - the excess earnings carry no SG.
    expect(result.cappedByMaximumContributionBase).toBe(true);
    expect(result.superGuaranteeAmount).toBe(7500);
  });

  it("uses 11.5% for 2024-25", () => {
    const result = run("superannuation_guarantee", {
      financialYear: "2024-25",
      ordinaryTimeEarnings: 100000,
      period: "year",
    });
    expect(result.superGuaranteeAmount).toBe(11500);
  });

  it("adds carry-forward cap only under the $500,000 balance limit", () => {
    const eligible = run("superannuation_contribution_caps", {
      financialYear: "2025-26",
      totalSuperBalanceAt30June: 400000,
      unusedConcessionalCapCarriedForward: 25000,
      concessionalContributions: 0,
    });
    const ineligible = run("superannuation_contribution_caps", {
      financialYear: "2025-26",
      totalSuperBalanceAt30June: 600000,
      unusedConcessionalCapCarriedForward: 25000,
      concessionalContributions: 0,
    });
    expect(eligible.concessional.effectiveCap).toBe(55000);
    expect(ineligible.concessional.effectiveCap).toBe(30000);
  });

  it("flags excess concessional contributions", () => {
    const result = run("superannuation_contribution_caps", {
      financialYear: "2025-26",
      concessionalContributions: 35000,
      totalSuperBalanceAt30June: 100000,
    });
    expect(result.concessional.excess).toBe(5000);
  });

  it("gives no non-concessional cap once the balance reaches the threshold", () => {
    const result = run("superannuation_contribution_caps", {
      financialYear: "2025-26",
      totalSuperBalanceAt30June: 2000000,
      nonConcessionalContributions: 50000,
      age: 50,
    });
    expect(result.nonConcessional.capAvailable).toBe(0);
    expect(result.nonConcessional.excess).toBe(50000);
  });

  it("allows a three year bring-forward on a low balance", () => {
    const result = run("superannuation_contribution_caps", {
      financialYear: "2025-26",
      totalSuperBalanceAt30June: 500000,
      age: 50,
    });
    expect(result.nonConcessional.bringForwardYearsAvailable).toBe(3);
    expect(result.nonConcessional.capAvailable).toBe(360000);
  });

  it("charges Division 293 on the amount over $250,000", () => {
    const result = run("superannuation_contribution_caps", {
      financialYear: "2025-26",
      concessionalContributions: 30000,
      income: 240000,
    });
    // 270,000 - 250,000 = 20,000 x 15%
    expect(result.division293.additionalTax).toBe(3000);
  });

  it("charges no Division 293 below the threshold", () => {
    const result = run("superannuation_contribution_caps", {
      financialYear: "2025-26",
      concessionalContributions: 30000,
      income: 150000,
    });
    expect(result.division293.additionalTax).toBe(0);
  });

  it("taxes an SMSF at 15% with a one third CGT discount", () => {
    const result = run("smsf_income_tax", {
      financialYear: "2025-26",
      investmentIncome: 100000,
      grossCapitalGains: 30000,
      capitalGainsHeldOver12Months: true,
    });
    expect(result.netCapitalGain).toBe(20000);
    expect(result.taxableIncome).toBe(120000);
    expect(result.tax.concessionalComponent).toBe(18000);
  });

  it("exempts pension phase income", () => {
    const result = run("smsf_income_tax", {
      financialYear: "2025-26",
      investmentIncome: 100000,
      exemptCurrentPensionIncomePercentage: 100,
    });
    expect(result.exemptCurrentPensionIncome).toBe(100000);
    expect(result.taxableIncome).toBe(0);
  });

  it("taxes non-arm's length income at 45%", () => {
    const result = run("smsf_income_tax", {
      financialYear: "2025-26",
      nonArmsLengthIncome: 20000,
    });
    expect(result.tax.nonArmsLengthComponent).toBe(9000);
  });
});

describe("depreciation", () => {
  it("uses 200% / effective life for diminishing value", () => {
    const result = run("depreciation", {
      financialYear: "2025-26",
      cost: 10000,
      effectiveLifeYears: 10,
      method: "diminishing-value",
      years: 2,
    });
    expect(result.schedule[0].declineInValue).toBe(2000);
    expect(result.schedule[1].declineInValue).toBe(1600);
  });

  it("uses 100% / effective life for prime cost", () => {
    const result = run("depreciation", {
      cost: 10000,
      effectiveLifeYears: 10,
      method: "prime-cost",
      years: 2,
    });
    expect(result.schedule[0].declineInValue).toBe(1000);
    expect(result.schedule[1].declineInValue).toBe(1000);
  });

  it("pro-rates the first year by days held", () => {
    const result = run("depreciation", {
      cost: 10000,
      effectiveLifeYears: 10,
      method: "prime-cost",
      daysHeldInFirstYear: 182.5,
      years: 1,
    });
    expect(result.schedule[0].declineInValue).toBe(500);
  });

  it("applies the instant asset write-off for an eligible small business", () => {
    const result = run("depreciation", {
      financialYear: "2025-26",
      cost: 15000,
      smallBusinessEntity: true,
      aggregatedTurnover: 5000000,
      effectiveLifeYears: 5,
    });
    expect(result.outcome).toBe("instant-asset-write-off");
    expect(result.immediateDeduction).toBe(15000);
  });

  it("does not apply the write-off above the threshold", () => {
    const result = run("depreciation", {
      financialYear: "2025-26",
      cost: 25000,
      smallBusinessEntity: true,
      aggregatedTurnover: 5000000,
      effectiveLifeYears: 5,
    });
    expect(result.outcome).toBe("schedule");
  });

  it("caps a car at the depreciation cost limit", () => {
    const result = run("depreciation", {
      financialYear: "2025-26",
      cost: 90000,
      isCar: true,
      effectiveLifeYears: 8,
      years: 1,
    });
    expect(result.carDepreciationLimitApplied).toBe(true);
    expect(result.cost).toBe(69674);
  });

  it("apportions the deduction by business use", () => {
    const result = run("depreciation", {
      cost: 10000,
      effectiveLifeYears: 10,
      method: "prime-cost",
      businessUsePercentage: 60,
      years: 1,
    });
    expect(result.schedule[0].declineInValue).toBe(1000);
    expect(result.schedule[0].deductibleAmount).toBe(600);
  });

  it("asks for an effective life when it cannot be determined", () => {
    const result = run("depreciation", { cost: 10000, assetDescription: "flux capacitor" });
    expect(result.outcome).toBe("effective-life-required");
    expect(result.knownAssetDescriptions.length).toBeGreaterThan(0);
  });

  it("looks up a common effective life from the description", () => {
    const result = run("depreciation", { cost: 20000, assetDescription: "motor vehicle - car", years: 1 });
    expect(result.effectiveLifeYears).toBe(8);
  });

  it("writes off capital works at 2.5% over 40 years", () => {
    const result = run("capital_works", { constructionCost: 400000, rate: 0.025 });
    expect(result.annualDeduction).toBe(10000);
    expect(result.writeOffPeriodYears).toBe(40);
  });
});

describe("payroll tax", () => {
  it("taxes NSW wages above the flat threshold", () => {
    const result = run("payroll_tax", { state: "NSW", annualAustralianWages: 2000000 });
    // (2,000,000 - 1,200,000) x 5.45%
    expect(result.estimatedAnnualPayrollTax).toBe(43600);
  });

  it("charges nothing below the threshold", () => {
    const result = run("payroll_tax", { state: "NSW", annualAustralianWages: 1000000 });
    expect(result.estimatedAnnualPayrollTax).toBe(0);
  });

  it("uses the regional rate when flagged", () => {
    const metro = run("payroll_tax", { state: "VIC", annualAustralianWages: 2000000 });
    const regional = run("payroll_tax", { state: "VIC", annualAustralianWages: 2000000, regionalEmployer: true });
    expect(regional.rateApplied).toBeLessThan(metro.rateApplied);
  });

  it("names the supported jurisdictions for an unknown state", () => {
    const result = run("payroll_tax", { state: "XYZ", annualAustralianWages: 2000000 });
    expect(result.error).toMatch(/Unknown jurisdiction/);
    expect(result.supportedJurisdictions).toContain("NSW");
  });
});

describe("partnerships", () => {
  it("splits net income by the partners' shares", () => {
    const result = run("partnership_distribution", {
      partnershipNetIncome: 200000,
      partners: [
        { name: "A", sharePercent: 60 },
        { name: "B", sharePercent: 40 },
      ],
    });
    expect(result.partners[0].shareOfNetIncome).toBe(120000);
    expect(result.partners[1].shareOfNetIncome).toBe(80000);
    expect(result.unallocated).toBe(0);
  });

  it("flags shares that do not add up to the net income", () => {
    const result = run("partnership_distribution", {
      partnershipNetIncome: 200000,
      partners: [{ name: "A", sharePercent: 60 }],
    });
    expect(result.unallocated).toBe(80000);
    expect(result.reminders.join(" ")).toMatch(/do not add up/);
  });
});

describe("registry behaviour", () => {
  it("returns an error object with the available names for an unknown calculator", () => {
    const result = run("not_a_calculator", {});
    expect(result.error).toMatch(/Unknown calculator/);
    expect(result.availableCalculators).toContain("individual_income_tax");
  });

  it("returns an error rather than throwing on a bad argument", () => {
    const result = run("individual_income_tax", { taxableIncome: "not a number" });
    expect(result.error).toMatch(/must be a number/);
  });

  it("returns an error for an unsupported financial year", () => {
    const result = run("individual_income_tax", { financialYear: "1990-91", taxableIncome: 1000 });
    expect(result.error).toMatch(/No Australian tax rate data/);
  });

  it("parses currency-formatted strings", () => {
    const result = run("individual_income_tax", { financialYear: "2025-26", taxableIncome: "$100,000" });
    expect(result.incomeTax.amount).toBe(20788);
  });

  it("exposes a schema and description for every calculator", () => {
    const calculators = AustralianTax.listCalculators();
    expect(calculators.length).toBeGreaterThan(10);
    for (const calculator of calculators) {
      expect(typeof calculator.description).toBe("string");
      expect(calculator.description.length).toBeGreaterThan(20);
      expect(calculator.parameters.type).toBe("object");
    }
  });

  it("attaches the disclaimer to every result", () => {
    const results = [
      run("individual_income_tax", { taxableIncome: 50000 }),
      run("company_tax", { taxableIncome: 50000 }),
      run("gst", { amount: 110 }),
      run("fringe_benefits_tax", { type1AggregateAmount: 1000 }),
    ];
    for (const result of results) expect(result.disclaimer).toMatch(/Verify against ato\.gov\.au/);
  });

  it("surfaces the caveat on figures that are not settled law", () => {
    // The 2025-26 Medicare levy low-income thresholds are indexed and marked
    // "estimated" in the rate table.
    const result = run("individual_income_tax", { financialYear: "2025-26", taxableIncome: 50000 });
    expect(result.caveats.join(" ")).toMatch(/Medicare levy low-income thresholds are indexed/);
  });

  it("returns the raw rate table for a section", () => {
    const result = run("tax_rates_lookup", { financialYear: "2025-26", section: "company" });
    expect(result.rates.baseRateEntityRate).toBe(0.25);
    expect(result.rates.standardRate).toBe(0.3);
  });

  it("lists lodgment obligations for an entity type", () => {
    const result = run("lodgment_calendar", { entityType: "trust" });
    expect(result.obligations.some((o) => o.obligation.match(/Trustee resolution/))).toBe(true);
    // "all" obligations are included too.
    expect(result.obligations.some((o) => o.obligation.match(/Quarterly BAS/))).toBe(true);
  });
});
