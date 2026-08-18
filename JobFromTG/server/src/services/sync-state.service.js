/**
 * src/services/sync-state.service.js
 *
 * Manages .last-sync.json — the single source of truth for the
 * last SUCCESSFUL pipeline synchronization.
 *
 * Updated by TWO code paths:
 *   1. scheduler.py  → calls recordSuccessfulSync() via POST /api/v1/internal/record-sync
 *   2. sync.controller.js → calls recordSuccessfulSync() directly after web-triggered sync
 *
 * File shape:
 * {
 *   "lastSyncedAt": "2026-08-18T07:30:00.123Z",
 *   "status":       "success",
 *   "jobsInserted": 625,
 *   "source":       "scheduler" | "web"
 * }
 *
 * A FAILED sync must NOT call recordSuccessfulSync().
 * Only the previous successful timestamp is ever displayed to users.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname }                        from "path";
import { fileURLToPath }                           from "url";

const __dirname     = dirname(fileURLToPath(import.meta.url));
// services/ → src/ → server/
const SERVER_DIR    = resolve(__dirname, "../../");
const LAST_SYNC_FILE = resolve(SERVER_DIR, ".last-sync.json");

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Returns the stored sync state, or a "never" placeholder if none exists.
 * Never throws — always returns a safe object.
 */
export function getLastSyncTime() {
  try {
    if (!existsSync(LAST_SYNC_FILE)) {
      return { lastSyncedAt: null, status: "never", jobsInserted: null, source: null };
    }
    const raw  = readFileSync(LAST_SYNC_FILE, "utf8");
    const data = JSON.parse(raw);
    return {
      lastSyncedAt: data.lastSyncedAt  ?? null,
      status:       data.status        ?? "unknown",
      jobsInserted: data.jobsInserted  ?? null,
      source:       data.source        ?? "unknown",
    };
  } catch {
    return { lastSyncedAt: null, status: "error", jobsInserted: null, source: null };
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Records a successful sync.
 * Call ONLY after the FULL pipeline (scraper + importer) succeeds.
 *
 * @param {object} opts
 * @param {number|null} opts.jobsInserted  - Number of new jobs added (null if unknown)
 * @param {"scheduler"|"web"} opts.source  - Who triggered this sync
 */
export function recordSuccessfulSync({ jobsInserted = null, source = "web" } = {}) {
  try {
    const payload = {
      lastSyncedAt: new Date().toISOString(),
      status:       "success",
      jobsInserted: jobsInserted ?? null,
      source,
    };
    writeFileSync(LAST_SYNC_FILE, JSON.stringify(payload, null, 2), "utf8");
    return payload;
  } catch (err) {
    console.error("[SyncState] Failed to write .last-sync.json:", err.message);
    return null;
  }
}
