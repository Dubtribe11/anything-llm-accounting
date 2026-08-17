/**
 * Swaps the Prisma datasource in schema.prisma from SQLite to PostgreSQL.
 *
 * The repository ships a SQLite schema because that is the default for a local
 * or Docker install. Serverless platforms have no persistent filesystem, so a
 * Vercel deployment needs Postgres. Rather than maintaining a second copy of
 * the schema (which would drift), this rewrites the datasource block in place.
 *
 * Idempotent - running it twice is a no-op.
 *
 * Usage: node server/scripts/use-postgres.js [--revert]
 */
const fs = require("fs");
const path = require("path");

const SCHEMA_PATH = path.resolve(__dirname, "..", "prisma", "schema.prisma");

const SQLITE_BLOCK = `datasource db {
  provider = "sqlite"
  url      = "file:../storage/anythingllm.db"
}`;

const POSTGRES_BLOCK = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`;

function main() {
  const revert = process.argv.includes("--revert");
  const from = revert ? POSTGRES_BLOCK : SQLITE_BLOCK;
  const to = revert ? SQLITE_BLOCK : POSTGRES_BLOCK;
  const target = revert ? "SQLite" : "PostgreSQL";

  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`Could not find the Prisma schema at ${SCHEMA_PATH}`);
    process.exit(1);
  }

  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");

  if (schema.includes(to)) {
    console.log(`Prisma datasource is already ${target}. Nothing to do.`);
    return;
  }

  if (!schema.includes(from)) {
    console.error(
      `Could not find the expected datasource block to replace. The schema may have been edited by hand - update the datasource in ${SCHEMA_PATH} manually.`
    );
    process.exit(1);
  }

  fs.writeFileSync(SCHEMA_PATH, schema.replace(from, to), "utf8");
  console.log(`Prisma datasource switched to ${target}.`);

  if (!revert)
    console.log(
      "The bundled migrations are SQLite-flavoured and will not run on Postgres. Use `npx prisma db push` to create the schema instead of `prisma migrate deploy`."
    );
}

main();
