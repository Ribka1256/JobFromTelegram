import asyncio
import json
from telethon import TelegramClient

# ==========================
# Telegram API Credentials
# ==========================
API_ID = 34122130
API_HASH = "b65d38bda48ee41f381286ae82d2c2dc"
PHONE = "+251704782498"

# Telegram channels
CHANNELS = [
    "OppHubEt",
    "ethioworks1",
    "fanajobs",
    "geezjobs_ethiopia",
    "ethioo_link",
    "remotejobss",
    "ethio_job_vacancy1",
    "hahujobs",
    "josad_digital",
    "josad_software",
    "effoyjobs",
    "ethiojobsofficial",
    "freelance_ethio",
    "work_remotely"
]

# Number of messages to fetch from each channel
MESSAGE_LIMIT = 500


async def export_messages():

    client = TelegramClient("session", API_ID, API_HASH)

    await client.start(phone=PHONE)

    all_messages = []

    for channel in CHANNELS:

        print(f"\nScraping @{channel}...")

        try:

            entity = await client.get_entity(channel)

            async for message in client.iter_messages(entity, limit=MESSAGE_LIMIT):

                # Skip empty messages
                if not message.text:
                    continue

                data = {
                    "channel": channel,
                    "message_id": message.id,
                    "date": message.date.isoformat(),
                    "views": getattr(message, "views", None),
                    "forwards": getattr(message, "forwards", None),
                    "text": message.text,
                    "link": f"https://t.me/{channel}/{message.id}"
                }

                all_messages.append(data)

        except Exception as e:

            print(f"Failed to scrape @{channel}")
            print(e)

    with open("raw_messages.json", "w", encoding="utf-8") as f:

        json.dump(all_messages, f, ensure_ascii=False, indent=2)

    print("\n===================================")
    print("Finished exporting raw messages!")
    print(f"Collected {len(all_messages)} messages.")
    print("Saved as raw_messages.json")
    print("===================================")

    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(export_messages())