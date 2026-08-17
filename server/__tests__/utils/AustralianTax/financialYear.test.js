const {
  financialYearOf,
  lodgementFinancialYearOf,
  normalizeFinancialYear,
  ratesFor,
  SUPPORTED_YEARS,
} = require("../../../utils/AustralianTax/data");

describe("financialYearOf", () => {
  it("puts July onwards in the year that just started", () => {
    expect(financialYearOf(new Date("2025-07-01T00:00:00"))).toBe("2025-26");
    expect(financialYearOf(new Date("2025-12-31T00:00:00"))).toBe("2025-26");
  });

  it("puts January to June in the year that started the previous July", () => {
    expect(financialYearOf(new Date("2026-06-30T00:00:00"))).toBe("2025-26");
    expect(financialYearOf(new Date("2026-01-15T00:00:00"))).toBe("2025-26");
  });

  it("pads a single-digit end year", () => {
    expect(financialYearOf(new Date("2008-09-01T00:00:00"))).toBe("2008-09");
    expect(financialYearOf(new Date("2009-08-01T00:00:00"))).toBe("2009-10");
  });
});

describe("lodgementFinancialYearOf", () => {
  it("is the year that just ended - the return most people are preparing", () => {
    expect(lodgementFinancialYearOf(new Date("2026-08-17T00:00:00"))).toBe("2025-26");
    expect(lodgementFinancialYearOf(new Date("2026-03-01T00:00:00"))).toBe("2024-25");
  });
});

describe("normalizeFinancialYear", () => {
  it.each([
    ["2025-26", "2025-26"],
    ["2025/26", "2025-26"],
    ["2025-2026", "2025-26"],
    ["FY26", "2025-26"],
    ["FY2026", "2025-26"],
    ["fy 26", "2025-26"],
    [2026, "2025-26"],
    ["2026", "2025-26"],
  ])("reads %p as %p", (input, expected) => {
    expect(normalizeFinancialYear(input)).toBe(expected);
  });

  it("returns null for empty input so callers can fall back to the current year", () => {
    expect(normalizeFinancialYear(null)).toBeNull();
    expect(normalizeFinancialYear("")).toBeNull();
    expect(normalizeFinancialYear(undefined)).toBeNull();
  });

  it("returns null for input it cannot understand", () => {
    expect(normalizeFinancialYear("last year")).toBeNull();
    expect(normalizeFinancialYear("20-21-22")).toBeNull();
  });
});

describe("ratesFor", () => {
  it("returns the table for a supported year", () => {
    expect(ratesFor("2025-26").financialYear).toBe("2025-26");
  });

  it("throws with the supported years listed when a year has no data", () => {
    expect(() => ratesFor("1999-00")).toThrow(/Supported years/);
  });

  it("has a complete table for every supported year", () => {
    for (const year of SUPPORTED_YEARS) {
      const rates = ratesFor(year);
      expect(rates.financialYear).toBe(year);
      expect(rates.individual.residentBrackets.length).toBeGreaterThan(0);
      expect(rates.company.baseRateEntityRate).toBeGreaterThan(0);
      expect(rates.gst.rate).toBe(0.1);
      expect(rates.fbt.rate).toBe(0.47);
      expect(rates.superannuation.guaranteeRate).toBeGreaterThan(0);
    }
  });

  it("starts every resident scale at a nil-rate tax-free threshold", () => {
    for (const year of SUPPORTED_YEARS) {
      const [first] = ratesFor(year).individual.residentBrackets;
      expect(first.from).toBe(0);
      expect(first.rate).toBe(0);
    }
  });
});
