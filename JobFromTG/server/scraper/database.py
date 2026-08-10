"""
scraper/database.py
Persistence layer for the scraper.
Writes scraped jobs to PostgreSQL via the Express REST API.
This keeps the Python scraper decoupled from direct DB access
and lets the API enforce all business rules.
"""

import json
import aiohttp
from dataclasses import asdict
from scraper.config import API_BASE_URL, MAX_RETRIES, RETRY_DELAY_SEC
import asyncio


class ScraperDatabaseClient:
    """
    HTTP client that calls the Express API to persist jobs and
    fetch existing links/hashes for cross-run deduplication.
    """

    def __init__(self, api_base: str = API_BASE_URL):
        self.api_base = api_base.rstrip("/")

    # ──────────────────────────────────────────
    # Deduplication data fetching
    # ──────────────────────────────────────────

    async def get_known_links(self) -> set[str]:
        """Fetch all known telegram_message_links from the DB."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.api_base}/internal/known-links",
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return set(data.get("links", []))
        except Exception as e:
            print(f"[DB] Could not fetch known links: {e}")
        return set()

    async def get_known_hashes(self) -> set[str]:
        """Fetch all known content_hashes from the DB."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.api_base}/internal/known-hashes",
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return set(data.get("hashes", []))
        except Exception as e:
            print(f"[DB] Could not fetch known hashes: {e}")
        return set()

    async def get_recent_texts(self, days: int = 7) -> list[str]:
        """Fetch raw texts of posts from the last N days for similarity checking."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.api_base}/internal/recent-texts?days={days}",
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        return data.get("texts", [])
        except Exception as e:
            print(f"[DB] Could not fetch recent texts: {e}")
        return []

    # ──────────────────────────────────────────
    # Job insertion
    # ──────────────────────────────────────────

    async def insert_job(self, job_payload: dict) -> dict | None:
        """
        POST a single job to the API for insertion.
        Returns the created job dict or None on failure.
        """
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.api_base}/internal/jobs",
                        json=job_payload,
                        timeout=aiohttp.ClientTimeout(total=30),
                    ) as resp:
                        if resp.status in (200, 201):
                            return await resp.json()
                        elif resp.status == 409:
                            # Duplicate — constraint violation
                            print(f"[DB] Duplicate detected by DB constraint. Skipping.")
                            return None
                        else:
                            body = await resp.text()
                            print(f"[DB] Insert failed ({resp.status}): {body[:200]}")
            except Exception as e:
                print(f"[DB] Insert error (attempt {attempt}): {e}")
                await asyncio.sleep(RETRY_DELAY_SEC * attempt)
        return None

    async def insert_jobs_batch(self, jobs: list[dict]) -> tuple[int, int]:
        """
        Insert multiple jobs. Returns (inserted_count, failed_count).
        Runs insertions concurrently in batches of 10.
        """
        inserted = 0
        failed   = 0
        batch_size = 10

        for i in range(0, len(jobs), batch_size):
            batch = jobs[i : i + batch_size]
            tasks = [self.insert_job(job) for job in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, Exception) or result is None:
                    failed += 1
                else:
                    inserted += 1

        return inserted, failed

    # ──────────────────────────────────────────
    # Scrape log
    # ──────────────────────────────────────────

    async def log_scrape(self, log_payload: dict) -> None:
        """Write a ScrapeLog record via the API."""
        try:
            async with aiohttp.ClientSession() as session:
                await session.post(
                    f"{self.api_base}/internal/scrape-logs",
                    json=log_payload,
                    timeout=aiohttp.ClientTimeout(total=10),
                )
        except Exception as e:
            print(f"[DB] Could not write scrape log: {e}")

    # ──────────────────────────────────────────
    # Channel upsert
    # ──────────────────────────────────────────

    async def upsert_channel(self, channel: dict) -> None:
        """Ensure a TelegramChannel record exists."""
        try:
            async with aiohttp.ClientSession() as session:
                await session.put(
                    f"{self.api_base}/internal/channels/{channel['username']}",
                    json=channel,
                    timeout=aiohttp.ClientTimeout(total=10),
                )
        except Exception as e:
            print(f"[DB] Could not upsert channel {channel.get('username')}: {e}")
