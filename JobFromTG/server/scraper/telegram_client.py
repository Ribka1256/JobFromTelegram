"""
scraper/telegram_client.py
Telethon client lifecycle management.
Extracted from telegram_scraper.py — single responsibility: connection only.
"""

import asyncio
from telethon import TelegramClient
from scraper.config import TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE, SESSION_NAME


_client: TelegramClient | None = None


async def get_client() -> TelegramClient:
    """Return an authenticated, connected Telethon client (singleton)."""
    global _client
    if _client is None or not _client.is_connected():
        _client = TelegramClient(SESSION_NAME, TELEGRAM_API_ID, TELEGRAM_API_HASH)
        await _client.start(phone=TELEGRAM_PHONE)
        print("[Telegram] Client connected.")
    return _client


async def disconnect_client() -> None:
    """Gracefully disconnect the Telethon client."""
    global _client
    if _client and _client.is_connected():
        await _client.disconnect()
        print("[Telegram] Client disconnected.")
    _client = None
