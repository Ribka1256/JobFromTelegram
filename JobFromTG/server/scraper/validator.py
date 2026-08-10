"""
scraper/validator.py
Data normalization and validation.
Converts raw extracted strings into canonical DB-ready values.
Examples: "Addis" → "Addis Ababa", "Full Time" → "FULL_TIME", "BSc" → "BACHELOR"
"""

import re
from datetime import datetime, date


# ──────────────────────────────────────────────
# Location normalization
# ──────────────────────────────────────────────

LOCATION_MAP: dict[str, str] = {
    # Addis Ababa variants
    "addis":                "Addis Ababa",
    "addis abeba":          "Addis Ababa",
    "addis ababa":          "Addis Ababa",
    "a.a":                  "Addis Ababa",
    "aa":                   "Addis Ababa",
    "finfinne":             "Addis Ababa",

    # Other major cities
    "dire dawa":            "Dire Dawa",
    "diredawa":             "Dire Dawa",
    "hawassa":              "Hawassa",
    "awassa":               "Hawassa",
    "mekelle":              "Mekelle",
    "bahir dar":            "Bahir Dar",
    "bahirdar":             "Bahir Dar",
    "gondar":               "Gondar",
    "jimma":                "Jimma",
    "adama":                "Adama",
    "nazret":               "Adama",
    "dessie":               "Dessie",
    "debre birhan":         "Debre Birhan",
    "shashamane":           "Shashamane",
    "arba minch":           "Arba Minch",

    # Remote
    "remote":               "Remote",
    "work from home":       "Remote",
    "anywhere":             "Remote",
    "wfh":                  "Remote",

    # Catch-all
    "ethiopia":             "Ethiopia",
    "nationwide":           "Ethiopia",
    "all over ethiopia":    "Ethiopia",
}


def normalize_location(raw: str | None) -> str:
    """Map raw location string to canonical city name."""
    if not raw:
        return "Ethiopia"
    key = raw.strip().lower()
    # Direct map
    if key in LOCATION_MAP:
        return LOCATION_MAP[key]
    # Prefix match (e.g. "Addis Ababa, Ethiopia" → "Addis Ababa")
    for k, v in LOCATION_MAP.items():
        if key.startswith(k):
            return v
    # Title-case the original as fallback
    return raw.strip().title()


# ──────────────────────────────────────────────
# Employment type normalization
# ──────────────────────────────────────────────

_EMPLOYMENT_TYPE_MAP: list[tuple[list[str], str]] = [
    (["full.?time", "permanent", "full time"],                          "FULL_TIME"),
    (["part.?time", "part time"],                                        "PART_TIME"),
    (["contract", "contractual", "fixed.?term"],                         "CONTRACT"),
    (["intern", "internship", "attachment", "graduate trainee"],         "INTERNSHIP"),
    (["remote", "work from home", "wfh", "telecommute"],                 "REMOTE"),
    (["freelance", "freelancer", "self.?employed", "gig"],               "FREELANCE"),
]


def normalize_employment_type(raw: str | None) -> str:
    """Map raw employment type string to enum value."""
    if not raw:
        return "UNKNOWN"
    lower = raw.strip().lower()
    for patterns, normalized in _EMPLOYMENT_TYPE_MAP:
        for pattern in patterns:
            if re.search(pattern, lower):
                return normalized
    return "UNKNOWN"


# ──────────────────────────────────────────────
# Experience level normalization
# ──────────────────────────────────────────────

def normalize_experience_level(raw: str | None) -> str:
    """Map raw experience string to enum: ENTRY, MID, SENIOR, LEAD, EXECUTIVE."""
    if not raw:
        return "UNKNOWN"
    lower = raw.strip().lower()
    if any(k in lower for k in ["lead", "head of", "principal", "director"]):
        return "LEAD"
    if any(k in lower for k in ["executive", "c-level", "ceo", "cto", "vp"]):
        return "EXECUTIVE"
    if any(k in lower for k in ["senior", "sr.", "sr ", "5+ year", "6+ year", "7+ year"]):
        return "SENIOR"
    if any(k in lower for k in ["junior", "entry", "graduate", "trainee", "0-1", "0-2", "fresh"]):
        return "ENTRY"
    if any(k in lower for k in ["mid", "intermediate", "3+ year", "4+ year", "2-4"]):
        return "MID"
    # Try to parse years
    year_match = re.search(r"(\d+)\s*(?:\+|years?)", lower)
    if year_match:
        years = int(year_match.group(1))
        if years <= 1:  return "ENTRY"
        if years <= 3:  return "MID"
        if years <= 6:  return "SENIOR"
        return "LEAD"
    return "UNKNOWN"


# ──────────────────────────────────────────────
# Education level normalization
# ──────────────────────────────────────────────

def normalize_education_level(raw: str | None) -> str:
    """Map raw education string to enum: CERTIFICATE, DIPLOMA, BACHELOR, MASTER, PHD."""
    if not raw:
        return "UNKNOWN"
    lower = raw.strip().lower()
    if any(k in lower for k in ["phd", "doctorate", "doctor of"]):
        return "PHD"
    if any(k in lower for k in ["master", "msc", "mba", "m.sc", "m.a.", "post.?grad"]):
        return "MASTER"
    if any(k in lower for k in ["bachelor", "degree", "bsc", "b.sc", "ba", "b.a.", "undergraduate"]):
        return "BACHELOR"
    if any(k in lower for k in ["diploma", "level 5", "level 4"]):
        return "DIPLOMA"
    if any(k in lower for k in ["certificate", "cert.", "level 3"]):
        return "CERTIFICATE"
    if any(k in lower for k in ["10+2", "12th", "high school"]):
        return "CERTIFICATE"
    return "UNKNOWN"


# ──────────────────────────────────────────────
# Salary normalization
# ──────────────────────────────────────────────

def normalize_salary(raw: str | None) -> tuple[float | None, float | None, str]:
    """
    Parse salary string into (min, max, currency).
    Returns (None, None, 'ETB') if parsing fails.
    """
    if not raw:
        return None, None, "ETB"

    # Detect currency
    currency = "ETB"
    if "$" in raw or "usd" in raw.lower():
        currency = "USD"
    elif "€" in raw or "eur" in raw.lower():
        currency = "EUR"

    # Extract numbers
    numbers = re.findall(r"[\d,]+(?:\.\d+)?", raw.replace(",", ""))
    floats  = []
    for n in numbers:
        try:
            floats.append(float(n))
        except ValueError:
            pass

    if len(floats) == 0:
        return None, None, currency
    if len(floats) == 1:
        return floats[0], floats[0], currency
    return min(floats), max(floats), currency


# ──────────────────────────────────────────────
# Deadline normalization
# ──────────────────────────────────────────────

_MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

def normalize_deadline(raw: str | None) -> date | None:
    """Try to parse a deadline string into a date. Returns None on failure."""
    if not raw:
        return None

    raw = raw.strip()

    # Try ISO format first
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            pass

    # Try "August 15, 2026" or "15 August 2026"
    match = re.search(
        r"(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})|([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})",
        raw
    )
    if match:
        try:
            if match.group(1):
                day, month_str, year = match.group(1), match.group(2), match.group(3)
            else:
                month_str, day, year = match.group(4), match.group(5), match.group(6)

            month = _MONTH_MAP.get(month_str.lower())
            if month:
                return date(int(year), month, int(day))
        except (ValueError, TypeError):
            pass

    return None


# ──────────────────────────────────────────────
# Company name normalization
# ──────────────────────────────────────────────

def normalize_company_name(raw: str | None) -> str | None:
    """Clean and title-case a company name."""
    if not raw:
        return None
    # Remove common noise phrases
    raw = re.sub(r"\b(PLC|plc|S\.C\.|sc|Ltd|ltd|LLC|llc)\.?\b", "", raw)
    # Remove trailing punctuation
    raw = re.sub(r"[.,:;]+$", "", raw)
    return raw.strip().title() or None


# ──────────────────────────────────────────────
# Category inference (moved from frontend)
# ──────────────────────────────────────────────

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Engineering":   ["engineer", "developer", "software", "backend", "frontend", "devops",
                      "qa", "data engineer", "programmer", "architect", "system admin"],
    "Design":        ["designer", "ux", "ui", "graphic", "product design", "illustrator", "figma"],
    "Marketing":     ["marketing", "seo", "content strategist", "brand", "social media",
                      "growth", "digital marketing", "advertising"],
    "Content":       ["content writer", "copywriter", "editor", "content creator", "blogger"],
    "Data Science":  ["data scientist", "data analyst", "machine learning", "ml engineer",
                      "ai engineer", "bi analyst", "statistician"],
    "Finance":       ["accountant", "finance", "auditor", "bookkeeper", "treasurer", "cfo",
                      "financial analyst", "banking"],
    "HR":            ["human resources", "hr ", "recruitment officer", "talent acquisition",
                      "people operations"],
    "Sales":         ["sales", "business development", "account manager", "business analyst",
                      "commercial"],
    "Healthcare":    ["doctor", "nurse", "pharmacist", "health officer", "medical", "clinical",
                      "midwife", "laboratory"],
    "Legal":         ["lawyer", "legal", "attorney", "counsel", "paralegal", "compliance"],
    "Operations":    ["operations", "logistics", "supply chain", "procurement", "warehouse",
                      "driver", "fleet"],
    "Service":       ["customer service", "barista", "server", "retail", "support", "kitchen",
                      "receptionist", "cashier"],
    "Education":     ["teacher", "trainer", "lecturer", "tutor", "instructor", "professor",
                      "curriculum", "school"],
    "NGO":           ["ngo", "non.?governmental", "humanitarian", "development officer",
                      "program officer", "field officer"],
}


def infer_category(title: str | None, description: str | None) -> str:
    """Infer job category from title and description. Moved from frontend categorize.js."""
    text = f"{title or ''} {description or ''}".lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(re.search(kw, text) for kw in keywords):
            return category
    return "Other"
