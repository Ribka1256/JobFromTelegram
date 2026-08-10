/**
 * src/repositories/jobs.repository.js
 * All Prisma queries for the Job model.
 * No business logic — pure database access only.
 * See ADR-004 for layering rationale.
 */

import { prisma } from "../database/prisma.js";

// ─────────────────────────────────────────────
// Standard job select shape (avoids over-fetching)
// ─────────────────────────────────────────────
const JOB_LIST_SELECT = {
  id:               true,
  title:            true,
  description:      true,
  salaryMin:        true,
  salaryMax:        true,
  salaryCurrency:   true,
  salaryRaw:        true,
  employmentType:   true,
  experienceLevel:  true,
  educationLevel:   true,
  email:            true,
  phone:            true,
  applicationUrl:   true,
  applicationMethod:true,
  responsibilities: true,
  requirements:     true,
  benefits:         true,
  telegramMessageLink: true,
  confidenceScore:  true,
  extractionMethod: true,
  isActive:         true,
  isDuplicate:      true,
  postedAt:         true,
  deadline:         true,
  createdAt:        true,
  company:  { select: { id: true, name: true, website: true } },
  category: { select: { id: true, name: true, slug: true, iconEmoji: true } },
  location: { select: { id: true, city: true, country: true } },
  skills:   { select: { skill: { select: { id: true, name: true, slug: true } } } },
};

// ─────────────────────────────────────────────
// findMany — paginated list with all filters
// ─────────────────────────────────────────────
export async function findJobs({
  page         = 1,
  limit        = 20,
  search       = null,
  category     = null,
  location     = null,
  employmentType = null,
  experienceLevel = null,
  channelUsername = null,
  onlyToday    = false,
  sort         = "postedAt",
  order        = "desc",
} = {}) {
  const skip  = (page - 1) * limit;
  const where = buildWhereClause({
    search, category, location,
    employmentType, experienceLevel,
    channelUsername, onlyToday,
  });

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      select:  JOB_LIST_SELECT,
      orderBy: { [sort]: order },
      skip,
      take:    limit,
    }),
    prisma.job.count({ where }),
  ]);

  return { jobs, total };
}

// ─────────────────────────────────────────────
// findById — single job with full detail
// ─────────────────────────────────────────────
export async function findJobById(id) {
  return prisma.job.findUnique({
    where:  { id },
    select: {
      ...JOB_LIST_SELECT,
      sources: {
        select: {
          telegramMessageLink: true,
          messageDate: true,
          views: true,
          forwards: true,
          channel: { select: { username: true, displayName: true } },
        },
      },
      aiExtractions: {
        select: { model: true, isValid: true, latencyMs: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

// ─────────────────────────────────────────────
// findTodayJobs — jobs posted today
// ─────────────────────────────────────────────
export async function findTodayJobs({ limit = 50 } = {}) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return prisma.job.findMany({
    where:   { postedAt: { gte: startOfDay }, isActive: true, isDuplicate: false },
    select:  JOB_LIST_SELECT,
    orderBy: { postedAt: "desc" },
    take:    limit,
  });
}

// ─────────────────────────────────────────────
// findRecentJobs — jobs from last N days
// ─────────────────────────────────────────────
export async function findRecentJobs({ days = 7, limit = 50 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return prisma.job.findMany({
    where:   { postedAt: { gte: since }, isActive: true, isDuplicate: false },
    select:  JOB_LIST_SELECT,
    orderBy: { postedAt: "desc" },
    take:    limit,
  });
}

// ─────────────────────────────────────────────
// findWeekJobs — jobs from last 7 days (dashboard "This Week" tab)
// ─────────────────────────────────────────────
export async function findWeekJobs({ limit = 50 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  return prisma.job.findMany({
    where:   { postedAt: { gte: since }, isActive: true, isDuplicate: false },
    select:  JOB_LIST_SELECT,
    orderBy: { postedAt: "desc" },
    take:    limit,
  });
}

// ─────────────────────────────────────────────
// Count helpers — used by stats endpoint
// ─────────────────────────────────────────────
export async function countTodayJobs() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.job.count({ where: { postedAt: { gte: startOfDay }, isActive: true, isDuplicate: false } });
}

export async function countWeekJobs() {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  return prisma.job.count({ where: { postedAt: { gte: since }, isActive: true, isDuplicate: false } });
}

export async function countRecentJobs() {
  const since = new Date();
  since.setDate(since.getDate() - 14);
  return prisma.job.count({ where: { postedAt: { gte: since }, isActive: true, isDuplicate: false } });
}

// ─────────────────────────────────────────────
// createJob — insert a new job (called by internal scraper route)
// Runs sequential prisma calls (no interactive transaction) because
// @prisma/adapter-pg does not support $transaction timeout options.
// Each upsert is idempotent; unique constraint on telegramMessageLink
// prevents duplicates at the DB level.
// ─────────────────────────────────────────────
export async function createJob(data) {
  const {
    title, description, salaryMin, salaryMax, salaryCurrency, salaryRaw,
    employmentType, experienceLevel, educationLevel,
    email, phone, applicationUrl, applicationMethod,
    responsibilities, requirements, benefits,
    skills, contentHash, telegramMessageLink, confidenceScore,
    extractionMethod, postedAt, deadline,
    companyName, locationName, categoryName, channelUsername,
    messageId, messageViews, messageForwards, aiExtraction,
  } = data;

  // ── Step 1: Upsert supporting entities ──────────────────────
  let companyId = null;
  if (companyName) {
    const company = await prisma.company.upsert({
      where:  { normalizedName: companyName.toLowerCase().trim() },
      update: {},
      create: {
        name:           companyName,
        normalizedName: companyName.toLowerCase().trim(),
      },
    });
    companyId = company.id;
  }

  let locationId = null;
  if (locationName) {
    const location = await prisma.location.upsert({
      where:  { normalizedName: locationName.toLowerCase().trim() },
      update: {},
      create: {
        city:           locationName,
        normalizedName: locationName.toLowerCase().trim(),
      },
    });
    locationId = location.id;
  }

  let categoryId = null;
  if (categoryName) {
    const slug = categoryName.toLowerCase().replace(/\s+/g, "-");
    const category = await prisma.category.upsert({
      where:  { slug },
      update: {},
      create: { name: categoryName, slug },
    });
    categoryId = category.id;
  }

  const skillIds = [];
  for (const skillName of (skills || [])) {
    if (!skillName?.trim()) continue;
    const slug  = skillName.toLowerCase().replace(/\s+/g, "-");
    const skill = await prisma.skill.upsert({
      where:  { slug },
      update: {},
      create: { name: skillName.trim(), slug },
    });
    skillIds.push(skill.id);
  }

  // ── Step 2: Find channel ──────────────────────────────────────
  const channel = await prisma.telegramChannel.findUnique({
    where: { username: channelUsername },
  });

  // ── Step 3: Create job ───────────────────────────────────────
  const job = await prisma.job.create({
    data: {
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
      postedAt:  new Date(postedAt),
      deadline:  deadline ? new Date(deadline) : null,
      companyId, locationId, categoryId,
      skills: {
        create: skillIds.map((skillId) => ({ skillId })),
      },
    },
  });

  // ── Step 4: Create JobSource (links job to channel) ─────────
  if (channel) {
    await prisma.jobSource.create({
      data: {
        jobId:              job.id,
        channelId:          channel.id,
        telegramMessageId:  messageId,
        telegramMessageLink,
        messageDate:        new Date(postedAt),
        views:              messageViews    ?? null,
        forwards:           messageForwards ?? null,
        rawText:            description,
      },
    });
  }

  // ── Step 5: Create AIExtraction audit record ─────────────────
  if (aiExtraction) {
    await prisma.aIExtraction.create({
      data: {
        jobId:            job.id,
        model:            aiExtraction.model,
        rawResponse:      aiExtraction.rawResponse,
        promptTokens:     aiExtraction.promptTokens     ?? null,
        completionTokens: aiExtraction.completionTokens ?? null,
        latencyMs:        aiExtraction.latencyMs        ?? null,
        isValid:          aiExtraction.isValid           ?? true,
        parsedOutput:     aiExtraction.parsedOutput      ?? null,
      },
    });
  }

  return job;
}

// ─────────────────────────────────────────────
// getKnownLinks — for scraper dedup pre-loading
// ─────────────────────────────────────────────
export async function getKnownLinks() {
  const rows = await prisma.job.findMany({
    select: { telegramMessageLink: true },
  });
  return rows.map((r) => r.telegramMessageLink);
}

export async function getKnownHashes() {
  const rows = await prisma.job.findMany({
    select: { contentHash: true },
  });
  return rows.map((r) => r.contentHash);
}

export async function getRecentTexts(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const rows = await prisma.job.findMany({
    where:  { postedAt: { gte: since } },
    select: { description: true },
  });
  return rows.map((r) => r.description);
}

// ─────────────────────────────────────────────
// Where clause builder (internal)
// ─────────────────────────────────────────────
function buildWhereClause({
  search, category, location,
  employmentType, experienceLevel,
  channelUsername, onlyToday,
}) {
  const where = {
    isActive:    true,
    isDuplicate: false,
  };

  if (search) {
    where.OR = [
      { title:       { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { company:     { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (category) {
    where.category = { slug: { equals: category.toLowerCase(), mode: "insensitive" } };
  }

  if (location) {
    where.location = { city: { contains: location, mode: "insensitive" } };
  }

  if (employmentType) {
    where.employmentType = employmentType.toUpperCase();
  }

  if (experienceLevel) {
    where.experienceLevel = experienceLevel.toUpperCase();
  }

  if (channelUsername) {
    where.sources = { some: { channel: { username: channelUsername } } };
  }

  if (onlyToday) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    where.postedAt = { gte: startOfDay };
  }

  return where;
}
