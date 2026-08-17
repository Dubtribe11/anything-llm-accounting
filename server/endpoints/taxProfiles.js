const { TaxProfile } = require("../models/taxProfile");
const { Document } = require("../models/documents");
const { EventLogs } = require("../models/eventLogs");
const { reqBody, userFromSession } = require("../utils/http");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { validWorkspaceSlug } = require("../utils/middleware/validWorkspace");
const { CollectorApi } = require("../utils/collectorApi");
const AustralianTax = require("../utils/AustralianTax");
const {
  loadKnowledgeDocuments,
  listKnowledgeDocuments,
} = require("../utils/AustralianTax/knowledge");
const { ENTITY_TYPES } = require("../utils/AustralianTax/prompts");

function taxProfileEndpoints(app) {
  if (!app) return;

  /**
   * Everything the UI needs to render the profile form and the calculator list.
   * Public to any signed-in user - it is reference data, not instance data.
   */
  app.get(
    "/tax/meta",
    [validatedRequest, flexUserRoleValid([ROLES.all])],
    async (_request, response) => {
      try {
        response.status(200).json({
          entityTypes: Object.entries(ENTITY_TYPES).map(([value, meta]) => ({
            value,
            label: meta.label,
            description: meta.description,
          })),
          states: TaxProfile.STATES,
          residencyStatuses: TaxProfile.RESIDENCY_STATUSES,
          gstReportingCycles: TaxProfile.GST_CYCLES,
          accountingBases: TaxProfile.ACCOUNTING_BASES,
          supportedFinancialYears: AustralianTax.SUPPORTED_YEARS,
          currentFinancialYear: AustralianTax.financialYearOf(),
          lodgementFinancialYear: AustralianTax.lodgementFinancialYearOf(),
          calculators: AustralianTax.listCalculators(),
          knowledgeDocuments: listKnowledgeDocuments(),
        });
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  /** Every profile in the instance, so the UI can show the whole client group. */
  app.get(
    "/tax/profiles",
    [validatedRequest, flexUserRoleValid([ROLES.all])],
    async (_request, response) => {
      try {
        const profiles = await TaxProfile.all();
        response.status(200).json({
          profiles: profiles.map((profile) => ({
            ...profile,
            abn: TaxProfile.formatAbn(profile.abn),
            entityTypeLabel:
              ENTITY_TYPES[profile.entityType]?.label ?? profile.entityType,
          })),
        });
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  app.get(
    "/workspace/:slug/tax-profile",
    [validatedRequest, flexUserRoleValid([ROLES.all]), validWorkspaceSlug],
    async (_request, response) => {
      try {
        const workspace = response.locals.workspace;
        const profile = await TaxProfile.forWorkspace(workspace.id);
        response.status(200).json({
          profile: profile
            ? { ...profile, abn: TaxProfile.formatAbn(profile.abn) }
            : null,
          // Show the caller what the composed prompt will look like so the
          // effect of the profile is never a black box.
          composedSystemPrompt: TaxProfile.systemPromptFor(
            profile,
            workspace.openAiPrompt
          ),
        });
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/workspace/:slug/tax-profile",
    [
      validatedRequest,
      flexUserRoleValid([ROLES.admin, ROLES.manager]),
      validWorkspaceSlug,
    ],
    async (request, response) => {
      try {
        const workspace = response.locals.workspace;
        const updates = reqBody(request);
        const { profile, error } = await TaxProfile.upsert(
          workspace.id,
          updates
        );
        if (error) return response.status(500).json({ profile: null, error });

        const warnings = [];
        if (profile.abn && !TaxProfile.isValidAbn(profile.abn))
          warnings.push("The ABN failed the ATO checksum - check for a typo.");
        if (profile.acn && !TaxProfile.isValidAcn(profile.acn))
          warnings.push("The ACN failed its checksum - check for a typo.");

        await EventLogs.logEvent(
          "tax_profile_updated",
          { workspaceName: workspace?.name, entityType: profile.entityType },
          (await userFromSession(request, response))?.id
        );

        response.status(200).json({
          profile: { ...profile, abn: TaxProfile.formatAbn(profile.abn) },
          composedSystemPrompt: TaxProfile.systemPromptFor(
            profile,
            workspace.openAiPrompt
          ),
          warnings,
          error: null,
        });
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  app.delete(
    "/workspace/:slug/tax-profile",
    [
      validatedRequest,
      flexUserRoleValid([ROLES.admin, ROLES.manager]),
      validWorkspaceSlug,
    ],
    async (_request, response) => {
      try {
        const workspace = response.locals.workspace;
        const success = await TaxProfile.delete(workspace.id);
        response.status(200).json({ success });
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  /**
   * Embeds the bundled Australian tax reference library into the workspace so
   * RAG can retrieve the detail behind the system prompt's summary.
   */
  app.post(
    "/workspace/:slug/tax-profile/seed-knowledge",
    [
      validatedRequest,
      flexUserRoleValid([ROLES.admin, ROLES.manager]),
      validWorkspaceSlug,
    ],
    async (request, response) => {
      try {
        const workspace = response.locals.workspace;
        const { entityType = null } = reqBody(request);
        const profile = await TaxProfile.forWorkspace(workspace.id);
        const targetEntityType =
          entityType ??
          ENTITY_TYPES[profile?.entityType]?.knowledgeEntityType ??
          null;

        const collector = new CollectorApi();
        if (!(await collector.online()))
          return response.status(503).json({
            success: false,
            error:
              "The document collector is not reachable, so the reference library cannot be embedded. Start the collector service and try again.",
          });

        const documents = loadKnowledgeDocuments(targetEntityType);
        const locations = [];
        const failures = [];

        for (const doc of documents) {
          const {
            success,
            reason,
            documents: created,
          } = await collector.processRawText(doc.content, {
            title: doc.title,
            docAuthor: "AnythingLLM Australian Tax Library",
            description: doc.description,
            docSource: "Bundled Australian tax reference library",
          });
          if (!success || !created?.[0]?.location) {
            failures.push({
              title: doc.title,
              reason: reason ?? "Unknown error",
            });
            continue;
          }
          locations.push(created[0].location);
        }

        const { failedToEmbed = [], errors = [] } = locations.length
          ? await Document.addDocuments(
              workspace,
              locations,
              (await userFromSession(request, response))?.id
            )
          : {};

        if (profile) await TaxProfile.markKnowledgeSeeded(workspace.id);
        await EventLogs.logEvent("tax_knowledge_seeded", {
          workspaceName: workspace?.name,
          documentCount: locations.length,
        });

        response.status(200).json({
          success: failures.length === 0 && failedToEmbed.length === 0,
          embedded: locations.length - failedToEmbed.length,
          documents: documents.map((d) => d.title),
          failures,
          failedToEmbed,
          errors,
        });
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  /**
   * Runs a tax calculator directly. The agent skill calls the same registry, so
   * a result obtained here is identical to one obtained in chat.
   */
  app.post(
    "/tax/calculate",
    [validatedRequest, flexUserRoleValid([ROLES.all])],
    async (request, response) => {
      try {
        const { calculator, args = {} } = reqBody(request);
        if (!calculator)
          return response.status(400).json({
            error: "A `calculator` name is required.",
            availableCalculators: Object.keys(AustralianTax.CALCULATORS),
          });

        const result = AustralianTax.runCalculator(calculator, args);
        response.status(result?.error ? 400 : 200).json(result);
      } catch (e) {
        console.error(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  /** Raw rate tables, for a UI that wants to show the figures being used. */
  app.get(
    "/tax/rates/:financialYear?",
    [validatedRequest, flexUserRoleValid([ROLES.all])],
    async (request, response) => {
      try {
        const rates = AustralianTax.ratesFor(
          request.params.financialYear ?? null
        );
        response.status(200).json({
          rates,
          supportedFinancialYears: AustralianTax.SUPPORTED_YEARS,
        });
      } catch (e) {
        response.status(400).json({
          error: e.message,
          supportedFinancialYears: AustralianTax.SUPPORTED_YEARS,
        });
      }
    }
  );
}

module.exports = { taxProfileEndpoints };
