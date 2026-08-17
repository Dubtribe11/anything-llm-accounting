/**
 * Vercel Serverless Function entry point.
 *
 * Vercel treats every file in /api as a function. This one hands the platform
 * the Express app from /server without letting it bind a port - the server's
 * index.js checks SERVERLESS_DEPLOYMENT and skips `.listen()` when it is set,
 * so the same file still boots a normal long-running server everywhere else.
 *
 * This file is ESM because the root package.json sets `"type": "module"`, while
 * the server is CommonJS - hence createRequire rather than a plain import.
 *
 * Deployment guide and limitations: see VERCEL.md at the repository root.
 */
import { createRequire } from "node:module";

// Set before requiring the server so its module-level branches see it, even if
// the environment variable was not configured in the Vercel project.
process.env.SERVERLESS_DEPLOYMENT = "true";
process.env.NODE_ENV = process.env.NODE_ENV || "production";

// Only /tmp is writable in a Vercel function, and it is wiped between cold
// starts. Anything that must survive a request belongs in Postgres or the
// external vector database.
process.env.STORAGE_DIR = process.env.STORAGE_DIR || "/tmp/anythingllm-storage";

const require = createRequire(import.meta.url);
const app = require("../server/index.js");

export default app;
