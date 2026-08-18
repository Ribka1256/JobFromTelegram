"""
export_string_session.py
Converts your local session.session file to a portable StringSession string.

Run ONCE locally:
    py export_string_session.py

Copy the printed string and add it as GitHub Secret: TELETHON_STRING_SESSION
"""

from telethon.sync import TelegramClient
from telethon.sessions import StringSession

API_ID   = 34122130
API_HASH = "b65d38bda48ee41f381286ae82d2c2dc"

print("Loading local session.session file...")

# Open the SQLite session and copy its auth data into a StringSession
with TelegramClient("session", API_ID, API_HASH) as client:
    # Build a StringSession from the active client's session data
    ss = StringSession()
    ss.set_dc(
        client.session.dc_id,
        client.session.server_address,
        client.session.port,
    )
    ss.auth_key = client.session.auth_key

    session_string = ss.save()

print("\n" + "=" * 60)
print("YOUR STRING SESSION (copy this ENTIRE line):")
print("=" * 60)
print(session_string)
print("=" * 60)
print("\nAdd this as GitHub Secret: TELETHON_STRING_SESSION")
