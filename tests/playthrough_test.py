#!/usr/bin/env python3
"""Dynamic playthrough test - Trandoshan Smuggler in Mandalorian Era"""
import requests
import json
import time
import sys

BASE = "http://localhost:8001"
TOKEN = "playtest_token"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# Story-following player actions for a smuggler adventure
PLAYER_ACTIONS = [
    "I look around carefully, taking in my surroundings and scanning for danger",
    "I check my Heavy Blaster Pistol and make sure it's loaded",
    "I approach the nearest person and ask what's going on around here",
    "I try to negotiate a better deal for my services",
    "I sneak through the shadows toward the back exit",
    "I pull out my sabacc deck and challenge someone to a game",
    "I search the area for any hidden compartments or secret passages",
    "I fire my blaster at the closest threat",
    "I try to pilot my ship through the asteroid field",
    "I use my hunting claws to intimidate the guard",
    "Continue",
    "I attempt to hack into the security terminal",
    "I try to charm the bartender into giving me information",
    "I dodge the incoming blaster fire and take cover",
    "I attempt to repair the damaged engine",
    "",  # Blank = Continue
    "I track the target through the crowded marketplace",
    "I climb up to the rooftop for a better vantage point",
    "I try to persuade the local authorities to look the other way",
    "I examine the ancient artifact closely",
]

errors = []
successes = []
warnings_triggered = 0
dice_rolls = 0
skills_used = set()
coin_balance = 500

print("=" * 60)
print("DYNAMIC PLAYTHROUGH TEST")
print("Trandoshan Smuggler | Mandalorian Era")
print("=" * 60)

# Step 1: Verify user
print("\n[1] Verifying test user...")
r = requests.get(f"{BASE}/api/auth/me", headers=HEADERS)
if r.status_code == 200:
    user = r.json()
    coin_balance = user.get("coins", 500)
    print(f"  OK - Coins: {coin_balance}, Sub Tier: {user.get('subscription_tier')}")
    successes.append("User verification")
else:
    errors.append(f"User verification failed: {r.status_code}")
    print(f"  FAIL - {r.status_code}")

# Step 2: Create character
print("\n[2] Creating Trandoshan Smuggler/Pilot...")
r = requests.post(f"{BASE}/api/characters", headers=HEADERS, json={
    "name": "Krassk Vao",
    "species": "Trandoshan",
    "career": "Smuggler",
    "specialization": "Pilot",
    "backstory": "A grizzled Trandoshan pilot smuggling weapons for credits."
})
if r.status_code == 200:
    char = r.json()
    char_id = char["character_id"]
    print(f"  OK - {char['name']} ({char['species']} {char['career']})")
    print(f"  Equipment: {len(char['equipment'])} items")
    print(f"  Stats: B={char['stats']['brawn']} A={char['stats']['agility']}")
    successes.append("Character creation")
else:
    errors.append(f"Character creation failed: {r.status_code} {r.text[:200]}")
    print(f"  FAIL - {r.status_code}")
    sys.exit(1)

# Step 3: Create session with Mandalorian Era
print("\n[3] Creating Mandalorian Era session...")
r = requests.post(f"{BASE}/api/game/sessions", headers=HEADERS, json={
    "character_id": char_id,
    "era": "Mandalorian Era",
    "scenario": {
        "scenario_id": "scn_mando_test",
        "title": "Smuggler's Run on Ord Mantell",
        "type": "intrigue",
        "description": "Weapons smuggling during the Mandalorian Wars",
        "location": "Ord Mantell - Scrapyard Planet",
        "danger_level": 3
    }
})
if r.status_code == 200:
    session = r.json()
    session_id = session["session_id"]
    print(f"  OK - Session: {session_id}")
    print(f"  Location: {session['current_location']}")
    print(f"  Era: {session['era']}")
    print(f"  Env: {session['environment_type']}")
    successes.append("Session creation with Mandalorian Era")
    if session['era'] != 'Mandalorian Era':
        errors.append(f"Era mismatch: expected 'Mandalorian Era', got '{session['era']}'")
else:
    errors.append(f"Session creation failed: {r.status_code}")
    print(f"  FAIL - {r.status_code}")
    sys.exit(1)

# Step 4: Start game
print("\n[4] Starting adventure...")
r = requests.post(f"{BASE}/api/game/sessions/{session_id}/start", headers=HEADERS)
if r.status_code == 200:
    start = r.json()
    opening = start.get("opening", "")
    print(f"  OK - Opening ({len(opening)} chars)")
    print(f"  Preview: {opening[:200]}...")
    print(f"  Env theme: {start.get('environment_theme', {}).get('mood', '')}")
    successes.append("Game start with AI narrative")
else:
    errors.append(f"Game start failed: {r.status_code} {r.text[:200]}")
    print(f"  FAIL - {r.status_code}")
    sys.exit(1)

# Step 5: Play through actions
print(f"\n[5] Playing {len(PLAYER_ACTIONS)} rounds...")
print("-" * 60)

for i, action in enumerate(PLAYER_ACTIONS):
    action_text = action if action else "Continue"
    print(f"\n  Round {i+1}/{len(PLAYER_ACTIONS)}: \"{action_text[:50]}{'...' if len(action_text) > 50 else ''}\"")

    try:
        r = requests.post(
            f"{BASE}/api/game/sessions/{session_id}/action",
            headers=HEADERS,
            json={"action": action, "force_action": True},  # Force through warnings for playthrough
            timeout=60
        )

        if r.status_code == 200:
            result = r.json()

            # Check for out-of-coins
            if result.get("warning") and result.get("warning_severity") == "out_of_coins":
                print(f"    OUT OF COINS at round {i+1}")
                errors.append(f"Out of coins at round {i+1}")
                break

            # Check for capability warning (shouldn't fire with force_action=True)
            if result.get("warning") and result.get("requires_confirmation"):
                warnings_triggered += 1
                print(f"    WARNING: {result.get('warning_message', '')[:100]}")
                # Force through
                r2 = requests.post(
                    f"{BASE}/api/game/sessions/{session_id}/action",
                    headers=HEADERS,
                    json={"action": action, "force_action": True},
                    timeout=60
                )
                if r2.status_code == 200:
                    result = r2.json()
                else:
                    errors.append(f"Force action failed round {i+1}: {r2.status_code}")
                    continue

            gm = result.get("gm_response", "")
            skill = result.get("skill_used")
            dice = result.get("dice_result")
            dice_line = result.get("dice_line")
            coins = result.get("coins", coin_balance)
            advancement = result.get("advancement")
            env = result.get("environment_type", "")

            coin_balance = coins

            if skill:
                skills_used.add(skill)
            if dice:
                dice_rolls += 1

            status_parts = []
            if skill: status_parts.append(f"Skill:{skill}")
            if dice_line: status_parts.append(f"Dice:{dice_line[:40]}")
            if advancement and advancement.get("ranked_up"):
                status_parts.append(f"RANKED UP: {advancement['skill_name']} -> {advancement['new_rank']}")
            status_parts.append(f"Coins:{coins}")
            if env: status_parts.append(f"Env:{env}")

            print(f"    GM ({len(gm)} chars): {gm[:120]}...")
            print(f"    [{' | '.join(status_parts)}]")

            successes.append(f"Round {i+1}")
        else:
            err_detail = r.text[:200]
            errors.append(f"Round {i+1} failed: {r.status_code} - {err_detail}")
            print(f"    FAIL ({r.status_code}): {err_detail}")

    except requests.exceptions.Timeout:
        errors.append(f"Round {i+1} timeout")
        print(f"    TIMEOUT")
    except Exception as e:
        errors.append(f"Round {i+1} exception: {str(e)[:100]}")
        print(f"    ERROR: {e}")

    time.sleep(0.5)  # Small delay between rounds

# Step 6: Test export story
print(f"\n[6] Testing story export...")
r = requests.get(f"{BASE}/api/game/sessions/{session_id}/export-story", headers=HEADERS)
if r.status_code == 200:
    export = r.json()
    print(f"  OK - Story export: {export.get('message_count')} GM messages")
    story = export.get("story", "")
    if "BEYOND THE STARS" in story:
        print(f"  Watermark present: YES")
        successes.append("Story export with watermark")
    else:
        errors.append("Story export missing watermark")
else:
    errors.append(f"Story export failed: {r.status_code}")

# Step 7: Test character export
print(f"\n[7] Testing character export...")
r = requests.get(f"{BASE}/api/characters/{char_id}/export-card", headers=HEADERS)
if r.status_code == 200:
    card = r.json()
    if "BEYOND THE STARS" in card.get("card_text", ""):
        print(f"  OK - Character card with watermark")
        successes.append("Character export with watermark")
    else:
        errors.append("Character export missing watermark")
else:
    errors.append(f"Character export failed: {r.status_code}")

# Step 8: Check coin deduction
print(f"\n[8] Checking coin balance...")
r = requests.get(f"{BASE}/api/auth/coins", headers=HEADERS)
if r.status_code == 200:
    final_coins = r.json().get("coins", 0)
    actions_played = len([s for s in successes if s.startswith("Round")])
    expected_coins = 500 - actions_played
    print(f"  Starting: 500 | Actions played: {actions_played} | Final: {final_coins}")
    if final_coins == expected_coins:
        print(f"  Coin deduction: CORRECT (1 per action)")
        successes.append("Coin deduction correct")
    else:
        print(f"  Coin deduction: MISMATCH (expected {expected_coins}, got {final_coins})")
        errors.append(f"Coin mismatch: expected {expected_coins}, got {final_coins}")
else:
    errors.append("Coin check failed")

# Step 9: Check latest session endpoint (Continue Adventure)
print(f"\n[9] Testing Continue Adventure...")
r = requests.get(f"{BASE}/api/game/sessions/latest/{char_id}", headers=HEADERS)
if r.status_code == 200:
    latest = r.json()
    if latest.get("has_session") and latest["session"]["session_id"] == session_id:
        print(f"  OK - Continue Adventure returns correct session")
        successes.append("Continue Adventure")
    else:
        errors.append("Continue Adventure returned wrong session")
else:
    errors.append(f"Continue Adventure failed: {r.status_code}")

# Final Report
print("\n" + "=" * 60)
print("PLAYTHROUGH TEST RESULTS")
print("=" * 60)
print(f"Total rounds played: {len([s for s in successes if s.startswith('Round')])}")
print(f"Dice rolls triggered: {dice_rolls}")
print(f"Skills used: {len(skills_used)} unique - {', '.join(sorted(skills_used))}")
print(f"Warnings triggered: {warnings_triggered}")
print(f"Final coin balance: {coin_balance}")
print(f"Successes: {len(successes)}")
print(f"Errors: {len(errors)}")

if errors:
    print(f"\nERRORS:")
    for e in errors:
        print(f"  - {e}")
else:
    print(f"\nALL TESTS PASSED!")

print("=" * 60)
