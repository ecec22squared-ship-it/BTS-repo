#!/usr/bin/env python3
"""Endurance test: Find the crash point by sending 50 rapid-fire messages"""
import requests
import json
import time
import sys

BASE = "http://localhost:8001"
TOKEN = "endurance_token"
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
SID = sys.argv[1]  # Session ID passed as arg

ACTIONS = [
    "I look around the cantina carefully",
    "I approach the bar and order a drink",
    "I ask the bartender about recent events",
    "I notice someone watching me from the corner",
    "I walk toward the suspicious figure",
    "Continue",
    "I try to negotiate for information",
    "I scan the room for exits",
    "I head toward the back exit",
    "Continue",
    "I sneak down the alley behind the cantina",
    "I check if anyone is following me",
    "I pull out my blaster and keep moving",
    "I find a hiding spot and wait",
    "Continue",
    "I hear blaster fire in the distance",
    "I move toward the sound cautiously",
    "I peek around the corner to see what's happening",
    "I take cover behind the dumpster",
    "Continue",
    "I fire at the closest threat",
    "I try to flank the enemy position",
    "I search the fallen enemy for useful items",
    "I patch up my wounds quickly",
    "Continue",
    "I continue moving through the streets",
    "I try to find a ship at the docking bay",
    "I negotiate with the dockmaster for a berth",
    "I inspect the available ships",
    "Continue",
    "I choose the fastest looking ship",
    "I try to hotwire the ship's ignition",
    "I fire up the engines",
    "I plot a course away from here",
    "Continue",
    "I dodge incoming fire from the port guns",
    "I push the ship to maximum speed",
    "I check the nav computer for safe routes",
    "I enter hyperspace",
    "Continue",
    "I check the ship's cargo hold",
    "I examine what I found",
    "Continue",
    "I set the ship on autopilot and rest",
    "Continue",
    "I wake up and check our position",
    "I scan for nearby systems",
    "Continue",
    "I approach the nearest planet",
    "I prepare to land",
]

print(f"ENDURANCE TEST: {len(ACTIONS)} messages")
print(f"Session: {SID}")
print("=" * 60)

crash_point = None
last_good = 0

for i, action in enumerate(ACTIONS):
    msg_num = i + 1
    display = action if action else "[Continue]"
    
    try:
        t0 = time.time()
        r = requests.post(
            f"{BASE}/api/game/sessions/{SID}/action",
            headers=H,
            json={"action": action, "force_action": True},
            timeout=90
        )
        elapsed = time.time() - t0
        
        if r.status_code == 200:
            d = r.json()
            gm = d.get("gm_response", "")
            coins = d.get("coins", "?")
            warn = d.get("warning")
            
            if warn and d.get("warning_severity") == "out_of_coins":
                print(f"  #{msg_num}: OUT OF COINS at message {msg_num}")
                crash_point = f"Out of coins at msg {msg_num}"
                break
            elif warn and d.get("requires_confirmation"):
                print(f"  #{msg_num}: WARNING BLOCKED ({elapsed:.1f}s) - severity={d.get('warning_severity')}")
                # Force through
                r2 = requests.post(f"{BASE}/api/game/sessions/{SID}/action", headers=H,
                    json={"action": action, "force_action": True}, timeout=90)
                if r2.status_code == 200:
                    d = r2.json()
                    gm = d.get("gm_response", "")
                    elapsed2 = time.time() - t0
                    print(f"  #{msg_num}: FORCED OK ({len(gm)}ch, {elapsed2:.1f}s) coins={d.get('coins')}")
                    last_good = msg_num
                else:
                    print(f"  #{msg_num}: FORCE FAILED ({r2.status_code})")
                    crash_point = f"Force failed at msg {msg_num}: {r2.status_code}"
                    break
            elif gm:
                print(f"  #{msg_num}: OK ({len(gm)}ch, {elapsed:.1f}s) coins={coins} | {display[:30]}")
                last_good = msg_num
            else:
                print(f"  #{msg_num}: EMPTY RESPONSE - {json.dumps(d)[:200]}")
                crash_point = f"Empty response at msg {msg_num}"
                break
        elif r.status_code == 500:
            err = r.json().get("detail", r.text[:200])
            print(f"  #{msg_num}: SERVER ERROR 500 ({elapsed:.1f}s) - {err[:200]}")
            crash_point = f"500 error at msg {msg_num}: {err[:100]}"
            break
        else:
            print(f"  #{msg_num}: HTTP {r.status_code} ({elapsed:.1f}s) - {r.text[:200]}")
            crash_point = f"HTTP {r.status_code} at msg {msg_num}"
            break
            
    except requests.exceptions.Timeout:
        print(f"  #{msg_num}: TIMEOUT (>90s)")
        crash_point = f"Timeout at msg {msg_num}"
        break
    except Exception as e:
        print(f"  #{msg_num}: EXCEPTION - {e}")
        crash_point = f"Exception at msg {msg_num}: {str(e)[:100]}"
        break
    
    time.sleep(0.3)

print("\n" + "=" * 60)
print("ENDURANCE RESULTS")
print(f"  Last successful message: #{last_good}")
print(f"  Crash point: {crash_point or 'NONE - all passed'}")

# Check history size
try:
    r = requests.get(f"{BASE}/api/game/sessions/{SID}", headers=H)
    if r.status_code == 200:
        sess = r.json()
        history = sess.get("game_history", [])
        hist_size = len(json.dumps(history))
        print(f"  Game history entries: {len(history)}")
        print(f"  History JSON size: {hist_size:,} bytes ({hist_size/1024:.1f} KB)")
except:
    pass

print("=" * 60)
