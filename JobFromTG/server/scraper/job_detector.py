"""
scraper/job_detector.py
Confidence scoring system (0–100) for determining whether a Telegram
message is a job posting. Replaces the simple JOB_KEYWORDS list from
the original telegram_scraper.py. See ADR-002 for rationale.
"""

import re
from dataclasses import dataclass
from scraper.config import JOB_HIGH_CONFIDENCE, JOB_LOW_CONFIDENCE


# ──────────────────────────────────────────────
# Scoring signals
# ──────────────────────────────────────────────

# Primary job keywords — high value signals
PRIMARY_KEYWORDS = [
    "vacancy", "job opening", "we are hiring", "now hiring", "is hiring",
    "recruitment", "job opportunity", "career opportunity", "job posting",
    "open position", "join our team", "looking for candidates",
    "qualified candidates", "applications are invited",
]

# Secondary job keywords — moderate signals (from original scraper)
SECONDARY_KEYWORDS = [
    "job", "position", "career", "qualification", "experience",
    "employment", "hiring", "apply", "deadline", "required",
    "requirements", "responsibilities", "applicants", "candidates",
    "salary", "benefits", "full.?time", "part.?time", "internship",
    "contract", "remote", "fresher", "graduate", "bachelor", "master",
]

# Strong structural signals
STRUCTURAL_PATTERNS = [
    re.compile(r"(job\s*title|position)\s*[:\-]", re.IGNORECASE),
    re.compile(r"company\s*[:\-]", re.IGNORECASE),
    re.compile(r"(work\s*)?location\s*[:\-]", re.IGNORECASE),
    re.compile(r"(closing\s*date|deadline|apply\s*before|due\s*date)\s*[:\-]", re.IGNORECASE),
    re.compile(r"(required\s*)?qualification[s]?\s*[:\-]", re.IGNORECASE),
    re.compile(r"(years?\s*of\s*)?experience\s*[:\-]", re.IGNORECASE),
    re.compile(r"(monthly\s*)?salary\s*[:\-]", re.IGNORECASE),
    re.compile(r"how\s*to\s*apply\s*[:\-]", re.IGNORECASE),
    re.compile(r"(education|degree)\s*[:\-]", re.IGNORECASE),
    re.compile(r"responsibilities\s*[:\-]", re.IGNORECASE),
]

# Contact / application signals
CONTACT_PATTERNS = [
    re.compile(r"\b[\w.+-]+@[\w-]+\.\w{2,}\b"),                          # Email
    re.compile(r"\+?\d[\d\s\-().]{7,}\d"),                                 # Phone
    re.compile(r"https?://\S+"),                                            # URL
    re.compile(r"(send\s*(your\s*)?(cv|resume)|apply\s*(via|at|through))", re.IGNORECASE),
]

# Negative signals (likely NOT a job post)
NEGATIVE_KEYWORDS = [
    "news", "breaking", "update", "announcement", "subscribe",
    "click here", "advertisement", "promo", "discount", "sale",
    "share this", "repost", "forwarded",
]


# ──────────────────────────────────────────────
# Result dataclass
# ──────────────────────────────────────────────

@dataclass
class DetectionResult:
    confidence_score: int      # 0–100
    is_job: bool               # True if >= JOB_LOW_CONFIDENCE
    needs_ai: bool             # True if score is in the medium range
    signals: dict              # Breakdown for debugging/logging


# ──────────────────────────────────────────────
# Detector
# ──────────────────────────────────────────────

class JobDetector:
    """
    Scores a message on a 0–100 confidence scale.
    Uses keywords, regex patterns, structural cues, and contact signals.
    """

    def detect(self, text: str, is_narrative_channel: bool = False) -> DetectionResult:
        if not text or len(text.strip()) < 30:
            return DetectionResult(0, False, False, {})

        lower = text.lower()
        score = 0
        signals: dict = {}

        # ── Primary keywords (up to 35 points) ──────────────────
        primary_hits = [kw for kw in PRIMARY_KEYWORDS if kw in lower]
        primary_score = min(len(primary_hits) * 15, 35)
        score += primary_score
        signals["primary_keywords"] = primary_hits

        # ── Secondary keywords (up to 25 points) ────────────────
        secondary_hits = [
            kw for kw in SECONDARY_KEYWORDS
            if re.search(kw, lower)
        ]
        secondary_score = min(len(secondary_hits) * 3, 25)
        score += secondary_score
        signals["secondary_keywords"] = secondary_hits[:5]  # cap log size

        # ── Structural patterns (up to 25 points) ───────────────
        structural_hits = [
            pat.pattern for pat in STRUCTURAL_PATTERNS
            if pat.search(text)
        ]
        structural_score = min(len(structural_hits) * 4, 25)
        score += structural_score
        signals["structural_patterns"] = len(structural_hits)

        # ── Contact / application signals (up to 10 points) ─────
        contact_hits = sum(
            1 for pat in CONTACT_PATTERNS if pat.search(text)
        )
        contact_score = min(contact_hits * 4, 10)
        score += contact_score
        signals["contact_signals"] = contact_hits

        # ── Text length bonus (up to 5 points) ──────────────────
        if len(text) > 300:
            score += 3
        if len(text) > 600:
            score += 2
        signals["text_length"] = len(text)

        # ── Negative signal penalty ──────────────────────────────
        negative_hits = [kw for kw in NEGATIVE_KEYWORDS if kw in lower]
        penalty = min(len(negative_hits) * 10, 25)
        score -= penalty
        signals["negative_keywords"] = negative_hits

        # ── Narrative channel boost ──────────────────────────────
        # If the channel is known to be narrative, lower the bar slightly
        # to avoid discarding valid but informal job posts
        if is_narrative_channel and score > 30:
            score += 10
            signals["narrative_channel_boost"] = True

        # Clamp to [0, 100]
        score = max(0, min(100, score))
        signals["final_score"] = score

        is_job   = score >= JOB_LOW_CONFIDENCE
        needs_ai = JOB_LOW_CONFIDENCE <= score < JOB_HIGH_CONFIDENCE

        return DetectionResult(
            confidence_score=score,
            is_job=is_job,
            needs_ai=needs_ai,
            signals=signals,
        )
