# ADR-003: Hybrid Extraction — Regex First, Cerebras AI Fallback

**Status:** Accepted  
**Date:** 2026-07-28  
**Deciders:** Engineering Team

---

## Context

Ethiopian Telegram job posts come in two fundamentally different formats:

**Format A — Structured (regex-friendly):**
```
Job Title: Software Engineer
Company: Kifiya Financial Technology
Location: Addis Ababa
Salary: 25,000 – 35,000 ETB
Deadline: August 15, 2026
```

**Format B — Narrative (AI-required):**
```
🚀 We're growing! Our team at Harambe Tech needs someone awesome 
who knows Python and has done backend work before. If interested 
shoot us an email at jobs@harambe.tech before the 20th!
```

The current scraper applies the same parse_job() regex to both formats. Format B produces empty fields for company, location, and deadline — resulting in "See description", "Ethiopia", "" being stored.

Additionally, the `CEREBRAS_API_KEY` is already present in `.env` but completely unused.

---

## Decision

Implement a **two-track extraction pipeline** driven by the `job_detector.py` confidence score:

```
confidence >= 70  →  Regex Extraction (regex_parser.py)
confidence 50-69  →  Cerebras AI Extraction (cerebras_parser.py)
confidence < 50   →  Discard (not a job post)
```

Additionally, even for high-confidence structured posts:
- If regex extraction returns < 3 non-empty fields → fall back to Cerebras
- Channel-level flag: some channels are known to be narrative-only

---

## Alternatives Considered

| Option | Decision |
|---|---|
| AI for everything | ❌ Too slow, too expensive; most posts ARE structured |
| Regex for everything | ❌ Already proven broken for Format B posts |
| spaCy / local NLP | ❌ Requires model download, GPU for good results; overkill |
| **Regex first + Cerebras fallback** | ✅ Fast for structured, intelligent for ambiguous |

---

## Cerebras Integration Details

- **Model:** `llama-3.3-70b` (fast, accurate, low latency via Cerebras hardware)
- **Prompt strategy:** System prompt specifies exact JSON schema. No free text allowed in response.
- **Validation:** AI output is validated against a Pydantic model before saving. Invalid AI responses are logged and discarded, not silently stored.
- **Rate limiting:** Cerebras calls are batched. Retry with exponential backoff on 429/503.
- **Cost control:** Only triggered when confidence 50–69 OR regex yields < 3 fields.

---

## AI Output Schema (enforced)

```json
{
  "title": "string | null",
  "company": "string | null",
  "location": "string | null",
  "salary_min": "number | null",
  "salary_max": "number | null",
  "employment_type": "FULL_TIME | PART_TIME | CONTRACT | INTERNSHIP | REMOTE | null",
  "experience_years_min": "number | null",
  "education_level": "CERTIFICATE | DIPLOMA | BACHELOR | MASTER | PHD | null",
  "deadline": "ISO date string | null",
  "skills": ["string"],
  "email": "string | null",
  "phone": "string | null",
  "application_url": "string | null"
}
```

---

## Consequences

- **Positive:** Structured posts are parsed fast without hitting AI APIs.
- **Positive:** Narrative posts that previously produced empty fields will now have rich structured data.
- **Positive:** Every AI extraction is stored in `AIExtraction` table for auditability and retraining.
- **Negative:** Cerebras adds latency (~1–2s) per ambiguous post. Mitigated by async processing.
- **Negative:** AI can hallucinate. Mitigated by strict JSON schema validation via Pydantic.
