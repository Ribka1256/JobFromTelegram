"""
server/scripts/migrate_json_to_db.py
One-time migration script: reads jobs.json and imports existing scraped
jobs into PostgreSQL via the Express API.

Run AFTER:
  1. npx prisma db push (schema applied)
  2. npm start (Express API running on port 5000)
  3. python scripts/seed_channels.py (channels seeded)

Usage:
  python scripts/migrate_json_to_db.py
  python scripts/migrate_json_to_db.py --file path/to/other.json
  python scripts/migrate_json_to_db.py --dry-run
"""

import asyncio
import json
import sys
import os
import argparse
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scraper.config    import API_BASE_URL
from scraper.utils     import compute_content_hash
from scraper.validator import (
    normalize_location, normalize_employment_type,
    normalize_experience_level, normalize_education_level,
    normalize_salary, normalize_deadline,
    normalize_company_name, infer_category,
)
from scraper.database  import ScraperDatabaseClient


def build_payload_from_v1(job: dict) -> dict:
    """Convert a v1 jobs.json record to the v2 API ingestion payload."""

    raw_text = job.get("description", "")
    title    = job.get("title", "Untitled Position")

    salary_min, salary_max, currency = normalize_salary(None)
    deadline_date = normalize_deadline(job.get("deadline"))

    return {
        "title":               title,
        "description":         raw_text,
        "salaryMin":           salary_min,
        "salaryMax":           salary_max,
        "salaryCurrency":      currency,
        "salaryRaw":           None,
        "employmentType":      "UNKNOWN",
        "experienceLevel":     normalize_experience_level(None),
        "educationLevel":      normalize_education_level(None),
        "email":               None,
        "phone":               None,
        "applicationUrl":      job.get("share_link"),
        "applicationMethod":   None,
        "responsibilities":    [],
        "requirements":        [],
        "benefits":            [],
        "skills":              [],
        "contentHash":         compute_content_hash(raw_text),
        "telegramMessageLink": job.get("share_link", f"migrated-{job.get('id', '')}"),
        "confidenceScore":     60,           # Conservative — we don't know original score
        "extractionMethod":    "REGEX",
        "postedAt":            job.get("posted_at") or "2026-01-01T00:00:00Z",
        "deadline":            deadline_date.isoformat() if deadline_date else None,
        "companyName":         normalize_company_name(job.get("company_name")),
        "locationName":        normalize_location(job.get("location")),
        "categoryName":        infer_category(title, raw_text),
        "channelUsername":     job.get("source", "").replace("telegram_", "") or "ethiojobsofficial",
        "messageId":           int(job.get("id", 0)) if str(job.get("id", "")).isdigit() else 0,
        "messageViews":        None,
        "messageForwards":     None,
        "aiExtraction":        None,
    }


async def migrate(json_path: Path, dry_run: bool) -> None:
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Migrating jobs from {json_path}")

    with open(json_path, "r", encoding="utf-8") as f:
        v1_jobs = json.load(f)

    print(f"Found {len(v1_jobs)} jobs in {json_path.name}")

    if dry_run:
        print("\n[DRY RUN] First 3 payloads:\n")
        for job in v1_jobs[:3]:
            payload = build_payload_from_v1(job)
            print(json.dumps(payload, indent=2, default=str))
        return

    db = ScraperDatabaseClient(API_BASE_URL)
    inserted = 0
    skipped  = 0
    failed   = 0

    for i, job in enumerate(v1_jobs, 1):
        payload = build_payload_from_v1(job)

        # Skip if content hash would be empty (no description)
        if not payload["description"].strip():
            skipped += 1
            continue

        result = await db.insert_job(payload)
        if result:
            inserted += 1
        else:
            skipped += 1   # Duplicate or error (logged inside insert_job)

        if i % 50 == 0:
            print(f"  Progress: {i}/{len(v1_jobs)} — inserted: {inserted}, skipped: {skipped}")

    print(f"\n[DONE] Migration complete.")
    print(f"   Inserted: {inserted}")
    print(f"   Skipped:  {skipped}  (duplicates / no description)")
    print(f"   Failed:   {failed}")


def main():
    parser = argparse.ArgumentParser(description="Migrate jobs.json → PostgreSQL")
    parser.add_argument("--file",    default="../jobs.json", help="Path to jobs.json")
    parser.add_argument("--dry-run", action="store_true",   help="Print payloads without inserting")
    args = parser.parse_args()

    json_path = Path(args.file).resolve()
    if not json_path.exists():
        print(f"Error: {json_path} not found.")
        sys.exit(1)

    asyncio.run(migrate(json_path, args.dry_run))


if __name__ == "__main__":
    main()
