/**
 * src/services/cleanup.service.js
 * Removes job records older than 14 days to keep the DB lean.
 * Preserves companies, categories, channels, and locations.
 */

import { prisma } from "../database/prisma.js";

export async function deleteOldJobs() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  try {
    const result = await prisma.job.deleteMany({
      where: { postedAt: { lt: cutoff } },
    });
    console.log(`[Cleanup] Deleted ${result.count} jobs older than 14 days.`);
    return result.count;
  } catch (err) {
    console.error("[Cleanup] Error during cleanup:", err.message);
    return 0;
  }
}
