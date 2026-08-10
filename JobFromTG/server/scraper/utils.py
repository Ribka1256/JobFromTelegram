"""
scraper/utils.py
Shared text-cleaning and hashing helpers.
Preserves and extends clean_text() and clean_title() from the original telegram_scraper.py.
"""

import re
import hashlib
import unicodedata


# ──────────────────────────────────────────────
# Text Cleaning (migrated from telegram_scraper.py)
# ──────────────────────────────────────────────

def clean_text(text: str) -> str:
    """Remove markdown formatting and normalize whitespace.
    Preserved from the original scraper with minor extension."""
    if not text:
        return ""

    # Remove bold/italic markdown markers
    text = text.replace("**", "").replace("__", "").replace("`", "")

    # Convert markdown links [label](url) → label
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)

    # Remove HTML tags (some channels include them)
    text = re.sub(r"<[^>]+>", "", text)

    # Collapse 3+ consecutive newlines into 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def clean_title(title: str) -> str:
    """Remove 'Job Title:' prefix patterns.
    Preserved from the original scraper."""
    if not title:
        return ""
    pattern = re.compile(r"^\s*(job\s*title\s*[:\-]\s*)+", re.IGNORECASE)
    return pattern.sub("", title).strip()


# ──────────────────────────────────────────────
# Normalization for Hashing (see ADR-005)
# ──────────────────────────────────────────────

def normalize_for_hash(text: str) -> str:
    """
    Strip all noise from text before hashing for deduplication.
    Removes: emojis, markdown, URLs, hashtags, @usernames, extra whitespace.
    """
    if not text:
        return ""

    # Remove emojis (Unicode ranges for emoticons and symbols)
    text = "".join(
        ch for ch in text
        if not unicodedata.category(ch).startswith("So")  # Symbol, other
        and ord(ch) < 0x1F000  # Additional emoji block cutoff
        or ord(ch) < 128       # Keep plain ASCII
    )

    # Remove URLs
    text = re.sub(r"https?://\S+", "", text)

    # Remove markdown bold/italic/code
    text = re.sub(r"[*_`~]", "", text)

    # Remove markdown links
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)

    # Remove hashtags
    text = re.sub(r"#\w+", "", text)

    # Remove @usernames
    text = re.sub(r"@\w+", "", text)

    # Remove phone numbers (common in job posts, vary per post)
    text = re.sub(r"\+?\d[\d\s\-().]{7,}\d", "", text)

    # Remove email addresses
    text = re.sub(r"\b[\w.+-]+@[\w-]+\.\w+\b", "", text)

    # Lowercase
    text = text.lower()

    # Collapse all whitespace (spaces, newlines, tabs) to single space
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def compute_content_hash(raw_text: str) -> str:
    """Compute SHA-256 of the normalized text for deduplication."""
    normalized = normalize_for_hash(raw_text)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


# ──────────────────────────────────────────────
# Shingle-based Jaccard Similarity (see ADR-005)
# ──────────────────────────────────────────────

def get_shingles(text: str, k: int = 3) -> set:
    """Return a set of character k-grams (shingles) from text."""
    normalized = normalize_for_hash(text)
    if len(normalized) < k:
        return {normalized}
    return {normalized[i : i + k] for i in range(len(normalized) - k + 1)}


def jaccard_similarity(text_a: str, text_b: str, k: int = 3) -> float:
    """Compute Jaccard similarity between two texts using character shingles."""
    shingles_a = get_shingles(text_a, k)
    shingles_b = get_shingles(text_b, k)
    if not shingles_a or not shingles_b:
        return 0.0
    intersection = len(shingles_a & shingles_b)
    union = len(shingles_a | shingles_b)
    return intersection / union if union > 0 else 0.0


# ──────────────────────────────────────────────
# Misc helpers
# ──────────────────────────────────────────────

def truncate(text: str, max_len: int = 200) -> str:
    """Truncate text with ellipsis for logging."""
    if not text:
        return ""
    return text[:max_len] + "..." if len(text) > max_len else text


def safe_split_lines(text: str) -> list[str]:
    """Split text into non-empty, stripped lines."""
    return [line.strip() for line in text.split("\n") if line.strip()]
