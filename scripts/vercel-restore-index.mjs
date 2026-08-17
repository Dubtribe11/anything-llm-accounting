/**
 * Restores frontend/dist/index.html for static hosting.
 *
 * The normal frontend build renames index.html to _index.html so the Express
 * server can serve it through MetaGenerator and inject custom meta tags at
 * request time. On Vercel the SPA is served as static files straight from the
 * CDN, so it needs a real index.html - only /api/* reaches the function.
 *
 * The trade-off: custom branding meta tags are not injected per-request on
 * Vercel. The page itself is complete and works as-is.
 */
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(root, "..", "frontend", "dist");
const source = path.join(dist, "_index.html");
const target = path.join(dist, "index.html");

if (!existsSync(source)) {
  console.error(
    `Expected ${source} to exist after the frontend build. Did the build run?`
  );
  process.exit(1);
}

copyFileSync(source, target);
console.log("Restored frontend/dist/index.html for static hosting on Vercel.");
