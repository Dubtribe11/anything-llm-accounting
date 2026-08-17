const prisma = require("../utils/prisma");
const {
  ENTITY_TYPES,
  buildSystemPrompt,
} = require("../utils/AustralianTax/prompts");
const {
  normalizeFinancialYear,
  lodgementFinancialYearOf,
} = require("../utils/AustralianTax/data");

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"];
const RESIDENCY_STATUSES = [
  "resident",
  "foreign-resident",
  "working-holiday-maker",
];
const GST_CYCLES = ["monthly", "quarterly", "annual", "not-registered"];
const ACCOUNTING_BASES = ["cash", "accruals"];

/**
 * A tax profile is the Australian-entity context attached to a workspace.
 * Workspaces are the "profiles" the user switches between - one for the
 * individual return, one for the family trust, one for the company - and this
 * record holds the facts that shape the assistant's system prompt and provide
 * defaults to the tax calculators.
 *
 * Memory is deliberately NOT stored here: global-scoped memories already
 * persist per user across every workspace, which is what makes context carry
 * from one profile to the next.
 */
const TaxProfile = {
  ENTITY_TYPES,
  STATES,
  RESIDENCY_STATUSES,
  GST_CYCLES,
  ACCOUNTING_BASES,

  writable: [
    "entityType",
    "entityName",
    "abn",
    "acn",
    "financialYear",
    "state",
    "residencyStatus",
    "gstRegistered",
    "gstReportingCycle",
    "accountingBasis",
    "hasEmployees",
    "industry",
    "accountingSoftware",
    "notes",
    "applySystemPrompt",
    "includeRateDigest",
  ],

  validations: {
    entityType: (value = "individual") => {
      const key = String(value ?? "").trim();
      return ENTITY_TYPES[key] ? key : "individual";
    },
    entityName: (value = null) => TaxProfile.trimmedOrNull(value, 255),
    // Stored as digits only so "12 345 678 901" and "12345678901" compare equal.
    abn: (value = null) => {
      const digits = String(value ?? "").replace(/\D/g, "");
      return digits.length ? digits.slice(0, 11) : null;
    },
    acn: (value = null) => {
      const digits = String(value ?? "").replace(/\D/g, "");
      return digits.length ? digits.slice(0, 9) : null;
    },
    financialYear: (value = null) => normalizeFinancialYear(value),
    state: (value = null) => {
      const key = String(value ?? "")
        .trim()
        .toUpperCase();
      return STATES.includes(key) ? key : null;
    },
    residencyStatus: (value = null) => {
      const key = String(value ?? "").trim();
      return RESIDENCY_STATUSES.includes(key) ? key : null;
    },
    gstRegistered: (value = false) => TaxProfile.toBool(value),
    gstReportingCycle: (value = null) => {
      const key = String(value ?? "")
        .trim()
        .toLowerCase();
      return GST_CYCLES.includes(key) ? key : null;
    },
    accountingBasis: (value = null) => {
      const key = String(value ?? "")
        .trim()
        .toLowerCase();
      return ACCOUNTING_BASES.includes(key) ? key : null;
    },
    hasEmployees: (value = false) => TaxProfile.toBool(value),
    industry: (value = null) => TaxProfile.trimmedOrNull(value, 255),
    accountingSoftware: (value = null) => TaxProfile.trimmedOrNull(value, 255),
    notes: (value = null) => TaxProfile.trimmedOrNull(value, 4000),
    applySystemPrompt: (value = true) => TaxProfile.toBool(value, true),
    includeRateDigest: (value = true) => TaxProfile.toBool(value, true),
  },

  trimmedOrNull: function (value, maxLength) {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    if (!str.length) return null;
    return str.slice(0, maxLength);
  },

  toBool: function (value, fallback = false) {
    if (value === null || value === undefined || value === "") return fallback;
    if (typeof value === "boolean") return value;
    return ["true", "yes", "1"].includes(String(value).trim().toLowerCase());
  },

  /**
   * Applies the validators to a loose update payload, dropping anything that is
   * not writable.
   * @param {object} updates
   * @returns {object}
   */
  sanitize: function (updates = {}) {
    const clean = {};
    for (const key of this.writable) {
      if (!Object.prototype.hasOwnProperty.call(updates, key)) continue;
      clean[key] = this.validations[key](updates[key]);
    }
    return clean;
  },

  /**
   * @param {number} workspaceId
   * @returns {Promise<object|null>}
   */
  forWorkspace: async function (workspaceId = null) {
    if (!workspaceId) return null;
    try {
      return await prisma.tax_profiles.findUnique({
        where: { workspace_id: Number(workspaceId) },
      });
    } catch (error) {
      console.error("[TaxProfile] forWorkspace:", error.message);
      return null;
    }
  },

  /**
   * Creates or updates the profile for a workspace.
   * @param {number} workspaceId
   * @param {object} updates
   * @returns {Promise<{profile: object|null, error: string|null}>}
   */
  upsert: async function (workspaceId = null, updates = {}) {
    if (!workspaceId)
      return { profile: null, error: "No workspace id provided." };
    try {
      const data = this.sanitize(updates);
      const profile = await prisma.tax_profiles.upsert({
        where: { workspace_id: Number(workspaceId) },
        update: { ...data, lastUpdatedAt: new Date() },
        create: {
          workspace_id: Number(workspaceId),
          entityType: data.entityType ?? "individual",
          ...data,
        },
      });
      return { profile, error: null };
    } catch (error) {
      console.error("[TaxProfile] upsert:", error.message);
      return { profile: null, error: error.message };
    }
  },

  /**
   * @param {number} workspaceId
   * @returns {Promise<boolean>}
   */
  delete: async function (workspaceId = null) {
    if (!workspaceId) return false;
    try {
      await prisma.tax_profiles.delete({
        where: { workspace_id: Number(workspaceId) },
      });
      return true;
    } catch (error) {
      console.error("[TaxProfile] delete:", error.message);
      return false;
    }
  },

  markKnowledgeSeeded: async function (workspaceId = null) {
    if (!workspaceId) return;
    try {
      await prisma.tax_profiles.update({
        where: { workspace_id: Number(workspaceId) },
        data: { knowledgeSeededAt: new Date() },
      });
    } catch (error) {
      console.error("[TaxProfile] markKnowledgeSeeded:", error.message);
    }
  },

  /**
   * Every profile in the instance, so the UI can show which entities exist and
   * memories can be described as spanning them.
   * @returns {Promise<object[]>}
   */
  all: async function () {
    try {
      return await prisma.tax_profiles.findMany({
        include: {
          workspace: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { entityType: "asc" },
      });
    } catch (error) {
      console.error("[TaxProfile] all:", error.message);
      return [];
    }
  },

  /**
   * The system prompt this profile contributes, or null when the profile is
   * absent or has opted out.
   * @param {object|null} profile
   * @param {string|null} workspacePrompt - whatever the user typed in workspace settings
   * @returns {string|null}
   */
  systemPromptFor: function (profile = null, workspacePrompt = null) {
    if (!profile || !profile.applySystemPrompt) return null;
    return buildSystemPrompt(
      {
        entityType: profile.entityType,
        entityName: profile.entityName,
        abn: profile.abn ? this.formatAbn(profile.abn) : null,
        financialYear: profile.financialYear || lodgementFinancialYearOf(),
        state: profile.state,
        residencyStatus: profile.residencyStatus,
        gstRegistered: profile.gstRegistered,
        gstReportingCycle: profile.gstReportingCycle,
        accountingBasis: profile.accountingBasis,
        hasEmployees: profile.hasEmployees,
        industry: profile.industry,
        accountingSoftware: profile.accountingSoftware,
        notes: profile.notes,
      },
      {
        includeRateDigest: profile.includeRateDigest !== false,
        additionalInstructions: workspacePrompt,
      }
    );
  },

  /** "12345678901" -> "12 345 678 901" */
  formatAbn: function (abn = "") {
    const digits = String(abn).replace(/\D/g, "");
    if (digits.length !== 11) return digits || null;
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  },

  /**
   * ABN checksum (the ATO's modulus 89 algorithm). Used to warn on a typo, not
   * to block saving - a profile is still useful without a valid ABN.
   * @param {string} abn
   * @returns {boolean}
   */
  isValidAbn: function (abn = "") {
    const digits = String(abn).replace(/\D/g, "");
    if (digits.length !== 11) return false;
    const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const sum = digits
      .split("")
      .map(Number)
      .reduce(
        (total, digit, index) =>
          total + (index === 0 ? digit - 1 : digit) * weights[index],
        0
      );
    return sum % 89 === 0;
  },

  /** ACN checksum (modulus 10, complement). */
  isValidAcn: function (acn = "") {
    const digits = String(acn).replace(/\D/g, "");
    if (digits.length !== 9) return false;
    const weights = [8, 7, 6, 5, 4, 3, 2, 1];
    const sum = digits
      .slice(0, 8)
      .split("")
      .map(Number)
      .reduce((total, digit, index) => total + digit * weights[index], 0);
    const remainder = (10 - (sum % 10)) % 10;
    return remainder === Number(digits[8]);
  },
};

module.exports = { TaxProfile };
