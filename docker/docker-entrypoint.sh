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