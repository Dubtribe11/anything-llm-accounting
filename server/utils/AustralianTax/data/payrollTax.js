/**
 * State and territory payroll tax parameters.
 *
 * Payroll tax is a STATE tax - it is not administered by the ATO. Thresholds,
 * rates, surcharges and grouping rules differ in every jurisdiction and change
 * frequently. These figures are a starting point for estimates only; always
 * confirm against the relevant revenue office before lodging.
 */
const PAYROLL_TAX = {
  "2025-26": {
    confidence: "estimated",
    verifyNote:
      "Confirm thresholds, rates and surcharges with the relevant state/territory revenue office before lodging or advising.",
    jurisdictions: {
      NSW: {
        name: "New South Wales",
        revenueOffice: "Revenue NSW",
        annualThreshold: 1200000,
        rate: 0.0545,
        thresholdType: "flat",
        notes: [
          "Threshold is apportioned for grouped employers and for part-year employment.",
          "Monthly returns with an annual reconciliation.",
        ],
      },
      VIC: {
        name: "Victoria",
        revenueOffice: "State Revenue Office Victoria",
        annualThreshold: 1000000,
        rate: 0.0485,
        regionalRate: 0.012125,
        thresholdType: "phase-out",
        phaseOutUpper: 5000000,
        surcharges: [
          {
            name: "Mental Health and Wellbeing Surcharge",
            rate: 0.005,
            appliesAbove: 10000000,
          },
          {
            name: "Mental Health and Wellbeing Surcharge (additional)",
            rate: 0.005,
            appliesAbove: 100000000,
          },
        ],
        notes: [
          "The tax-free threshold phases out between $3m and $5m of Australian wages.",
        ],
      },
      QLD: {
        name: "Queensland",
        revenueOffice: "Queensland Revenue Office",
        annualThreshold: 1300000,
        rate: 0.0475,
        higherRate: 0.0495,
        higherRateAppliesAbove: 6500000,
        thresholdType: "phase-out",
        phaseOutUpper: 6500000,
        regionalDiscount: 0.01,
        surcharges: [
          {
            name: "Mental Health Levy",
            rate: 0.0025,
            appliesAbove: 10000000,
          },
          {
            name: "Mental Health Levy (additional)",
            rate: 0.005,
            appliesAbove: 100000000,
          },
        ],
      },
      SA: {
        name: "South Australia",
        revenueOffice: "RevenueSA",
        annualThreshold: 1500000,
        rate: 0.0495,
        thresholdType: "variable-rate",
        variableRateUpper: 1700000,
        notes: [
          "Between $1.5m and $1.7m of Australian wages the rate varies from 0% to 4.95%.",
        ],
      },
      WA: {
        name: "Western Australia",
        revenueOffice: "RevenueWA",
        annualThreshold: 1000000,
        rate: 0.055,
        thresholdType: "phase-out",
        phaseOutUpper: 7500000,
        tiers: [
          { above: 100000000, rate: 0.06 },
          { above: 1500000000, rate: 0.065 },
        ],
      },
      TAS: {
        name: "Tasmania",
        revenueOffice: "State Revenue Office Tasmania",
        annualThreshold: 1250000,
        rate: 0.04,
        thresholdType: "tiered",
        tiers: [{ above: 2000000, rate: 0.061 }],
      },
      ACT: {
        name: "Australian Capital Territory",
        revenueOffice: "ACT Revenue Office",
        annualThreshold: 2000000,
        rate: 0.0685,
        thresholdType: "flat",
      },
      NT: {
        name: "Northern Territory",
        revenueOffice: "Territory Revenue Office",
        annualThreshold: 1500000,
        rate: 0.055,
        thresholdType: "phase-out",
        phaseOutUpper: 7500000,
      },
    },
  },
};

// Later years fall back to the most recent table we have.
PAYROLL_TAX["2026-27"] = {
  ...PAYROLL_TAX["2025-26"],
  verifyNote:
    "Carried forward from 2025-26. Payroll tax thresholds and rates change frequently - confirm with the relevant revenue office.",
};
PAYROLL_TAX["2024-25"] = PAYROLL_TAX["2025-26"];
PAYROLL_TAX["2023-24"] = PAYROLL_TAX["2025-26"];

module.exports = { PAYROLL_TAX };
