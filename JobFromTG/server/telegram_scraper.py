import asyncio
import json
import re
from telethon import TelegramClient

API_ID = 34405245
API_HASH = "b1fee10df2dae1b2ff6b7c88ea323472"
PHONE = "+251984131481"

# Telegram usernames (without https://t.me/)
CHANNELS = [
    "freelance_ethio",
    "ethiojobs03",
    "seekerascommerce",
    "ethiojobsofficial"
]


def clean_text(text):
    """Remove Telegram markdown and extra whitespace."""
    if not text:
        return ""

    # Remove markdown formatting
    text = (
        text.replace("**", "")
            .replace("__", "")
            .replace("`", "")
    )

    # Remove markdown links but keep the text
    # [text](url) -> text
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)

    # Remove duplicate blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def parse_job(message, channel):
    text = clean_text(message.text)

    lines = [line.strip() for line in text.split("\n") if line.strip()]

    if not lines:
        return None

    title = clean_text(lines[0])

    company = ""
    location = ""
    deadline = ""

    for line in lines:
        lower = line.lower()

        if any(keyword in lower for keyword in [
            "company:",
            "organization:",
            "employer:",
            "institution:"
        ]):
            company = clean_text(line.split(":", 1)[-1])

        elif any(keyword in lower for keyword in [
            "location:",
            "work location:",
            "place:",
            "city:",
            "address:"
        ]):
            location = clean_text(line.split(":", 1)[-1])

        elif any(keyword in lower for keyword in [
            "deadline:",
            "closing date:",
            "apply before:",
            "due date:"
        ]):
            deadline = clean_text(line.split(":", 1)[-1])

    return {
        "id": str(message.id),
        "title": title,
        "company_name": company if company else "See description",
        "location": location if location else "Ethiopia",
        "description": text,
        "posted_at": message.date.strftime("%Y-%m-%d"),
        "deadline": deadline,
        "share_link": f"https://t.me/{channel}/{message.id}",
        "source": "telegram"
    }


async def scrape():
    client = TelegramClient("session", API_ID, API_HASH)

    await client.start(phone=PHONE)

    all_jobs = []

    for channel in CHANNELS:
        print(f"Scraping @{channel}...")

        try:
            entity = await client.get_entity(channel)

            async for message in client.iter_messages(entity, limit=100):

                if not message.text:
                    continue

                if len(message.text.strip()) < 50:
                    continue

                job = parse_job(message, channel)

                if job:
                    all_jobs.append(job)

        except Exception as e:
            print(f"Failed @{channel}: {e}")

    with open("jobs.json", "w", encoding="utf-8") as f:
        json.dump(all_jobs, f, ensure_ascii=False, indent=2)

    print(f"\nDone! Saved {len(all_jobs)} jobs to jobs.json")

    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(scrape())