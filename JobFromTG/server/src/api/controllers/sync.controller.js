/**
 * src/api/controllers/sync.controller.js
 * Runs the Telegram scraper + importer as child processes.
 * Called by the frontend Reload button via POST /api/v1/internal/sync.
 *
 * Flow:
 *   1. POST /sync        → starts both scripts, returns { syncId }
 *   2. GET  /sync/status → returns current status + progress logs
 */

import { spawn }  from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath }    from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// controllers/ → api/ → src/ → server/  (3 levels up)
const SERVER_DIR = resolve(__dirname, "../../../");

// In-memory store of sync jobs (keyed by syncId)
const syncJobs = new Map();

let activeSyncId = null;   // Only one sync at a time

// ─────────────────────────────────────────────
// POST /api/v1/internal/sync  — kick off a sync
// ─────────────────────────────────────────────
export async function startSync(req, res) {
  // Prevent concurrent syncs
  if (activeSyncId && syncJobs.get(activeSyncId)?.status === "running") {
    return res.json({
      success: true,
      data: { syncId: activeSyncId, alreadyRunning: true },
    });
  }

  const syncId = `sync-${Date.now()}`;
  activeSyncId = syncId;

  const job = {
    syncId,
    status:    "running",
    phase:     "scraping",    // "scraping" | "importing" | "done" | "error"
    logs:      [],
    inserted:  0,
    skipped:   0,
    startedAt: new Date().toISOString(),
    doneAt:    null,
    error:     null,
  };
  syncJobs.set(syncId, job);

  // Respond immediately so the UI doesn't wait
  res.json({ success: true, data: { syncId } });

  // Run scripts in background
  runSync(job).catch(err => {
    job.status = "error";
    job.error  = err.message;
    job.doneAt = new Date().toISOString();
  });
}

// ─────────────────────────────────────────────
// GET /api/v1/internal/sync/status
// ─────────────────────────────────────────────
export async function getSyncStatus(req, res) {
  if (!activeSyncId) {
    return res.json({ success: true, data: { status: "idle" } });
  }
  const job = syncJobs.get(activeSyncId);
  res.json({ success: true, data: job });
}

// ─────────────────────────────────────────────
// Internal: run scraper then importer
// ─────────────────────────────────────────────
async function runSync(job) {
  // ── Phase 1: py telegram_scraper.py ─────────
  job.phase = "scraping";
  job.logs.push("[Scraper] Starting Telegram scrape…");

  await runProcess("py", ["telegram_scraper.py"], SERVER_DIR, job, (line) => {
    job.logs.push(`[Scraper] ${line}`);
  });

  job.logs.push("[Scraper] ✅ Scrape complete. Starting import…");

  // ── Phase 2: node scripts/import_jobs.mjs ───
  job.phase = "importing";

  await runProcess(
    process.execPath,                          // path to node
    ["scripts/import_jobs.mjs"],
    SERVER_DIR,
    job,
    (line) => {
      job.logs.push(`[Importer] ${line}`);
      // Parse progress line: ✅ inserted: 123  ⏭  skipped: 456
      const m = line.match(/inserted:\s*(\d+).*skipped:\s*(\d+)/);
      if (m) {
        job.inserted = parseInt(m[1]);
        job.skipped  = parseInt(m[2]);
      }
      // Final DONE
      const done = line.match(/Inserted\s*:\s*(\d+)/);
      if (done) job.inserted = parseInt(done[1]);
    }
  );

  job.status = "done";
  job.phase  = "done";
  job.doneAt = new Date().toISOString();
  job.logs.push(`[Sync] ✅ Done — ${job.inserted} new jobs added.`);
}

// ─────────────────────────────────────────────
// Helper: spawn a process and collect output
// ─────────────────────────────────────────────
function runProcess(cmd, args, cwd, job, onLine) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd,
      shell: true,    // Required on Windows for py/node in PATH
      env:   process.env,
    });

    let buffer = "";

    const handleData = (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();     // keep incomplete line in buffer
      for (const line of lines) {
        if (line.trim()) onLine(line.trim());
      }
    };

    proc.stdout.on("data", handleData);
    proc.stderr.on("data", handleData);

    proc.on("close", (code) => {
      if (buffer.trim()) onLine(buffer.trim());
      if (code === 0 || code === null) resolve();
      else {
        job.status = "error";
        job.error  = `Process "${cmd}" exited with code ${code}`;
        reject(new Error(job.error));
      }
    });

    proc.on("error", (err) => {
      job.status = "error";
      job.error  = err.message;
      reject(err);
    });
  });
}
