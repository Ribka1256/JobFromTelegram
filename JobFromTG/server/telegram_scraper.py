import asyncio
import json
from telethon import TelegramClient

API_ID = "34405245"
API_HASH = "b1fee10df2dae1b2ff6b7c88ea323472"
PHONE = "+251984131481"

# Use only the username, NOT the full URL
CHANNELS = [
    "https://t.me/freelance_ethio",
    "https://t.me/ethiojobs03",
    "https://t.me/seekerascommerce",
    "https://t.me/ethiojobsofficial"
    # add more channel usernames here (without https://t.me/)
]

async def scrape():
    client = TelegramClient("session", API_ID, API_HASH)
    await client.start(phone=PHONE)

    all_jobs = []

    for channel in CHANNELS:
        print(f"Scraping @{channel}...")
        try:
            entity = await client.get_entity(channel)
            async for message in client.iter_messages(entity, limit=100):
                if message.text and len(message.text) > 50:
                    job = parse_job(message, channel)
                    if job:
                        all_jobs.append(job)
        except Exception as e:
            print(f"Failed @{channel}: {e}")

    with open("jobs.json", "w", encoding="utf-8") as f:
        json.dump(all_jobs, f, ensure_ascii=False, indent=2)

    print(f"Done — saved {len(all_jobs)} jobs to jobs.json")
    await client.disconnect()

def parse_job(message, channel):
    text = message.text.strip()
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    title = lines[0] if lines else "Job Opportunity"
    company = ""
    location = ""
    deadline = ""

    for line in lines:
        low = line.lower()
        if any(k in low for k in ["company:", "organization:", "employer:", "institution:"]):
            company = line.split(":", 1)[-1].strip()
        if any(k in low for k in ["location:", "place:", "city:", "address:"]):
            location = line.split(":", 1)[-1].strip()
        if any(k in low for k in ["deadline:", "closing date:", "apply before:", "due date:"]):
            deadline = line.split(":", 1)[-1].strip()
    channel_username = channel.replace("https://t.me/", "").strip("/")

    return {
        "id": str(message.id),
        "title": title,
        "company_name": company or "See description",
        "location": location or "Ethiopia",
        "description": text,
        "posted_at": message.date.strftime("%Y-%m-%d"),
        "deadline": deadline,
        "share_link": f"https://t.me/{channel_username}/{message.id}",  # ← includes post ID
        "source": "telegram",
    }
asyncio.run(scrape())
