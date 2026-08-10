/**
 * src/services/stats.service.js
 * Business logic for statistics endpoints.
 */

import { prisma } from "../database/prisma.js";

export async function getOverallStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekAgo   = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const recentAgo = new Date(); recentAgo.setDate(recentAgo.getDate() - 14);

  const [
    totalJobs, totalCompanies, totalChannels,
    todayJobs, weekJobs, recentJobs, totalAiExtractions,
  ] = await Promise.all([
    prisma.job.count({ where: { isActive: true, isDuplicate: false } }),
    prisma.company.count(),
    prisma.telegramChannel.count({ where: { isActive: true } }),
    prisma.job.count({ where: { isActive: true, isDuplicate: false, postedAt: { gte: today } } }),
    prisma.job.count({ where: { isActive: true, isDuplicate: false, postedAt: { gte: weekAgo } } }),
    prisma.job.count({ where: { isActive: true, isDuplicate: false, postedAt: { gte: recentAgo } } }),
    prisma.aIExtraction.count({ where: { isValid: true } }),
  ]);

  return { totalJobs, totalCompanies, totalChannels, todayJobs, weekJobs, recentJobs, totalAiExtractions };
}

export async function getCategoryBreakdown() {
  const rows = await prisma.job.groupBy({
    by:      ["categoryId"],
    where:   { isActive: true, isDuplicate: false, categoryId: { not: null } },
    _count:  { id: true },
    orderBy: { _count: { id: "desc" } },
    take:    20,
  });

  // Fetch category names
  const categoryIds = rows.map((r) => r.categoryId).filter(Boolean);
  const categories  = await prisma.category.findMany({
    where:  { id: { in: categoryIds } },
    select: { id: true, name: true, slug: true, iconEmoji: true },
  });

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  return rows.map((row) => ({
    category: catMap[row.categoryId] || { name: "Other", slug: "other" },
    count:    row._count.id,
  }));
}

export async function getEmploymentTypeBreakdown() {
  const rows = await prisma.job.groupBy({
    by:      ["employmentType"],
    where:   { isActive: true, isDuplicate: false },
    _count:  { id: true },
    orderBy: { _count: { id: "desc" } },
  });
  return rows.map((r) => ({ type: r.employmentType, count: r._count.id }));
}

export async function getTopLocations() {
  const rows = await prisma.job.groupBy({
    by:      ["locationId"],
    where:   { isActive: true, isDuplicate: false, locationId: { not: null } },
    _count:  { id: true },
    orderBy: { _count: { id: "desc" } },
    take:    10,
  });

  const locationIds = rows.map((r) => r.locationId).filter(Boolean);
  const locations   = await prisma.location.findMany({
    where:  { id: { in: locationIds } },
    select: { id: true, city: true, country: true },
  });

  const locMap = Object.fromEntries(locations.map((l) => [l.id, l]));

  return rows.map((row) => ({
    location: locMap[row.locationId] || { city: "Unknown" },
    count:    row._count.id,
  }));
}
