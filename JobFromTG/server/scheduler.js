/**
 * scheduler.js
 * Runs background maintenance tasks on a schedule.
 * Cleanup runs every 24h to enforce the 5-day rolling window.
 */

import { deleteOldJobs, RETENTION_DAYS } from "./src/services/cleanup.service.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function startScheduler() {
  // Run once on startup after a 10-second delay
  setTimeout(async () => {
    console.log("[Scheduler] Running initial cleanup...");
    await deleteOldJobs();
  }, 10_000);

  // Repeat every 24 hours to enforce rolling window
  setInterval(async () => {
    console.log("[Scheduler] Running daily cleanup...");
    await deleteOldJobs();
  }, ONE_DAY_MS);

  console.log(`[Scheduler] ${RETENTION_DAYS}-day rolling cleanup job registered (runs every 24h).`);
}
