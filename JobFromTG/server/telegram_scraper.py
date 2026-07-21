import asyncio
import json
import re
from telethon import TelegramClient

# ==========================
# Telegram API Credentials
# ==========================
API_ID = 34405245
API_HASH = "YOUR_API_HASH"
PHONE = "+251984131481"

# Telegram channels
CHANNELS = [
    "freelance_ethio",
    "ethiojobs03",
    "seekerascommerce",
    "ethiojobsofficial"
]

# Keywords used to identify job posts
JOB_KEYWORDS = [
    "vacancy",
    "job",
    "position",
    "career",
    "qualification",
    "experience",
    "deadline",
    "employment",
    "apply",
    "hiring",
    "recruitment"
]


def clean_text(text):
    """Remove markdown formatting and extra whitespace."""

    if not text:
        return ""

    # Remove markdown
    text = (
        text.replace("**", "")
            .replace("__", "")
            .replace("`", "")
    )

    # Convert markdown links:
    # [Google](https://google.com) -> Google
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)

    # Remove extra blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def clean_title(title):
    """Remove prefixes like 'Job Title:'"""

    if not title:
        return ""

    pattern = re.compile(
        r'^\s*(job\s*title\s*[:\-]\s*)+',
        re.IGNORECASE
    )

    return pattern.sub("", title).strip()


def parse_job(message, channel):
    text = clean_text(message.text)

    lines = [line.strip() for line in text.split("\n") if line.strip()]

    if not lines:
        return None

    title = clean_title(lines[0])

    company = ""
    location = ""
    deadline = ""

    for line in lines:
        lower = line.lower()

        if any(k in lower for k in [
            "company:",
            "organization:",
            "employer:",
            "institution:"
        ]):
            company = line.split(":", 1)[-1].strip()

        elif any(k in lower for k in [
            "location:",
            "work location:",
            "city:",
            "address:",
            "place:"
        ]):
            location = line.split(":", 1)[-1].strip()

        elif any(k in lower for k in [
            "deadline:",
            "closing date:",
            "apply before:",
            "due date:"
        ]):
            deadline = line.split(":", 1)[-1].strip()

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

        print(f"\nScraping @{channel}...")

        try:
            entity = await client.get_entity(channel)

            async for message in client.iter_messages(entity, limit=100):

                if not message.text:
                    continue

                text = message.text.strip()

                if len(text) < 50:
                    continue

                lower = text.lower()

                # Skip messages that don't look like jobs
                if not any(keyword in lower for keyword in JOB_KEYWORDS):
                    continue

                job = parse_job(message, channel)

                if job:
                    all_jobs.append(job)

        except Exception as e:
            print(f"Failed to scrape @{channel}")
            print(e)

    # Remove duplicates using share_link
    unique_jobs = []
    seen = set()

    for job in all_jobs:
        if job["share_link"] not in seen:
            seen.add(job["share_link"])
            unique_jobs.append(job)

    with open("jobs.json", "w", encoding="utf-8") as f:
        json.dump(unique_jobs, f, ensure_ascii=False, indent=2)

    print(f"\nFinished!")
    print(f"Collected {len(unique_jobs)} jobs.")
    print("Saved to jobs.json")

    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(scrape())