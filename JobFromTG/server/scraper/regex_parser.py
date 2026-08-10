"""
scraper/regex_parser.py
Structured field extraction via regex for high-confidence job posts.
Extends and formalizes the original parse_job() from telegram_scraper.py.
Extracts 15 fields where the original extracted only 4.
"""

import re
from dataclasses import dataclass, field
from scraper.utils import clean_text, clean_title, safe_split_lines


@dataclass
class ParsedJob:
    """All fields that regex can extract from a structured post."""
    title:              str | None = None
    company:            str | None = None
    location:           str | None = None
    salary_raw:         str | None = None
    employment_type:    str | None = None
    experience_raw:     str | None = None
    education_raw:      str | None = None
    deadline_raw:       str | None = None
    skills:             list[str]  = field(default_factory=list)
    email:              str | None = None
    phone:              str | None = None
    application_url:    str | None = None
    responsibilities:   list[str]  = field(default_factory=list)
    requirements:       list[str]  = field(default_factory=list)
    benefits:           list[str]  = field(default_factory=list)
    application_method: str | None = None

    def non_empty_field_count(self) -> int:
        """Count how many core fields were extracted (used for AI fallback decision)."""
        core = [
            self.title, self.company, self.location,
            self.salary_raw, self.deadline_raw, self.employment_type,
        ]
        return sum(1 for f in core if f)


# ──────────────────────────────────────────────
# Field-level regex patterns
# ──────────────────────────────────────────────

_TITLE_PATTERNS = re.compile(
    r"^(?:job\s*title|position|role)\s*[:\-]\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)
_COMPANY_PATTERNS = re.compile(
    r"^(?:company|organization|employer|institution|hiring\s*company)\s*[:\-]\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)
_LOCATION_PATTERNS = re.compile(
    r"^(?:(?:work\s*)?location|city|address|place|based\s*in)\s*[:\-]\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)
_SALARY_PATTERNS = re.compile(
    r"^(?:salary|compensation|remuneration|pay|monthly\s*salary)\s*[:\-]\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)
_EMPLOYMENT_TYPE_PATTERNS = re.compile(
    r"^(?:employment\s*type|job\s*type|contract\s*type|position\s*type)\s*[:\-]\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)
_EXPERIENCE_PATTERNS = re.compile(
    r"^(?:experience|years?\s*of\s*experience|work\s*experience)\s*[:\-]\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)
_EDUCATION_PATTERNS = re.compile(
    r"^(?:education|educational\s*background|qualification|degree)\s*[:\-]\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)
_DEADLINE_PATTERNS = re.compile(
    r"^(?:deadline|closing\s*date|application\s*deadline|apply\s*before|due\s*date|last\s*date)\s*[:\-]\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)
_SKILLS_PATTERNS = re.compile(
    r"^(?:skills?|required\s*skills?|key\s*skills?|technical\s*skills?)\s*[:\-]\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)
_EMAIL_PATTERN = re.compile(r"\b([\w.+-]+@[\w-]+\.\w{2,})\b")
_PHONE_PATTERN = re.compile(r"(\+?\d[\d\s\-().]{7,}\d)")
_URL_PATTERN   = re.compile(r"(https?://[^\s]+)")

_APPLY_METHOD_PATTERNS = re.compile(
    r"^(?:how\s*to\s*apply|application\s*method|send\s*(?:your\s*)?(?:cv|resume|application))\s*[:\-]\s*(.+)$",
    re.IGNORECASE | re.MULTILINE,
)

# Section headers for multi-line list extraction
_RESPONSIBILITIES_HEADER = re.compile(
    r"(?:responsibilities|duties|key\s*responsibilities|roles?\s*(?:and\s*responsibilities)?)\s*[:\-]",
    re.IGNORECASE,
)
_REQUIREMENTS_HEADER = re.compile(
    r"(?:requirements?|qualifications?|what\s*we\s*(?:need|look\s*for)|skills?\s*required)\s*[:\-]",
    re.IGNORECASE,
)
_BENEFITS_HEADER = re.compile(
    r"(?:benefits?|what\s*we\s*offer|perks?|compensation\s*(?:and\s*benefits)?)\s*[:\-]",
    re.IGNORECASE,
)


# ──────────────────────────────────────────────
# Parser class
# ──────────────────────────────────────────────

class RegexParser:

    def parse(self, raw_text: str) -> ParsedJob:
        """
        Extract structured fields from a job post.
        Returns a ParsedJob dataclass.
        """
        text  = clean_text(raw_text)
        lines = safe_split_lines(text)
        result = ParsedJob()

        # ── Single-line field extraction ──────────────────────────
        result.title           = self._extract_first(_TITLE_PATTERNS, text)
        result.company         = self._extract_first(_COMPANY_PATTERNS, text)
        result.location        = self._extract_first(_LOCATION_PATTERNS, text)
        result.salary_raw      = self._extract_first(_SALARY_PATTERNS, text)
        result.employment_type = self._extract_first(_EMPLOYMENT_TYPE_PATTERNS, text)
        result.experience_raw  = self._extract_first(_EXPERIENCE_PATTERNS, text)
        result.education_raw   = self._extract_first(_EDUCATION_PATTERNS, text)
        result.deadline_raw    = self._extract_first(_DEADLINE_PATTERNS, text)
        result.application_method = self._extract_first(_APPLY_METHOD_PATTERNS, text)

        # ── Title fallback: use first meaningful line (from original scraper) ──
        if not result.title and lines:
            result.title = clean_title(lines[0])

        # ── Company fallback: check lines for known prefixes (from original scraper) ──
        if not result.company:
            result.company = self._scan_lines_for_field(
                lines,
                ["company:", "organization:", "employer:", "institution:"],
            )

        # ── Location fallback (from original scraper) ──
        if not result.location:
            result.location = self._scan_lines_for_field(
                lines,
                ["location:", "work location:", "city:", "address:", "place:"],
            )

        # ── Deadline fallback (from original scraper) ──
        if not result.deadline_raw:
            result.deadline_raw = self._scan_lines_for_field(
                lines,
                ["deadline:", "closing date:", "apply before:", "due date:"],
            )

        # ── Skills (comma or bullet separated) ──────────────────
        skills_raw = self._extract_first(_SKILLS_PATTERNS, text)
        if skills_raw:
            result.skills = [s.strip() for s in re.split(r"[,•\-|/]", skills_raw) if s.strip()]

        # ── Contact fields ───────────────────────────────────────
        email_match = _EMAIL_PATTERN.search(text)
        result.email = email_match.group(1) if email_match else None

        phone_match = _PHONE_PATTERN.search(text)
        result.phone = phone_match.group(1).strip() if phone_match else None

        url_match = _URL_PATTERN.search(text)
        result.application_url = url_match.group(1) if url_match else None

        # ── Multi-line section extraction ────────────────────────
        result.responsibilities = self._extract_section(text, _RESPONSIBILITIES_HEADER)
        result.requirements     = self._extract_section(text, _REQUIREMENTS_HEADER)
        result.benefits         = self._extract_section(text, _BENEFITS_HEADER)

        return result

    # ──────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────

    @staticmethod
    def _extract_first(pattern: re.Pattern, text: str) -> str | None:
        match = pattern.search(text)
        if match:
            return match.group(1).strip() or None
        return None

    @staticmethod
    def _scan_lines_for_field(lines: list[str], prefixes: list[str]) -> str | None:
        """Fallback line scanner — mirrors original parse_job() logic."""
        for line in lines:
            lower = line.lower()
            if any(lower.startswith(p) for p in prefixes):
                return line.split(":", 1)[-1].strip() or None
        return None

    @staticmethod
    def _extract_section(text: str, header_pattern: re.Pattern) -> list[str]:
        """
        Extract bullet-point items under a section header.
        Returns list of non-empty strings.
        """
        match = header_pattern.search(text)
        if not match:
            return []

        # Take text after the header until the next double-newline section
        after = text[match.end():]
        # Cut at the next probable section header (all-caps line or double newline)
        chunk = re.split(r"\n\n[A-Z]", after)[0]

        items = []
        for line in chunk.split("\n"):
            line = line.strip().lstrip("•-*►▶→✓✔ \t")
            if line and len(line) > 3:
                items.append(line)

        return items[:15]  # Cap to avoid storing noise
