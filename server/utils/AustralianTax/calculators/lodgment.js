/**
 * Key Australian lodgment and payment dates.
 *
 * Dates shift when they fall on a weekend or public holiday (the ATO accepts
 * the next business day) and tax agent concessional dates depend on the client's
 * lodgment history and prior-year status. Confirm anything date-critical in the
 * ATO's lodgment program for the relevant year.
 */
const { lodgementFinancialYearOf, normalizeFinancialYear } = require("../data");

const OBLIGATIONS = [
  {
    obligation: "Quarterly BAS - September quarter",
    entityTypes: ["all"],
    dueDate: "28 October",
    agentConcession: "25 November when lodged electronically through a registered agent",
  },
  {
    obligation: "Quarterly BAS - December quarter",
    entityTypes: ["all"],
    dueDate: "28 February",
    agentConcession: "No further extension - 28 February applies to everyone",
  },
  {
    obligation: "Quarterly BAS - March quarter",
    entityTypes: ["all"],
    dueDate: "28 April",
    agentConcession: "26 May when lodged electronically through a registered agent",
  },
  {
    obligation: "Quarterly BAS - June quarter",
    entityTypes: ["all"],
    dueDate: "28 July",
    agentConcession: "25 August when lodged electronically through a registered agent",
  },
  {
    obligation: "Monthly BAS / IAS",
    entityTypes: ["all"],
    dueDate: "21st of the following month",
  },
  {
    obligation: "Superannuation guarantee contributions",
    entityTypes: ["employer"],
    dueDate: "28 days after the end of each quarter (28 Oct, 28 Jan, 28 Apr, 28 Jul)",
    note: "Late payment triggers the superannuation guarantee charge, which is not deductible. Payday Super is legislated to change this from 1 July 2026 - confirm the commencement rules.",
  },
  {
    obligation: "Superannuation guarantee charge statement",
    entityTypes: ["employer"],
    dueDate: "28 days after the SG due date (i.e. 28 Nov, 28 Feb, 28 May, 28 Aug)",
  },
  {
    obligation: "Single Touch Payroll finalisation declaration",
    entityTypes: ["employer"],
    dueDate: "14 July",
    note: "31 July for closely held payees of small employers.",
  },
  {
    obligation: "PAYG withholding annual report (where not reported via STP)",
    entityTypes: ["employer"],
    dueDate: "14 August",
  },
  {
    obligation: "Taxable payments annual report (TPAR)",
    entityTypes: ["business"],
    dueDate: "28 August",
    note: "Required for building and construction, cleaning, courier, road freight, IT and security services businesses.",
  },
  {
    obligation: "FBT return and payment",
    entityTypes: ["employer"],
    dueDate: "21 May",
    agentConcession: "25 June when lodged electronically through a registered agent",
    note: "The FBT year ends 31 March.",
  },
  {
    obligation: "Trustee resolution making beneficiaries presently entitled",
    entityTypes: ["trust"],
    dueDate: "30 June",
    note: "Or the earlier date required by the trust deed. Must be in writing and evidenced.",
  },
  {
    obligation: "Division 7A minimum yearly repayment",
    entityTypes: ["company"],
    dueDate: "30 June",
  },
  {
    obligation: "Division 7A written loan agreement (for a loan made in the year)",
    entityTypes: ["company"],
    dueDate: "The company's lodgment day for that income year",
  },
  {
    obligation: "Individual income tax return (self-preparer)",
    entityTypes: ["individual"],
    dueDate: "31 October",
    agentConcession:
      "Up to 15 May of the following year through a registered tax agent, provided the client is on the agent's list by 31 October",
  },
  {
    obligation: "Company / trust / partnership income tax return",
    entityTypes: ["company", "trust", "partnership"],
    dueDate: "28 February (new registrants and large/medium taxpayers) or 15 May via a tax agent",
    note: "The exact date depends on the entity's prior-year lodgment status and taxable income - check the ATO lodgment program.",
  },
  {
    obligation: "SMSF annual return",
    entityTypes: ["smsf"],
    dueDate: "28 February for newly registered funds, otherwise 15 May via a tax agent",
    note: "The fund must be audited by an approved SMSF auditor before the return is lodged.",
  },
  {
    obligation: "Personal deductible super contribution - notice of intent",
    entityTypes: ["individual"],
    dueDate: "Before the income tax return is lodged, or by 30 June of the following year (whichever is earlier)",
  },
  {
    obligation: "Annual GST return (for annual reporters)",
    entityTypes: ["business"],
    dueDate: "The date the income tax return is due, otherwise 28 February",
  },
];

/**
 * @param {object} [input]
 * @param {string} [input.entityType] - individual, company, trust, partnership, smsf, employer, business
 * @param {string} [input.financialYear]
 */
function lodgmentCalendar(input = {}) {
  const financialYear =
    normalizeFinancialYear(input.financialYear) ?? lodgementFinancialYearOf();
  const entityType = String(input.entityType ?? "").trim().toLowerCase();

  const obligations = entityType
    ? OBLIGATIONS.filter(
        (o) => o.entityTypes.includes("all") || o.entityTypes.includes(entityType)
      )
    : OBLIGATIONS;

  return {
    calculator: "lodgment-calendar",
    financialYear,
    entityType: entityType || "all",
    obligations,
    caveats: [
      "When a due date falls on a weekend or public holiday, the ATO accepts lodgment and payment on the next business day.",
      "Tax agent concessional dates depend on the client being on the agent's client list and having lodged prior years on time.",
      "Always confirm dates against the ATO lodgment program for the relevant year.",
    ],
  };
}

module.exports = { lodgmentCalendar, OBLIGATIONS };
