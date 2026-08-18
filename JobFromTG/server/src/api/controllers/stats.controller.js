/**
 * src/api/controllers/stats.controller.js
 * HTTP layer for statistics endpoints.
 */

import * as statsService    from "../../services/stats.service.js";
import { getLastSyncTime }  from "../../services/sync-state.service.js";
import { sendSuccess }      from "../../utils/response.js";

// GET /api/v1/stats
export async function getStats(req, res, next) {
  try {
    const stats = await statsService.getOverallStats();
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/stats/categories
export async function getCategoryBreakdown(req, res, next) {
  try {
    const data = await statsService.getCategoryBreakdown();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/stats/employment-types
export async function getEmploymentTypeBreakdown(req, res, next) {
  try {
    const data = await statsService.getEmploymentTypeBreakdown();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/stats/locations
export async function getTopLocations(req, res, next) {
  try {
    const data = await statsService.getTopLocations();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/stats/sync
// Returns the last successful sync timestamp. Safe for public access —
// contains no credentials or internal details.
export async function getSyncStatus(req, res, next) {
  try {
    const data = await getLastSyncTime();
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
}
