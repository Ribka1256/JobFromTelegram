/**
 * src/service/api.js
 * Frontend API client — updated for v2 architecture.
 *
 * Changes from v1:
 * - Base URL now points to /api/v1/jobs (was /jobs)
 * - Added getJobById, getTodayJobs, getRecentJobs, getStats, getCategories
 * - Added proper error handling with typed error messages
 * - The old /jobs endpoint still works via server redirect (ADR-004)
 */

const BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/v1`;

async function apiFetch(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Request failed: ${response.status}`);
  }
  const json = await response.json();
  // Unwrap the { success, data, meta } envelope
  return { data: json.data, meta: json.meta };
}

// ── Jobs ────────────────────────────────────────────────────

/**
 * Fetch a paginated, filterable list of jobs.
 * @param {Object} params - page, limit, q, category, location,
 *                          employment_type, experience_level, channel,
 *                          today, sort, order
 */
export const getJobs = async (params = {}) => {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== "")
  ).toString();
  const { data, meta } = await apiFetch(`${BASE}/jobs${qs ? "?" + qs : ""}`);
  return { jobs: data, meta };
};

/**
 * Search jobs by keyword — wraps getJobs with q param.
 * Preserved for backward compat with existing Home.jsx usage.
 */
export const searchJobs = async (query) => {
  const { jobs } = await getJobs({ q: query });
  return jobs;
};

/** Get a single job by ID. */
export const getJobById = async (id) => {
  const { data } = await apiFetch(`${BASE}/jobs/${id}`);
  return data;
};

/** Get jobs posted today. */
export const getTodayJobs = async (limit = 50) => {
  const { data } = await apiFetch(`${BASE}/jobs/today?limit=${limit}`);
  return data;
};

/** Get jobs from the last N days (default 14 for "Recent" tab). */
export const getRecentJobs = async (days = 14, limit = 50) => {
  const { data } = await apiFetch(`${BASE}/jobs/recent?days=${days}&limit=${limit}`);
  return data;
};

/** Get jobs from the last 7 days (dedicated This Week tab). */
export const getWeekJobs = async (limit = 50) => {
  const { data } = await apiFetch(`${BASE}/jobs/week?limit=${limit}`);
  return data;
};

// ── Stats ───────────────────────────────────────────────────

/** Get overall platform statistics. */
export const getStats = async () => {
  const { data } = await apiFetch(`${BASE}/stats`);
  return data;
};

/** Get job counts grouped by category. */
export const getCategories = async () => {
  const { data } = await apiFetch(`${BASE}/stats/categories`);
  return data;
};

/** Get top locations by job count. */
export const getTopLocations = async () => {
  const { data } = await apiFetch(`${BASE}/stats/locations`);
  return data;
};

// ── Companies ───────────────────────────────────────────────

/** Get all companies with job counts. */
export const getCompanies = async () => {
  const { data } = await apiFetch(`${BASE}/companies`);
  return data;
};

/** Get jobs for a specific company. */
export const getCompanyJobs = async (companyId, page = 1) => {
  const { data, meta } = await apiFetch(`${BASE}/companies/${companyId}/jobs?page=${page}`);
  return { jobs: data, meta };
};

// ── Channels ────────────────────────────────────────────────

/** Get all scraped Telegram channels. */
export const getChannels = async () => {
  const { data } = await apiFetch(`${BASE}/channels`);
  return data;
};

// ── Sync ─────────────────────────────────────────────────────

/**
 * Trigger a full sync: scrape Telegram → import into DB.
 * Returns { syncId } immediately; poll getSyncStatus() for progress.
 */
export const startSync = async () => {
  const res = await fetch(`${BASE}/internal/sync`, { method: "POST" });
  const json = await res.json();
  return json.data;
};

/** Poll the status of the current/latest sync. */
export const getSyncStatus = async () => {
  const res = await fetch(`${BASE}/internal/sync/status`);
  const json = await res.json();
  return json.data;
};

/**
 * Fetch the last successful pipeline sync timestamp.
 * Used by the navbar sync indicator.
 * Returns null gracefully on network errors so the navbar never breaks.
 */
export const getSyncTime = async () => {
  try {
    const { data } = await apiFetch(`${BASE}/stats/sync`);
    return data;
  } catch {
    return null;
  }
};