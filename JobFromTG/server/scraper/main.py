"""
scraper/main.py
Orchestration entrypoint — wires all modules together.
This file contains NO business logic. It only coordinates the pipeline:

  ChannelScraper → DuplicateDetector → JobDetector
       → RegexParser / CerebrasParser → Validator → Database

See ADR-002 and ADR-003 for architecture rationale.
"""

import asyncio
import time
from datetime import timezone

from scraper.config        import CHANNELS, REGEX_MIN_FIELDS
from scraper.telegram_client   import disconnect_client
from scraper.channel_scraper   import ChannelScraper
from scraper.duplicate_detector import DuplicateDetector
from scraper.job_detector      import JobDetector
from scraper.regex_parser      import RegexParser
from scraper.cerebras_parser   import CerebrasParser
from scraper.validator         import (
    normalize_location, normalize_employment_type, normalize_experience_level,
    normalize_education_level, normalize_salary, normalize_deadline,
    normalize_company_name, infer_category,
)
from scraper.database          import ScraperDatabaseClient
from scraper.utils             import compute_content_hash


async def run_pipeline() -> None:
    """Execute the full scraping pipeline end-to-end."""

    print("\n" + "=" * 60)
    print("  JobFeed v2 — Scraper Pipeline Starting")
    print("=" * 60)

    t_start = time.monotonic()

    # ── Instantiate all modules ──────────────────────────────────
    db              = ScraperDatabaseClient()
    channel_scraper = ChannelScraper()
    job_detector    = JobDetector()
    regex_parser    = RegexParser()
    cerebras_parser = CerebrasParser()

    # ── Pre-load deduplication data from DB ─────────────────────
    print("\n[Pipeline] Loading deduplication data from database...")
    known_links  = await db.get_known_links()
    known_hashes = await db.get_known_hashes()
    recent_texts = await db.get_recent_texts()
    print(f"[Pipeline] Loaded {len(known_links)} links, {len(known_hashes)} hashes, "
          f"{len(recent_texts)} recent texts.")

    dedup = DuplicateDetector(
        known_links  = known_links,
        known_hashes = known_hashes,
        recent_texts = recent_texts,
    )

    # ── Ensure all channels exist in the DB ─────────────────────
    for channel in CHANNELS:
        await db.upsert_channel(channel)

    # ── Scrape all channels ──────────────────────────────────────
    all_messages = await channel_scraper.scrape_channels(CHANNELS)

    # ── Per-channel counters ─────────────────────────────────────
    total_scanned  = 0
    total_jobs     = 0
    total_inserted = 0
    total_dupes    = 0
    total_ai_calls = 0

    # ── Process each message ─────────────────────────────────────
    for channel_config in CHANNELS:
        username      = channel_config["username"]
        is_narrative  = channel_config.get("is_narrative", False)
        messages      = all_messages.get(username, [])
        ch_inserted   = 0
        ch_dupes      = 0
        ch_ai_calls   = 0
        ch_start      = time.monotonic()

        print(f"\n[{username}] Processing {len(messages)} messages...")

        for msg in messages:
            total_scanned += 1

            # ── Step 1: Duplicate detection ──────────────────────
            dupe_result = dedup.check(msg.text, msg.telegram_link)
            if dupe_result.is_duplicate:
                ch_dupes += 1
                total_dupes += 1
                continue

            # ── Step 2: Job detection (confidence scoring) ───────
            detection = job_detector.detect(msg.text, is_narrative_channel=is_narrative)

            if not detection.is_job:
                # Score < JOB_LOW_CONFIDENCE — not a job post
                continue

            total_jobs += 1

            # ── Step 3: Extraction ───────────────────────────────
            use_ai   = detection.needs_ai or is_narrative
            parsed   = None
            method   = "REGEX"
            ai_meta  = None

            if not use_ai:
                # High confidence — try regex first
                parsed = regex_parser.parse(msg.text)
                if parsed.non_empty_field_count() < REGEX_MIN_FIELDS:
                    # Regex yielded too few fields — fall back to AI
                    use_ai = True

            if use_ai:
                method      = "CEREBRAS_AI"
                ch_ai_calls += 1
                total_ai_calls += 1
                ai_result = await cerebras_parser.parse(msg.text)

                if not ai_result.is_valid:
                    print(f"  [AI] Extraction failed for {msg.telegram_link}: {ai_result.error_message}")
                    # Fall back to whatever regex got
                    if parsed is None:
                        parsed = regex_parser.parse(msg.text)
                else:
                    # Map AI result to the same shape as ParsedJob
                    from scraper.regex_parser import ParsedJob
                    parsed = ParsedJob(
                        title             = ai_result.title,
                        company           = ai_result.company,
                        location          = ai_result.location,
                        salary_raw        = ai_result.salary_raw,
                        employment_type   = ai_result.employment_type,
                        experience_raw    = ai_result.experience_raw,
                        education_raw     = ai_result.education_raw,
                        deadline_raw      = ai_result.deadline_raw,
                        skills            = ai_result.skills,
                        email             = ai_result.email,
                        phone             = ai_result.phone,
                        application_url   = ai_result.application_url,
                        responsibilities  = ai_result.responsibilities,
                        requirements      = ai_result.requirements,
                        benefits          = ai_result.benefits,
                        application_method= ai_result.application_method,
                    )
                    ai_meta = {
                        "model":            "llama-3.3-70b",
                        "rawResponse":      ai_result.raw_response,
                        "promptTokens":     ai_result.prompt_tokens,
                        "completionTokens": ai_result.completion_tokens,
                        "latencyMs":        ai_result.latency_ms,
                        "isValid":          ai_result.is_valid,
                    }

            if parsed is None:
                continue

            # ── Step 4: Normalize ────────────────────────────────
            salary_min, salary_max, currency = normalize_salary(parsed.salary_raw)
            deadline_date                    = normalize_deadline(parsed.deadline_raw)
            location_normalized              = normalize_location(parsed.location)
            employment_type_normalized       = normalize_employment_type(parsed.employment_type)
            experience_level_normalized      = normalize_experience_level(parsed.experience_raw)
            education_level_normalized       = normalize_education_level(parsed.education_raw)
            company_name_normalized          = normalize_company_name(parsed.company)
            category_name                    = infer_category(parsed.title, msg.text)
            content_hash                     = compute_content_hash(msg.text)

            # ── Step 5: Build DB payload ─────────────────────────
            job_payload = {
                "title":               parsed.title or "Untitled Position",
                "description":         msg.text,
                "salaryMin":           salary_min,
                "salaryMax":           salary_max,
                "salaryCurrency":      currency,
                "salaryRaw":           parsed.salary_raw,
                "employmentType":      employment_type_normalized,
                "experienceLevel":     experience_level_normalized,
                "experienceRaw":       parsed.experience_raw,
                "educationLevel":      education_level_normalized,
                "educationRaw":        parsed.education_raw,
                "email":               parsed.email,
                "phone":               parsed.phone,
                "applicationUrl":      parsed.application_url,
                "applicationMethod":   parsed.application_method,
                "responsibilities":    parsed.responsibilities,
                "requirements":        parsed.requirements,
                "benefits":            parsed.benefits,
                "skills":              parsed.skills,
                "contentHash":         content_hash,
                "telegramMessageLink": msg.telegram_link,
                "confidenceScore":     detection.confidence_score,
                "extractionMethod":    method,
                "postedAt":            msg.date.replace(tzinfo=timezone.utc).isoformat(),
                "deadline":            deadline_date.isoformat() if deadline_date else None,
                # Nested objects for upsert/connect
                "companyName":         company_name_normalized,
                "locationName":        location_normalized,
                "categoryName":        category_name,
                "channelUsername":     username,
                "messageId":           msg.message_id,
                "messageViews":        msg.views,
                "messageForwards":     msg.forwards,
                # AI metadata (if used)
                "aiExtraction":        ai_meta,
            }

            # ── Step 6: Persist ──────────────────────────────────
            result = await db.insert_job(job_payload)
            if result:
                ch_inserted += 1
                total_inserted += 1
                # Register in dedup so subsequent messages in this run are checked
                dedup.register(msg.text, msg.telegram_link)

        # ── Per-channel summary + log ────────────────────────────
        duration_ms = int((time.monotonic() - ch_start) * 1000)
        print(
            f"[{username}] Done → inserted: {ch_inserted} | "
            f"dupes: {ch_dupes} | AI calls: {ch_ai_calls} | "
            f"time: {duration_ms}ms"
        )

        await db.log_scrape({
            "channelUsername": username,
            "status":          "SUCCESS",
            "messagesScanned": len(messages),
            "jobsFound":       total_jobs,
            "jobsInserted":    ch_inserted,
            "duplicatesFound": ch_dupes,
            "aiCallsMade":     ch_ai_calls,
            "durationMs":      duration_ms,
        })

    # ── Final summary ────────────────────────────────────────────
    total_duration = int((time.monotonic() - t_start) * 1000)
    print("\n" + "=" * 60)
    print("  Pipeline Complete")
    print(f"  Scanned:   {total_scanned} messages")
    print(f"  Jobs found:{total_jobs}")
    print(f"  Inserted:  {total_inserted}")
    print(f"  Dupes:     {total_dupes}")
    print(f"  AI calls:  {total_ai_calls}")
    print(f"  Duration:  {total_duration / 1000:.1f}s")
    print("=" * 60)

    await disconnect_client()


if __name__ == "__main__":
    asyncio.run(run_pipeline())
