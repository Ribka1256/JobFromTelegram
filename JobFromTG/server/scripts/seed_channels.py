"""
server/scripts/seed_channels.py
One-time script to seed TelegramChannel records into the database.
Run once after the first migration: python scripts/seed_channels.py
"""

import asyncio
import aiohttp
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scraper.config import CHANNELS, API_BASE_URL


async def seed():
    base = API_BASE_URL.rstrip("/")
    print(f"Seeding {len(CHANNELS)} channels to {base}...")

    async with aiohttp.ClientSession() as session:
        for channel in CHANNELS:
            try:
                async with session.put(
                    f"{base}/internal/channels/{channel['username']}",
                    json=channel,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status in (200, 201):
                        print(f"  [OK]   @{channel['username']}")
                    else:
                        body = await resp.text()
                        print(f"  [FAIL] @{channel['username']} - {resp.status}: {body[:100]}")
            except Exception as e:
                print(f"  [ERR]  @{channel['username']} - Error: {e}")

    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(seed())
