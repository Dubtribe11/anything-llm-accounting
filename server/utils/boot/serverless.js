/**
 * Cold-start boot for serverless deployments (Vercel).
 *
 * `bootHTTP` does its one-time setup inside the `.listen()` callback, which
 * never runs when the platform owns the socket. This does the equivalent work
 * lazily on the first request of each cold start, and deliberately skips the
 * pieces that cannot work in a serverless runtime:
 *
 *  - BackgroundService (bree workers) - no long-lived process to run them
 *  - Telegram bot polling - same
 *  - Web push service - depends on the background service
 *  - Telemetry setup - not worth a network round trip per cold start
 */
const fs = require("fs");
const path = require("path");

/** Directories the app writes to at runtime. */
const STORAGE_SUBDIRECTORIES = [
  "documents",
  "vector-cache",
  "models",
  "lancedb",
  "assets",
  "tmp",
  "plugins",
  "plugins/agent-skills",
  "plugins/agent-flows",
];

let bootPromise = null;

/**
 * Creates STORAGE_DIR and its subdirectories. On Vercel only /tmp is writable
 * and it is wiped between cold starts, so this has to run every time.
 */
function ensureStorageDirectories() {
  const storageDir = process.env.STORAGE_DIR;
  if (!storageDir) return;
  for (const subdirectory of ["", ...STORAGE_SUBDIRECTORIES]) {
    const target = path.join(storageDir, subdirectory);
    try {
      if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    } catch (error) {
      console.error(
        `[serverless boot] Could not create ${target}:`,
        error.message
      );
    }
  }
}

/**
 * Runs the one-time setup for this cold start. Safe to call on every request -
 * the work happens once and later calls await the same promise.
 * @returns {Promise<void>}
 */
function bootServerless() {
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    ensureStorageDirectories();

    const { CommunicationKey } = require("../comKey");
    const { EncryptionManager } = require("../EncryptionManager");
    const markOnboarded = require("./markOnboarded");

    try {
      // Both write key material into STORAGE_DIR, so they must come after the
      // directories exist.
      new CommunicationKey(true);
      new EncryptionManager();
      await markOnboarded();
    } catch (error) {
      console.error("[serverless boot] Setup failed:", error.message);
    }

    console.log("[serverless boot] Ready.");
  })();

  return bootPromise;
}

/**
 * Express middleware that blocks the first request of a cold start until boot
 * has finished.
 */
function serverlessBootMiddleware(_request, _response, next) {
  bootServerless()
    .then(() => next())
    .catch((error) => next(error));
}

module.exports = {
  bootServerless,
  serverlessBootMiddleware,
  ensureStorageDirectories,
  STORAGE_SUBDIRECTORIES,
};
