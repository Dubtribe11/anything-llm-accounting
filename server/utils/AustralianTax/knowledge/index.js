/**
 * Loader for the bundled Australian tax reference library.
 *
 * These documents ship with the app so a fresh install has real Australian tax
 * knowledge before the user has uploaded anything. They are used two ways:
 *  1. seeded into a workspace as documents, so RAG can retrieve the detail, and
 *  2. summarised into the system prompt, so the model has the essentials even
 *     when no embedder is configured.
 */
const fs = require("fs");
const path = require("path");

const KNOWLEDGE_DIR = __dirname;

const DOCUMENTS = [
  {
    file: "00-core-principles.md",
    title: "Australian Tax: Core Principles and Framework",
    entityTypes: ["all"],
    description:
      "Legislative framework, the income tax formula, s 8-1, residency, entity comparison, integrity rules, substantiation and penalties.",
  },
  {
    file: "01-individuals-and-sole-traders.md",
    title: "Australian Tax: Individuals and Sole Traders",
    entityTypes: ["individual", "sole-trader"],
    description:
      "Resident, foreign resident and working holiday maker rate scales, Medicare levy and surcharge, study loans, deductions, offsets, and sole trader specifics including Division 35 and PSI.",
  },
  {
    file: "02-companies.md",
    title: "Australian Tax: Companies",
    entityTypes: ["company"],
    description:
      "Base rate entity test, imputation and franking, Division 7A, loss recoupment, small business concessions and director obligations.",
  },
  {
    file: "03-trusts.md",
    title: "Australian Tax: Trusts",
    entityTypes: ["trust", "unit-trust", "testamentary-trust"],
    description:
      "Division 6, present entitlement and the 30 June resolution, streaming, Division 6AA minors, s 100A and PCG 2022/2, UPEs and Division 7A, trust losses and family trust elections.",
  },
  {
    file: "04-partnerships-and-smsf.md",
    title: "Australian Tax: Partnerships and SMSFs",
    entityTypes: ["partnership", "smsf"],
    description:
      "Division 5 partnership taxation, and SMSF tax rates, ECPI, contribution caps, compliance obligations and conditions of release.",
  },
  {
    file: "05-gst-and-bas.md",
    title: "Australian Tax: GST and Activity Statements",
    entityTypes: ["all"],
    description:
      "Registration thresholds, taxable/GST-free/input taxed supplies, input tax credits, accounting basis, BAS labels and due dates, property and GST, adjustments.",
  },
  {
    file: "06-employment-payroll-and-fbt.md",
    title: "Australian Tax: Employment, Payroll and FBT",
    entityTypes: ["all"],
    description:
      "PAYG withholding and STP, superannuation guarantee and the SGC, state payroll tax, the full FBT regime, termination payments and the contractor/employee test.",
  },
  {
    file: "07-cgt-and-property.md",
    title: "Australian Tax: CGT and Property",
    entityTypes: ["all"],
    description:
      "Cost base, the CGT discount, main residence exemption, the four small business CGT concessions, common CGT events, foreign resident withholding and property specifics.",
  },
];

/**
 * @param {string} fileName
 * @returns {string} the raw markdown
 */
function readDocument(fileName) {
  const safe = path.basename(fileName);
  const fullPath = path.join(KNOWLEDGE_DIR, safe);
  if (!fullPath.startsWith(KNOWLEDGE_DIR) || !fs.existsSync(fullPath))
    throw new Error(`Unknown knowledge document: ${fileName}`);
  return fs.readFileSync(fullPath, "utf8");
}

/**
 * @param {string} [entityType] - filter to documents relevant to an entity type
 * @returns {Array<{file:string,title:string,description:string,content:string}>}
 */
function loadKnowledgeDocuments(entityType = null) {
  return DOCUMENTS.filter(
    (doc) =>
      !entityType ||
      doc.entityTypes.includes("all") ||
      doc.entityTypes.includes(entityType)
  ).map((doc) => ({ ...doc, content: readDocument(doc.file) }));
}

/** Metadata only - no file reads. */
function listKnowledgeDocuments() {
  return DOCUMENTS.map(({ file, title, description, entityTypes }) => ({
    file,
    title,
    description,
    entityTypes,
  }));
}

module.exports = {
  KNOWLEDGE_DIR,
  DOCUMENTS,
  readDocument,
  loadKnowledgeDocuments,
  listKnowledgeDocuments,
};
