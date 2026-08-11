/**
 * src/api/controllers/sync.controller.js
 * Runs the Telegram scraper + importer as child processes.
 * State is persisted to .sync-state.json so it survives node --watch restarts.
 *
 * Flow:
 *   1. POST /sync        → starts both scripts, returns { syncId }
 *   2. GET  /sync/status → reads state file, returns current status
 */

import { spawn }                       from "child_process";
import { resolve, dirname }            from "path";
import { fileURLToPath }               from "url";
import { writeFileSync, readFileSync,
         existsSync }                  from "fs";

const __dirname  = dirname(fileURLToPath(import.meta.url));
// controllers/ → api/ → src/ → server/  (3 levels up)
const SERVER_DIR  = resolve(__dirname, "../../../");
const STATE_FILE  = resolve(SERVER_DIR, ".sync-state.json");

// ─────────────────────────────────────────────
// State helpers (file-based, survives restarts)
// ─────────────────────────────────────────────
function readState() {
  try {
    if (existsSync(STATE_FILE)) return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {}
  return null;
}

function writeState(state) {
  try { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch {}
}

// Track if THIS process is already running a sync (prevents double-trigger)
let processRunning = false;

// ─────────────────────────────────────────────
// On startup: reset any stale "running" state left by a previous crashed process.
// When node --watch restarts, all child processes (scraper/importer) are killed,
// so any persisted "running" state must be treated as failed.
// ─────────────────────────────────────────────
(function resetStaleState() {
  const state = readState();
  if (state?.status === "running") {
    writeState({
      ...state,
      status: "error",
      phase:  state.phase,
      error:  "Sync interrupted — server restarted mid-sync. Click Reload to try again.",
      doneAt: new Date().toISOString(),
    });
    console.log("[Sync] Reset stale 'running' state from previous session.");
  }
})();

// ─────────────────────────────────────────────
// POST /api/v1/internal/sync
// ─────────────────────────────────────────────
export async function startSync(req, res) {
  // Prevent concurrent syncs in this process
  if (processRunning) {
    const state = readState();
    return res.json({ success: true, data: { ...(state || {}), alreadyRunning: true } });
  }

  // Check persisted state — but only trust it if it started < 5 minutes ago
  const existing = readState();
  const STALE_MS = 5 * 60 * 1000; // 5 minutes
  const isStale  = !existing?.startedAt ||
    (Date.now() - new Date(existing.startedAt).getTime()) > STALE_MS;

  if (existing?.status === "running" && !isStale) {
    return res.json({ success: true, data: { ...existing, alreadyRunning: true } });
  }

  const syncId = `sync-${Date.now()}`;
  const job = {
    syncId,
    status:    "running",
    phase:     "scraping",
    logs:      [],
    inserted:  0,
    skipped:   0,
    startedAt: new Date().toISOString(),
    doneAt:    null,
    error:     null,
  };

  writeState(job);
  processRunning = true;

  // Respond immediately
  res.json({ success: true, data: { syncId } });

  // Run in background
  runSync(job).catch(err => {
    job.status = "error";
    job.error  = err.message;
    job.doneAt = new Date().toISOString();
    writeState(job);
  }).finally(() => {
    processRunning = false;
  });
}

// ─────────────────────────────────────────────
// GET /api/v1/internal/sync/status
// ─────────────────────────────────────────────
export async function getSyncStatus(req, res) {
  const state = readState();
  res.json({ success: true, data: state || { status: "idle" } });
}

// ─────────────────────────────────────────────
// Internal: run scraper then importer
// ─────────────────────────────────────────────
async function runSync(job) {
  // ── Phase 1: py telegram_scraper.py ──────────
  job.phase = "scraping";
  job.logs.push("[Scraper] Starting Telegram scrape…");
  writeState(job);

  try {
    await runProcess("py", ["telegram_scraper.py"], SERVER_DIR, job, (line) => {
      job.logs.push(`[Scraper] ${line}`);
      if (job.logs.length % 5 === 0) writeState(job);
    });
    job.logs.push("[Scraper] ✅ Scrape complete.");
  } catch (scraperErr) {
    // Scraper failed but may have still written jobs.json — continue anyway
    job.logs.push(`[Scraper] ⚠ Scraper exited with error: ${scraperErr.message}. Continuing with existing data…`);
    job.status = "running"; // reset — error was non-fatal
  }
  writeState(job);

  // ── Phase 2: cleanup old jobs (rolling 5-day window) ─
  job.phase = "cleaning";
  job.logs.push("[Cleanup] Removing jobs older than 5 days…");
  writeState(job);

  try {
    await runProcess("node", ["scripts/cleanup_jobs.mjs"], SERVER_DIR, job, (line) => {
      job.logs.push(`[Cleanup] ${line}`);
      writeState(job);
    });
  } catch {
    job.logs.push("[Cleanup] ⚠ Cleanup skipped (non-fatal).");
    job.status = "running";
  }
  writeState(job);

  // ── Phase 3: node scripts/import_jobs.mjs ────
  job.phase = "importing";
  job.logs.push("[Importer] Starting import…");
  writeState(job);

  await runProcess("node", ["scripts/import_jobs.mjs"], SERVER_DIR, job, (line) => {
    job.logs.push(`[Importer] ${line}`);
    const m = line.match(/inserted:\s*(\d+)/);
    if (m) job.inserted = parseInt(m[1]);
    const done = line.match(/Inserted\s*:\s*(\d+)/);
    if (done) job.inserted = parseInt(done[1]);
    if (job.logs.length % 5 === 0) writeState(job);
  });

  job.status = "done";
  job.phase  = "done";
  job.doneAt = new Date().toISOString();
  job.logs.push(`[Sync] ✅ Done — ${job.inserted} new jobs added.`);
  writeState(job);
}

// ─────────────────────────────────────────────
// Helper: spawn a process and stream output
// ─────────────────────────────────────────────
function runProcess(cmd, args, cwd, job, onLine) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd,
      shell: true,   // Required on Windows: finds py/node from PATH
      env:   process.env,
    });

    let buffer = "";

    const handleData = (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
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
        writeState(job);
        reject(new Error(job.error));
      }
    });

    proc.on("error", (err) => {
      job.status = "error";
      job.error  = err.message;
      writeState(job);
      reject(err);
    });
  });
}
