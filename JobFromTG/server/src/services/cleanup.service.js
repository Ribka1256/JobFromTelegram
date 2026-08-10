/**
 * src/services/cleanup.service.js
 * Removes job records older than 14 days to keep the DB lean.
 * Preserves companies, categories, channels, and locations.
 * Uses Supabase JS (HTTPS) instead of Prisma (TCP).
 */

import { supabase } from "../database/supabase.js";

export async function deleteOldJobs() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  try {
    const { data, error } = await supabase
      .from("jobs")
      .delete()
      .lt("postedAt", cutoff.toISOString())
      .select("id");

    if (error) throw error;
    const count = data?.length ?? 0;
    console.log(`[Cleanup] Deleted ${count} jobs older than 14 days.`);
    return count;
  } catch (err) {
    console.error("[Cleanup] Error during cleanup:", err.message);
    return 0;
  }
}
