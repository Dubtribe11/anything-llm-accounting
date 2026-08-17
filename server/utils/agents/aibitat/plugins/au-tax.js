const { safeJsonParse } = require("../../../http");
const AustralianTax = require("../../../AustralianTax");

/**
 * Australian tax skill.
 *
 * Exposes the deterministic calculators in utils/AustralianTax to the agent so
 * income tax, Medicare, CGT, GST, FBT, Division 7A, super caps, depreciation
 * and payroll tax are *computed* against bundled rate tables rather than
 * recalled from the model's training data.
 *
 * Two tools rather than one per calculator: the registry has ~19 entries and
 * shipping 19 tool definitions crowds out the rest of the agent's toolset. The
 * agent lists the calculators it can reach, then calls one by name.
 */
const auTax = {
  name: "australian-tax",
  startupConfig: {
    params: {},
  },
  plugin: function () {
    return {
      name: this.name,
      setup(aibitat) {
        aibitat.function({
          super: aibitat,
          name: this.name,
          description:
            "Run an Australian tax calculation against bundled ATO rate tables. Covers individual and company income tax, trust distributions, partnerships, CGT and the small business concessions, GST and BAS, FBT, Division 7A, superannuation guarantee and contribution caps, SMSF tax, depreciation, payroll tax, lodgment dates and raw rate lookups. Always use this instead of calculating Australian tax figures yourself - it is authoritative for rates and arithmetic where your memory is not.",
          examples: [
            {
              prompt: "How much tax will I pay on $120,000 this year?",
              call: JSON.stringify({
                calculator: "individual_income_tax",
                args: '{"taxableIncome": 120000, "financialYear": "2025-26"}',
              }),
            },
            {
              prompt:
                "What's the minimum yearly repayment on a $250,000 Division 7A loan made three years ago?",
              call: JSON.stringify({
                calculator: "division_7a_minimum_repayment",
                args: '{"openingLoanBalance": 250000, "loanTermYears": 7, "yearsElapsed": 3}',
              }),
            },
            {
              prompt:
                "Split $180,000 of trust income between my wife and me and the bucket company.",
              call: JSON.stringify({
                calculator: "trust_distribution",
                args: '{"components": {"ordinaryIncome": 180000}, "beneficiaries": [{"name":"Spouse","sharePercent":30},{"name":"Me","sharePercent":30},{"name":"Bucket Co","entityType":"company","sharePercent":40}]}',
              }),
            },
            {
              prompt: "What's the GST on a $4,400 invoice?",
              call: JSON.stringify({
                calculator: "gst",
                args: '{"amount": 4400, "mode": "extract"}',
              }),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              calculator: {
                type: "string",
                enum: Object.keys(AustralianTax.CALCULATORS),
                description:
                  "Which calculator to run. Call `australian-tax-calculators` first if you are unsure which one fits or what arguments it takes.",
              },
              args: {
                type: "string",
                description:
                  "A JSON object of arguments for the calculator, as a string. Omit `financialYear` to use the income year currently being lodged.",
              },
            },
            additionalProperties: false,
          },
          required: ["calculator"],
          handler: async function ({ calculator, args = "{}" }) {
            try {
              const entry = AustralianTax.CALCULATORS[calculator];
              if (!entry) {
                this.super.introspect(
                  `${this.caller}: "${calculator}" is not an Australian tax calculator.`
                );
                return JSON.stringify({
                  error: `Unknown calculator "${calculator}".`,
                  availableCalculators: Object.keys(AustralianTax.CALCULATORS),
                });
              }

              // Models pass the argument object as a string, an already-parsed
              // object, or occasionally a JSON string wrapped in one more layer.
              let parsed = typeof args === "object" && args !== null ? args : safeJsonParse(args, null);
              if (typeof parsed === "string") parsed = safeJsonParse(parsed, null);
              if (parsed === null) {
                this.super.introspect(
                  `${this.caller}: could not parse the arguments for ${calculator}.`
                );
                return JSON.stringify({
                  error: "The `args` value was not valid JSON.",
                  expectedSchema: entry.parameters,
                });
              }

              this.super.introspect(
                `${this.caller}: running the Australian ${calculator.replace(/_/g, " ")} calculator.`
              );

              const result = AustralianTax.runCalculator(calculator, parsed);
              return JSON.stringify(result);
            } catch (error) {
              this.super.handlerProps.log(
                `australian-tax raised an error. ${error.message}`
              );
              return JSON.stringify({
                error: error.message,
                hint: "Check the argument names and types against the calculator's schema.",
              });
            }
          },
        });

        aibitat.function({
          super: aibitat,
          name: "australian-tax-calculators",
          description:
            "List the Australian tax calculators available through the `australian-tax` tool, with the arguments each one accepts and the income years that have rate data. Use this when you are not sure which calculator to run or how to shape its arguments.",
          examples: [
            {
              prompt: "What Australian tax calculations can you do?",
              call: JSON.stringify({}),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          handler: async function () {
            this.super.introspect(
              `${this.caller}: listing the available Australian tax calculators.`
            );
            return JSON.stringify({
              supportedFinancialYears: AustralianTax.SUPPORTED_YEARS,
              currentFinancialYear: AustralianTax.financialYearOf(),
              incomeYearMostReturnsAreBeingPreparedFor:
                AustralianTax.lodgementFinancialYearOf(),
              calculators: AustralianTax.listCalculators(),
            });
          },
        });
      },
    };
  },
};

module.exports = { auTax };
