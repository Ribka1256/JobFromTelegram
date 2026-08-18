/**
 * src/services/sync-state.service.js
 *
 * Manages the "last successful sync" timestamp.
 *
 * Storage strategy:
 *   - Reads from Supabase table `system_config` (key = 'last_sync_at')
 *     → durable across Render restarts and redeploys
 *   - Falls back to local .last-sync.json for local development
 *
 * Written by TWO paths:
 *   1. GitHub Actions workflow → POST /api/v1/internal/record-sync after pipeline succeeds
 *   2. Web-triggered sync (sync.controller.js) → same endpoint
 *
 * A FAILED sync must NOT call recordSuccessfulSync().
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname }                        from "path";
import { fileURLToPath }                           from "url";
import { supabase }                                from "../database/supabase.js";

const __dirname      = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR     = resolve(__dirname, "../../");
const LAST_SYNC_FILE = resolve(SERVER_DIR, ".last-sync.json");

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function readFromSupabase() {
  try {
    const { data, error } = await supabase
      .from("system_config")
      .select("value, updated_at")
      .eq("key", "last_sync_at")
      .maybeSingle();
    if (error || !data?.value) return null;
    return {
      lastSyncedAt: data.value,
      status:       "success",
      jobsInserted: null,
      source:       "supabase",
    };
  } catch {
    return null;
  }
}

async function writeToSupabase(isoTimestamp) {
  try {
    const { error } = await supabase
      .from("system_config")
      .upsert(
        { key: "last_sync_at", value: isoTimestamp, updated_at: isoTimestamp },
        { onConflict: "key" }
      );
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("[SyncState] Supabase write failed:", err.message);
    return false;
  }
}

// ── Local file fallback (dev only) ───────────────────────────────────────────

function readFromFile() {
  try {
    if (!existsSync(LAST_SYNC_FILE)) return null;
    const data = JSON.parse(readFileSync(LAST_SYNC_FILE, "utf8"));
    return {
      lastSyncedAt: data.lastSyncedAt ?? null,
      status:       data.status       ?? "unknown",
      jobsInserted: data.jobsInserted ?? null,
      source:       data.source       ?? "file",
    };
  } catch {
    return null;
  }
}

function writeToFile(isoTimestamp, extra = {}) {
  try {
    writeFileSync(
      LAST_SYNC_FILE,
      JSON.stringify({ lastSyncedAt: isoTimestamp, status: "success", ...extra }, null, 2),
      "utf8"
    );
  } catch (err) {
    console.error("[SyncState] File write failed:", err.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read the last successful sync timestamp.
 * Prefers Supabase (durable); falls back to local file (dev).
 * Never throws.
 */
export async function getLastSyncTime() {
  // Try Supabase first (works in production on Render)
  const fromDB = await readFromSupabase();
  if (fromDB?.lastSyncedAt) return fromDB;

  // Fall back to local file (local development)
  const fromFile = readFromFile();
  if (fromFile?.lastSyncedAt) return fromFile;

  return { lastSyncedAt: null, status: "never", jobsInserted: null, source: null };
}

/**
 * Record a successful sync.
 * Writes to BOTH Supabase (durable) and local file (dev convenience).
 * Call ONLY after the FULL pipeline succeeds.
 *
 * @param {object} opts
 * @param {number|null} opts.jobsInserted
 * @param {"scheduler"|"web"|"github-actions"} opts.source
 */
export async function recordSuccessfulSync({ jobsInserted = null, source = "web" } = {}) {
  const isoTimestamp = new Date().toISOString();
  const extra = { jobsInserted, source };

  // Write to Supabase (primary, durable storage)
  const ok = await writeToSupabase(isoTimestamp);
  if (ok) {
    console.log(`[SyncState] Recorded sync timestamp in Supabase (${source}).`);
  }

  // Also write local file for dev convenience
  writeToFile(isoTimestamp, extra);

  return { lastSyncedAt: isoTimestamp, status: "success", ...extra };
}
