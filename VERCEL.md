# Deploying to Vercel

This fork can run on Vercel, with real constraints. Read the limitations before
you commit to it — for some uses a small always-on host (Railway, Fly.io,
Render, a VM, or Docker) is a better fit, and the Docker path in this repo is
unchanged and fully featured.

## What works and what does not

| Capability | On Vercel | Why |
| --- | --- | --- |
| Chat with an LLM (OpenRouter and other API providers) | ✅ | Plain HTTP request/response |
| Australian tax profiles, prompts and rate digest | ✅ | Server-side, no disk needed |
| Tax calculators (chat, agent skill and `/api/tax/calculate`) | ✅ | Pure computation |
| Multi-user, auth, workspaces, threads, chat history | ✅ | All in Postgres |
| RAG over already-embedded documents | ✅ | Vectors live in an external vector database |
| Document upload and embedding | ⚠️ | Needs the collector service running elsewhere — see below |
| `@agent` (agent chat) | ❌ | Needs a websocket; serverless functions cannot hold one open |
| Scheduled jobs / background workers | ❌ | No long-lived process |
| Telegram bot, web push | ❌ | Both need a persistent process |
| The bundled native embedder | ❌ | `onnxruntime-node` plus a writable model cache |
| LanceDB (default vector store) | ❌ | Writes to local disk |
| SQLite | ❌ | No persistent filesystem |

If you need `@agent` or background jobs, deploy the Docker image instead.

## What you need before you start

1. **A Postgres database.** Vercel Postgres, Neon and Supabase all work. Use the
   **pooled** connection string — a serverless function opens a connection per
   invocation and will exhaust a direct connection limit.
2. **An OpenRouter API key** (or another API-based LLM provider). Get one at
   [openrouter.ai](https://openrouter.ai/keys).
3. **A vector database.** `pgvector` on the same Postgres instance is the
   simplest; Pinecone, Qdrant and Chroma Cloud also work.
4. **An API-based embedder.** OpenRouter reuses the key from step 2.

## Deploying

### 1. Fork and import

Import the repository into Vercel. `vercel.json` in the repo root already sets
the install command, build command, output directory and function config, so
leave the framework preset as "Other".

### 2. Set the environment variables

Copy the checklist in [`.env.vercel.example`](./.env.vercel.example) into
**Settings → Environment Variables**. The essentials:

```
SERVERLESS_DEPLOYMENT=true
STORAGE_DIR=/tmp/anythingllm-storage
JWT_SECRET=<openssl rand -hex 32>
SIG_KEY=<openssl rand -hex 32>
SIG_SALT=<openssl rand -hex 32>
DATABASE_URL=postgresql://...?sslmode=require&pgbouncer=true&connection_limit=1

LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL_PREF=anthropic/claude-sonnet-4.5

EMBEDDING_ENGINE=openrouter
EMBEDDING_MODEL_PREF=baai/bge-m3

VECTOR_DB=pgvector
PGVECTOR_CONNECTION_STRING=postgresql://...?sslmode=require
PGVECTOR_TABLE_NAME=anythingllm_vectors
```

`DATABASE_URL` must be available at **build time** as well as runtime — the
build pushes the schema to the database.

### 3. Deploy

The build runs:

```
yarn db:use-postgres      # rewrites the Prisma datasource from SQLite to Postgres
npx prisma generate
npx prisma db push        # creates the schema
cd frontend && yarn build # static assets to frontend/dist
node scripts/vercel-restore-index.mjs
```

That last step exists because the normal frontend build renames `index.html` to
`_index.html` so the Express server can inject meta tags at request time. On
Vercel the SPA is served straight from the CDN and only `/api/*` reaches the
function, so it needs a real `index.html`. The trade-off is that custom branding
meta tags are not injected per-request on Vercel; the page itself is complete.

Then open the deployment and create the first admin account.

> **Why `db push` and not `prisma migrate deploy`?** The migrations in
> `server/prisma/migrations` are SQLite-flavoured (`AUTOINCREMENT`, `DATETIME`)
> and will not run on Postgres. `db push` builds the schema from the model
> definitions instead. It is additive by default and will refuse a destructive
> change without `--accept-data-loss`.

### 4. (Optional) Deploy the collector for document upload

Document upload, URL scraping and the "embed the Australian tax reference
library" button all go through the collector service, which needs a filesystem
and a long-lived process. Deploy `collector/` to any always-on host and set:

```
COLLECTOR_ENDPOINT=https://your-collector.example.com
```

**One caveat you must plan for.** The server signs every collector request with
an RSA key it generates at boot into `STORAGE_DIR`, and the collector verifies
the signature. On Vercel `STORAGE_DIR` is `/tmp`, which is wiped between cold
starts, so the key the collector was given will not match the key the next cold
start signs with. To make a remote collector work you need to pin that key pair
— generate one once and mount the same `comkey/ipc-priv.pem` and
`comkey/ipc-pub.pem` into both services rather than letting the server roll it.
Until you do that, treat document upload as unavailable on Vercel.

**None of this affects the Australian tax knowledge.** The rate tables,
calculators, entity guidance and rate digest live in the system prompt and the
agent skill — no embedding, no collector, no vector database required. The
reference library is only there to give RAG the long-form detail.

## Local development is unchanged

Nothing above affects local development. `SERVERLESS_DEPLOYMENT` is unset, so
the server binds a port and boots normally:

```
yarn setup
yarn dev
```

To go back to SQLite after running the Postgres swap locally:

```
yarn db:use-sqlite
```

## Things that will bite you

**Cold starts.** The first request after idle pays for module loading and the
one-time setup in `server/utils/boot/serverless.js`. Expect a few seconds.

**Function timeout.** `vercel.json` sets `maxDuration` to 60 seconds, which
needs a Pro plan (Hobby caps at 60s for the Node runtime but historically lower
— check your plan). A slow model with a long prompt can exceed it. Streaming
responses start emitting before the limit, which helps, but a long agent-style
turn can still be cut off.

**Bundle size.** Serverless functions have a 250 MB unzipped limit. `.vercelignore`
excludes the native dependencies that cannot run there anyway (`onnxruntime-node`,
`@lancedb`, `puppeteer`, `sharp`). If a deploy fails on size, add more of
`server/node_modules` to `.vercelignore` — anything only reachable from a
provider you are not using is safe to drop.

**Connection limits.** Always use a pooled Postgres connection string with
`connection_limit=1`. Without it a burst of requests will exhaust the database's
connection cap.

**Nothing on disk survives.** Uploaded files, cached vectors and generated keys
in `/tmp` are gone on the next cold start. Everything that matters must be in
Postgres or the vector database.

## Security note

This app is designed to hold tax records. Before putting real client data in it:

- turn on **multi-user mode** so the instance is not a single shared login,
- set a strong `JWT_SECRET`, `SIG_KEY` and `SIG_SALT` (never the examples),
- keep `DISABLE_TELEMETRY=true`,
- confirm where your LLM provider processes and retains data — with OpenRouter
  that depends on the upstream model provider you route to, and some free-tier
  endpoints train on inputs. Check the model's privacy setting on OpenRouter
  before sending client information through it.
