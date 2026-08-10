/**
 * src/services/stats.service.js
 * Business logic for statistics endpoints.
 * Uses Supabase JS (HTTPS) instead of Prisma (TCP).
 */

import { supabase } from "../database/supabase.js";

async function countWhere(table, filters = {}) {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [key, val] of Object.entries(filters)) {
    if (val !== undefined) q = q.eq(key, val);
  }
  const { count, error } = await q;
  if (error) throw new Error(`countWhere(${table}): ${error.message}`);
  return count || 0;
}

export async function getOverallStats() {
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo  = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const recentAgo= new Date(); recentAgo.setDate(recentAgo.getDate() - 14);

  // Run all counts in parallel via HTTPS
  const [
    totalJobs, totalCompanies, totalChannels,
    todayJobs, weekJobs, recentJobs,
  ] = await Promise.all([
    // total jobs
    supabase.from("jobs").select("id", { count: "exact", head: true })
      .eq("isActive", true).eq("isDuplicate", false)
      .then(({ count }) => count || 0),
    // companies
    supabase.from("companies").select("id", { count: "exact", head: true })
      .then(({ count }) => count || 0),
    // active channels
    supabase.from("telegram_channels").select("id", { count: "exact", head: true })
      .eq("isActive", true)
      .then(({ count }) => count || 0),
    // today's jobs
    supabase.from("jobs").select("id", { count: "exact", head: true })
      .eq("isActive", true).eq("isDuplicate", false)
      .gte("postedAt", today.toISOString())
      .then(({ count }) => count || 0),
    // week's jobs
    supabase.from("jobs").select("id", { count: "exact", head: true })
      .eq("isActive", true).eq("isDuplicate", false)
      .gte("postedAt", weekAgo.toISOString())
      .then(({ count }) => count || 0),
    // recent (14d) jobs
    supabase.from("jobs").select("id", { count: "exact", head: true })
      .eq("isActive", true).eq("isDuplicate", false)
      .gte("postedAt", recentAgo.toISOString())
      .then(({ count }) => count || 0),
  ]);

  return { totalJobs, totalCompanies, totalChannels, todayJobs, weekJobs, recentJobs };
}

export async function getCategoryBreakdown() {
  // Fetch all active jobs with their categoryId + category name
  const { data, error } = await supabase
    .from("jobs")
    .select("categoryId, category:categories(id, name, slug, iconEmoji)")
    .eq("isActive", true)
    .eq("isDuplicate", false)
    .not("categoryId", "is", null);

  if (error) throw new Error(`getCategoryBreakdown: ${error.message}`);

  // Group client-side
  const counts = {};
  for (const job of (data || [])) {
    const cat = job.category;
    if (!cat) continue;
    if (!counts[cat.id]) counts[cat.id] = { category: cat, count: 0 };
    counts[cat.id].count++;
  }

  return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 20);
}

export async function getEmploymentTypeBreakdown() {
  const { data, error } = await supabase
    .from("jobs")
    .select("employmentType")
    .eq("isActive", true)
    .eq("isDuplicate", false);

  if (error) throw new Error(`getEmploymentTypeBreakdown: ${error.message}`);

  const counts = {};
  for (const job of (data || [])) {
    counts[job.employmentType] = (counts[job.employmentType] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getTopLocations() {
  const { data, error } = await supabase
    .from("jobs")
    .select("locationId, location:locations(id, city, country)")
    .eq("isActive", true)
    .eq("isDuplicate", false)
    .not("locationId", "is", null);

  if (error) throw new Error(`getTopLocations: ${error.message}`);

  const counts = {};
  for (const job of (data || [])) {
    const loc = job.location;
    if (!loc) continue;
    if (!counts[loc.id]) counts[loc.id] = { location: loc, count: 0 };
    counts[loc.id].count++;
  }
  return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);
}
