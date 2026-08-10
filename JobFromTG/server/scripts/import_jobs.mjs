/**
 * scripts/import_jobs.mjs
 * Fast Node.js importer: reads jobs.json → POST to API.
 * Runs batched with concurrency control so it won't overwhelm the server.
 *
 * Usage:
 *   node scripts/import_jobs.mjs
 *   node scripts/import_jobs.mjs --file path/to/jobs.json
 */

import { readFileSync } from "fs";
import { createHash }   from "crypto";
import { resolve }      from "path";

const API_BASE  = "http://localhost:5000/api/v1";
const FILE_ARG  = process.argv.find(a => a.startsWith("--file="))?.split("=")[1];
const JSON_FILE = resolve(FILE_ARG ?? "jobs.json");
const CONCURRENCY = 5;   // parallel requests at once

// ── Helpers ──────────────────────────────────────────────────
function hash(text) {
  return createHash("sha256").update(text || "").digest("hex");
}

function inferCategory(title = "", text = "") {
  const t = (title + " " + text).toLowerCase();
  if (/engineer|developer|software|devops|frontend|backend|fullstack|it |tech|system|network|data scientist|ml |ai /.test(t)) return "Engineering";
  if (/design|ui\/ux|graphic|ux |creative|motion/.test(t)) return "Design";
  if (/market|brand|social media|digital market|seo|content market/.test(t)) return "Marketing";
  if (/content|writ|editor|journalist|copywrite/.test(t)) return "Content";
  if (/data analyst|data entry|analyst|business intel|reporting/.test(t)) return "Data Science";
  if (/financ|account|audit|bookkeep|tax|treasury|budget/.test(t)) return "Finance";
  if (/hr |human resource|recruit|talent|payroll|staff/.test(t)) return "HR";
  if (/sales|business dev|biz dev|client|customer success/.test(t)) return "Sales";
  if (/health|medical|nurse|doctor|pharma|clinic|hospital/.test(t)) return "Healthcare";
  if (/legal|lawyer|attorney|compliance|contract/.test(t)) return "Legal";
  if (/operation|logistics|supply chain|procurement|admin/.test(t)) return "Operations";
  if (/ngo|nonprofit|charity|volunteer|humanitarian/.test(t)) return "NGO";
  if (/education|teach|train|tutor|school|university/.test(t)) return "Education";
  return null;
}

function parseDeadline(raw = "") {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (!isNaN(d)) return d.toISOString();
  } catch {}
  return null;
}

function buildPayload(job) {
  const text  = job.description || "";
  const title = job.title       || "Untitled Position";
  return {
    title,
    description:         text,
    salaryMin:           null,
    salaryMax:           null,
    salaryCurrency:      "ETB",
    salaryRaw:           null,
    employmentType:      "UNKNOWN",
    experienceLevel:     "UNKNOWN",
    educationLevel:      "UNKNOWN",
    email:               null,
    phone:               null,
    applicationUrl:      job.share_link || null,
    applicationMethod:   null,
    responsibilities:    [],
    requirements:        [],
    benefits:            [],
    skills:              [],
    contentHash:         hash(text),
    telegramMessageLink: job.share_link || `migrated-${job.id || Math.random()}`,
    confidenceScore:     60,
    extractionMethod:    "REGEX",
    postedAt:            job.posted_at  || new Date().toISOString(),
    deadline:            parseDeadline(job.deadline),
    companyName:         job.company_name || null,
    locationName:        job.location    || "Ethiopia",
    categoryName:        inferCategory(title, text),
    channelUsername:     "ethiojobsofficial",  // default
    messageId:           parseInt(job.id) || 0,
    messageViews:        null,
    messageForwards:     null,
    aiExtraction:        null,
  };
}

async function postJob(payload) {
  const res = await fetch(`${API_BASE}/internal/jobs`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  return res.status; // 201 = inserted, 409/500 = duplicate/error
}

// ── Concurrent batch runner ───────────────────────────────────
async function runBatch(tasks) {
  const results = await Promise.allSettled(tasks.map(fn => fn()));
  return results;
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log(`\nReading ${JSON_FILE} …`);
  const jobs = JSON.parse(readFileSync(JSON_FILE, "utf8"));
  console.log(`Found ${jobs.length} jobs. Inserting (concurrency=${CONCURRENCY})…\n`);

  let inserted = 0, skipped = 0, failed = 0;
  const total = jobs.length;

  for (let i = 0; i < total; i += CONCURRENCY) {
    const slice = jobs.slice(i, i + CONCURRENCY);
    const tasks = slice.map(job => async () => {
      if (!job.description?.trim()) { skipped++; return; }
      try {
        const status = await postJob(buildPayload(job));
        if (status === 201) inserted++;
        else skipped++;   // duplicate / conflict
      } catch (err) {
        failed++;
      }
    });

    await runBatch(tasks);

    if ((i + CONCURRENCY) % 50 === 0 || i + CONCURRENCY >= total) {
      const done = Math.min(i + CONCURRENCY, total);
      process.stdout.write(
        `\r  Progress: ${done}/${total} — ✅ inserted: ${inserted}  ⏭  skipped: ${skipped}  ❌ failed: ${failed}   `
      );
    }
  }

  console.log(`\n\n[DONE]`);
  console.log(`  ✅ Inserted : ${inserted}`);
  console.log(`  ⏭  Skipped  : ${skipped}  (duplicates or empty)`);
  console.log(`  ❌ Failed   : ${failed}`);
  console.log(`\nOpen http://localhost:5173 and click ↻ Reload to see the jobs!\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
