// utils/categorize.js
const categoryKeywords = {
  Engineering: ["engineer", "developer", "software", "backend", "frontend", "devops", "qa", "data engineer"],
  Design: ["designer", "ux", "ui", "graphic", "product design"],
  Marketing: ["marketing", "seo", "content strategist", "brand", "social media", "growth"],
  Content: ["content writer", "copywriter", "editor", "content creator"],
  "Data Science": ["data scientist", "data analyst", "machine learning", "ml engineer", "ai engineer"],
  Service: ["customer service", "barista", "server", "retail", "support representative", "kitchen staff"],
};

export function getJobCategory(job) {
  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) return category;
  }
  return "Other";
}

// Derives job type from title/description
export function getJobType(job) {
  const text = `${job.title || ""} ${job.description || ""} ${job.detected_extensions?.schedule_type || ""}`.toLowerCase();
  if (text.includes("part-time") || text.includes("part time")) return "Part-time";
  if (text.includes("contract")) return "Contract";
  if (text.includes("internship") || text.includes("intern")) return "Internship";
  if (text.includes("remote")) return "Remote";
  return "Full-time"; // default
}

// Derives experience level from title/description
export function getExperienceLevel(job) {
  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();
  if (text.includes("lead") || text.includes("head of") || text.includes("principal")) return "Lead";
  if (text.includes("senior") || text.includes("sr.") || text.includes("sr ")) return "Senior";
  if (text.includes("mid") || text.includes("intermediate") || text.includes("ii")) return "Mid Level";
  if (text.includes("junior") || text.includes("entry") || text.includes("graduate") || text.includes("trainee")) return "Entry Level";
  return "Mid Level"; // default
}