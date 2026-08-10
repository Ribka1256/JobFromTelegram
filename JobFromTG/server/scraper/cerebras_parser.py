"""
scraper/cerebras_parser.py
AI-powered extraction for ambiguous / narrative job posts.
Only invoked when job_detector confidence is 50–69 OR regex extraction
yields fewer than REGEX_MIN_FIELDS filled fields.
See ADR-003 for full rationale.
"""

import json
import asyncio
import aiohttp
from dataclasses import dataclass, field
from scraper.config import CEREBRAS_API_KEY, CEREBRAS_MODEL, MAX_RETRIES, RETRY_DELAY_SEC

CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions"

# ──────────────────────────────────────────────
# System prompt — forces structured JSON output
# ──────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are a structured job data extraction engine for Ethiopian job postings.
Your ONLY job is to extract information from the text and return a valid JSON object.
Return ONLY valid JSON. Do not include any explanation, markdown, or extra text.

Extract the following fields (use null for missing fields):
{
  "title": "Job title string or null",
  "company": "Company name string or null",
  "location": "City/location string or null",
  "salary_raw": "Salary as written in the post or null",
  "employment_type": "One of: FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP, REMOTE, FREELANCE, UNKNOWN",
  "experience_raw": "Experience requirement string or null",
  "education_raw": "Education requirement string or null",
  "deadline_raw": "Application deadline as written or null",
  "skills": ["list", "of", "skills"],
  "email": "email@example.com or null",
  "phone": "+251... or null",
  "application_url": "https://... or null",
  "responsibilities": ["list of responsibility strings"],
  "requirements": ["list of requirement strings"],
  "benefits": ["list of benefit strings"],
  "application_method": "How to apply string or null"
}
"""


@dataclass
class AIParseResult:
    """Validated output from Cerebras extraction."""
    title:              str | None    = None
    company:            str | None    = None
    location:           str | None    = None
    salary_raw:         str | None    = None
    employment_type:    str | None    = None
    experience_raw:     str | None    = None
    education_raw:      str | None    = None
    deadline_raw:       str | None    = None
    skills:             list[str]     = field(default_factory=list)
    email:              str | None    = None
    phone:              str | None    = None
    application_url:    str | None    = None
    responsibilities:   list[str]     = field(default_factory=list)
    requirements:       list[str]     = field(default_factory=list)
    benefits:           list[str]     = field(default_factory=list)
    application_method: str | None    = None
    # Metadata (not from AI, populated by caller)
    raw_response:       str           = ""
    prompt_tokens:      int           = 0
    completion_tokens:  int           = 0
    latency_ms:         int           = 0
    is_valid:           bool          = True
    error_message:      str | None    = None


class CerebrasParser:
    """
    Calls the Cerebras API to extract structured job data from a raw message.
    Validates the JSON response before returning.
    """

    async def parse(self, raw_text: str) -> AIParseResult:
        """
        Send the raw post text to Cerebras and return a validated AIParseResult.
        Retries up to MAX_RETRIES times on transient errors.
        """
        import time

        payload = {
            "model": CEREBRAS_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": raw_text[:4000]},  # Token cap
            ],
            "temperature": 0.1,    # Low temp = consistent structured output
            "max_tokens": 1024,
        }

        headers = {
            "Authorization": f"Bearer {CEREBRAS_API_KEY}",
            "Content-Type": "application/json",
        }

        last_error: str | None = None

        for attempt in range(1, MAX_RETRIES + 1):
            t_start = time.monotonic()
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        CEREBRAS_API_URL,
                        json=payload,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=30),
                    ) as resp:
                        latency_ms = int((time.monotonic() - t_start) * 1000)

                        if resp.status in (429, 503):
                            # Rate limited — back off and retry
                            wait = RETRY_DELAY_SEC * attempt
                            print(f"[Cerebras] Rate limited (attempt {attempt}). Waiting {wait}s...")
                            await asyncio.sleep(wait)
                            continue

                        resp.raise_for_status()
                        data = await resp.json()

            except Exception as exc:
                last_error = str(exc)
                print(f"[Cerebras] Request error (attempt {attempt}): {exc}")
                await asyncio.sleep(RETRY_DELAY_SEC * attempt)
                continue

            # ── Parse and validate response ──────────────────────
            raw_content  = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            usage        = data.get("usage", {})
            prompt_toks  = usage.get("prompt_tokens",     0)
            compl_toks   = usage.get("completion_tokens", 0)

            try:
                parsed_json = json.loads(raw_content)
                result      = self._map_to_result(parsed_json)
                result.raw_response      = raw_content
                result.prompt_tokens     = prompt_toks
                result.completion_tokens = compl_toks
                result.latency_ms        = latency_ms
                return result

            except (json.JSONDecodeError, KeyError, TypeError) as parse_err:
                return AIParseResult(
                    raw_response    = raw_content,
                    prompt_tokens   = prompt_toks,
                    completion_tokens = compl_toks,
                    latency_ms      = latency_ms,
                    is_valid        = False,
                    error_message   = f"JSON parse failed: {parse_err}",
                )

        # All retries exhausted
        return AIParseResult(
            is_valid      = False,
            error_message = f"All {MAX_RETRIES} retries failed. Last error: {last_error}",
        )

    # ──────────────────────────────────────────
    # Response mapping + validation
    # ──────────────────────────────────────────

    @staticmethod
    def _map_to_result(data: dict) -> AIParseResult:
        """Map raw AI JSON to typed AIParseResult. Validates field types."""

        def _str_or_none(key: str) -> str | None:
            val = data.get(key)
            return str(val).strip() if val else None

        def _list_of_str(key: str) -> list[str]:
            val = data.get(key)
            if isinstance(val, list):
                return [str(s).strip() for s in val if s]
            if isinstance(val, str) and val:
                return [val.strip()]
            return []

        VALID_EMPLOYMENT_TYPES = {
            "FULL_TIME", "PART_TIME", "CONTRACT",
            "INTERNSHIP", "REMOTE", "FREELANCE", "UNKNOWN",
        }
        employment_type = _str_or_none("employment_type")
        if employment_type and employment_type.upper() not in VALID_EMPLOYMENT_TYPES:
            employment_type = "UNKNOWN"
        elif employment_type:
            employment_type = employment_type.upper()

        return AIParseResult(
            title             = _str_or_none("title"),
            company           = _str_or_none("company"),
            location          = _str_or_none("location"),
            salary_raw        = _str_or_none("salary_raw"),
            employment_type   = employment_type,
            experience_raw    = _str_or_none("experience_raw"),
            education_raw     = _str_or_none("education_raw"),
            deadline_raw      = _str_or_none("deadline_raw"),
            skills            = _list_of_str("skills"),
            email             = _str_or_none("email"),
            phone             = _str_or_none("phone"),
            application_url   = _str_or_none("application_url"),
            responsibilities  = _list_of_str("responsibilities"),
            requirements      = _list_of_str("requirements"),
            benefits          = _list_of_str("benefits"),
            application_method= _str_or_none("application_method"),
            is_valid          = True,
        )
