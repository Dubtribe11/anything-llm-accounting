/**
 * Australian tax engine.
 *
 * A registry of deterministic calculators plus the rate tables behind them. The
 * point of this module is that the model never has to *remember* a threshold or
 * do arithmetic in its head - it calls a calculator and reports the result.
 *
 * Each entry carries a JSON schema so the same registry drives the agent skill,
 * the HTTP endpoints and any future UI without the definitions drifting apart.
 */
const data = require("./data");
const { calculateIndividualTax } = require("./calculators/individual");
const {
  calculateCompanyTax,
  calculateFranking,
  calculateDiv7AMinimumRepayment,
} = require("./calculators/company");
const { calculateTrustDistribution } = require("./calculators/trust");
const {
  calculatePartnershipDistribution,
} = require("./calculators/partnership");
const { calculateCapitalGain } = require("./calculators/cgt");
const {
  calculateGst,
  calculateBas,
  gstRegistrationCheck,
} = require("./calculators/gst");
const {
  calculateFbt,
  calculateCarFringeBenefit,
} = require("./calculators/fbt");
const {
  calculateSuperGuarantee,
  calculateContributionCaps,
  calculateSmsfTax,
} = require("./calculators/superannuation");
const {
  calculateDepreciation,
  calculateCapitalWorks,
} = require("./calculators/depreciation");
const { calculatePayrollTax } = require("./calculators/payrollTax");
const { lodgmentCalendar } = require("./calculators/lodgment");

const FY_PARAM = {
  type: "string",
  description:
    'Australian income year, e.g. "2025-26". Omit to use the year currently being lodged.',
};

const CALCULATORS = {
  individual_income_tax: {
    description:
      "Estimate an individual's (or sole trader's) income tax: tax on the applicable scale, LITO, Medicare levy and surcharge, study/training loan repayment, franking credits and PAYG credits.",
    handler: calculateIndividualTax,
    parameters: {
      type: "object",
      properties: {
        financialYear: FY_PARAM,
        taxableIncome: {
          type: "number",
          description:
            "Taxable income. Supply this, or assessableIncome and deductions.",
        },
        assessableIncome: { type: "number" },
        deductions: { type: "number" },
        residency: {
          type: "string",
          enum: ["resident", "foreign-resident", "working-holiday-maker"],
        },
        hasSpouseOrDependants: { type: "boolean" },
        dependentChildren: { type: "number" },
        seniorOrPensioner: { type: "boolean" },
        medicareLevyExemption: {
          type: "string",
          enum: ["none", "half", "full"],
        },
        privateHospitalCover: { type: "boolean" },
        reportableFringeBenefits: { type: "number" },
        reportableSuperContributions: { type: "number" },
        netInvestmentLosses: { type: "number" },
        hasStudyLoan: { type: "boolean" },
        studyLoanBalance: { type: "number" },
        frankingCredits: { type: "number" },
        otherNonRefundableOffsets: { type: "number" },
        otherRefundableOffsets: { type: "number" },
        paygWithheld: { type: "number" },
        paygInstalmentsPaid: { type: "number" },
      },
    },
  },

  company_tax: {
    description:
      "Estimate company income tax, including the base rate entity test that decides whether the 25% or 30% rate applies.",
    handler: calculateCompanyTax,
    parameters: {
      type: "object",
      required: ["taxableIncome"],
      properties: {
        financialYear: FY_PARAM,
        taxableIncome: { type: "number" },
        aggregatedTurnover: { type: "number" },
        assessableIncome: { type: "number" },
        passiveIncome: {
          type: "number",
          description: "Base rate entity passive income.",
        },
        priorYearLossesApplied: { type: "number" },
        frankingCreditsReceived: { type: "number" },
        otherRefundableOffsets: { type: "number" },
        paygInstalmentsPaid: { type: "number" },
        forceStandardRate: { type: "boolean" },
      },
    },
  },

  franking: {
    description:
      "Work out the franking credit, gross-up and maximum franking credit on a dividend.",
    handler: calculateFranking,
    parameters: {
      type: "object",
      required: ["distributionAmount"],
      properties: {
        financialYear: FY_PARAM,
        distributionAmount: {
          type: "number",
          description: "Cash dividend amount.",
        },
        frankingPercentage: {
          type: "number",
          description: "0-100, defaults to 100.",
        },
        corporateTaxRateForImputation: {
          type: "number",
          description: "0.25 or 0.30. Defaults to the base rate entity rate.",
        },
      },
    },
  },

  division_7a_minimum_repayment: {
    description:
      "Calculate the Division 7A minimum yearly repayment on a complying loan from a private company to a shareholder or associate.",
    handler: calculateDiv7AMinimumRepayment,
    parameters: {
      type: "object",
      required: ["openingLoanBalance"],
      properties: {
        financialYear: FY_PARAM,
        openingLoanBalance: {
          type: "number",
          description:
            "Amount of the loan not repaid at the end of the previous income year.",
        },
        loanTermYears: {
          type: "number",
          description: "7 for unsecured, 25 for secured.",
        },
        yearsElapsed: {
          type: "number",
          description: "Complete income years since the loan was made.",
        },
        benchmarkInterestRate: {
          type: "number",
          description: "Override the bundled rate if needed.",
        },
      },
    },
  },

  trust_distribution: {
    description:
      "Compute trust net income (s 95) and allocate it to beneficiaries, including streaming of franked distributions and capital gains, Division 6AA minor rates, and s 99A on undistributed income.",
    handler: calculateTrustDistribution,
    parameters: {
      type: "object",
      properties: {
        financialYear: FY_PARAM,
        trustNetIncome: { type: "number" },
        components: {
          type: "object",
          properties: {
            ordinaryIncome: { type: "number" },
            frankedDistributions: { type: "number" },
            frankingCredits: { type: "number" },
            grossCapitalGains: { type: "number" },
            capitalLossesApplied: { type: "number" },
            capitalGainsDiscountEligible: { type: "boolean" },
            foreignIncome: { type: "number" },
            deductions: { type: "number" },
          },
        },
        beneficiaries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              entityType: {
                type: "string",
                enum: ["individual", "company", "trust", "smsf", "partnership"],
              },
              sharePercent: { type: "number" },
              shareAmount: { type: "number" },
              isMinor: { type: "boolean" },
              otherTaxableIncome: { type: "number" },
              streamedFrankedDistributions: { type: "number" },
              streamedCapitalGains: { type: "number" },
            },
          },
        },
      },
    },
  },

  partnership_distribution: {
    description:
      "Allocate partnership net income to partners under Division 5 and estimate each partner's tax.",
    handler: calculatePartnershipDistribution,
    parameters: {
      type: "object",
      properties: {
        financialYear: FY_PARAM,
        partnershipNetIncome: { type: "number" },
        assessableIncome: { type: "number" },
        deductions: { type: "number" },
        partners: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              entityType: {
                type: "string",
                enum: ["individual", "company", "trust"],
              },
              sharePercent: { type: "number" },
              otherTaxableIncome: { type: "number" },
            },
          },
        },
      },
    },
  },

  capital_gains_tax: {
    description:
      "Calculate a net capital gain: proceeds less cost base, capital losses, the CGT discount, and the small business CGT concessions in Division 152.",
    handler: calculateCapitalGain,
    parameters: {
      type: "object",
      required: ["capitalProceeds", "costBase"],
      properties: {
        financialYear: FY_PARAM,
        entityType: {
          type: "string",
          enum: ["individual", "trust", "company", "smsf", "partnership"],
        },
        capitalProceeds: { type: "number" },
        costBase: { type: "number" },
        improvementCosts: { type: "number" },
        acquisitionDate: {
          type: "string",
          description: "ISO date, e.g. 2019-03-14.",
        },
        disposalDate: { type: "string" },
        heldMoreThan12Months: { type: "boolean" },
        currentYearCapitalLosses: { type: "number" },
        priorYearCapitalLosses: { type: "number" },
        smallBusinessConcessions: {
          type: "object",
          properties: {
            fifteenYearExemption: { type: "boolean" },
            activeAssetReduction: { type: "boolean" },
            retirementExemptionAmount: { type: "number" },
            retirementExemptionAlreadyUsed: { type: "number" },
            rolloverAmount: { type: "number" },
          },
        },
      },
    },
  },

  gst: {
    description:
      "Add GST to a price, or extract the GST from a GST-inclusive amount (one eleventh).",
    handler: calculateGst,
    parameters: {
      type: "object",
      required: ["amount"],
      properties: {
        financialYear: FY_PARAM,
        amount: { type: "number" },
        mode: { type: "string", enum: ["add", "extract"] },
      },
    },
  },

  business_activity_statement: {
    description:
      "Estimate the key BAS labels (G1, 1A, 1B, W1, W2) and the net amount payable or refundable.",
    handler: calculateBas,
    parameters: {
      type: "object",
      properties: {
        financialYear: FY_PARAM,
        totalSales: { type: "number", description: "GST inclusive." },
        gstFreeSales: { type: "number" },
        exportSales: { type: "number" },
        inputTaxedSales: { type: "number" },
        totalPurchases: { type: "number", description: "GST inclusive." },
        capitalPurchases: { type: "number" },
        nonCreditablePurchases: { type: "number" },
        wagesPaid: { type: "number" },
        paygWithheld: { type: "number" },
        paygInstalment: { type: "number" },
        fbtInstalment: { type: "number" },
        cashBasis: { type: "boolean" },
      },
    },
  },

  gst_registration_check: {
    description:
      "Decide whether GST registration is required and which reporting cycle applies.",
    handler: gstRegistrationCheck,
    parameters: {
      type: "object",
      required: ["gstTurnover"],
      properties: {
        financialYear: FY_PARAM,
        gstTurnover: { type: "number" },
        isNonProfit: { type: "boolean" },
        providesTaxiOrRideSourcing: { type: "boolean" },
      },
    },
  },

  fringe_benefits_tax: {
    description:
      "Calculate FBT payable from Type 1 and Type 2 aggregate amounts.",
    handler: calculateFbt,
    parameters: {
      type: "object",
      properties: {
        financialYear: FY_PARAM,
        type1AggregateAmount: {
          type: "number",
          description:
            "Taxable value of benefits where a GST credit was available.",
        },
        type2AggregateAmount: { type: "number" },
        fbtInstalmentsPaid: { type: "number" },
      },
    },
  },

  car_fringe_benefit: {
    description:
      "Compare the statutory formula and operating cost methods for a car fringe benefit and return the lower taxable value.",
    handler: calculateCarFringeBenefit,
    parameters: {
      type: "object",
      properties: {
        financialYear: FY_PARAM,
        method: { type: "string", enum: ["statutory", "operating-cost"] },
        baseValue: { type: "number" },
        daysAvailable: { type: "number" },
        totalOperatingCosts: { type: "number" },
        businessUsePercentage: { type: "number" },
        employeeContributions: { type: "number" },
        isExemptElectricVehicle: { type: "boolean" },
      },
    },
  },

  superannuation_guarantee: {
    description:
      "Calculate the superannuation guarantee on ordinary time earnings for a quarter or year.",
    handler: calculateSuperGuarantee,
    parameters: {
      type: "object",
      required: ["ordinaryTimeEarnings"],
      properties: {
        financialYear: FY_PARAM,
        ordinaryTimeEarnings: { type: "number" },
        period: { type: "string", enum: ["quarter", "year"] },
      },
    },
  },

  superannuation_contribution_caps: {
    description:
      "Check concessional and non-concessional contribution caps, carry-forward and bring-forward availability, and Division 293 tax.",
    handler: calculateContributionCaps,
    parameters: {
      type: "object",
      properties: {
        financialYear: FY_PARAM,
        concessionalContributions: { type: "number" },
        nonConcessionalContributions: { type: "number" },
        totalSuperBalanceAt30June: { type: "number" },
        unusedConcessionalCapCarriedForward: { type: "number" },
        income: {
          type: "number",
          description:
            "Income for Division 293 purposes, excluding the contributions.",
        },
        age: { type: "number" },
      },
    },
  },

  smsf_income_tax: {
    description:
      "Estimate a complying superannuation fund / SMSF's income tax, including ECPI and NALI.",
    handler: calculateSmsfTax,
    parameters: {
      type: "object",
      properties: {
        financialYear: FY_PARAM,
        concessionalContributionsReceived: { type: "number" },
        investmentIncome: { type: "number" },
        grossCapitalGains: { type: "number" },
        capitalGainsHeldOver12Months: { type: "boolean" },
        exemptCurrentPensionIncomePercentage: { type: "number" },
        deductions: { type: "number" },
        frankingCredits: { type: "number" },
        nonArmsLengthIncome: { type: "number" },
      },
    },
  },

  depreciation: {
    description:
      "Produce a Division 40 depreciation schedule (prime cost or diminishing value), or apply the instant asset write-off where eligible.",
    handler: calculateDepreciation,
    parameters: {
      type: "object",
      required: ["cost"],
      properties: {
        financialYear: FY_PARAM,
        cost: { type: "number" },
        assetDescription: {
          type: "string",
          description: "Used to look up a common effective life.",
        },
        effectiveLifeYears: { type: "number" },
        method: { type: "string", enum: ["diminishing-value", "prime-cost"] },
        daysHeldInFirstYear: { type: "number" },
        businessUsePercentage: { type: "number" },
        years: { type: "number" },
        isCar: { type: "boolean" },
        smallBusinessEntity: { type: "boolean" },
        aggregatedTurnover: { type: "number" },
      },
    },
  },

  capital_works: {
    description:
      "Calculate the Division 43 capital works deduction on construction costs.",
    handler: calculateCapitalWorks,
    parameters: {
      type: "object",
      required: ["constructionCost"],
      properties: {
        constructionCost: { type: "number" },
        rate: { type: "number", description: "0.025 or 0.04." },
        assetType: { type: "string" },
        daysIncomeProducing: { type: "number" },
      },
    },
  },

  payroll_tax: {
    description:
      "Estimate state or territory payroll tax, including threshold phase-outs, regional rates and surcharges.",
    handler: calculatePayrollTax,
    parameters: {
      type: "object",
      required: ["state", "annualAustralianWages"],
      properties: {
        financialYear: FY_PARAM,
        state: {
          type: "string",
          enum: ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"],
        },
        annualAustralianWages: { type: "number" },
        taxableWagesInState: { type: "number" },
        regionalEmployer: { type: "boolean" },
      },
    },
  },

  lodgment_calendar: {
    description: "List lodgment and payment due dates for an entity type.",
    handler: lodgmentCalendar,
    parameters: {
      type: "object",
      properties: {
        financialYear: FY_PARAM,
        entityType: {
          type: "string",
          enum: [
            "individual",
            "company",
            "trust",
            "partnership",
            "smsf",
            "employer",
            "business",
          ],
        },
      },
    },
  },

  tax_rates_lookup: {
    description:
      "Return the raw bundled rate table for a financial year - brackets, thresholds, caps and rates - so figures can be quoted exactly.",
    handler: (input = {}) => {
      const rates = data.ratesFor(input.financialYear ?? null);
      const section = input.section ? rates[input.section] : null;
      return {
        calculator: "tax-rates-lookup",
        financialYear: rates.financialYear,
        supportedYears: data.SUPPORTED_YEARS,
        section: input.section ?? "all",
        rates: section ?? rates,
      };
    },
    parameters: {
      type: "object",
      properties: {
        financialYear: FY_PARAM,
        section: {
          type: "string",
          enum: [
            "individual",
            "medicareLevy",
            "medicareLevySurcharge",
            "studyLoan",
            "company",
            "div7a",
            "trust",
            "smsf",
            "cgt",
            "gst",
            "fbt",
            "superannuation",
            "deductions",
            "smallBusiness",
            "rd",
          ],
        },
      },
    },
  },
};

/**
 * Run a calculator by name.
 * @param {string} name
 * @param {object} args
 * @returns {object} the calculator result, or an `{ error }` object
 */
function runCalculator(name, args = {}) {
  const entry = CALCULATORS[name];
  if (!entry)
    return {
      error: `Unknown calculator "${name}".`,
      availableCalculators: Object.keys(CALCULATORS),
    };
  try {
    return entry.handler(args ?? {});
  } catch (error) {
    return {
      error: error.message,
      calculator: name,
      hint: "Check the argument names and types against the calculator's schema.",
    };
  }
}

/** Compact list of calculators for prompts and tool definitions. */
function listCalculators() {
  return Object.entries(CALCULATORS).map(([name, entry]) => ({
    name,
    description: entry.description,
    parameters: entry.parameters,
  }));
}

module.exports = {
  CALCULATORS,
  runCalculator,
  listCalculators,
  ...data,
};
