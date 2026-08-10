"""
scraper/duplicate_detector.py
Three-strategy duplicate detection as specified in ADR-005.

Strategy 1: Telegram message link (exact match — checked against DB)
Strategy 2: Normalized content hash (SHA-256 — checked against DB)
Strategy 3: Jaccard similarity on shingles (near-duplicate detection)
"""

from dataclasses import dataclass
from enum import Enum
from scraper.utils import compute_content_hash, jaccard_similarity
from scraper.config import SIMILARITY_THRESHOLD


class DuplicateStrategy(Enum):
    LINK       = "LINK"
    HASH       = "HASH"
    SIMILARITY = "SIMILARITY"


@dataclass
class DuplicateResult:
    is_duplicate: bool
    strategy: DuplicateStrategy | None = None
    similarity_score: float | None = None
    matched_link: str | None = None


class DuplicateDetector:
    """
    Stateful duplicate detector.

    Maintains in-memory sets of seen links and hashes for the current
    scraper run (fast), while also accepting pre-loaded sets from the
    database for cross-run deduplication.
    """

    def __init__(
        self,
        known_links: set[str] | None = None,
        known_hashes: set[str] | None = None,
        recent_texts: list[str] | None = None,
    ):
        # Pre-populated from DB for cross-run dedup
        self._seen_links:   set[str]  = known_links  or set()
        self._seen_hashes:  set[str]  = known_hashes or set()
        # Recent raw texts for similarity comparison
        self._recent_texts: list[str] = recent_texts or []

    # ──────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────

    def check(self, raw_text: str, telegram_link: str) -> DuplicateResult:
        """
        Run all three strategies in order.
        Returns on the first match found (fast path).
        """

        # Strategy 1: Exact Telegram link
        if telegram_link in self._seen_links:
            return DuplicateResult(
                is_duplicate=True,
                strategy=DuplicateStrategy.LINK,
                matched_link=telegram_link,
            )

        # Strategy 2: Content hash
        content_hash = compute_content_hash(raw_text)
        if content_hash in self._seen_hashes:
            return DuplicateResult(
                is_duplicate=True,
                strategy=DuplicateStrategy.HASH,
            )

        # Strategy 3: Jaccard similarity vs recent posts
        similarity_match = self._check_similarity(raw_text)
        if similarity_match is not None:
            return DuplicateResult(
                is_duplicate=True,
                strategy=DuplicateStrategy.SIMILARITY,
                similarity_score=similarity_match,
            )

        return DuplicateResult(is_duplicate=False)

    def register(self, raw_text: str, telegram_link: str) -> None:
        """
        Register a newly accepted post so subsequent posts in the same
        run can be checked against it.
        """
        self._seen_links.add(telegram_link)
        self._seen_hashes.add(compute_content_hash(raw_text))
        self._recent_texts.append(raw_text)

    # ──────────────────────────────────────────
    # Internal helpers
    # ──────────────────────────────────────────

    def _check_similarity(self, raw_text: str) -> float | None:
        """
        Compare new text against all recent texts.
        Returns the similarity score if a near-duplicate is found,
        else None.
        """
        for existing_text in self._recent_texts:
            score = jaccard_similarity(raw_text, existing_text)
            if score >= SIMILARITY_THRESHOLD:
                return score
        return None
