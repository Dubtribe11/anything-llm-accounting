#!/bin/bash

# Check if STORAGE_DIR is set
if [ -z "$STORAGE_DIR" ]; then
    echo "================================================================"
    echo "⚠️  ⚠️  ⚠️  WARNING: STORAGE_DIR environment variable is not set! ⚠️  ⚠️  ⚠️"
    echo ""
    echo "Not setting this will result in data loss on container restart since"
    echo "the application will not have a persistent storage location."
    echo "It can also result in weird errors in various parts of the application."
    echo ""
    echo "Please run the container with the official docker command at"
    echo "https://docs.anythingllm.com/installation-docker/quickstart"
    echo ""
    echo "⚠️  ⚠️  ⚠️  WARNING: STORAGE_DIR environment variable is not set! ⚠️  ⚠️  ⚠️"
    echo "================================================================"
fi

# Keep settings changed in the UI across redeploys.
#
# Saving a setting in the UI writes to /app/server/.env, which lives in the
# container's ephemeral filesystem. On a managed platform (Railway, Fly, Render)
# that means the API key you typed into the UI is gone on the next deploy. Move
# the real file onto the persistent volume and symlink to it.
#
# Skipped when .env is already bind-mounted from the host - that host file is
# the source of truth and must not be replaced.
if [ -n "$STORAGE_DIR" ] && ! grep -q " /app/server/.env " /proc/mounts 2>/dev/null; then
  if [ ! -e "$STORAGE_DIR/.env" ]; then
    mkdir -p "$STORAGE_DIR"
    cp /app/server/.env "$STORAGE_DIR/.env" 2>/dev/null || touch "$STORAGE_DIR/.env"
  fi
  ln -sf "$STORAGE_DIR/.env" /app/server/.env
  echo "[entrypoint] Settings file linked to $STORAGE_DIR/.env so UI changes survive a redeploy."
fi

{
  cd /app/server/ &&
    # Disable Prisma CLI telemetry (https://www.prisma.io/docs/orm/tools/prisma-cli#how-to-opt-out-of-data-collection)
    export CHECKPOINT_DISABLE=1 &&
    npx prisma generate --schema=./prisma/schema.prisma &&
    npx prisma migrate deploy --schema=./prisma/schema.prisma &&
    # First-boot Australian tax setup: creates a workspace per entity type and
    # turns on memory. Idempotent - it leaves an instance that already has
    # workspaces alone. Set AU_TAX_AUTOSEED=false to skip it.
    if [ "${AU_TAX_AUTOSEED:-true}" = "true" ]; then
      node /app/server/scripts/seed-tax-profiles.js || \
        echo "[tax-seed] Seeding failed - the app will still start. Run 'yarn tax:seed' inside the container to retry."
    fi &&
    node /app/server/index.js
} &
{ node /app/collector/index.js; } &
wait -n
exit $?