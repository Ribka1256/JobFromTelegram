/**
 * src/utils/categorize.js
 *
 * DEPRECATED for v2 — category, job_type, and experience_level
 * are now stored in the database and returned by the API.
 *
 * These functions are kept as a FALLBACK only, used when displaying
 * jobs that were saved to localStorage before the v2 migration
 * (i.e. items in the Favorites list that were saved in v1 format).
 *
 * For all new API responses, use the fields directly:
 *   job.category.name        (was: getJobCategory(job))
 *   job.employmentType       (was: getJobType(job))
 *   job.experienceLevel      (was: getExperienceLevel(job))
 *
 * See validator.py for the authoritative backend normalization logic.
 */

const categoryKeywords = {
  Engineering:    ["engineer", "developer", "software", "backend", "frontend", "devops", "qa", "data engineer"],
  Design:         ["designer", "ux", "ui", "graphic", "product design"],
  Marketing:      ["marketing", "seo", "content strategist", "brand", "social media", "growth"],
  Content:        ["content writer", "copywriter", "editor", "content creator"],
  "Data Science": ["data scientist", "data analyst", "machine learning", "ml engineer", "ai engineer"],
  Finance:        ["accountant", "finance", "auditor", "bookkeeper"],
  HR:             ["human resources", "hr ", "recruitment officer", "talent acquisition"],
  Service:        ["customer service", "barista", "server", "retail", "support", "kitchen staff"],
};

/** @deprecated Use job.category.name from API response instead. */
export function getJobCategory(job) {
  // v2 API: category is a nested object
  if (job.category?.name) return job.category.name;
  // v1 fallback: derive from text
  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) return category;
  }
  return "Other";
}

/** @deprecated Use job.employmentType from API response instead. */
export function getJobType(job) {
  // v2 API: employmentType is already normalized
  if (job.employmentType && job.employmentType !== "UNKNOWN") {
    const map = {
      FULL_TIME:  "Full-time",
      PART_TIME:  "Part-time",
      CONTRACT:   "Contract",
      INTERNSHIP: "Internship",
      REMOTE:     "Remote",
      FREELANCE:  "Freelance",
    };
    return map[job.employmentType] || job.employmentType;
  }
  // v1 fallback
  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();
  if (text.includes("part-time") || text.includes("part time")) return "Part-time";
  if (text.includes("contract"))  return "Contract";
  if (text.includes("internship") || text.includes("intern")) return "Internship";
  if (text.includes("remote"))    return "Remote";
  return "Full-time";
}

/** @deprecated Use job.experienceLevel from API response instead. */
export function getExperienceLevel(job) {
  // v2 API: experienceLevel is already normalized
  if (job.experienceLevel && job.experienceLevel !== "UNKNOWN") {
    const map = {
      ENTRY:     "Entry Level",
      MID:       "Mid Level",
      SENIOR:    "Senior",
      LEAD:      "Lead",
      EXECUTIVE: "Executive",
    };
    return map[job.experienceLevel] || job.experienceLevel;
  }
  // v1 fallback
  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();
  if (text.includes("lead") || text.includes("head of") || text.includes("principal")) return "Lead";
  if (text.includes("senior") || text.includes("sr.") || text.includes("sr "))         return "Senior";
  if (text.includes("mid") || text.includes("intermediate") || text.includes("ii"))    return "Mid Level";
  if (text.includes("junior") || text.includes("entry") || text.includes("graduate"))  return "Entry Level";
  return "Mid Level";
}