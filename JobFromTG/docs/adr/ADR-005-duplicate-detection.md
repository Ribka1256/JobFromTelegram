# ADR-005: Three-Strategy Duplicate Detection

**Status:** Accepted  
**Date:** 2026-07-28  
**Deciders:** Engineering Team

---

## Context

The current scraper's deduplication is a single in-memory Python `set` of `share_link` strings:

```python
seen = set()
for job in all_jobs:
    if job["share_link"] not in seen:
        seen.add(job["share_link"])
        unique_jobs.append(job)
```

Problems with this approach:
1. **Session-only:** The `seen` set is empty every time the scraper runs. It cannot detect a job scraped yesterday.
2. **Link-only:** The same job posted in two different channels with different message IDs will be stored twice.
3. **Forwarded posts:** Telegram forwards preserve text but get new `message_id` values — completely bypasses link-based dedup.
4. **Minor edits:** A recruiter posting the same job with a one-word change (e.g. "Vacancy" → "Opening") gets stored twice.

---

## Decision

Implement **three complementary deduplication strategies** with persistence in PostgreSQL:

### Strategy 1 — Telegram Message Link (exact)
- Store the full `https://t.me/{channel}/{message_id}` as `telegram_message_link` with a `UNIQUE` constraint.
- Prevents re-ingesting the exact same message on subsequent scraper runs.
- **This is a DB-level constraint**, not just application-level.

### Strategy 2 — Normalized Content Hash
Before hashing, the raw text is normalized:
1. Strip all emojis (Unicode ranges)
2. Strip markdown (`**`, `__`, `` ` ``, `[]()`)
3. Strip URLs (`https?://\S+`)
4. Strip hashtags (`#\w+`)
5. Strip @usernames (`@\w+`)
6. Lowercase everything
7. Collapse all whitespace to single spaces
8. Strip leading/trailing whitespace

The normalized text is then hashed with SHA-256 and stored as `content_hash` with a `UNIQUE` constraint.

**Why SHA-256?** Collision probability is negligible (~2^-128 for identical normalized content). Fast to compute, no external dependency.

### Strategy 3 — Similarity Detection
For near-duplicate detection (same job, slightly different wording):
- Compute **Jaccard similarity** on 3-gram character shingles of the normalized text.
- If similarity ≥ 0.85 between a new post and any existing post within 7 days, flag as near-duplicate.
- Near-duplicates are stored in `DuplicateJob` table for review, NOT deleted.
- Primary record (older post) is kept; duplicate is marked `is_duplicate = true`.

**Why Jaccard on shingles over edit distance?**  
Edit distance (Levenshtein) is O(n*m) — too slow for comparing each new post against thousands of existing ones. Jaccard on shingles can be accelerated with MinHash / LSH, and Jaccard ≥ 0.85 is a well-calibrated threshold for "same job, minor variation".

---

## Deduplication Order of Operations

```
1. Check telegram_message_link in DB         → if exists: SKIP (exact duplicate)
2. Compute content_hash                       → if exists in DB: SKIP (same content, different link)  
3. Compute shingle similarity vs recent posts → if > 0.85: flag as near-duplicate, still insert
4. No match found                             → INSERT as new job
```

---

## Storage

```sql
-- On jobs table:
telegram_message_link  TEXT UNIQUE NOT NULL
content_hash           TEXT UNIQUE NOT NULL

-- Separate table for near-duplicates:
DuplicateJob {
  id
  original_job_id   FK → Job
  duplicate_job_id  FK → Job
  similarity_score  FLOAT
  strategy          ENUM(LINK, HASH, SIMILARITY)
  detected_at       TIMESTAMP
}
```

---

## Consequences

- **Positive:** Zero duplicate inserts across scraper runs (Strategies 1 + 2 are DB-enforced).
- **Positive:** Forwarded posts and re-posted jobs are detected even across different channels.
- **Positive:** Near-duplicate data is preserved for analysis and future ML training.
- **Positive:** The `DuplicateJob` table provides an audit trail for any disputed classification.
- **Negative:** Similarity check requires loading recent post hashes into memory. Mitigated by limiting the window to 7 days and indexing `posted_at`.
- **Negative:** Aggressive normalization may hash two genuinely different jobs identically if they share all the same boilerplate text. Mitigated by including the job title in the hash input.
