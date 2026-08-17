/**
 * Shared numeric helpers for the Australian tax calculators.
 *
 * Every calculator returns plain JSON-serialisable objects so the results can
 * be handed straight to an LLM tool call, an API response, or a UI.
 */

/** Round to cents, avoiding binary floating point drift on .5 boundaries. */
function round2(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Round down to whole dollars (how the ATO calculates most tax amounts). */
function roundDownDollars(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.floor(value);
}

/** Coerce user/LLM supplied input into a non-negative number. */
function toAmount(value, fieldName = "amount") {
  if (value === null || value === undefined || value === "") return 0;
  const num =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(num))
    throw new Error(
      `${fieldName} must be a number, received ${JSON.stringify(value)}`
    );
  return num;
}

/** Coerce to a number that may legitimately be negative (e.g. a capital loss). */
function toSignedAmount(value, fieldName = "amount") {
  return toAmount(value, fieldName);
}

function toBool(value, fallback = false) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const str = String(value).trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(str)) return true;
  if (["false", "no", "n", "0"].includes(str)) return false;
  return fallback;
}

/**
 * Applies a progressive bracket table to an amount.
 * Brackets use `{ from, to, rate, base }` where `base` is the cumulative tax at
 * the bottom of the bracket. When `base` is absent the tax is built up from the
 * bracket widths instead, so both styles of table work.
 * @param {number} amount
 * @param {Array<{from:number,to:number|null,rate:number,base?:number,wholeAmount?:boolean}>} brackets
 * @returns {{tax:number, marginalRate:number, bracket:object|null, breakdown:Array}}
 */
function applyBrackets(amount, brackets) {
  const income = Math.max(0, amount);
  const breakdown = [];
  let tax = 0;
  let marginalRate = 0;
  let matched = null;

  for (const bracket of brackets) {
    const upper =
      bracket.to === null || bracket.to === undefined ? Infinity : bracket.to;
    if (income <= bracket.from) continue;

    matched = bracket;
    marginalRate = bracket.rate;

    // Division 6AA's top band taxes the *whole* amount, not just the excess.
    if (bracket.wholeAmount && income > bracket.from) {
      tax = income * bracket.rate;
      breakdown.length = 0;
      breakdown.push({
        from: bracket.from,
        to: null,
        rate: bracket.rate,
        taxedAmount: round2(income),
        tax: round2(tax),
        note: bracket.note ?? "Rate applies to the entire amount",
      });
      continue;
    }

    const taxedAmount = Math.min(income, upper) - bracket.from;
    if (taxedAmount <= 0) continue;
    const bracketTax = taxedAmount * bracket.rate;
    breakdown.push({
      from: bracket.from,
      to: bracket.to,
      rate: bracket.rate,
      taxedAmount: round2(taxedAmount),
      tax: round2(bracketTax),
    });
  }

  if (matched && !matched.wholeAmount && typeof matched.base === "number") {
    const upperOfMatched =
      matched.to === null || matched.to === undefined ? Infinity : matched.to;
    // Use the published `base + rate x excess` formula for the final bracket so
    // the result matches ATO tables exactly rather than accumulating rounding.
    if (income <= upperOfMatched)
      tax = matched.base + (income - matched.from) * matched.rate;
    else tax = breakdown.reduce((sum, row) => sum + row.tax, 0);
  } else if (!matched?.wholeAmount) {
    tax = breakdown.reduce((sum, row) => sum + row.tax, 0);
  }

  return {
    tax: round2(Math.max(0, tax)),
    marginalRate,
    bracket: matched,
    breakdown,
  };
}

/**
 * Collects `verifyNote` / `confidence` markers off the rate tables that were
 * actually used so every result can tell the reader what to double-check.
 * @param {...(object|undefined)} sections
 * @returns {string[]}
 */
function collectCaveats(...sections) {
  const caveats = [];
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    if (section.verifyNote) caveats.push(section.verifyNote);
    if (section.note) caveats.push(section.note);
    if (
      section.confidence &&
      section.confidence !== "legislated" &&
      !section.verifyNote &&
      !section.note
    )
      caveats.push(
        `One or more figures used here are marked "${section.confidence}" - confirm them against ato.gov.au.`
      );
  }
  return [...new Set(caveats)];
}

const DISCLAIMER =
  "Calculated estimate only, based on the bundled rate tables. It is general information, not personal tax advice, and does not account for every offset, levy or integrity rule that may apply. Verify against ato.gov.au or a registered tax agent before lodging.";

module.exports = {
  round2,
  roundDownDollars,
  toAmount,
  toSignedAmount,
  toBool,
  applyBrackets,
  collectCaveats,
  DISCLAIMER,
};
