/**
 * First-boot setup for an Australian tax accounting instance.
 *
 * Creates one workspace per entity type, attaches a tax profile to each, and
 * turns on memory so context carries between them. Running it a second time
 * changes nothing - it only creates what is missing, and never touches a
 * workspace a user has already set up.
 *
 * Usage:
 *   yarn tax:seed                    # from /server
 *   node scripts/seed-tax-profiles.js --dry-run
 *   node scripts/seed-tax-profiles.js --force   # add profiles even if workspaces exist
 *
 * The docker entrypoint runs this automatically when AU_TAX_AUTOSEED=true.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "production";
if (process.env.NODE_ENV === "development")
  require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` });
else require("dotenv").config();

const prisma = require("../utils/prisma");
const { Workspace } = require("../models/workspace");
const { TaxProfile } = require("../models/taxProfile");
const { SystemSettings } = require("../models/systemSettings");

/**
 * The starting set. Deliberately small - the structures most Australian
 * taxpayers actually deal with. Users add the rest themselves (unit trust,
 * partnership, not-for-profit and the practice view are all available on the
 * Tax Profile tab).
 */
const DEFAULT_PROFILES = [
  {
    name: "My Tax Return",
    entityType: "individual",
    description: "Personal income tax return",
  },
  {
    name: "Sole Trader",
    entityType: "sole-trader",
    description: "Business carried on in your own name",
  },
  {
    name: "Family Trust",
    entityType: "trust",
    description: "Discretionary trust distributions and resolutions",
  },
  {
    name: "Company",
    entityType: "company",
    description: "Pty Ltd company, franking and Division 7A",
  },
  {
    name: "SMSF",
    entityType: "smsf",
    description: "Self-managed superannuation fund",
  },
];

const log = (message) => console.log(`\x1b[36m[tax-seed]\x1b[0m ${message}`);

/**
 * Memory is what carries a user's context between profiles, so an instance set
 * up for tax work should have it on.
 */
async function enableMemory(dryRun) {
  const existing = await SystemSettings.get({ label: "memory_enabled" });
  if (existing?.value === "true") return false;
  if (dryRun) {
    log("would enable memory (global memories carry across profiles)");
    return true;
  }
  await SystemSettings.updateSettings({ memory_enabled: "true" });
  log("enabled memory - global memories carry across every profile");
  return true;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");

  const existingCount = await prisma.workspaces.count();
  if (existingCount > 0 && !force) {
    log(
      `${existingCount} workspace(s) already exist - leaving them alone. Re-run with --force to add any missing default profiles.`
    );
    await enableMemory(dryRun);
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const template of DEFAULT_PROFILES) {
    const slug = Workspace.slugify(template.name, { lower: true });
    const existing = await Workspace.get({ slug });

    if (existing) {
      const profile = await TaxProfile.forWorkspace(existing.id);
      if (profile) {
        skipped++;
        continue;
      }
      if (dryRun) {
        log(
          `would attach a ${template.entityType} profile to "${template.name}"`
        );
        created++;
        continue;
      }
      await TaxProfile.upsert(existing.id, { entityType: template.entityType });
      log(
        `attached a ${template.entityType} profile to the existing "${template.name}" workspace`
      );
      created++;
      continue;
    }

    if (dryRun) {
      log(`would create "${template.name}" (${template.entityType})`);
      created++;
      continue;
    }

    const { workspace, message } = await Workspace.new(template.name);
    if (!workspace) {
      console.error(`  could not create "${template.name}": ${message}`);
      continue;
    }

    const { error } = await TaxProfile.upsert(workspace.id, {
      entityType: template.entityType,
    });
    if (error) {
      console.error(
        `  created "${template.name}" but could not attach its profile: ${error}`
      );
      continue;
    }

    log(
      `created "${template.name}" (${template.entityType}) - ${template.description}`
    );
    created++;
  }

  await enableMemory(dryRun);

  log(
    dryRun
      ? `dry run complete - ${created} profile(s) would be created, ${skipped} already set up.`
      : `done - ${created} profile(s) created, ${skipped} already set up.`
  );
  if (!dryRun && created > 0)
    log(
      "Open any of them and check Workspace Settings -> Tax Profile to fill in the entity details."
    );
}

main()
  .catch((error) => {
    console.error(`\x1b[31m[tax-seed]\x1b[0m Failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
