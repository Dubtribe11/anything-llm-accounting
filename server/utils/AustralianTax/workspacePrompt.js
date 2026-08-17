/**
 * Resolves the base system prompt for a workspace.
 *
 * Kept in its own module (rather than in utils/chats) so the agent providers can
 * use it without pulling in the whole chat command surface. Both the chat
 * handlers and the agent runtime call this, so a workspace's tax profile shapes
 * both paths identically.
 */

/**
 * @param {import("@prisma/client").workspaces | null} workspace
 * @returns {Promise<string>}
 */
async function basePromptForWorkspace(workspace) {
  const { SystemSettings } = require("../../models/systemSettings");
  const workspacePrompt = workspace?.openAiPrompt ?? null;

  try {
    if (workspace?.id) {
      const { TaxProfile } = require("../../models/taxProfile");
      const profile = await TaxProfile.forWorkspace(workspace.id);
      // The workspace's own prompt text is carried through as additional
      // instructions rather than discarded.
      const taxPrompt = TaxProfile.systemPromptFor(profile, workspacePrompt);
      if (taxPrompt) return taxPrompt;
    }
  } catch (error) {
    console.error("[TaxProfile] Failed to compose system prompt:", error.message);
  }

  return workspacePrompt ?? SystemSettings.saneDefaultSystemPrompt;
}

module.exports = { basePromptForWorkspace };
