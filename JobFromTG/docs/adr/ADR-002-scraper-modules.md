# ADR-002: Modular Python Scraper Architecture

**Status:** Accepted  
**Date:** 2026-07-28  
**Deciders:** Engineering Team

---

## Context

The existing `telegram_scraper.py` is a 199-line monolith that performs five distinct responsibilities in a single file:

1. Telegram API connection management
2. Channel iteration and message fetching
3. Text cleaning and parsing (`clean_text`, `parse_job`)
4. Deduplication via a `seen` set
5. File I/O (writing `jobs.json`)

Additionally, `export_raw_messages.py` duplicates the Telegram connection logic with hardcoded credentials.

Problems:
- Cannot unit-test any single concern in isolation
- Credentials are hardcoded in source code (`API_ID = 34122130`)
- No retry logic — one failed channel silently skips all messages
- No confidence scoring — a simple keyword list decides what is a job
- No AI fallback for ambiguous / narrative posts
- No normalization — "Addis" and "Addis Ababa" become different records

---

## Decision

Split the scraper into **11 single-responsibility Python modules** under `server/scraper/`.

---

## Module Responsibilities

| Module | Responsibility |
|---|---|
| `config.py` | All constants and environment variables (no hardcoding) |
| `utils.py` | Text cleaning, hashing, shared helpers |
| `telegram_client.py` | Telethon client lifecycle only |
| `channel_scraper.py` | Channel iteration, raw message fetching |
| `duplicate_detector.py` | Three-strategy dedup: link, hash, similarity |
| `job_detector.py` | Confidence scoring (0–100) |
| `regex_parser.py` | Structured field extraction via regex |
| `cerebras_parser.py` | AI extraction for ambiguous posts |
| `validator.py` | Data normalization (locations, types, levels) |
| `database.py` | PostgreSQL persistence via HTTP API |
| `main.py` | Orchestration only — no business logic |

---

## Alternatives Considered

| Option | Decision |
|---|---|
| Keep monolith, add functions inside it | ❌ Rejected — untestable, still one responsibility boundary |
| Separate microservices (scraper, parser, AI each as a service) | ❌ Rejected — over-engineering at this scale |
| **Single-repo modules with clear interfaces** | ✅ Accepted — testable, readable, deployable as one process |

---

## Rationale

- **Single Responsibility Principle (SRP):** Each module has one reason to change.
- **Testability:** `job_detector.py` can be unit-tested with mock text without starting Telegram.
- **Configurability:** Thresholds (e.g. `JOB_CONFIDENCE_THRESHOLD = 70`) live in `config.py` and are overridable via environment variables.
- **Reusability:** `regex_parser.py` and `validator.py` can be called from both the scraper and a future re-processing script.

---

## Consequences

- **Positive:** Each module is independently testable and replaceable.
- **Positive:** `export_raw_messages.py` is absorbed into `channel_scraper.py` — no duplicate Telegram connection code.
- **Positive:** Credentials come from environment variables only.
- **Migration note:** The existing `telegram_scraper.py` logic is fully preserved and redistributed — `clean_text` → `utils.py`, `parse_job` → `regex_parser.py`, `scrape()` loop → `channel_scraper.py` + `main.py`.
