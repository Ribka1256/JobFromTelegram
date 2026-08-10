/**
 * src/api/controllers/jobs.controller.js
 * HTTP layer only — parse req, call service, format res.
 * Zero business logic lives here.
 */

import * as jobsService from "../../services/jobs.service.js";
import * as companiesRepo from "../../repositories/companies.repository.js";
import * as channelsRepo from "../../repositories/channels.repository.js";
import {
  sendSuccess, sendPaginated, sendNotFound, sendError,
} from "../../utils/response.js";

// GET /api/v1/jobs
export async function listJobs(req, res, next) {
  try {
    const { jobs, total } = await jobsService.getJobs(req.query);
    const page  = parseInt(req.query.page  || "1",  10);
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    sendPaginated(res, jobs, { page, limit, total });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/jobs/today
export async function listTodayJobs(req, res, next) {
  try {
    const jobs = await jobsService.getTodayJobs(req.query);
    sendSuccess(res, jobs, { count: jobs.length });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/jobs/recent
export async function listRecentJobs(req, res, next) {
  try {
    const jobs = await jobsService.getRecentJobs(req.query);
    sendSuccess(res, jobs, { count: jobs.length });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/jobs/week
export async function listWeekJobs(req, res, next) {
  try {
    const jobs = await jobsService.getWeekJobs(req.query);
    sendSuccess(res, jobs, { count: jobs.length });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/jobs/:id
export async function getJob(req, res, next) {
  try {
    const job = await jobsService.getJobById(req.params.id);
    sendSuccess(res, job);
  } catch (err) {
    if (err.statusCode === 404) return sendNotFound(res, "Job");
    next(err);
  }
}

// GET /api/v1/companies
export async function listCompanies(req, res, next) {
  try {
    const companies = await companiesRepo.findAllCompanies();
    sendSuccess(res, companies, { count: companies.length });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/companies/:id/jobs
export async function listCompanyJobs(req, res, next) {
  try {
    const company = await companiesRepo.findCompanyById(req.params.id);
    if (!company) return sendNotFound(res, "Company");

    const page  = parseInt(req.query.page  || "1",  10);
    const limit = parseInt(req.query.limit || "20", 10);
    const { jobs, total } = await companiesRepo.findJobsByCompany(req.params.id, { page, limit });
    sendPaginated(res, jobs, { page, limit, total });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/channels
export async function listChannels(req, res, next) {
  try {
    const channels = await channelsRepo.findAllChannels();
    sendSuccess(res, channels, { count: channels.length });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────
// Internal routes (called by Python scraper)
// ─────────────────────────────────────────────

// POST /api/v1/internal/jobs
export async function ingestJob(req, res, next) {
  try {
    const job = await jobsService.ingestJob(req.body);
    sendSuccess(res, job, {}, 201);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/internal/known-links
export async function getKnownLinks(req, res, next) {
  try {
    const { links } = await jobsService.getKnownLinksAndHashes();
    sendSuccess(res, { links });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/internal/known-hashes
export async function getKnownHashes(req, res, next) {
  try {
    const { hashes } = await jobsService.getKnownLinksAndHashes();
    sendSuccess(res, { hashes });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/internal/recent-texts
export async function getRecentTexts(req, res, next) {
  try {
    const days  = parseInt(req.query.days || "7", 10);
    const texts = await jobsService.getRecentTexts(days);
    sendSuccess(res, { texts });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/internal/channels/:username
export async function upsertChannel(req, res, next) {
  try {
    const channel = await channelsRepo.upsertChannel({
      username: req.params.username,
      ...req.body,
    });
    sendSuccess(res, channel);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/internal/scrape-logs
export async function createScrapeLog(req, res, next) {
  try {
    await channelsRepo.logScrape(req.body);
    sendSuccess(res, { logged: true });
  } catch (err) {
    next(err);
  }
}
