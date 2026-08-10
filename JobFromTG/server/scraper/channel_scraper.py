"""
scraper/channel_scraper.py
Fetches raw messages from Telegram channels.
Absorbs export_raw_messages.py (which is now superseded).
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime
from telethon.errors import FloodWaitError, ChannelPrivateError
from scraper.telegram_client import get_client
from scraper.config import MESSAGE_LIMIT, MIN_TEXT_LENGTH


@dataclass
class RawMessage:
    channel_username: str
    message_id:       int
    date:             datetime
    text:             str
    views:            int | None
    forwards:         int | None
    telegram_link:    str


class ChannelScraper:
    """
    Fetches raw messages from a Telegram channel.
    Single responsibility: network I/O with Telegram only.
    """

    async def scrape_channel(
        self,
        channel_username: str,
        limit: int = MESSAGE_LIMIT,
    ) -> list[RawMessage]:
        """
        Fetch up to `limit` messages from a channel.
        Filters out messages that are too short to be job posts.
        Returns a list of RawMessage dataclasses.
        """
        client = await get_client()
        messages: list[RawMessage] = []

        try:
            entity = await client.get_entity(channel_username)

            async for message in client.iter_messages(entity, limit=limit):
                if not message.text:
                    continue
                text = message.text.strip()
                if len(text) < MIN_TEXT_LENGTH:
                    continue

                messages.append(RawMessage(
                    channel_username = channel_username,
                    message_id       = message.id,
                    date             = message.date,
                    text             = text,
                    views            = getattr(message, "views",    None),
                    forwards         = getattr(message, "forwards", None),
                    telegram_link    = f"https://t.me/{channel_username}/{message.id}",
                ))

        except FloodWaitError as e:
            wait = e.seconds + 5
            print(f"[{channel_username}] Flood wait {wait}s. Sleeping...")
            await asyncio.sleep(wait)

        except ChannelPrivateError:
            print(f"[{channel_username}] Channel is private — skipping.")

        except Exception as e:
            print(f"[{channel_username}] Unexpected error: {e}")

        return messages

    async def scrape_channels(
        self,
        channels: list[dict],
        limit: int = MESSAGE_LIMIT,
    ) -> dict[str, list[RawMessage]]:
        """
        Scrape multiple channels sequentially (Telegram rate-limit safe).
        Returns a dict mapping channel username → list of RawMessage.
        """
        results: dict[str, list[RawMessage]] = {}

        for channel in channels:
            username = channel["username"]
            print(f"\n[Scraper] Fetching @{username}...")
            msgs = await self.scrape_channel(username, limit)
            results[username] = msgs
            print(f"[Scraper] @{username} -> {len(msgs)} messages fetched.")
            # Small delay between channels to avoid flood limits
            await asyncio.sleep(1.5)

        return results
