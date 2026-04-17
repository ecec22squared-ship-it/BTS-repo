"""
Backend tests for V2 enhancements:
- Equipment system (GET /api/game/equipment)
- Environment themes (GET /api/game/environments)
- Character creation with auto-equipment
- Game sessions with environment themes
- Auto-dice rolls with skill detection
"""

import pytest
import requests
import os
import subprocess
import json

# Get BASE_URL from frontend .env
BASE_URL = "https://game-deploy-kit.preview.emergentagent.com"

# Test session token (will be created in setup)
TEST_SESSION_TOKEN = None
TEST_USER_ID = None

@pytest.fixture(scope="module", autouse=True)
def setup_test_user():
    """Create test user and session in MongoDB"""
    global TEST_SESSION_TOKEN, TEST_USER_ID
    
    # Create test user via mongosh
    mongo_cmd = """
    mongosh --quiet --eval "
    use('test_database');
    var userId='test-user-'+Date.now();
    var sessionToken='test_session_'+Date.now();
    db.users.insertOne({
        user_id: userId,
        email: 'test@example.com',
        name: 'Test User',
        created_at: new Date()
    });
    db.user_sessions.insertOne({
        user_id: userId,
        session_token: sessionToken,
        expires_at: new Date(Date.now() + 7*24*60*60*1000),
        created_at: new Date()
    });
    print(JSON.stringify({userId: userId, sessionToken: sessionToken}));
    "
    """
    
    try:
        result = subprocess.run(mongo_cmd, shell=True, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            # Parse the JSON output
            output_lines = result.stdout.strip().split('\n')
            for line in output_lines:
                if 'userId' in line and 'sessionToken' in line:
                    data = json.loads(line)
                    TEST_USER_ID = data['userId']
                    TEST_SESSION_TOKEN = data['sessionToken']
                    print(f"✓ Created test user: {TEST_USER_ID}")
                    print(f"✓ Session token: {TEST_SESSION_TOKEN}")
                    break
        
        if not TEST_SESSION_TOKEN:
            pytest.skip("Failed to create test user session")
    except Exception as e:
        pytest.skip(f"MongoDB setup failed: {e}")
    
    yield
    
    # Cleanup
    cleanup_cmd = f"""
    mongosh --quiet --eval "
    use('test_database');
    db.users.deleteOne({{user_id: '{TEST_USER_ID}'}});
    db.user_sessions.deleteOne({{session_token: '{TEST_SESSION_TOKEN}'}});
    db.characters.deleteMany({{user_id: '{TEST_USER_ID}'}});
    db.game_sessions.deleteMany({{user_id: '{TEST_USER_ID}'}});
    "
    """
    subprocess.run(cleanup_cmd, shell=True, capture_output=True)

@pytest.fixture
def auth_headers():
    """Return headers with auth token"""
    return {
        "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
        "Content-Type": "application/json"
    }

# ============================================================================
# Test Equipment System
# ============================================================================

def test_get_equipment_endpoint():
    """Test GET /api/game/equipment returns all career equipment"""
    response = requests.get(f"{BASE_URL}/api/game/equipment")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert isinstance(data, dict), "Equipment data should be a dictionary"
    
    # Check all 6 careers are present
    expected_careers = ["Bounty Hunter", "Colonist", "Explorer", "Hired Gun", "Smuggler", "Technician"]
    for career in expected_careers:
        assert career in data, f"Missing career: {career}"
        assert "base" in data[career], f"{career} missing 'base' equipment"
        assert isinstance(data[career]["base"], list), f"{career} base should be a list"
        assert len(data[career]["base"]) > 0, f"{career} base equipment is empty"
        
        # Check base equipment structure
        for item in data[career]["base"]:
            assert "name" in item, "Equipment item missing 'name'"
            assert "category" in item, "Equipment item missing 'category'"
            assert "description" in item, "Equipment item missing 'description'"
            assert item["category"] in ["weapon", "armor", "gear", "tool"], f"Invalid category: {item['category']}"
    
    print(f"✓ Equipment endpoint returns data for {len(data)} careers")
    print(f"✓ Bounty Hunter base equipment: {len(data['Bounty Hunter']['base'])} items")

def test_equipment_has_specializations():
    """Test that each career has specialization-specific equipment"""
    response = requests.get(f"{BASE_URL}/api/game/equipment")
    data = response.json()
    
    # Check Bounty Hunter specializations
    bh_data = data["Bounty Hunter"]
    assert "Assassin" in bh_data, "Missing Assassin specialization"
    assert "Gadgeteer" in bh_data, "Missing Gadgeteer specialization"
    assert "Survivalist" in bh_data, "Missing Survivalist specialization"
    
    # Check Assassin has vibroknife
    assassin_items = [item["name"] for item in bh_data["Assassin"]]
    assert "Vibroknife" in assassin_items, "Assassin missing Vibroknife"
    
    print(f"✓ Specialization equipment verified")

# ============================================================================
# Test Environment Themes
# ============================================================================

def test_get_environments_endpoint():
    """Test GET /api/game/environments returns all 9 environment themes"""
    response = requests.get(f"{BASE_URL}/api/game/environments")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert isinstance(data, dict), "Environments should be a dictionary"
    
    # Check all 9 environments
    expected_envs = ["cantina", "desert", "jungle", "space", "urban", "ruins", "ice", "industrial", "dark_side"]
    assert len(data) == 9, f"Expected 9 environments, got {len(data)}"
    
    for env in expected_envs:
        assert env in data, f"Missing environment: {env}"
        theme = data[env]
        
        # Check theme structure
        assert "type" in theme, f"{env} missing 'type'"
        assert "primary" in theme, f"{env} missing 'primary' color"
        assert "accent" in theme, f"{env} missing 'accent' color"
        assert "background" in theme, f"{env} missing 'background' color"
        assert "border" in theme, f"{env} missing 'border' color"
        assert "text_glow" in theme, f"{env} missing 'text_glow' color"
        assert "mood" in theme, f"{env} missing 'mood' description"
        
        # Validate color format (should start with #)
        assert theme["primary"].startswith("#"), f"{env} primary color invalid"
        assert theme["accent"].startswith("#"), f"{env} accent color invalid"
    
    print(f"✓ Environment themes endpoint returns {len(data)} themes")
    print(f"✓ Cantina mood: {data['cantina']['mood']}")

# ============================================================================
# Test Character Creation with Auto-Equipment
# ============================================================================

def test_create_character_with_equipment(auth_headers):
    """Test POST /api/characters assigns starter equipment based on career+specialization"""
    char_data = {
        "name": "TEST_Kael Voss",
        "species": "Human",
        "career": "Bounty Hunter",
        "specialization": "Assassin",
        "backstory": "A deadly tracker from the The Rim"
    }
    
    response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    character = response.json()
    assert "character_id" in character, "Missing character_id"
    assert "equipment" in character, "Missing equipment field"
    
    equipment = character["equipment"]
    assert isinstance(equipment, list), "Equipment should be a list"
    assert len(equipment) > 0, "Equipment list is empty"
    
    # Check for base Bounty Hunter equipment
    equipment_names = [item["name"] for item in equipment]
    assert "Blaster Rifle" in equipment_names, "Missing base Blaster Rifle"
    assert "Heavy Clothing" in equipment_names, "Missing base Heavy Clothing"
    assert "Binder Cuffs" in equipment_names, "Missing base Binder Cuffs"
    
    # Check for Assassin specialization equipment
    assert "Vibroknife" in equipment_names, "Missing Assassin Vibroknife"
    assert "Optical Camouflage Cloak" in equipment_names, "Missing Assassin cloak"
    
    # Verify equipment structure
    for item in equipment:
        assert "name" in item, "Equipment item missing name"
        assert "category" in item, "Equipment item missing category"
        assert "description" in item, "Equipment item missing description"
    
    print(f"✓ Character created with {len(equipment)} equipment items")
    print(f"✓ Equipment includes: {', '.join(equipment_names[:3])}...")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)

def test_different_specialization_equipment(auth_headers):
    """Test that different specializations get different equipment"""
    # Create Gadgeteer
    gadgeteer_data = {
        "name": "TEST_Tech Specialist",
        "species": "Human",
        "career": "Bounty Hunter",
        "specialization": "Gadgeteer"
    }
    
    response = requests.post(f"{BASE_URL}/api/characters", json=gadgeteer_data, headers=auth_headers)
    assert response.status_code == 200
    
    character = response.json()
    equipment_names = [item["name"] for item in character["equipment"]]
    
    # Should have Gadgeteer-specific items, NOT Assassin items
    assert "Utility Belt" in equipment_names, "Missing Gadgeteer Utility Belt"
    assert "Extra Reload" in equipment_names, "Missing Gadgeteer Extra Reload"
    assert "Vibroknife" not in equipment_names, "Should not have Assassin Vibroknife"
    
    print(f"✓ Gadgeteer has correct specialization equipment")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)

# ============================================================================
# Test Game Sessions with Environment
# ============================================================================

def test_create_session_with_environment(auth_headers):
    """Test POST /api/game/sessions includes environment_type and environment_theme"""
    # First create a character
    char_data = {
        "name": "TEST_Session Char",
        "species": "Human",
        "career": "Smuggler",
        "specialization": "Pilot"
    }
    char_response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    character = char_response.json()
    
    # Create game session
    session_data = {"character_id": character["character_id"]}
    response = requests.post(f"{BASE_URL}/api/game/sessions", json=session_data, headers=auth_headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    session = response.json()
    assert "session_id" in session, "Missing session_id"
    assert "environment_type" in session, "Missing environment_type"
    assert "environment_theme" in session, "Missing environment_theme"
    
    # Validate environment_theme structure
    theme = session["environment_theme"]
    assert "type" in theme, "Theme missing type"
    assert "primary" in theme, "Theme missing primary color"
    assert "mood" in theme, "Theme missing mood"
    
    print(f"✓ Session created with environment: {session['environment_type']}")
    print(f"✓ Theme mood: {theme['mood']}")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)

def test_session_start_returns_environment(auth_headers):
    """Test POST /api/game/sessions/{id}/start returns environment_type and environment_theme"""
    # Create character and session
    char_data = {
        "name": "TEST_Start Char",
        "species": "Human",
        "career": "Explorer",
        "specialization": "Scout"
    }
    char_response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    character = char_response.json()
    
    session_data = {"character_id": character["character_id"]}
    session_response = requests.post(f"{BASE_URL}/api/game/sessions", json=session_data, headers=auth_headers)
    session = session_response.json()
    
    # Start the game
    response = requests.post(f"{BASE_URL}/api/game/sessions/{session['session_id']}/start", headers=auth_headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    result = response.json()
    assert "opening" in result, "Missing opening narrative"
    assert "environment_type" in result, "Missing environment_type"
    assert "environment_theme" in result, "Missing environment_theme"
    
    theme = result["environment_theme"]
    assert "primary" in theme, "Theme missing primary color"
    assert "mood" in theme, "Theme missing mood"
    
    print(f"✓ Game start returns environment: {result['environment_type']}")
    print(f"✓ Opening narrative length: {len(result['opening'])} chars")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)

# ============================================================================
# Test Auto-Dice Rolls with Skill Detection
# ============================================================================

def test_action_auto_detects_skill(auth_headers):
    """Test POST /api/game/sessions/{id}/action auto-detects skill from action text"""
    # Create character and session
    char_data = {
        "name": "TEST_Dice Char",
        "species": "Human",
        "career": "Hired Gun",
        "specialization": "Mercenary Soldier"
    }
    char_response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    character = char_response.json()
    
    session_data = {"character_id": character["character_id"]}
    session_response = requests.post(f"{BASE_URL}/api/game/sessions", json=session_data, headers=auth_headers)
    session = session_response.json()
    
    # Start game first
    requests.post(f"{BASE_URL}/api/game/sessions/{session['session_id']}/start", headers=auth_headers)
    
    # Send action with skill keyword
    action_data = {"action": "I shoot at the dominion sentinel"}
    response = requests.post(
        f"{BASE_URL}/api/game/sessions/{session['session_id']}/action",
        json=action_data,
        headers=auth_headers
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    result = response.json()
    assert "gm_response" in result, "Missing gm_response"
    assert "dice_result" in result, "Missing dice_result"
    assert "dice_line" in result, "Missing dice_line"
    assert "skill_used" in result, "Missing skill_used"
    assert "environment_theme" in result, "Missing environment_theme"
    
    # Check skill was detected
    assert result["skill_used"] is not None, "Skill should be auto-detected"
    assert "Ranged" in result["skill_used"], f"Expected Ranged skill, got {result['skill_used']}"
    
    # Check dice_line format
    dice_line = result["dice_line"]
    assert "[DICE:" in dice_line, "dice_line should start with [DICE:"
    assert "vs" in dice_line, "dice_line should contain 'vs'"
    assert "SUCCESS" in dice_line or "FAILURE" in dice_line, "dice_line should have verdict"
    
    print(f"✓ Skill auto-detected: {result['skill_used']}")
    print(f"✓ Dice line: {dice_line[:80]}...")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)

def test_action_returns_dice_line_format(auth_headers):
    """Test that dice_line is properly formatted with skill, pool, and outcome"""
    # Create character and session
    char_data = {
        "name": "TEST_Format Char",
        "species": "Xeel'thara",
        "career": "Smuggler",
        "specialization": "Scoundrel"
    }
    char_response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    character = char_response.json()
    
    session_data = {"character_id": character["character_id"]}
    session_response = requests.post(f"{BASE_URL}/api/game/sessions", json=session_data, headers=auth_headers)
    session = session_response.json()
    
    # Start game
    requests.post(f"{BASE_URL}/api/game/sessions/{session['session_id']}/start", headers=auth_headers)
    
    # Send action
    action_data = {"action": "I try to sneak past the guards"}
    response = requests.post(
        f"{BASE_URL}/api/game/sessions/{session['session_id']}/action",
        json=action_data,
        headers=auth_headers
    )
    
    result = response.json()
    dice_line = result.get("dice_line", "")
    
    # Validate dice_line format
    assert "[DICE:" in dice_line, "Should start with [DICE:"
    assert "]" in dice_line, "Should end with ]"
    assert "Stealth" in dice_line or "Ranged" in dice_line or "Brawl" in dice_line, "Should contain skill name"
    
    # Check for dice pool components
    assert "Ability" in dice_line or "Proficiency" in dice_line or "0" in dice_line, "Should show dice pool"
    assert "Difficulty" in dice_line or "Challenge" in dice_line or "0" in dice_line, "Should show opposition"
    
    print(f"✓ Dice line properly formatted")
    print(f"✓ Full dice line: {dice_line}")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)

def test_multiple_skill_keywords(auth_headers):
    """Test different action keywords trigger correct skills"""
    # Create character
    char_data = {
        "name": "TEST_Multi Skill",
        "species": "Human",
        "career": "Technician",
        "specialization": "Slicer"
    }
    char_response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    character = char_response.json()
    
    session_data = {"character_id": character["character_id"]}
    session_response = requests.post(f"{BASE_URL}/api/game/sessions", json=session_data, headers=auth_headers)
    session = session_response.json()
    
    # Start game
    requests.post(f"{BASE_URL}/api/game/sessions/{session['session_id']}/start", headers=auth_headers)
    
    # Test different actions
    test_cases = [
        ("I hack into the terminal", "Computers"),
        ("I repair the ship", "Mechanics"),
        ("I look around carefully", "Perception"),
    ]
    
    for action_text, expected_skill in test_cases:
        action_data = {"action": action_text}
        response = requests.post(
            f"{BASE_URL}/api/game/sessions/{session['session_id']}/action",
            json=action_data,
            headers=auth_headers
        )
        result = response.json()
        skill_used = result.get("skill_used")
        
        assert skill_used is not None, f"Skill not detected for: {action_text}"
        assert expected_skill in skill_used, f"Expected {expected_skill}, got {skill_used} for: {action_text}"
        print(f"✓ '{action_text}' → {skill_used}")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)

# ============================================================================
# Integration Test: Full Flow
# ============================================================================

def test_full_v2_flow(auth_headers):
    """Integration test: Create character with equipment, start game with environment, perform action with dice"""
    # 1. Get equipment data
    equip_response = requests.get(f"{BASE_URL}/api/game/equipment")
    assert equip_response.status_code == 200
    
    # 2. Get environment data
    env_response = requests.get(f"{BASE_URL}/api/game/environments")
    assert env_response.status_code == 200
    
    # 3. Create character (should get auto-equipment)
    char_data = {
        "name": "TEST_Integration Hero",
        "species": "Krrrhash",
        "career": "Hired Gun",
        "specialization": "Marauder",
        "backstory": "A fierce warrior seeking glory"
    }
    char_response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    assert char_response.status_code == 200
    character = char_response.json()
    
    # Verify equipment
    assert len(character["equipment"]) > 0, "Character should have equipment"
    equipment_names = [item["name"] for item in character["equipment"]]
    assert "Blaster Carbine" in equipment_names, "Should have base Hired Gun weapon"
    assert "Vibroknucklers" in equipment_names, "Should have Marauder specialization weapon"
    
    # 4. Create game session (should have environment)
    session_data = {"character_id": character["character_id"]}
    session_response = requests.post(f"{BASE_URL}/api/game/sessions", json=session_data, headers=auth_headers)
    assert session_response.status_code == 200
    session = session_response.json()
    assert "environment_theme" in session
    
    # 5. Start game (should return environment)
    start_response = requests.post(f"{BASE_URL}/api/game/sessions/{session['session_id']}/start", headers=auth_headers)
    assert start_response.status_code == 200
    start_result = start_response.json()
    assert "environment_theme" in start_result
    assert "opening" in start_result
    
    # 6. Perform action (should auto-detect skill and roll dice)
    action_data = {"action": "I punch the nearest enemy"}
    action_response = requests.post(
        f"{BASE_URL}/api/game/sessions/{session['session_id']}/action",
        json=action_data,
        headers=auth_headers
    )
    assert action_response.status_code == 200
    action_result = action_response.json()
    
    assert "dice_line" in action_result, "Should have dice_line"
    assert "environment_theme" in action_result, "Should have environment_theme"
    assert action_result["skill_used"] == "Brawl", "Should detect Brawl skill"
    
    print("✓ Full V2 integration flow completed successfully")
    print(f"  - Character with {len(character['equipment'])} equipment items")
    print(f"  - Session in {session['environment_type']} environment")
    print(f"  - Action with auto-detected skill: {action_result['skill_used']}")
    print(f"  - Dice line: {action_result['dice_line'][:60]}...")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)
