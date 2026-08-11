/**
 * scripts/cleanup_jobs.mjs
 * Standalone script: deletes jobs older than 5 days (rolling window).
 * Spawned by sync.controller.js as a proper child process.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const RETENTION_DAYS = 5;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function run() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  cutoff.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("jobs")
    .delete()
    .lt("postedAt", cutoff.toISOString())
    .select("id");

  if (error) {
    console.error(`[Cleanup] Error: ${error.message}`);
    process.exit(0); // Non-fatal — don't block the import
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    console.log(`[Cleanup] 🗑  Deleted ${count} jobs older than ${RETENTION_DAYS} days.`);
  } else {
    console.log(`[Cleanup] ✅ No old jobs to delete.`);
  }
}

run().catch(e => { console.error("[Cleanup] Fatal:", e.message); process.exit(0); });
