/**
 * src/scheduler.js
 * Runs background maintenance tasks on a schedule.
 * Uses setInterval (no external deps) for 14-day cleanup.
 */

import { deleteOldJobs } from "./src/services/cleanup.service.js";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export function startScheduler() {
  // Run once on startup after a 10-second delay
  setTimeout(async () => {
    console.log("[Scheduler] Running initial cleanup...");
    await deleteOldJobs();
  }, 10_000);

  // Then repeat every 14 days
  setInterval(async () => {
    console.log("[Scheduler] Running scheduled 14-day cleanup...");
    await deleteOldJobs();
  }, FOURTEEN_DAYS_MS);

  console.log("[Scheduler] 14-day cleanup job registered.");
}
