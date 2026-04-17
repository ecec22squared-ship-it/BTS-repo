"""
Backend tests for the NEW reviewer-seed logic in /app/backend/server.py.

Scope (narrow):
- POST /api/dev/seed-reviewer returns 401 with no auth
- POST /api/dev/seed-reviewer returns 403 when authed as a non-reviewer user
- POST /api/dev/seed-reviewer returns 200 and seeds DB when authed as the reviewer email
- Idempotency: repeated seed calls do not duplicate characters or sessions
"""

import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone, timedelta

import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BACKEND_URL = "https://game-deploy-kit.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
REVIEWER_EMAIL = "ecec22squared@gmail.com"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


async def seed_user(email: str, name: str):
    """Create a user + active session directly in Mongo and return (user_id, session_token)."""
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": None,
            "coins": 500,
            "subscription_tier": 0,
            "unlocked_eras": ["Vex Directive 66 - Fall of the Concordat"],
            "created_at": datetime.now(timezone.utc),
        })

    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })
    return user_id, session_token


async def cleanup_user(user_id: str):
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.characters.delete_many({"user_id": user_id})
    await db.game_sessions.delete_many({"user_id": user_id})
    await db.users.delete_many({"user_id": user_id})


results = []


def record(name: str, ok: bool, detail: str = ""):
    marker = "PASS" if ok else "FAIL"
    line = f"[{marker}] {name}"
    if detail:
        line += f" :: {detail}"
    print(line)
    results.append((name, ok, detail))


async def main():
    # 1) 401 with no auth
    r = requests.post(f"{API}/dev/seed-reviewer", timeout=30)
    record("No auth -> 401", r.status_code == 401, f"status={r.status_code} body={r.text[:200]}")

    # 2) 403 for non-reviewer user
    non_reviewer_email = f"galactic.pilot.{uuid.uuid4().hex[:6]}@example.com"
    non_reviewer_id, non_reviewer_token = await seed_user(non_reviewer_email, "Han Solo Test")
    try:
        r = requests.post(
            f"{API}/dev/seed-reviewer",
            headers={"Authorization": f"Bearer {non_reviewer_token}"},
            timeout=30,
        )
        record("Non-reviewer auth -> 403", r.status_code == 403, f"status={r.status_code} body={r.text[:200]}")
    finally:
        await cleanup_user(non_reviewer_id)

    # 3 & 4) Reviewer auth + idempotency
    reviewer_id, reviewer_token = await seed_user(REVIEWER_EMAIL, "App Store Reviewer")

    # Purge any stale reviewer docs and muddy the user record
    await db.characters.delete_many({"user_id": reviewer_id})
    await db.game_sessions.delete_many({"user_id": reviewer_id})
    await db.users.update_one(
        {"user_id": reviewer_id},
        {"$set": {"coins": 42, "subscription_tier": 2, "unlocked_eras": []}},
    )

    try:
        r1 = requests.post(
            f"{API}/dev/seed-reviewer",
            headers={"Authorization": f"Bearer {reviewer_token}"},
            timeout=30,
        )
        record("Reviewer auth first call -> 200", r1.status_code == 200, f"status={r1.status_code} body={r1.text[:200]}")

        char_count_1 = await db.characters.count_documents({"user_id": reviewer_id})
        session_count_1 = await db.game_sessions.count_documents({"user_id": reviewer_id})
        user_doc_1 = await db.users.find_one({"user_id": reviewer_id}, {"_id": 0})

        record("First seed: exactly 1 character", char_count_1 == 1, f"character_count={char_count_1}")
        record("First seed: exactly 1 game session", session_count_1 == 1, f"session_count={session_count_1}")
        record("First seed: coins reset to 500", user_doc_1.get("coins") == 500, f"coins={user_doc_1.get('coins')}")
        record("First seed: subscription_tier reset to 0", user_doc_1.get("subscription_tier") == 0, f"subscription_tier={user_doc_1.get('subscription_tier')}")
        record(
            "First seed: unlocked_eras contains Vex Directive 66 - Fall of the Concordat",
            "Vex Directive 66 - Fall of the Concordat" in (user_doc_1.get("unlocked_eras") or []),
            f"unlocked_eras={user_doc_1.get('unlocked_eras')}",
        )

        char = await db.characters.find_one({"user_id": reviewer_id}, {"_id": 0})
        if char:
            ok = (
                char.get("name") == "Kyrix Vhandir"
                and char.get("species") == "Xeel'thara"
                and char.get("career") == "Smuggler"
                and char.get("specialization") == "Pilot"
            )
            record(
                "First seed: character fields correct",
                ok,
                f"name={char.get('name')} species={char.get('species')} career={char.get('career')} spec={char.get('specialization')}",
            )
        else:
            record("First seed: character fields correct", False, "no character doc found")

        sess = await db.game_sessions.find_one({"user_id": reviewer_id}, {"_id": 0})
        if sess:
            loc_ok = sess.get("current_location") == "Vrak'Shaddain - Docking Bay 94"
            era_ok = sess.get("era") == "Vex Directive 66 - Fall of the Concordat"
            history = sess.get("game_history") or []
            hist_ok = len(history) >= 1 and history[0].get("role") == "assistant"
            record("First seed: session location correct", loc_ok, f"location={sess.get('current_location')}")
            record("First seed: session era correct", era_ok, f"era={sess.get('era')}")
            record("First seed: session has seeded assistant message", hist_ok, f"history_len={len(history)} first_role={(history[0].get('role') if history else None)}")
        else:
            record("First seed: session fields correct", False, "no session doc found")

        initial_char_id = char["character_id"] if char else None
        initial_session_id = sess["session_id"] if sess else None

        # Idempotency
        r2 = requests.post(f"{API}/dev/seed-reviewer", headers={"Authorization": f"Bearer {reviewer_token}"}, timeout=30)
        r3 = requests.post(f"{API}/dev/seed-reviewer", headers={"Authorization": f"Bearer {reviewer_token}"}, timeout=30)
        record("Second seed call -> 200", r2.status_code == 200, f"status={r2.status_code}")
        record("Third seed call -> 200", r3.status_code == 200, f"status={r3.status_code}")

        char_count_final = await db.characters.count_documents({"user_id": reviewer_id})
        session_count_final = await db.game_sessions.count_documents({"user_id": reviewer_id})
        record("Idempotent: character count stays at 1 after 3 seeds", char_count_final == 1, f"character_count={char_count_final}")
        record("Idempotent: session count stays at 1 after 3 seeds", session_count_final == 1, f"session_count={session_count_final}")

        char_after = await db.characters.find_one({"user_id": reviewer_id}, {"_id": 0})
        sess_after = await db.game_sessions.find_one({"user_id": reviewer_id}, {"_id": 0})
        record(
            "Idempotent: same character_id reused",
            bool(char_after) and char_after.get("character_id") == initial_char_id,
            f"initial={initial_char_id} after={char_after.get('character_id') if char_after else None}",
        )
        record(
            "Idempotent: same session_id reused",
            bool(sess_after) and sess_after.get("session_id") == initial_session_id,
            f"initial={initial_session_id} after={sess_after.get('session_id') if sess_after else None}",
        )
    finally:
        await cleanup_user(reviewer_id)

    print("\n========== TEST SUMMARY ==========")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    for name, ok, detail in results:
        marker = "PASS" if ok else "FAIL"
        print(f"[{marker}] {name}")
        if not ok and detail:
            print(f"   -> {detail}")
    print(f"\nTotal: {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    code = asyncio.run(main())
    sys.exit(code)
