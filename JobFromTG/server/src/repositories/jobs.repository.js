/**
 * src/repositories/jobs.repository.js
 * All database queries for the Job model.
 * Uses @supabase/supabase-js (HTTPS) instead of Prisma (TCP)
 * because the local network blocks PostgreSQL port 5432/6543.
 *
 * Output shape is preserved exactly — the rest of the app is unchanged.
 */

import { supabase }     from "../database/supabase.js";
import { randomUUID }   from "crypto";

// ─────────────────────────────────────────────
// Column selection string (PostgREST syntax)
// ─────────────────────────────────────────────
const JOB_SELECT = `
  id, title, description, salaryMin, salaryMax, salaryCurrency, salaryRaw,
  employmentType, experienceLevel, educationLevel,
  email, phone, applicationUrl, applicationMethod,
  responsibilities, requirements, benefits,
  telegramMessageLink, confidenceScore, extractionMethod,
  isActive, isDuplicate, postedAt, deadline, createdAt,
  company:companies ( id, name, website ),
  category:categories ( id, name, slug, iconEmoji ),
  location:locations ( id, city, country ),
  skills:job_skills ( skill:skills ( id, name, slug ) )
`.trim();

// ─────────────────────────────────────────────
// Helper: throw on Supabase error
// ─────────────────────────────────────────────
function assertOk({ error }, label) {
  if (error) throw new Error(`[${label}] ${error.message}`);
}

// ─────────────────────────────────────────────
// findMany — paginated list with all filters
// ─────────────────────────────────────────────
export async function findJobs({
  page          = 1,
  limit         = 20,
  search        = null,
  category      = null,
  location      = null,
  employmentType  = null,
  experienceLevel = null,
  sort          = "postedAt",
  order         = "desc",
} = {}) {
  const skip = (page - 1) * limit;

  let q = supabase
    .from("jobs")
    .select(JOB_SELECT, { count: "exact" })
    .eq("isActive",    true)
    .eq("isDuplicate", false)
    .order(sort, { ascending: order === "asc" })
    .range(skip, skip + limit - 1);

  if (search) {
    q = q.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }
  if (employmentType) q = q.eq("employmentType", employmentType.toUpperCase());
  if (experienceLevel) q = q.eq("experienceLevel", experienceLevel.toUpperCase());

  const { data, error, count } = await q;
  assertOk({ error }, "findJobs");
  return { jobs: data || [], total: count || 0 };
}

// ─────────────────────────────────────────────
// findById — single job (full detail)
// ─────────────────────────────────────────────
export async function findJobById(id) {
  const { data, error } = await supabase
    .from("jobs")
    .select(`${JOB_SELECT},
      sources:job_sources (
        telegramMessageLink, messageDate, views, forwards,
        channel:telegram_channels ( username, displayName )
      ),
      aiExtractions:ai_extractions (
        model, isValid, latencyMs, createdAt
      )
    `)
    .eq("id", id)
    .single();
  assertOk({ error }, "findJobById");
  return data;
}

// ─────────────────────────────────────────────
// findTodayJobs
// ─────────────────────────────────────────────
export async function findTodayJobs({ limit = 50 } = {}) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("isActive",    true)
    .eq("isDuplicate", false)
    .gte("postedAt", startOfDay.toISOString())
    .order("postedAt", { ascending: false })
    .limit(limit);

  assertOk({ error }, "findTodayJobs");
  return data || [];
}

// ─────────────────────────────────────────────
// findRecentJobs — last N days (default: 5)
// ─────────────────────────────────────────────
export async function findRecentJobs({ days = 5, limit = 50 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("isActive",    true)
    .eq("isDuplicate", false)
    .gte("postedAt", since.toISOString())
    .order("postedAt", { ascending: false })
    .limit(limit);

  assertOk({ error }, "findRecentJobs");
  return data || [];
}

// ─────────────────────────────────────────────
// findWeekJobs — yesterday back to 5 days ago
// Explicitly excludes today so the right column
// never duplicates the "Today's Post" left column.
// ─────────────────────────────────────────────
export async function findWeekJobs({ limit = 50 } = {}) {
  const now = new Date();

  // UTC midnight of today — reliable boundary regardless of server timezone
  const startOfTodayUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));

  // 5 UTC days before today's midnight
  const fiveDaysAgoUTC = new Date(startOfTodayUTC);
  fiveDaysAgoUTC.setUTCDate(fiveDaysAgoUTC.getUTCDate() - 5);

  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("isActive",    true)
    .eq("isDuplicate", false)
    .gte("postedAt", fiveDaysAgoUTC.toISOString())   // from 5 days ago (UTC)...
    .lt("postedAt",  startOfTodayUTC.toISOString())   // ...up to (not incl.) today (UTC)
    .order("postedAt", { ascending: false })
    .limit(limit);

  assertOk({ error }, "findWeekJobs");
  return data || [];
}


// ─────────────────────────────────────────────
// Count helpers — used by stats endpoint
// ─────────────────────────────────────────────
export async function countTodayJobs() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("isActive", true).eq("isDuplicate", false)
    .gte("postedAt", startOfDay.toISOString());
  assertOk({ error }, "countTodayJobs");
  return count || 0;
}

export async function countWeekJobs() {
  const since = new Date();
  since.setDate(since.getDate() - 5);  // 5-day rolling window
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("isActive", true).eq("isDuplicate", false)
    .gte("postedAt", since.toISOString());
  assertOk({ error }, "countWeekJobs");
  return count || 0;
}

export async function countRecentJobs() {
  const since = new Date();
  since.setDate(since.getDate() - 5);  // aligned to 5-day window
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("isActive", true).eq("isDuplicate", false)
    .gte("postedAt", since.toISOString());
  assertOk({ error }, "countRecentJobs");
  return count || 0;
}

// ─────────────────────────────────────────────
// createJob — insert a new job (called by scraper)
// ─────────────────────────────────────────────
export async function createJob(data) {
  const {
    title, description, salaryMin, salaryMax, salaryCurrency, salaryRaw,
    employmentType, experienceLevel, educationLevel,
    email, phone, applicationUrl, applicationMethod,
    responsibilities, requirements, benefits,
    contentHash, telegramMessageLink, confidenceScore,
    extractionMethod, postedAt, deadline,
    companyName, locationName, categoryName, channelUsername,
    messageId, messageViews, messageForwards, aiExtraction,
  } = data;

  // ── Safe upsert helper: insert-or-select (never overwrites PK) ──
  // Using ignoreDuplicates:true (DO NOTHING) prevents the race condition
  // where concurrent upserts overwrite the row's UUID, causing FK failures.
  async function upsertOrSelect(table, conflictCol, insertData, selectCol = "id") {
    const { data: inserted } = await supabase
      .from(table)
      .upsert(insertData, { onConflict: conflictCol, ignoreDuplicates: true })
      .select(selectCol)
      .maybeSingle();
    if (inserted) return inserted[selectCol];
    // Row already existed → fetch the existing id
    const { data: existing } = await supabase
      .from(table)
      .select(selectCol)
      .eq(conflictCol, insertData[conflictCol])
      .maybeSingle();
    return existing?.[selectCol] ?? null;
  }

  // ── Upsert Company ──────────────────────────
  let companyId = null;
  if (companyName) {
    const norm = companyName.toLowerCase().trim();
    companyId = await upsertOrSelect("companies", "normalizedName",
      { id: randomUUID(), name: companyName, normalizedName: norm });
  }

  // ── Upsert Location ─────────────────────────
  let locationId = null;
  if (locationName) {
    const norm = locationName.toLowerCase().trim();
    locationId = await upsertOrSelect("locations", "normalizedName",
      { id: randomUUID(), city: locationName, normalizedName: norm });
  }

  // ── Upsert Category ─────────────────────────
  let categoryId = null;
  if (categoryName) {
    const slug = categoryName.toLowerCase().replace(/\s+/g, "-");
    categoryId = await upsertOrSelect("categories", "slug",
      { id: randomUUID(), name: categoryName, slug });
  }

  // ── Insert Job ──────────────────────────────
  const now = new Date().toISOString();
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .insert({ id: randomUUID(),
      title, description,
      salaryMin:         salaryMin         ?? null,
      salaryMax:         salaryMax         ?? null,
      salaryCurrency:    salaryCurrency    || "ETB",
      salaryRaw:         salaryRaw         ?? null,
      employmentType:    employmentType    || "UNKNOWN",
      experienceLevel:   experienceLevel   || "UNKNOWN",
      educationLevel:    educationLevel    || "UNKNOWN",
      email:             email             ?? null,
      phone:             phone             ?? null,
      applicationUrl:    applicationUrl    ?? null,
      applicationMethod: applicationMethod ?? null,
      responsibilities:  responsibilities  || [],
      requirements:      requirements      || [],
      benefits:          benefits          || [],
      contentHash, telegramMessageLink,
      confidenceScore,
      extractionMethod:  extractionMethod  || "REGEX",
      isActive:          true,
      isDuplicate:       false,
      isVerified:        false,
      postedAt:  new Date(postedAt).toISOString(),
      deadline:  deadline ? new Date(deadline).toISOString() : null,
      createdAt: now,
      updatedAt: now,
      companyId, locationId, categoryId,
    })
    .select("id")
    .single();

  assertOk({ error: jobErr }, "createJob");
  return job;
}

// ─────────────────────────────────────────────
// Scraper dedup helpers
// ─────────────────────────────────────────────
export async function getKnownLinks() {
  const { data, error } = await supabase
    .from("jobs")
    .select("telegramMessageLink")
    .range(0, 99999);   // bypass default 1000-row cap
  assertOk({ error }, "getKnownLinks");
  return (data || []).map((r) => r.telegramMessageLink);
}

export async function getKnownHashes() {
  const { data, error } = await supabase
    .from("jobs")
    .select("contentHash")
    .range(0, 99999);   // bypass default 1000-row cap
  assertOk({ error }, "getKnownHashes");
  return (data || []).map((r) => r.contentHash);
}

export async function getRecentTexts(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from("jobs")
    .select("description")
    .gte("postedAt", since.toISOString());
  assertOk({ error }, "getRecentTexts");
  return (data || []).map((r) => r.description);
}
