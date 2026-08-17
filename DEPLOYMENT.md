# Deployment

This is the full-featured deployment guide. Everything works on this path:
agents, websockets, background jobs, document upload, the local vector store,
multi-user, and the Australian tax profiles and calculators.

All four options below run the same Docker image. Pick by where you want it to
live.

| | Best for | Cost | Effort |
| --- | --- | --- | --- |
| **[Docker Compose](#option-1-docker-compose-recommended)** | Your own machine, or any VPS | Free / cost of the VPS | Lowest |
| **[Railway](#option-2-railway)** | Managed, deploy from GitHub | ~$5–20/mo | Low |
| **[Fly.io](#option-3-flyio)** | Managed, Sydney region | ~$5–15/mo | Low |
| **[Render](#option-4-render)** | Managed, blueprint-driven | ~$25/mo | Low |

> Serverless (Vercel) is a **separate, reduced** path — agent chat, background
> jobs and document upload do not work there. See [VERCEL.md](./VERCEL.md) if you
> specifically want it. Everything on this page is the full build.

---

## Before you start

You need one thing: an **OpenRouter API key** from
[openrouter.ai/keys](https://openrouter.ai/keys). One key gets you Claude, GPT,
Gemini, Llama and the rest.

Generate three secrets — the app uses them to sign sessions and encrypt stored
credentials:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # SIG_KEY
openssl rand -hex 32   # SIG_SALT
```

Keep them. Changing `SIG_KEY` or `SIG_SALT` later makes already-encrypted values
unreadable.

---

## Option 1: Docker Compose (recommended)

```bash
git clone https://github.com/Dubtribe11/anything-llm-accounting.git
cd anything-llm-accounting

cp .env.example .env
# edit .env: paste the three secrets and your OPENROUTER_API_KEY

docker compose up -d --build
```

First build takes 10–20 minutes. Then open **http://localhost:3001**.

Useful commands:

```bash
docker compose logs -f          # watch it boot
docker compose restart          # after changing .env
docker compose down             # stop (your data stays in the volumes)
docker compose pull && docker compose up -d --build   # update
```

### Putting it on a VPS

Any 2GB+ box works (Hetzner CX22, DigitalOcean, Lightsail, an old machine).
Install Docker, clone, and run the same three commands. Then put a reverse proxy
in front for TLS — Caddy is two lines:

```
tax.example.com {
    reverse_proxy localhost:3001
}
```

Nginx works too, but **must** be configured to pass websocket upgrades or agent
chat will silently fail to connect:

```nginx
location / {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 300s;
}
```

### Your data

Three named Docker volumes hold everything that must survive a restart:

- `anythingllm_storage` — the SQLite database, uploaded documents, the LanceDB
  vector store, and the encryption keys
- `anythingllm_hotdir`, `anythingllm_outputs` — document collector working dirs

Back up the first one:

```bash
docker run --rm -v anythingllm-autax_anythingllm_storage:/data \
  -v "$PWD":/backup alpine tar czf /backup/anythingllm-backup.tar.gz -C /data .
```

---

## Option 2: Railway

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
   → pick this repository. `railway.json` tells it to build `docker/Dockerfile`.
2. **Variables** → add:
   ```
   STORAGE_DIR=/app/server/storage
   JWT_SECRET=<your value>
   SIG_KEY=<your value>
   SIG_SALT=<your value>
   LLM_PROVIDER=openrouter
   OPENROUTER_API_KEY=<your key>
   OPENROUTER_MODEL_PREF=anthropic/claude-sonnet-4.5
   EMBEDDING_ENGINE=native
   VECTOR_DB=lancedb
   AU_TAX_AUTOSEED=true
   DISABLE_TELEMETRY=true
   ```
3. **Settings → Volumes** → add a volume mounted at `/app/server/storage`.
   **Do this before the first successful boot** — without it every restart wipes
   the database.
4. **Settings → Networking** → Generate Domain.

---

## Option 3: Fly.io

`fly.toml` is already configured, including the Sydney region and the volume
mount.

```bash
fly launch --no-deploy --copy-config --name your-app-name
fly volumes create anythingllm_storage --size 10 --region syd

fly secrets set \
  JWT_SECRET=$(openssl rand -hex 32) \
  SIG_KEY=$(openssl rand -hex 32) \
  SIG_SALT=$(openssl rand -hex 32) \
  OPENROUTER_API_KEY=sk-or-v1-your-key

fly deploy
fly open
```

`auto_stop_machines` is deliberately **off** in `fly.toml`. Letting Fly stop the
machine kills the background workers and drops in-flight agent sessions.

---

## Option 4: Render

1. [render.com](https://render.com) → **New → Blueprint** → point at this
   repository. `render.yaml` defines the service, the 10GB disk and the env vars,
   and generates the three secrets for you.
2. After it creates the service, open **Environment** and set
   `OPENROUTER_API_KEY`.

Use the **Standard** plan or above — the local embedder needs the RAM.

---

## First run

However you deployed, the first boot:

1. runs the database migrations,
2. creates five workspaces, each with a tax profile attached — **My Tax Return**
   (individual), **Sole Trader**, **Family Trust**, **Company**, **SMSF**,
3. turns on memory, so global memories carry across all of them.

That is `AU_TAX_AUTOSEED=true`. It is idempotent — it leaves an instance that
already has workspaces alone. Set it to `false` to start empty, or run it
manually later:

```bash
docker compose exec anythingllm sh -c "cd /app/server && node scripts/seed-tax-profiles.js"
```

Then, in the browser:

1. Create your admin account.
2. Open a workspace → **Workspace Settings → Tax Profile** and fill in the
   entity details (name, ABN, state, GST). The ABN is checksum-validated.
3. Ask it something. It calls the calculators rather than guessing.
4. Optional: **Embed the Australian tax reference library** on that same tab
   pushes the long-form reference documents into the workspace so RAG can quote
   the detail. The prompt-level tax knowledge does not need this.

### Turn on multi-user mode

If more than one person will use it, or it holds client data:
**Settings → Security → Multi-User Mode**. Until you do, anyone who reaches the
URL is an admin.

---

## Configuration you might change

Everything is in `.env` (or the platform's environment variables).

**A different model** — any OpenRouter model id:
```
OPENROUTER_MODEL_PREF="openai/gpt-5"
```

**A different embedder.** The default `native` runs in the container with no API
key and no per-token cost, which is the right default for tax records — nothing
leaves the machine to be embedded. To offload it:
```
EMBEDDING_ENGINE="openrouter"
EMBEDDING_MODEL_PREF="baai/bge-m3"
```

**A different LLM provider.** All the upstream providers still work — OpenAI,
Anthropic, Azure, Bedrock, Ollama, LM Studio and the rest. Set `LLM_PROVIDER` and
that provider's keys, or use **Settings → LLM Preference** in the UI.

**Local models.** Point at Ollama on the host:
```
LLM_PROVIDER="ollama"
OLLAMA_BASE_PATH="http://host.docker.internal:11434"
```

---

## Troubleshooting

**Permission errors on the volume (Linux).** Set `UID` and `GID` in `.env` to
your own (`id -u; id -g`) and `docker compose up -d` again.

**Agent chat connects then hangs.** Your reverse proxy is not passing websocket
upgrades — see the nginx block above.

**Out of memory during build or embedding.** The native embedder and document
processing want ~2GB. Either give the host more, or switch
`EMBEDDING_ENGINE` to an API-based one.

**Everything resets on restart.** No volume is mounted at the `STORAGE_DIR`
path. This is the most common managed-platform mistake — check step 3 of the
Railway instructions.

**Documents fail to upload.** That is the collector process. `docker compose
logs -f` will show it; the tax calculators and profiles do not depend on it.

---

## Security for real tax data

- Turn on **multi-user mode** — otherwise the URL is the only thing between
  anyone and your records.
- Put TLS in front of it. Do not run it on a public IP over plain HTTP.
- Use secrets you generated, never the placeholders in `.env.example`.
- Keep `DISABLE_TELEMETRY=true`.
- Check where your model provider processes and retains data. With OpenRouter
  that depends on the upstream provider you route to, and some free-tier
  endpoints train on inputs — check the model's privacy setting before sending
  client information through it.
- Back up the storage volume. It holds the only copy of your data.
