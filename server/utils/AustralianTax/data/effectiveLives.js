/**
 * A small set of commonly used Commissioner's effective lives (TR 2022/1 and
 * successors) so the assistant can produce a depreciation schedule without a
 * lookup. This is NOT the full table - the ATO publishes hundreds of
 * industry-specific effective lives. When an asset is not listed here, either
 * look up the current taxation ruling or self-assess the effective life under
 * s 40-105 ITAA 1997.
 */
const COMMON_EFFECTIVE_LIVES = {
  "computer - desktop": 4,
  "computer - laptop": 2,
  "computer - tablet": 2,
  "computer monitor": 4,
  "computer server": 4,
  "printer / multifunction device": 5,
  "mobile phone": 3,
  "office furniture - desk": 20,
  "office furniture - chair": 10,
  "office furniture - filing cabinet": 20,
  "air conditioner - split system": 10,
  "motor vehicle - car": 8,
  "motor vehicle - light truck": 12,
  trailer: 15,
  forklift: 11,
  photocopier: 5,
  "point of sale terminal": 5,
  "security system": 5,
  "hot water system": 12,
  "carpet (rental property)": 8,
  "curtains and blinds (rental property)": 6,
  "dishwasher (rental property)": 10,
  "oven (rental property)": 12,
  "cooktop (rental property)": 12,
  "refrigerator (rental property)": 12,
  "washing machine (rental property)": 8,
  "clothes dryer (rental property)": 10,
  "television (rental property)": 10,
  "solar power generating system": 20,
};

/**
 * Capital works (Division 43) write-off rates. Capital works are NOT
 * depreciating assets - they are deducted at a flat rate on construction cost.
 */
const CAPITAL_WORKS_RATES = [
  {
    assetType: "Residential rental property",
    constructedOnOrAfter: "1987-09-16",
    rate: 0.025,
    years: 40,
  },
  {
    assetType: "Non-residential (income producing) building",
    constructedOnOrAfter: "1992-06-30",
    rate: 0.025,
    years: 40,
  },
  {
    assetType: "Industrial (manufacturing) building",
    constructedOnOrAfter: "1992-02-26",
    rate: 0.04,
    years: 25,
  },
  {
    assetType: "Structural improvements",
    constructedOnOrAfter: "1992-02-26",
    rate: 0.025,
    years: 40,
  },
];

module.exports = { COMMON_EFFECTIVE_LIVES, CAPITAL_WORKS_RATES };
