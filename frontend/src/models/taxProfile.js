import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

/**
 * Australian tax profile attached to a workspace, plus direct access to the
 * server-side tax calculators and rate tables.
 */
const TaxProfile = {
  /** Reference data for rendering the profile form (entity types, states, years, calculators). */
  meta: async function () {
    return await fetch(`${API_BASE}/tax/meta`, { headers: baseHeaders() })
      .then((res) => res.json())
      .catch(() => null);
  },

  /** Every profile in the instance - the whole client group. */
  all: async function () {
    return await fetch(`${API_BASE}/tax/profiles`, { headers: baseHeaders() })
      .then((res) => res.json())
      .then((res) => res.profiles ?? [])
      .catch(() => []);
  },

  forWorkspace: async function (slug) {
    return await fetch(`${API_BASE}/workspace/${slug}/tax-profile`, {
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch(() => ({ profile: null, composedSystemPrompt: null }));
  },

  save: async function (slug, updates = {}) {
    return await fetch(`${API_BASE}/workspace/${slug}/tax-profile`, {
      method: "POST",
      body: JSON.stringify(updates),
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => ({ profile: null, error: e.message }));
  },

  delete: async function (slug) {
    return await fetch(`${API_BASE}/workspace/${slug}/tax-profile`, {
      method: "DELETE",
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .then((res) => res.success)
      .catch(() => false);
  },

  /** Embeds the bundled Australian tax reference library into the workspace. */
  seedKnowledge: async function (slug, entityType = null) {
    return await fetch(`${API_BASE}/workspace/${slug}/tax-profile/seed-knowledge`, {
      method: "POST",
      body: JSON.stringify({ entityType }),
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => ({ success: false, error: e.message }));
  },

  /** Runs a calculator server-side against the bundled rate tables. */
  calculate: async function (calculator, args = {}) {
    return await fetch(`${API_BASE}/tax/calculate`, {
      method: "POST",
      body: JSON.stringify({ calculator, args }),
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch((e) => ({ error: e.message }));
  },

  rates: async function (financialYear = "") {
    return await fetch(`${API_BASE}/tax/rates/${financialYear}`, {
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .catch(() => null);
  },
};

export default TaxProfile;
