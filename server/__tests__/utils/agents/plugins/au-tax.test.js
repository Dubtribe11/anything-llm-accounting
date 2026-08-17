process.env.STORAGE_DIR = __dirname;
process.env.NODE_ENV = "test";

const { auTax } = require("../../../../utils/agents/aibitat/plugins/au-tax");

/** Registers the plugin's tools the way aibitat does and returns them by name. */
function loadTools() {
  const registered = [];
  auTax.plugin().setup({ function: (definition) => registered.push(definition) });
  return Object.fromEntries(
    registered.map((definition) => [
      definition.name,
      {
        ...definition,
        // The handler is called with the definition as `this`; supply the bits
        // of the aibitat bus it reaches for.
        call(args) {
          return definition.handler.call(
            {
              ...definition,
              super: { introspect: () => {}, handlerProps: { log: () => {} } },
              caller: "@agent",
            },
            args
          );
        },
      },
    ])
  );
}

describe("australian-tax agent skill", () => {
  const tools = loadTools();
  const run = async (args) => JSON.parse(await tools["australian-tax"].call(args));

  it("registers both tools", () => {
    expect(Object.keys(tools).sort()).toEqual([
      "australian-tax",
      "australian-tax-calculators",
    ]);
  });

  it("offers every registry calculator in the enum", () => {
    const AustralianTax = require("../../../../utils/AustralianTax");
    expect(tools["australian-tax"].parameters.properties.calculator.enum).toEqual(
      Object.keys(AustralianTax.CALCULATORS)
    );
  });

  it("runs a calculator from stringified args", async () => {
    const result = await run({
      calculator: "individual_income_tax",
      args: JSON.stringify({ taxableIncome: 120000, financialYear: "2025-26" }),
    });
    expect(result.incomeTax.amount).toBe(26788);
  });

  it("accepts args as an object", async () => {
    const result = await run({ calculator: "gst", args: { amount: 2200 } });
    expect(result.gstAmount).toBe(200);
  });

  it("accepts args wrapped in an extra layer of JSON encoding", async () => {
    const result = await run({
      calculator: "gst",
      args: JSON.stringify(JSON.stringify({ amount: 1100 })),
    });
    expect(result.gstAmount).toBe(100);
  });

  it("errors on an unknown calculator and lists the real ones", async () => {
    const result = await run({ calculator: "not_real", args: "{}" });
    expect(result.error).toMatch(/Unknown calculator/);
    expect(result.availableCalculators).toContain("individual_income_tax");
  });

  // safeJsonParse is lenient and salvages malformed JSON, so an unvalidated
  // handler would run the calculator on nothing and return a confident $0.
  it("rejects malformed JSON rather than calculating on nothing", async () => {
    const result = await run({ calculator: "gst", args: "{not json" });
    expect(result.error).toBeTruthy();
    expect(result.gstAmount).toBeUndefined();
    expect(result.expectedSchema).toBeTruthy();
  });

  it("rejects arguments that match nothing in the schema", async () => {
    // lodgment_calendar has no required arguments, so this exercises the
    // unrecognised-key check rather than the missing-required one.
    const result = await run({
      calculator: "lodgment_calendar",
      args: JSON.stringify({ taxableIncome: 100 }),
    });
    expect(result.error).toMatch(/None of the supplied arguments/);
    expect(result.obligations).toBeUndefined();
  });

  it("reports a missing required argument before an unrecognised one", async () => {
    const result = await run({
      calculator: "gst",
      args: JSON.stringify({ income: 100 }),
    });
    expect(result.error).toMatch(/Missing required argument\(s\): amount/);
  });

  it("rejects an array of arguments", async () => {
    const result = await run({ calculator: "gst", args: JSON.stringify([1, 2]) });
    expect(result.error).toMatch(/must be a JSON object/);
  });

  it("reports a missing required argument", async () => {
    const result = await run({ calculator: "gst", args: "{}" });
    expect(result.error).toMatch(/Missing required argument\(s\): amount/);
  });

  it("allows empty args for a calculator that requires none", async () => {
    const result = await run({ calculator: "lodgment_calendar", args: "{}" });
    expect(result.obligations.length).toBeGreaterThan(0);
  });

  it("lists the calculators and the years with rate data", async () => {
    const result = JSON.parse(
      await tools["australian-tax-calculators"].call({})
    );
    expect(result.calculators.length).toBeGreaterThan(10);
    expect(result.supportedFinancialYears).toContain("2025-26");
    expect(result.incomeYearMostReturnsAreBeingPreparedFor).toMatch(/^\d{4}-\d{2}$/);
  });
});
