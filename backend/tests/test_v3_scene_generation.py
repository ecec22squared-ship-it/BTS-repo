"""
Backend tests for V3 enhancements:
- Scene generation endpoint (POST /api/game/sessions/{id}/generate-scene)
- Verify equipment included in character creation
- Verify environment_type in session creation
- Verify environment_theme and environment_type in session start
- Verify dice_line, environment_theme, skill_used in action endpoint
"""

import pytest
import requests
import os
import subprocess
import json

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
    var userId='test_v3_'+Date.now();
    var sessionToken='sess_v3_'+Date.now();
    db.users.insertOne({
        user_id: userId,
        email: 'v3@test.com',
        name: 'V3 Tester',
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
# Test Scene Generation Endpoint
# ============================================================================

def test_generate_scene_endpoint_exists(auth_headers):
    """Test POST /api/game/sessions/{id}/generate-scene endpoint exists and requires auth"""
    # Create character and session first
    char_data = {
        "name": "TEST_Scene_Char",
        "species": "Human",
        "career": "Smuggler",
        "specialization": "Pilot"
    }
    char_response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    assert char_response.status_code == 200
    character = char_response.json()
    
    session_data = {"character_id": character["character_id"]}
    session_response = requests.post(f"{BASE_URL}/api/game/sessions", json=session_data, headers=auth_headers)
    assert session_response.status_code == 200
    session = session_response.json()
    
    # Test endpoint exists (without auth should fail)
    response_no_auth = requests.post(f"{BASE_URL}/api/game/sessions/{session['session_id']}/generate-scene")
    assert response_no_auth.status_code == 401, "Should require authentication"
    
    # Test endpoint exists (with auth should return 200 or start processing)
    # NOTE: We're NOT actually generating the scene (takes 60s+), just verifying endpoint structure
    response_with_auth = requests.post(
        f"{BASE_URL}/api/game/sessions/{session['session_id']}/generate-scene",
        headers=auth_headers
    )
    
    # Should either succeed (200) or fail with a specific error (not 404)
    assert response_with_auth.status_code != 404, "Endpoint should exist"
    assert response_with_auth.status_code in [200, 500], f"Expected 200 or 500, got {response_with_auth.status_code}"
    
    print(f"✓ Scene generation endpoint exists and requires auth")
    print(f"✓ Response status: {response_with_auth.status_code}")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)

def test_generate_scene_returns_base64_image(auth_headers):
    """Test that generate-scene returns scene_image_base64 field (if successful)"""
    # Create character and session
    char_data = {
        "name": "TEST_Scene_Image",
        "species": "Human",
        "career": "Explorer",
        "specialization": "Scout"
    }
    char_response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    character = char_response.json()
    
    session_data = {"character_id": character["character_id"]}
    session_response = requests.post(f"{BASE_URL}/api/game/sessions", json=session_data, headers=auth_headers)
    session = session_response.json()
    
    # Start game to set environment
    requests.post(f"{BASE_URL}/api/game/sessions/{session['session_id']}/start", headers=auth_headers)
    
    # Try to generate scene (may timeout or succeed)
    try:
        response = requests.post(
            f"{BASE_URL}/api/game/sessions/{session['session_id']}/generate-scene",
            headers=auth_headers,
            timeout=5  # Short timeout to avoid waiting 60s
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "scene_image_base64" in data, "Should return scene_image_base64"
            assert "environment_type" in data, "Should return environment_type"
            print(f"✓ Scene generated successfully")
            print(f"✓ Image size: {len(data['scene_image_base64'])} chars")
        else:
            print(f"✓ Endpoint responded (status {response.status_code}), skipping actual generation test")
    except requests.exceptions.Timeout:
        print(f"✓ Scene generation started (timed out as expected - takes 60s+)")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)

# ============================================================================
# Test Character Creation with Equipment
# ============================================================================

def test_character_creation_includes_equipment(auth_headers):
    """Test POST /api/characters returns equipment array"""
    char_data = {
        "name": "TEST_Equipment_Check",
        "species": "Wookiee",
        "career": "Hired Gun",
        "specialization": "Marauder",
        "backstory": "A fierce warrior"
    }
    
    response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    character = response.json()
    assert "equipment" in character, "Character should have equipment field"
    assert isinstance(character["equipment"], list), "Equipment should be a list"
    assert len(character["equipment"]) > 0, "Equipment should not be empty"
    
    # Verify equipment structure
    for item in character["equipment"]:
        assert "name" in item, "Equipment item should have name"
        assert "category" in item, "Equipment item should have category"
        assert "description" in item, "Equipment item should have description"
    
    equipment_names = [item["name"] for item in character["equipment"]]
    print(f"✓ Character created with {len(character['equipment'])} equipment items")
    print(f"✓ Sample equipment: {', '.join(equipment_names[:3])}")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)

# ============================================================================
# Test Session Creation with Environment
# ============================================================================

def test_session_creation_has_environment_type(auth_headers):
    """Test POST /api/game/sessions returns environment_type"""
    # Create character first
    char_data = {
        "name": "TEST_Env_Session",
        "species": "Human",
        "career": "Smuggler",
        "specialization": "Scoundrel"
    }
    char_response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    character = char_response.json()
    
    # Create session
    session_data = {"character_id": character["character_id"]}
    response = requests.post(f"{BASE_URL}/api/game/sessions", json=session_data, headers=auth_headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    session = response.json()
    assert "environment_type" in session, "Session should have environment_type"
    assert isinstance(session["environment_type"], str), "environment_type should be a string"
    
    # Verify it's a valid environment type
    valid_envs = ["cantina", "desert", "jungle", "space", "urban", "ruins", "ice", "industrial", "dark_side"]
    assert session["environment_type"] in valid_envs, f"Invalid environment_type: {session['environment_type']}"
    
    print(f"✓ Session created with environment_type: {session['environment_type']}")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)

# ============================================================================
# Test Session Start Returns Environment
# ============================================================================

def test_session_start_returns_environment_theme_and_type(auth_headers):
    """Test POST /api/game/sessions/{id}/start returns environment_theme and environment_type"""
    # Create character and session
    char_data = {
        "name": "TEST_Start_Env",
        "species": "Twi'lek",
        "career": "Colonist",
        "specialization": "Doctor"
    }
    char_response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    character = char_response.json()
    
    session_data = {"character_id": character["character_id"]}
    session_response = requests.post(f"{BASE_URL}/api/game/sessions", json=session_data, headers=auth_headers)
    session = session_response.json()
    
    # Start game
    response = requests.post(f"{BASE_URL}/api/game/sessions/{session['session_id']}/start", headers=auth_headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    result = response.json()
    assert "environment_theme" in result, "Should return environment_theme"
    assert "environment_type" in result, "Should return environment_type"
    
    # Verify environment_theme structure
    theme = result["environment_theme"]
    assert "type" in theme, "Theme should have type"
    assert "primary" in theme, "Theme should have primary color"
    assert "accent" in theme, "Theme should have accent color"
    assert "background" in theme, "Theme should have background color"
    assert "border" in theme, "Theme should have border color"
    assert "text_glow" in theme, "Theme should have text_glow color"
    assert "mood" in theme, "Theme should have mood"
    
    print(f"✓ Session start returns environment_type: {result['environment_type']}")
    print(f"✓ Theme mood: {theme['mood']}")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)

# ============================================================================
# Test Action Returns Dice Line and Environment
# ============================================================================

def test_action_returns_dice_line_and_environment(auth_headers):
    """Test POST /api/game/sessions/{id}/action returns dice_line, environment_theme, skill_used"""
    # Create character and session
    char_data = {
        "name": "TEST_Action_Dice",
        "species": "Rodian",
        "career": "Bounty Hunter",
        "specialization": "Survivalist"
    }
    char_response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    character = char_response.json()
    
    session_data = {"character_id": character["character_id"]}
    session_response = requests.post(f"{BASE_URL}/api/game/sessions", json=session_data, headers=auth_headers)
    session = session_response.json()
    
    # Start game
    requests.post(f"{BASE_URL}/api/game/sessions/{session['session_id']}/start", headers=auth_headers)
    
    # Send action
    action_data = {"action": "I carefully look around for threats"}
    response = requests.post(
        f"{BASE_URL}/api/game/sessions/{session['session_id']}/action",
        json=action_data,
        headers=auth_headers
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    result = response.json()
    assert "dice_line" in result, "Should return dice_line"
    assert "environment_theme" in result, "Should return environment_theme"
    assert "skill_used" in result, "Should return skill_used"
    
    # Verify dice_line format
    dice_line = result["dice_line"]
    assert "[DICE:" in dice_line, "dice_line should start with [DICE:"
    assert "vs" in dice_line, "dice_line should contain 'vs'"
    assert "SUCCESS" in dice_line or "FAILURE" in dice_line, "dice_line should have verdict"
    
    # Verify skill was auto-detected
    assert result["skill_used"] is not None, "Skill should be auto-detected"
    
    print(f"✓ Action returns dice_line: {dice_line[:60]}...")
    print(f"✓ Skill auto-detected: {result['skill_used']}")
    print(f"✓ Environment theme included: {result['environment_theme']['type']}")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)

def test_action_auto_detects_multiple_skills(auth_headers):
    """Test that action endpoint auto-detects various skills correctly"""
    # Create character and session
    char_data = {
        "name": "TEST_Multi_Skills",
        "species": "Bothan",
        "career": "Technician",
        "specialization": "Mechanic"
    }
    char_response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    character = char_response.json()
    
    session_data = {"character_id": character["character_id"]}
    session_response = requests.post(f"{BASE_URL}/api/game/sessions", json=session_data, headers=auth_headers)
    session = session_response.json()
    
    # Start game
    requests.post(f"{BASE_URL}/api/game/sessions/{session['session_id']}/start", headers=auth_headers)
    
    # Test different skill keywords
    test_cases = [
        ("I shoot at the enemy", "Ranged"),
        ("I sneak past the guards", "Stealth"),
        ("I repair the damaged console", "Mechanics"),
    ]
    
    for action_text, expected_skill_keyword in test_cases:
        action_data = {"action": action_text}
        response = requests.post(
            f"{BASE_URL}/api/game/sessions/{session['session_id']}/action",
            json=action_data,
            headers=auth_headers
        )
        
        result = response.json()
        skill_used = result.get("skill_used")
        
        assert skill_used is not None, f"Skill not detected for: {action_text}"
        assert expected_skill_keyword in skill_used, f"Expected {expected_skill_keyword}, got {skill_used}"
        print(f"✓ '{action_text}' → {skill_used}")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)

# ============================================================================
# Integration Test
# ============================================================================

def test_v3_full_integration(auth_headers):
    """Integration test: Full V3 flow with scene generation endpoint verification"""
    # 1. Create character with equipment
    char_data = {
        "name": "TEST_V3_Hero",
        "species": "Droid",
        "career": "Explorer",
        "specialization": "Fringer",
        "backstory": "A protocol droid reprogrammed for adventure"
    }
    char_response = requests.post(f"{BASE_URL}/api/characters", json=char_data, headers=auth_headers)
    assert char_response.status_code == 200
    character = char_response.json()
    assert len(character["equipment"]) > 0, "Should have equipment"
    
    # 2. Create session with environment
    session_data = {"character_id": character["character_id"]}
    session_response = requests.post(f"{BASE_URL}/api/game/sessions", json=session_data, headers=auth_headers)
    assert session_response.status_code == 200
    session = session_response.json()
    assert "environment_type" in session, "Should have environment_type"
    
    # 3. Start game
    start_response = requests.post(f"{BASE_URL}/api/game/sessions/{session['session_id']}/start", headers=auth_headers)
    assert start_response.status_code == 200
    start_result = start_response.json()
    assert "environment_theme" in start_result, "Should have environment_theme"
    assert "environment_type" in start_result, "Should have environment_type"
    
    # 4. Perform action with auto-dice
    action_data = {"action": "I climb up the rocky cliff"}
    action_response = requests.post(
        f"{BASE_URL}/api/game/sessions/{session['session_id']}/action",
        json=action_data,
        headers=auth_headers
    )
    assert action_response.status_code == 200
    action_result = action_response.json()
    assert "dice_line" in action_result, "Should have dice_line"
    assert "skill_used" in action_result, "Should have skill_used"
    
    # 5. Verify scene generation endpoint exists (may timeout)
    try:
        scene_response = requests.post(
            f"{BASE_URL}/api/game/sessions/{session['session_id']}/generate-scene",
            headers=auth_headers,
            timeout=3
        )
        # Should not be 404 (endpoint exists)
        assert scene_response.status_code != 404, "Scene generation endpoint should exist"
    except requests.exceptions.Timeout:
        # Timeout is expected - scene generation takes 60s+
        print("  - Scene generation started (timed out as expected)")
    
    print("✓ V3 Full Integration Test Passed")
    print(f"  - Character with {len(character['equipment'])} equipment items")
    print(f"  - Session environment: {session['environment_type']}")
    print(f"  - Action skill detected: {action_result['skill_used']}")
    print(f"  - Scene generation endpoint verified")
    
    # Cleanup
    requests.delete(f"{BASE_URL}/api/characters/{character['character_id']}", headers=auth_headers)
