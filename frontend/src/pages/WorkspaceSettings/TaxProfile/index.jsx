import { useEffect, useState } from "react";
import { CaretDown, CaretRight, Books, Warning } from "@phosphor-icons/react";
import TaxProfile from "@/models/taxProfile";
import CTAButton from "@/components/lib/CTAButton";
import showToast from "@/utils/toast";
import paths from "@/utils/paths";
import { Link } from "react-router-dom";

const BLANK_PROFILE = {
  entityType: "individual",
  entityName: "",
  abn: "",
  acn: "",
  financialYear: "",
  state: "",
  residencyStatus: "",
  gstRegistered: false,
  gstReportingCycle: "",
  accountingBasis: "",
  hasEmployees: false,
  industry: "",
  accountingSoftware: "",
  notes: "",
  applySystemPrompt: true,
  includeRateDigest: true,
};

/**
 * Attaches an Australian tax profile to a workspace.
 *
 * A workspace with a profile IS a tax profile - "my individual return", "the
 * family trust", "the trading company" - and the profile drives the assistant's
 * system prompt, the entity-specific guidance it follows, and the rate digest
 * it works from.
 */
export default function TaxProfileSettings({ slug }) {
  const [meta, setMeta] = useState(null);
  const [profile, setProfile] = useState(BLANK_PROFILE);
  const [enabled, setEnabled] = useState(false);
  const [composedPrompt, setComposedPrompt] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [knowledgeSeededAt, setKnowledgeSeededAt] = useState(null);

  useEffect(() => {
    async function load() {
      const [_meta, existing] = await Promise.all([
        TaxProfile.meta(),
        TaxProfile.forWorkspace(slug),
      ]);
      setMeta(_meta);
      if (existing?.profile) {
        setProfile({ ...BLANK_PROFILE, ...stripNulls(existing.profile) });
        setEnabled(true);
        setKnowledgeSeededAt(existing.profile.knowledgeSeededAt ?? null);
      }
      setComposedPrompt(existing?.composedSystemPrompt ?? "");
      setLoading(false);
    }
    if (slug) load();
  }, [slug]);

  const update = (key, value) =>
    setProfile((prev) => ({ ...prev, [key]: value }));

  async function handleSave(e) {
    e?.preventDefault();
    setSaving(true);
    const result = await TaxProfile.save(slug, profile);
    if (result?.error) {
      showToast(`Could not save the tax profile: ${result.error}`, "error", {
        clear: true,
      });
    } else {
      setEnabled(true);
      setWarnings(result.warnings ?? []);
      setComposedPrompt(result.composedSystemPrompt ?? "");
      showToast("Tax profile saved.", "success", { clear: true });
    }
    setSaving(false);
  }

  async function handleRemove() {
    if (
      !window.confirm(
        "Remove the tax profile from this workspace? The workspace and its documents are not affected."
      )
    )
      return;
    const success = await TaxProfile.delete(slug);
    if (success) {
      setProfile(BLANK_PROFILE);
      setEnabled(false);
      setComposedPrompt("");
      showToast("Tax profile removed.", "success", { clear: true });
    } else {
      showToast("Could not remove the tax profile.", "error", { clear: true });
    }
  }

  async function handleSeedKnowledge() {
    setSeeding(true);
    const result = await TaxProfile.seedKnowledge(slug);
    if (result?.success) {
      setKnowledgeSeededAt(new Date().toISOString());
      showToast(
        `Embedded ${result.embedded} Australian tax reference documents into this workspace.`,
        "success",
        { clear: true }
      );
    } else {
      showToast(
        result?.error ??
          `Embedded ${result?.embedded ?? 0} of ${result?.documents?.length ?? 0} documents - check the server logs.`,
        "error",
        { clear: true }
      );
    }
    setSeeding(false);
  }

  if (loading || !meta)
    return <div className="text-white/60 text-sm">Loading tax profile…</div>;

  const entityTypeMeta = meta.entityTypes.find(
    (e) => e.value === profile.entityType
  );

  return (
    <form
      onSubmit={handleSave}
      className="w-full max-w-3xl flex flex-col gap-y-8"
    >
      <div>
        <h2 className="text-base font-semibold text-white">
          Australian tax profile
        </h2>
        <p className="text-white/60 text-xs mt-2 leading-relaxed">
          Tell the assistant what kind of entity this workspace is for. The
          profile shapes the system prompt with entity-specific guidance and a
          rate digest for the income year in focus, and gives the tax
          calculators their defaults. Create one workspace per entity - your
          individual return, the family trust, the company - and switch between
          them like profiles.
        </p>
        <p className="text-white/60 text-xs mt-2 leading-relaxed">
          Memories you save are stored per user, and global memories carry
          across every profile, so context you have already given the assistant
          follows you from one entity to the next.
        </p>
      </div>

      {!enabled && (
        <div className="text-white/80 text-xs bg-theme-bg-primary border border-white/10 rounded-lg p-4">
          No tax profile is attached to this workspace yet. Fill in the entity
          details below and save to attach one.
        </div>
      )}

      {warnings.length > 0 && (
        <div className="flex flex-col gap-y-1 text-amber-300 text-xs bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          {warnings.map((warning) => (
            <div key={warning} className="flex items-center gap-x-2">
              <Warning className="h-4 w-4 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      <Field label="Entity type" hint={entityTypeMeta?.description}>
        <Select
          value={profile.entityType}
          onChange={(value) => update("entityType", value)}
          options={meta.entityTypes.map((e) => ({
            value: e.value,
            label: e.label,
          }))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-6">
        <Field
          label="Entity name"
          hint="How the assistant should refer to this entity."
        >
          <Input
            value={profile.entityName}
            onChange={(value) => update("entityName", value)}
            placeholder="Smith Family Trust"
          />
        </Field>
        <Field
          label="Income year in focus"
          hint="Defaults to the year most returns are currently being prepared for."
        >
          <Select
            value={profile.financialYear}
            onChange={(value) => update("financialYear", value)}
            options={[
              { value: "", label: `Current (${meta.lodgementFinancialYear})` },
              ...meta.supportedFinancialYears.map((y) => ({
                value: y,
                label: y,
              })),
            ]}
          />
        </Field>
        <Field
          label="ABN"
          hint="Checked against the ATO checksum when you save."
        >
          <Input
            value={profile.abn}
            onChange={(value) => update("abn", value)}
            placeholder="12 345 678 901"
          />
        </Field>
        <Field label="ACN" hint="Companies only.">
          <Input
            value={profile.acn}
            onChange={(value) => update("acn", value)}
            placeholder="123 456 789"
          />
        </Field>
        <Field
          label="State / territory"
          hint="Drives payroll tax, duty and land tax."
        >
          <Select
            value={profile.state}
            onChange={(value) => update("state", value)}
            options={[
              { value: "", label: "Not set" },
              ...meta.states.map((s) => ({ value: s, label: s })),
            ]}
          />
        </Field>
        <Field label="Residency status">
          <Select
            value={profile.residencyStatus}
            onChange={(value) => update("residencyStatus", value)}
            options={[
              { value: "", label: "Not set" },
              ...meta.residencyStatuses.map((s) => ({
                value: s,
                label: s
                  .replace(/-/g, " ")
                  .replace(/^\w/, (c) => c.toUpperCase()),
              })),
            ]}
          />
        </Field>
        <Field label="GST reporting cycle">
          <Select
            value={profile.gstReportingCycle}
            onChange={(value) => update("gstReportingCycle", value)}
            options={[
              { value: "", label: "Not set" },
              ...meta.gstReportingCycles.map((c) => ({
                value: c,
                label: c
                  .replace(/-/g, " ")
                  .replace(/^\w/, (ch) => ch.toUpperCase()),
              })),
            ]}
          />
        </Field>
        <Field label="Accounting basis">
          <Select
            value={profile.accountingBasis}
            onChange={(value) => update("accountingBasis", value)}
            options={[
              { value: "", label: "Not set" },
              ...meta.accountingBases.map((b) => ({
                value: b,
                label: b.replace(/^\w/, (c) => c.toUpperCase()),
              })),
            ]}
          />
        </Field>
        <Field label="Industry">
          <Input
            value={profile.industry}
            onChange={(value) => update("industry", value)}
            placeholder="Construction"
          />
        </Field>
        <Field label="Accounting software">
          <Input
            value={profile.accountingSoftware}
            onChange={(value) => update("accountingSoftware", value)}
            placeholder="Xero"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-y-3">
        <Toggle
          label="Registered for GST"
          checked={profile.gstRegistered}
          onChange={(value) => update("gstRegistered", value)}
        />
        <Toggle
          label="Has employees"
          hint="Turns on PAYG withholding, superannuation guarantee and payroll tax guidance."
          checked={profile.hasEmployees}
          onChange={(value) => update("hasEmployees", value)}
        />
        <Toggle
          label="Apply the tax system prompt to this workspace"
          hint="When off, the profile is stored but the workspace uses its own system prompt unchanged."
          checked={profile.applySystemPrompt}
          onChange={(value) => update("applySystemPrompt", value)}
        />
        <Toggle
          label="Include the rate digest in the system prompt"
          hint="Headline rates, thresholds and caps for the income year in focus, generated from the same tables the calculators use."
          checked={profile.includeRateDigest}
          onChange={(value) => update("includeRateDigest", value)}
        />
      </div>

      <Field
        label="Notes"
        hint="Anything else the assistant should always know about this entity - deed quirks, prior year positions, carried-forward losses."
      >
        <textarea
          value={profile.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
          rows={4}
          className="bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
          placeholder="Family trust deed excludes foreign beneficiaries (amended 2023). Carried-forward capital loss of $18,400."
        />
      </Field>

      <div className="border-t border-white/10 pt-6 flex flex-col gap-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Reference library
          </h3>
          <p className="text-white/60 text-xs mt-1 leading-relaxed">
            Embed the bundled Australian tax reference documents into this
            workspace so the assistant can retrieve the detail behind the
            prompt's summary. This needs an embedder configured and the document
            collector running.
            {knowledgeSeededAt && (
              <span className="block mt-1 text-white/40">
                Last embedded {new Date(knowledgeSeededAt).toLocaleString()}.
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          disabled={seeding}
          onClick={handleSeedKnowledge}
          className="w-fit flex items-center gap-x-2 text-xs px-4 py-2 font-semibold rounded-lg bg-theme-bg-primary border border-white/20 text-white hover:bg-theme-bg-secondary disabled:opacity-50"
        >
          <Books className="h-4 w-4" />
          {seeding
            ? "Embedding…"
            : "Embed the Australian tax reference library"}
        </button>
      </div>

      {composedPrompt && (
        <div className="border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={() => setShowPrompt((prev) => !prev)}
            className="flex items-center gap-x-2 text-sm font-semibold text-white"
          >
            {showPrompt ? (
              <CaretDown className="h-4 w-4" />
            ) : (
              <CaretRight className="h-4 w-4" />
            )}
            Preview the composed system prompt
          </button>
          {showPrompt && (
            <pre className="mt-3 whitespace-pre-wrap text-xs text-white/70 bg-theme-bg-primary border border-white/10 rounded-lg p-4 max-h-[420px] overflow-y-auto">
              {composedPrompt}
            </pre>
          )}
          <p className="text-white/40 text-xs mt-2">
            Text you enter in{" "}
            <Link
              to={paths.workspace.settings.chatSettings(slug)}
              className="underline hover:text-white/70"
            >
              Chat Settings → system prompt
            </Link>{" "}
            is appended to this as additional instructions.
          </p>
        </div>
      )}

      <div className="flex items-center gap-x-4">
        <CTAButton className="!mr-0" disabled={saving} onClick={handleSave}>
          {saving
            ? "Saving…"
            : enabled
              ? "Update tax profile"
              : "Attach tax profile"}
        </CTAButton>
        {enabled && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-white/60 hover:text-red-400"
          >
            Remove profile
          </button>
        )}
      </div>
    </form>
  );
}

/** Nulls from the API would make the inputs uncontrolled - normalise to "". */
function stripNulls(object) {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key, value ?? ""])
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-y-2">
      <label className="text-white text-sm font-semibold">{label}</label>
      {hint && <p className="text-white/50 text-xs -mt-1">{hint}</p>}
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="bg-theme-settings-input-bg text-white text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="relative inline-flex items-start cursor-pointer gap-x-3">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <div className="mt-0.5 peer-disabled:opacity-50 pointer-events-none peer h-6 w-11 shrink-0 rounded-full bg-[#CFCFD0] after:absolute after:left-[4px] after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#32D583] peer-checked:after:translate-x-full" />
      <div className="flex flex-col">
        <span className="text-sm text-white">{label}</span>
        {hint && <span className="text-xs text-white/50">{hint}</span>}
      </div>
    </label>
  );
}
