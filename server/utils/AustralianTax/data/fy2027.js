/**
 * Australian tax parameters for the 2026-27 income year (1 July 2026 - 30 June 2027).
 *
 * The legislated personal tax cuts reduce the second marginal rate from 16% to
 * 15% on 1 July 2026 (and to 14% on 1 July 2027). Indexed amounts that had not
 * been published at the time this table was written are carried forward from
 * 2025-26 and marked `confidence: "estimated"` - verify them before use.
 */
const previous = require("./fy2026");

module.exports = {
  ...previous,
  financialYear: "2026-27",
  startDate: "2026-07-01",
  endDate: "2027-06-30",
  confidence: "mixed",
  verifyNote:
    "Personal rates reflect the legislated 1 July 2026 reduction of the second marginal rate to 15%. Indexed thresholds (Medicare levy low-income, super caps, car limit, cents per km, Division 7A benchmark rate) are carried forward from 2025-26 and must be confirmed against ato.gov.au.",

  individual: {
    ...previous.individual,
    residentBrackets: [
      { from: 0, to: 18200, rate: 0, base: 0 },
      { from: 18200, to: 45000, rate: 0.15, base: 0 },
      { from: 45000, to: 135000, rate: 0.3, base: 4020 },
      { from: 135000, to: 190000, rate: 0.37, base: 31020 },
      { from: 190000, to: null, rate: 0.45, base: 51370 },
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
  },

  div7a: {
    ...previous.div7a,
    confidence: "estimated",
    verifyNote:
      "The 2026-27 Division 7A benchmark interest rate had not been confirmed when this table was written. Look it up on ato.gov.au before preparing minimum yearly repayments.",
  },

  fbt: {
    ...previous.fbt,
    yearLabel: "1 April 2026 - 31 March 2027",
  },

  deductions: {
    ...previous.deductions,
    centsPerKilometreConfidence: "estimated",
    instantAssetWriteOff: {
      amount: 1000,
      aggregatedTurnoverThreshold: 10000000,
      confidence: "estimated",
      note: "Unless further extended, the small business instant asset write-off threshold reverts to $1,000 from 1 July 2026. Confirm the current law before advising.",
    },
  },
};
