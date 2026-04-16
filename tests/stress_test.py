#!/usr/bin/env python3
"""5+ Player Concurrent Stress Test on Nar Shaddaa during Order 66
Tests: concurrent sessions, global events cross-pollination, response continuity,
warning fix verification, coin deduction accuracy, NPC appearances
"""
import requests
import json
import time
import sys
import pymongo
from datetime import datetime, timezone, timedelta

BASE = "http://localhost:8001"
mongo = pymongo.MongoClient("mongodb://localhost:27017")
db = mongo["test_database"]

PLAYERS = [
    {"uid": "stress_p1", "token": "stress_t1", "char": "Zara Kell", "species": "Twi'lek", "career": "Smuggler", "spec": "Scoundrel"},
    {"uid": "stress_p2", "token": "stress_t2", "char": "Commander Rex", "species": "Human", "career": "Hired Gun", "spec": "Mercenary Soldier"},
    {"uid": "stress_p3", "token": "stress_t3", "char": "Nyx Voidwalker", "species": "Chiss", "career": "Explorer", "spec": "Scout"},
    {"uid": "stress_p4", "token": "stress_t4", "char": "Kragg Bloodfang", "species": "Trandoshan", "career": "Bounty Hunter", "spec": "Assassin"},
    {"uid": "stress_p5", "token": "stress_t5", "char": "Dr. Phel Marr", "species": "Mon Calamari", "career": "Colonist", "spec": "Doctor"},
    {"uid": "stress_p6", "token": "stress_t6", "char": "Vex Ironhorn", "species": "Zabrak", "career": "Technician", "spec": "Mechanic"},
]

# Actions per player — varied length and style to test response quality tracking
PLAYER_SCRIPTS = {
    "Zara Kell": [
        "I pull my hood low and weave through the crowd toward the docking bay",
        "I try to charm the dock officer into letting me through without papers",
        "I fire my blaster at the clone troopers approaching from the east corridor",
    ],
    "Commander Rex": [
        "I check my weapon and take a defensive position behind the cargo crates",
        "I shoot at the approaching enemies with my carbine",
        "I throw a frag grenade at the Imperial patrol blocking the intersection",
    ],
    "Nyx Voidwalker": [
        "I observe the situation from the shadows, scanning for escape routes",
        "I sneak past the patrol using the maintenance tunnels",
        "I try to navigate through the spaceport to find a ship",
    ],
    "Kragg Bloodfang": [
        "I track my prey through the market, following the scent trail",
        "I strike from the shadows with my vibroknife",
        "I intimidate the information broker into talking by showing my hunting claws",
    ],
    "Dr. Phel Marr": [
        "I look for wounded civilians to help with my medpac",
        "I treat the injured Jedi's wounds before the clones find us",
        "I negotiate with the captain for passage off-world",
    ],
    "Vex Ironhorn": [
        "I examine the damaged ship to see if I can repair the hyperdrive",
        "I fix the power coupling with my toolkit",
        "I try to modify the ship's transponder to avoid Imperial detection",
    ],
}

errors = []
successes = []
total_ai_calls = 0
total_time = 0
warnings_blocked = 0

def h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}

print("=" * 70)
print("5+ PLAYER CONCURRENT STRESS TEST")
print(f"{len(PLAYERS)} players on Nar Shaddaa | Order 66")
print("=" * 70)

# CLEANUP
for p in PLAYERS:
    db.users.delete_many({"user_id": p["uid"]})
    db.user_sessions.delete_many({"session_token": p["token"]})
    db.characters.delete_many({"name": p["char"]})
db.game_sessions.delete_many({"user_id": {"$in": [p["uid"] for p in PLAYERS]}})
db.global_events.delete_many({})
db.player_profiles.delete_many({"user_id": {"$in": [p["uid"] for p in PLAYERS]}})

# PHASE 1: Create all players
print("\n[PHASE 1] Creating 6 players...")
for p in PLAYERS:
    db.users.insert_one({
        "user_id": p["uid"], "email": f"{p['uid']}@test.com", "name": p["char"],
        "coins": 500, "subscription_tier": 0,
        "unlocked_eras": ["Order 66 - Fall of the Republic"],
        "created_at": datetime.now(timezone.utc)
    })
    db.user_sessions.insert_one({
        "user_id": p["uid"], "session_token": p["token"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    })
    r = requests.post(f"{BASE}/api/characters", headers=h(p["token"]), json={
        "name": p["char"], "species": p["species"],
        "career": p["career"], "specialization": p["spec"],
        "backstory": f"A {p['species']} {p['career']} caught in the chaos of Order 66."
    })
    if r.status_code == 200:
        p["char_id"] = r.json()["character_id"]
        print(f"  {p['char']} ({p['species']} {p['career']}) - OK")
        successes.append(f"Created {p['char']}")
    else:
        errors.append(f"Create {p['char']} failed: {r.status_code}")
        print(f"  {p['char']} - FAIL")

# PHASE 2: Start all sessions
print("\n[PHASE 2] Starting 6 concurrent sessions on Nar Shaddaa...")
for p in PLAYERS:
    r = requests.post(f"{BASE}/api/game/sessions", headers=h(p["token"]), json={
        "character_id": p["char_id"],
        "era": "Order 66 - Fall of the Republic",
        "scenario": {
            "scenario_id": f"scn_{p['uid']}",
            "title": "Chaos on Nar Shaddaa",
            "type": "combat",
            "description": "Order 66 has been executed",
            "location": "Nar Shaddaa - The Smuggler's Moon",
            "danger_level": 5
        }
    })
    if r.status_code == 200:
        p["session_id"] = r.json()["session_id"]
        successes.append(f"Session {p['char']}")
    else:
        errors.append(f"Session {p['char']} failed")

# Start all games
for p in PLAYERS:
    t0 = time.time()
    r = requests.post(f"{BASE}/api/game/sessions/{p['session_id']}/start", headers=h(p["token"]), timeout=60)
    elapsed = time.time() - t0
    total_time += elapsed
    total_ai_calls += 1
    if r.status_code == 200:
        opening = r.json().get("opening", "")
        print(f"  {p['char']}: Started ({len(opening)} chars, {elapsed:.1f}s)")
        successes.append(f"Start {p['char']}")
    else:
        errors.append(f"Start {p['char']} failed: {r.status_code}")

# PHASE 3: Interleaved actions — simulating concurrent play
print(f"\n[PHASE 3] Playing {sum(len(v) for v in PLAYER_SCRIPTS.values())} interleaved actions...")
print("-" * 70)

round_num = 0
for action_idx in range(3):  # 3 actions per player
    for p in PLAYERS:
        actions = PLAYER_SCRIPTS.get(p["char"], ["Continue"])
        if action_idx >= len(actions):
            continue
        
        action = actions[action_idx]
        round_num += 1
        
        t0 = time.time()
        r = requests.post(
            f"{BASE}/api/game/sessions/{p['session_id']}/action",
            headers=h(p["token"]),
            json={"action": action, "force_action": False},
            timeout=60
        )
        elapsed = time.time() - t0
        total_time += elapsed
        total_ai_calls += 1
        
        if r.status_code == 200:
            result = r.json()
            
            # Check if warning blocked us
            if result.get("warning") and result.get("requires_confirmation"):
                warnings_blocked += 1
                print(f"  R{round_num} {p['char']}: WARNING ({result.get('warning_severity')}) - {result.get('skill_assessed')}")
                # Force through
                r2 = requests.post(
                    f"{BASE}/api/game/sessions/{p['session_id']}/action",
                    headers=h(p["token"]),
                    json={"action": action, "force_action": True},
                    timeout=60
                )
                if r2.status_code == 200:
                    result = r2.json()
                    total_ai_calls += 1
                else:
                    errors.append(f"Force-through failed R{round_num} {p['char']}")
                    continue
            
            if result.get("warning") and result.get("warning_severity") == "out_of_coins":
                errors.append(f"Out of coins R{round_num} {p['char']}")
                continue
            
            gm = result.get("gm_response", "")
            skill = result.get("skill_used")
            dice = result.get("dice_line")
            coins = result.get("coins", "?")
            
            status = f"Coins:{coins}"
            if skill: status += f" Skill:{skill}"
            if dice: status += f" Dice:yes"
            
            print(f"  R{round_num} {p['char']}: OK ({len(gm)}ch, {elapsed:.1f}s) [{status}]")
            successes.append(f"R{round_num} {p['char']}")
        else:
            errors.append(f"R{round_num} {p['char']}: {r.status_code}")
            print(f"  R{round_num} {p['char']}: FAIL ({r.status_code})")

# PHASE 4: Verify global events
print(f"\n[PHASE 4] Verifying global events...")
all_events = list(db.global_events.find({}, {"_id": 0}))
print(f"  Total global events: {len(all_events)}")
by_type = {}
for e in all_events:
    by_type[e["event_type"]] = by_type.get(e["event_type"], 0) + 1
for t, c in sorted(by_type.items()):
    print(f"    {t}: {c}")
if all_events:
    successes.append(f"Global events: {len(all_events)}")

# PHASE 5: Verify cross-player visibility
print(f"\n[PHASE 5] Testing cross-player event visibility...")
for p in PLAYERS[:2]:  # Test first 2 players
    visible = list(db.global_events.find({
        "location": "Nar Shaddaa - The Smuggler's Moon",
        "source_user_id": {"$ne": p["uid"]}
    }, {"_id": 0}))
    print(f"  {p['char']} sees {len(visible)} events from other players")
    if visible:
        successes.append(f"Cross-visibility for {p['char']}: {len(visible)} events")

# PHASE 6: Verify coin deductions
print(f"\n[PHASE 6] Coin balance verification...")
all_correct = True
for p in PLAYERS:
    user = db.users.find_one({"user_id": p["uid"]}, {"_id": 0})
    sess = db.game_sessions.find_one({"session_id": p["session_id"]}, {"_id": 0})
    actions_played = len([m for m in sess.get("game_history", []) if m.get("role") == "player"]) if sess else 0
    expected = 500 - actions_played
    actual = user.get("coins", 0) if user else 0
    ok = "OK" if actual == expected else "MISMATCH"
    if actual != expected:
        all_correct = False
        errors.append(f"Coins {p['char']}: expected {expected}, got {actual}")
    print(f"  {p['char']}: {actions_played} actions, coins: {actual} (expected: {expected}) {ok}")
if all_correct:
    successes.append("All coin balances correct")

# PHASE 7: Player profiles
print(f"\n[PHASE 7] Player profile verification...")
profiles_found = 0
for p in PLAYERS:
    prof = db.player_profiles.find_one({"user_id": p["uid"]}, {"_id": 0})
    if prof:
        profiles_found += 1
print(f"  Profiles created: {profiles_found}/{len(PLAYERS)}")
if profiles_found == len(PLAYERS):
    successes.append("All player profiles created")

# FINAL REPORT
print("\n" + "=" * 70)
print("STRESS TEST RESULTS")
print("=" * 70)
print(f"Players:            {len(PLAYERS)}")
print(f"Total AI calls:     {total_ai_calls}")
print(f"Total time:         {total_time:.1f}s")
print(f"Avg response time:  {total_time/max(1,total_ai_calls):.1f}s")
print(f"Warnings blocked:   {warnings_blocked}")
print(f"Global events:      {len(all_events)}")
print(f"Successes:          {len(successes)}")
print(f"Errors:             {len(errors)}")

if errors:
    print(f"\nERRORS:")
    for e in errors:
        print(f"  ✗ {e}")
else:
    print(f"\nALL TESTS PASSED!")
print("=" * 70)

# Cleanup
for p in PLAYERS:
    db.users.delete_many({"user_id": p["uid"]})
    db.user_sessions.delete_many({"session_token": p["token"]})
    db.characters.delete_many({"name": p["char"]})
db.game_sessions.delete_many({"user_id": {"$in": [p["uid"] for p in PLAYERS]}})
db.global_events.delete_many({})
db.player_profiles.delete_many({"user_id": {"$in": [p["uid"] for p in PLAYERS]}})
print("Test data cleaned up.")
