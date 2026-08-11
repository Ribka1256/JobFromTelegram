/**
 * src/services/cleanup.service.js
 * Rolling 5-day window: keeps only the last 5 days of jobs.
 * On every sync, jobs older than 5 days are deleted to make room
 * for today's new data — preventing Supabase storage from filling up.
 */

import { supabase } from "../database/supabase.js";

export const RETENTION_DAYS = 5;

export async function deleteOldJobs() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  cutoff.setHours(0, 0, 0, 0); // midnight of the cutoff day

  try {
    const { data, error } = await supabase
      .from("jobs")
      .delete()
      .lt("postedAt", cutoff.toISOString())
      .select("id");

    if (error) throw error;
    const count = data?.length ?? 0;
    if (count > 0) {
      console.log(`[Cleanup] 🗑  Deleted ${count} jobs older than ${RETENTION_DAYS} days (before ${cutoff.toDateString()}).`);
    } else {
      console.log(`[Cleanup] ✅ No jobs older than ${RETENTION_DAYS} days to delete.`);
    }
    return count;
  } catch (err) {
    console.error("[Cleanup] Error during cleanup:", err.message);
    return 0;
  }
}
