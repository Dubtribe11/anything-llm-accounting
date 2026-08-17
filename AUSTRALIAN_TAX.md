# Australian Tax Accounting

This fork of [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) is set
up as an all-in-one assistant for Australian tax accounting: it knows the
Australian tax system out of the box, it computes figures instead of recalling
them, and it keeps a separate profile for each entity you deal with while your
context follows you between them.

Everything upstream still works — documents, RAG, agents, multi-user, the
provider list. This document covers what is different.

---

## 1. Australian tax knowledge, out of the box

Two layers, because they fail differently.

### Deterministic calculators

`server/utils/AustralianTax` holds financial-year-indexed rate tables and
calculators built on them. The model never has to remember a threshold or do
arithmetic in its head — it calls a calculator and reports what comes back.

| Calculator | Covers |
| --- | --- |
| `individual_income_tax` | Resident / foreign resident / WHM scales, LITO, Medicare levy with the low-income shade-in, the surcharge tiers, study and training loan repayments (both the banded and the post-2025 marginal systems), franking credits, PAYG credits |
| `company_tax` | The base rate entity test (turnover **and** passive income), 25% vs 30%, prior year losses |
| `franking` | Franking credits, gross-up, maximum franking credit |
| `division_7a_minimum_repayment` | The minimum yearly repayment annuity formula, benchmark rate, 7/25 year terms |
| `trust_distribution` | s 95 net income, beneficiary allocation, streaming of franked distributions and capital gains, Division 6AA minor rates, s 99A on undistributed income |
| `partnership_distribution` | Division 5 allocation and per-partner tax |
| `capital_gains_tax` | Cost base, loss ordering, the discount by entity type, and all four Division 152 concessions in the right order |
| `gst`, `business_activity_statement`, `gst_registration_check` | One-eleventh extraction, BAS labels G1/1A/1B/W1/W2, registration thresholds and reporting cycle |
| `fringe_benefits_tax`, `car_fringe_benefit` | Type 1/Type 2 gross-ups, statutory formula vs operating cost |
| `superannuation_guarantee`, `superannuation_contribution_caps`, `smsf_income_tax` | SG and the maximum contribution base, concessional and non-concessional caps with carry-forward and bring-forward, Division 293, SMSF tax with ECPI and NALI |
| `depreciation`, `capital_works` | Prime cost and diminishing value, the instant asset write-off, the car limit, Division 43 |
| `payroll_tax` | All eight jurisdictions, threshold phase-outs, regional rates, surcharges |
| `lodgment_calendar`, `tax_rates_lookup` | Due dates by entity type, and the raw rate tables |

Rate data ships for **2023-24 through 2026-27**. Figures that are indexed or
merely announced carry a confidence marker and produce a caveat in the result
rather than being presented as settled law — for example, the 2025-26 Medicare
levy low-income thresholds and the status of Division 296.

The calculators are reachable three ways, all hitting the same registry:

- the **`australian-tax` agent skill** (enabled by default),
- **`POST /api/tax/calculate`** with `{ "calculator": "...", "args": {...} }`,
- directly, via `require("./utils/AustralianTax").runCalculator(name, args)`.

```bash
curl -X POST http://localhost:3001/api/tax/calculate \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"calculator":"individual_income_tax","args":{"taxableIncome":120000,"financialYear":"2025-26","hasStudyLoan":true}}'
```

### Reference library

`server/utils/AustralianTax/knowledge` holds long-form reference documents:
core principles and the s 8-1 framework, individuals and sole traders,
companies (including Division 7A), trusts (Division 6, streaming, s 100A,
PCG 2022/2), partnerships and SMSFs, GST and BAS, employment and FBT, and CGT
and property.

These are summarised into the system prompt automatically. Embedding them for
RAG is optional — use **Embed the Australian tax reference library** on the Tax
Profile tab when you want the assistant to be able to quote the detail. That
button needs an embedder and the collector; the prompt-level knowledge does not.

---

## 2. Profiles

A **workspace is a profile**. Create one per entity — your individual return,
the family trust, the trading company, the SMSF — and switch between them from
the sidebar.

Attach a profile at **Workspace Settings → Tax Profile**. Available entity
types: individual, sole trader, company, discretionary trust, unit trust,
partnership, SMSF, not-for-profit, and a practice/multi-entity view for looking
across a whole client group.

The profile composes the workspace's system prompt from three pieces:

1. **Operating rules** — call the calculators rather than recalling figures,
   cite the provision, state the income year, name the assumptions, flag the
   integrity rules, and distinguish general information from tax agent services.
2. **Entity-specific guidance** — a trust profile leads with the deed, the
   30 June resolution, streaming and s 100A; a company profile leads with the
   base rate entity test, the franking account and Division 7A.
3. **A rate digest** for the income year in focus, generated from the same
   tables the calculators use, so the prompt cannot drift from the maths.

Anything you type in **Chat Settings → system prompt** is appended as additional
instructions rather than discarded. The Tax Profile tab shows you the full
composed prompt. Both normal chat and agent runs use it.

Profile fields also give the calculators their defaults: entity type, name,
ABN and ACN (checksum-validated), income year, state, residency status, GST
registration and cycle, accounting basis, employees, industry and free-form
notes.

### Memory across profiles

Memory is **on by default** in this build.

- **Global memories** are stored per user and are injected into *every*
  workspace — so what the assistant knows about you follows you from the
  individual profile to the trust profile to the company profile.
- **Workspace memories** stay with one profile, which is what you want for
  entity-specific facts.

Manage both from the personalization menu in a workspace, or via
`/api/workspaces/:slug/memories`.

---

## 3. OpenRouter

OpenRouter is supported as an LLM provider, an embedding provider and an image
generation provider.

```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL_PREF=anthropic/claude-sonnet-4.5

EMBEDDING_ENGINE=openrouter
EMBEDDING_MODEL_PREF=baai/bge-m3
```

Or set it from the UI: **Settings → LLM Preference → OpenRouter**, and
**Settings → Embedder → OpenRouter**. The model list is fetched live from your
key. `OPENROUTER_TIMEOUT_MS` raises the per-request timeout for slow models.

> Before routing client tax data through a model, check its privacy setting on
> OpenRouter — some free-tier endpoints train on inputs.

---

## 4. Hosting on Vercel

See **[VERCEL.md](./VERCEL.md)** for the full guide, the environment checklist
in [`.env.vercel.example`](./.env.vercel.example), and — importantly — the
limitations. In short: chat, tax profiles, calculators, multi-user and RAG over
already-embedded documents all work; `@agent`, background jobs, document upload,
SQLite, LanceDB and the native embedder do not, because a serverless function
has no persistent disk and no long-lived process.

Docker remains the fully-featured deployment. Use Vercel when you want a hosted
chat-and-calculate experience without running a server.

---

## Getting started locally

```bash
yarn setup                 # installs deps, copies .env files, sets up the database
# edit server/.env.development - set LLM_PROVIDER, OPENROUTER_API_KEY, EMBEDDING_ENGINE
yarn dev                   # server, frontend and collector together
```

Then:

1. Create a workspace named for the entity ("Smith Family Trust").
2. Open **Workspace Settings → Tax Profile**, pick the entity type, fill in what
   you know, and save.
3. Ask it something. It will call the calculators rather than guessing.

---

## Scope and accuracy

The rate tables are a bundled snapshot, not a live feed from the ATO. Indexed
thresholds and announced-but-not-enacted measures are marked as such and produce
caveats in calculator output — pass those on rather than presenting an estimate
as a lodged position.

Tax agent services in Australia are regulated under the *Tax Agent Services Act
2009*. This tool produces analysis, calculations and explanations. Preparing and
lodging returns for a fee, and giving personal tax advice, is work for a
registered tax agent.

### Keeping the rates current

Rate tables live in `server/utils/AustralianTax/data/fy20XX.js`, one file per
income year. To add a year, copy the most recent file, update the figures, and
register it in `data/index.js`. The tests in
`server/__tests__/utils/AustralianTax` assert against published ATO amounts, so
a wrong figure in a table shows up as a failing test rather than a wrong answer
in a client's return.
