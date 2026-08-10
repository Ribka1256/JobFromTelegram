"""
scraper/config.py
All configuration loaded from environment variables.
No hardcoded credentials — see ADR-002 for rationale.
"""

import os
from dotenv import load_dotenv

# Load .env from the parent server directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))


# ──────────────────────────────────────────────
# Telegram API
# ──────────────────────────────────────────────
TELEGRAM_API_ID   = int(os.environ["TELEGRAM_API_ID"])
TELEGRAM_API_HASH = os.environ["TELEGRAM_API_HASH"]
TELEGRAM_PHONE    = os.environ["TELEGRAM_PHONE"]
SESSION_NAME      = os.environ.get("TELEGRAM_SESSION_NAME", "session")

# ──────────────────────────────────────────────
# Cerebras AI
# ──────────────────────────────────────────────
CEREBRAS_API_KEY  = os.environ["CEREBRAS_API_KEY"]
CEREBRAS_MODEL    = os.environ.get("CEREBRAS_MODEL", "llama-3.3-70b")

# ──────────────────────────────────────────────
# Backend API (scraper posts jobs via REST)
# ──────────────────────────────────────────────
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:5000/api/v1")

# ──────────────────────────────────────────────
# Telegram Channels
# ──────────────────────────────────────────────
CHANNELS = [
    {"username": "OppHubEt",          "display_name": "Opp Hub Ethiopia",      "is_narrative": False},
    {"username": "ethioworks1",        "display_name": "Ethio Works",           "is_narrative": False},
    {"username": "fanajobs",           "display_name": "Fana Jobs",             "is_narrative": False},
    {"username": "geezjobs_ethiopia",  "display_name": "Geez Jobs Ethiopia",    "is_narrative": False},
    {"username": "ethioo_link",        "display_name": "Ethio Link",            "is_narrative": True },
    {"username": "remotejobss",        "display_name": "Remote Jobs",           "is_narrative": True },
    {"username": "ethio_job_vacancy1", "display_name": "Ethio Job Vacancy",     "is_narrative": False},
    {"username": "hahujobs",           "display_name": "Hahu Jobs",             "is_narrative": False},
    {"username": "josad_digital",      "display_name": "Josad Digital",         "is_narrative": True },
    {"username": "josad_software",     "display_name": "Josad Software",        "is_narrative": True },
    {"username": "effoyjobs",          "display_name": "Effoy Jobs",            "is_narrative": False},
    {"username": "ethiojobsofficial",  "display_name": "Ethio Jobs Official",   "is_narrative": False},
    {"username": "freelance_ethio",    "display_name": "Freelance Ethio",       "is_narrative": True },
    {"username": "work_remotely",      "display_name": "Work Remotely",         "is_narrative": True },
]

# ──────────────────────────────────────────────
# Scraper Tuning
# ──────────────────────────────────────────────

# How many messages to fetch per channel per run
MESSAGE_LIMIT = int(os.environ.get("MESSAGE_LIMIT", "200"))

# Minimum text length to consider a message
MIN_TEXT_LENGTH = int(os.environ.get("MIN_TEXT_LENGTH", "80"))

# ──────────────────────────────────────────────
# Job Detection Thresholds (see ADR-005)
# ──────────────────────────────────────────────

# Score >= this → structured regex extraction
JOB_HIGH_CONFIDENCE   = int(os.environ.get("JOB_HIGH_CONFIDENCE", "70"))

# Score in [this, JOB_HIGH_CONFIDENCE) → Cerebras AI extraction
JOB_LOW_CONFIDENCE    = int(os.environ.get("JOB_LOW_CONFIDENCE", "50"))

# Score < JOB_LOW_CONFIDENCE → discard

# If regex returns fewer than this many fields → fall back to Cerebras
REGEX_MIN_FIELDS      = int(os.environ.get("REGEX_MIN_FIELDS", "3"))

# ──────────────────────────────────────────────
# Duplicate Detection (see ADR-005)
# ──────────────────────────────────────────────

# Jaccard similarity threshold above which two posts are near-duplicates
SIMILARITY_THRESHOLD  = float(os.environ.get("SIMILARITY_THRESHOLD", "0.85"))

# Window (days) for similarity comparison — don't compare against posts > N days old
SIMILARITY_WINDOW_DAYS = int(os.environ.get("SIMILARITY_WINDOW_DAYS", "7"))

# ──────────────────────────────────────────────
# Retry / Error Handling
# ──────────────────────────────────────────────
MAX_RETRIES     = int(os.environ.get("MAX_RETRIES", "3"))
RETRY_DELAY_SEC = float(os.environ.get("RETRY_DELAY_SEC", "2.0"))
