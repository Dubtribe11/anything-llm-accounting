/**
 * Financial-year keyed registry of Australian tax parameters.
 *
 * An Australian income year runs 1 July - 30 June and is written "2025-26".
 * All lookups go through `ratesFor()` so callers never index the table directly
 * and always get a clear error (with the supported years) on a bad year.
 */
const { PAYROLL_TAX } = require("./payrollTax");
const {
  COMMON_EFFECTIVE_LIVES,
  CAPITAL_WORKS_RATES,
} = require("./effectiveLives");

const YEARS = {
  "2023-24": require("./fy2024"),
  "2024-25": require("./fy2025"),
  "2025-26": require("./fy2026"),
  "2026-27": require("./fy2027"),
};

const SUPPORTED_YEARS = Object.keys(YEARS).sort();
const LATEST_YEAR = SUPPORTED_YEARS[SUPPORTED_YEARS.length - 1];

/**
 * The Australian income year that a given date falls into.
 * @param {Date} [date]
 * @returns {string} e.g. "2025-26"
 */
function financialYearOf(date = new Date()) {
  const year = date.getFullYear();
  // Months are 0-indexed; July is 6.
  const startYear = date.getMonth() >= 6 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/**
 * The income year that is currently being *lodged* for most taxpayers. Between
 * 1 July and 30 June the return everyone is preparing is for the year that just
 * ended, so this is the sensible default when a user says "this year's return".
 * @param {Date} [date]
 * @returns {string}
 */
function lodgementFinancialYearOf(date = new Date()) {
  const current = financialYearOf(date);
  const startYear = Number(current.split("-")[0]);
  return `${startYear - 1}-${String(startYear % 100).padStart(2, "0")}`;
}

/**
 * Normalises loose user input into a supported financial year key.
 * Accepts "2025-26", "2025/26", "FY26", "FY2026", "2026" (year ending) and
 * `null` (meaning "current").
 * @param {string|number|null} [input]
 * @returns {string|null} normalised key, or null if it cannot be understood
 */
function normalizeFinancialYear(input) {
  if (input === null || input === undefined || input === "") return null;
  const raw = String(input).trim().toUpperCase().replace(/\s+/g, "");

  const fullMatch = raw.match(/^(?:FY)?(\d{4})[-/](\d{2}|\d{4})$/);
  if (fullMatch) {
    const start = Number(fullMatch[1]);
    return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
  }

  const shortMatch = raw.match(/^FY(\d{2}|\d{4})$/);
  if (shortMatch) {
    const value = Number(shortMatch[1]);
    const endYear = value < 100 ? 2000 + value : value;
    return `${endYear - 1}-${String(endYear % 100).padStart(2, "0")}`;
  }

  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) {
    const value = Number(yearOnly[1]);
    // A bare 4-digit year is read as the year the income year *ends*, which is
    // how Australians normally say it ("the 2026 return").
    return `${value - 1}-${String(value % 100).padStart(2, "0")}`;
  }

  return null;
}

/**
 * @param {string|number|null} [financialYear] - omit for the year currently being lodged
 * @returns {object} the rate table for that year
 * @throws {Error} when the year is not understood or not supported
 */
function ratesFor(financialYear = null) {
  const key =
    normalizeFinancialYear(financialYear) ?? lodgementFinancialYearOf();
  if (!YEARS[key]) {
    throw new Error(
      `No Australian tax rate data for financial year "${key}". Supported years: ${SUPPORTED_YEARS.join(", ")}.`
    );
  }
  return YEARS[key];
}

/**
 * @param {string|number|null} [financialYear]
 * @returns {object} payroll tax parameters for every state/territory
 */
function payrollTaxFor(financialYear = null) {
  const key =
    normalizeFinancialYear(financialYear) ?? lodgementFinancialYearOf();
  return PAYROLL_TAX[key] ?? PAYROLL_TAX[LATEST_YEAR];
}

module.exports = {
  YEARS,
  SUPPORTED_YEARS,
  LATEST_YEAR,
  COMMON_EFFECTIVE_LIVES,
  CAPITAL_WORKS_RATES,
  financialYearOf,
  lodgementFinancialYearOf,
  normalizeFinancialYear,
  ratesFor,
  payrollTaxFor,
};
