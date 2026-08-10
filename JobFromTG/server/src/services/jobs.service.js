/**
 * src/services/jobs.service.js
 * Business logic for job operations.
 * Controllers call this; this calls the repository.
 * No req/res objects here — pure logic only.
 */

import { config } from "../config/index.js";
import * as jobsRepo from "../repositories/jobs.repository.js";

// ─────────────────────────────────────────────
// Parse and validate query params
// ─────────────────────────────────────────────

function parsePaginationParams(query) {
  const { defaultLimit, maxLimit } = config.pagination;

  let page  = parseInt(query.page  || "1",            10);
  let limit = parseInt(query.limit || String(defaultLimit), 10);

  if (isNaN(page)  || page  < 1) page  = 1;
  if (isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit)          limit = maxLimit;

  return { page, limit };
}

const ALLOWED_SORT_FIELDS = new Set([
  "postedAt", "createdAt", "deadline", "confidenceScore", "title",
]);

function parseSortParams(query) {
  const sort  = ALLOWED_SORT_FIELDS.has(query.sort)  ? query.sort  : "postedAt";
  const order = query.order === "asc"                 ? "asc"       : "desc";
  return { sort, order };
}

// ─────────────────────────────────────────────
// Public service methods
// ─────────────────────────────────────────────

export async function getJobs(query) {
  const { page, limit }   = parsePaginationParams(query);
  const { sort, order }   = parseSortParams(query);

  return jobsRepo.findJobs({
    page, limit, sort, order,
    search:          query.q         || null,
    category:        query.category  || null,
    location:        query.location  || null,
    employmentType:  query.employment_type || null,
    experienceLevel: query.experience_level || null,
    channelUsername: query.channel   || null,
    onlyToday:       query.today === "true",
  });
}

export async function getJobById(id) {
  if (!id) throw Object.assign(new Error("Job ID is required."), { statusCode: 400 });
  const job = await jobsRepo.findJobById(id);
  if (!job) throw Object.assign(new Error("Job not found."), { statusCode: 404 });
  return job;
}

export async function getTodayJobs(query) {
  const limit = Math.min(parseInt(query.limit || "50", 10), 100);
  return jobsRepo.findTodayJobs({ limit });
}

export async function getRecentJobs(query) {
  const days  = Math.min(parseInt(query.days  || "7",  10), 30);
  const limit = Math.min(parseInt(query.limit || "50", 10), 100);
  return jobsRepo.findRecentJobs({ days, limit });
}

export async function getWeekJobs(query) {
  const limit = Math.min(parseInt(query.limit || "50", 10), 100);
  return jobsRepo.findWeekJobs({ limit });
}

export async function ingestJob(payload) {
  // Guard: content_hash and telegram_link are mandatory for dedup
  if (!payload.contentHash)         throw Object.assign(new Error("contentHash is required."),         { statusCode: 400 });
  if (!payload.telegramMessageLink) throw Object.assign(new Error("telegramMessageLink is required."), { statusCode: 400 });
  return jobsRepo.createJob(payload);
}

export async function getKnownLinksAndHashes() {
  const [links, hashes] = await Promise.all([
    jobsRepo.getKnownLinks(),
    jobsRepo.getKnownHashes(),
  ]);
  return { links, hashes };
}

export async function getRecentTexts(days) {
  return jobsRepo.getRecentTexts(days);
}
