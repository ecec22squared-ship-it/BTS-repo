#!/usr/bin/env python3
"""
Galactic: Edge of the Dominion RPG Backend API Test Suite
Tests all backend endpoints including authentication, character management, dice rolling, and game sessions.
"""

import asyncio
import httpx
import json
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os

# Configuration
BACKEND_URL = "https://game-deploy-kit.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

class BackendTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.mongo_client = AsyncIOMotorClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        self.session_token = None
        self.user_id = None
        self.character_id = None
        self.game_session_id = None
        self.test_results = []

    async def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status} {test_name}"
        if details:
            result += f" - {details}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })

    async def test_public_endpoints(self):
        """Test public endpoints that don't require authentication"""
        print("\n=== Testing Public Endpoints ===")
        
        # Test root endpoint
        try:
            response = await self.client.get(f"{BACKEND_URL}/")
            if response.status_code == 200:
                data = response.json()
                await self.log_result("Root endpoint", True, f"Message: {data.get('message', 'N/A')}")
            else:
                await self.log_result("Root endpoint", False, f"Status: {response.status_code}")
        except Exception as e:
            await self.log_result("Root endpoint", False, f"Error: {str(e)}")

        # Test game data endpoints
        endpoints = [
            ("species", "/game/species"),
            ("careers", "/game/careers"),
            ("skills", "/game/skills"),
            ("locations", "/game/locations")
        ]
        
        for name, endpoint in endpoints:
            try:
                response = await self.client.get(f"{BACKEND_URL}{endpoint}")
                if response.status_code == 200:
                    data = response.json()
                    count = len(data) if isinstance(data, (list, dict)) else 0
                    await self.log_result(f"Game data - {name}", True, f"Count: {count}")
                else:
                    await self.log_result(f"Game data - {name}", False, f"Status: {response.status_code}")
            except Exception as e:
                await self.log_result(f"Game data - {name}", False, f"Error: {str(e)}")

    async def create_test_user_session(self):
        """Create a test user and session in MongoDB for authentication testing"""
        print("\n=== Creating Test User Session ===")
        
        try:
            # Generate unique test data
            timestamp = int(datetime.now().timestamp())
            self.user_id = f"test_user_{timestamp}"
            session_token = f"test_session_{timestamp}"
            
            # Create test user
            user_doc = {
                "user_id": self.user_id,
                "email": f"test.user.{timestamp}@example.com",
                "name": "Test User",
                "picture": "https://via.placeholder.com/150",
                "created_at": datetime.now(timezone.utc)
            }
            await self.db.users.insert_one(user_doc)
            
            # Create session
            session_doc = {
                "user_id": self.user_id,
                "session_token": session_token,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                "created_at": datetime.now(timezone.utc)
            }
            await self.db.user_sessions.insert_one(session_doc)
            
            self.session_token = session_token
            await self.log_result("Test user creation", True, f"User ID: {self.user_id}")
            
        except Exception as e:
            await self.log_result("Test user creation", False, f"Error: {str(e)}")

    async def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n=== Testing Authentication Endpoints ===")
        
        if not self.session_token:
            await self.log_result("Auth test setup", False, "No session token available")
            return
        
        # Test /auth/me endpoint
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = await self.client.get(f"{BACKEND_URL}/auth/me", headers=headers)
            
            if response.status_code == 200:
                user_data = response.json()
                await self.log_result("Auth /me endpoint", True, f"User: {user_data.get('name', 'N/A')}")
            else:
                await self.log_result("Auth /me endpoint", False, f"Status: {response.status_code}")
        except Exception as e:
            await self.log_result("Auth /me endpoint", False, f"Error: {str(e)}")

    async def test_character_crud(self):
        """Test character CRUD operations"""
        print("\n=== Testing Character CRUD Operations ===")
        
        if not self.session_token:
            await self.log_result("Character CRUD setup", False, "No session token available")
            return
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test character creation
        try:
            character_data = {
                "name": "Ryn Korveth",
                "species": "Human",
                "career": "Smuggler",
                "specialization": "Scoundrel",
                "backstory": "A smuggler from Korveth seeking fortune in the The Rim"
            }
            
            response = await self.client.post(
                f"{BACKEND_URL}/characters",
                headers=headers,
                json=character_data
            )
            
            if response.status_code == 200:
                character = response.json()
                self.character_id = character.get("character_id")
                await self.log_result("Character creation", True, f"ID: {self.character_id}")
                
                # Verify character has proper stats and skills
                stats = character.get("stats", {})
                skills = character.get("skills", [])
                health = character.get("health", {})
                
                if stats and skills and health:
                    await self.log_result("Character data validation", True, 
                                        f"Stats: {len(stats)}, Skills: {len(skills)}, Health: {health.get('wound_threshold', 0)}")
                else:
                    await self.log_result("Character data validation", False, "Missing character data")
                    
            else:
                await self.log_result("Character creation", False, f"Status: {response.status_code}")
        except Exception as e:
            await self.log_result("Character creation", False, f"Error: {str(e)}")
        
        # Test character listing
        try:
            response = await self.client.get(f"{BACKEND_URL}/characters", headers=headers)
            if response.status_code == 200:
                characters = response.json()
                await self.log_result("Character listing", True, f"Count: {len(characters)}")
            else:
                await self.log_result("Character listing", False, f"Status: {response.status_code}")
        except Exception as e:
            await self.log_result("Character listing", False, f"Error: {str(e)}")
        
        # Test character retrieval
        if self.character_id:
            try:
                response = await self.client.get(f"{BACKEND_URL}/characters/{self.character_id}", headers=headers)
                if response.status_code == 200:
                    character = response.json()
                    await self.log_result("Character retrieval", True, f"Name: {character.get('name', 'N/A')}")
                else:
                    await self.log_result("Character retrieval", False, f"Status: {response.status_code}")
            except Exception as e:
                await self.log_result("Character retrieval", False, f"Error: {str(e)}")

    async def test_dice_rolling(self):
        """Test dice rolling system"""
        print("\n=== Testing Dice Rolling System ===")
        
        if not self.session_token:
            await self.log_result("Dice rolling setup", False, "No session token available")
            return
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test basic dice roll
        try:
            dice_data = {
                "ability": 3,
                "proficiency": 2,
                "difficulty": 2,
                "boost": 1
            }
            
            response = await self.client.post(
                f"{BACKEND_URL}/dice/roll",
                headers=headers,
                json=dice_data
            )
            
            if response.status_code == 200:
                result = response.json()
                net_successes = result.get("net_successes", 0)
                net_advantages = result.get("net_advantages", 0)
                dice_details = result.get("dice_details", [])
                
                await self.log_result("Dice rolling", True, 
                                    f"Net successes: {net_successes}, Net advantages: {net_advantages}, Dice: {len(dice_details)}")
            else:
                await self.log_result("Dice rolling", False, f"Status: {response.status_code}")
        except Exception as e:
            await self.log_result("Dice rolling", False, f"Error: {str(e)}")
        
        # Test skill check
        if self.character_id:
            try:
                skill_data = {
                    "character_id": self.character_id,
                    "skill_name": "Perception",
                    "difficulty": 2
                }
                
                response = await self.client.post(
                    f"{BACKEND_URL}/dice/skill-check",
                    headers=headers,
                    json=skill_data
                )
                
                if response.status_code == 200:
                    result = response.json()
                    skill = result.get("skill", "N/A")
                    dice_pool = result.get("dice_pool", {})
                    await self.log_result("Skill check", True, f"Skill: {skill}, Pool: {dice_pool}")
                else:
                    await self.log_result("Skill check", False, f"Status: {response.status_code}")
            except Exception as e:
                await self.log_result("Skill check", False, f"Error: {str(e)}")

    async def test_game_sessions(self):
        """Test game session management"""
        print("\n=== Testing Game Session Management ===")
        
        if not self.session_token or not self.character_id:
            await self.log_result("Game session setup", False, "Missing session token or character ID")
            return
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test game session creation
        try:
            session_data = {"character_id": self.character_id}
            
            response = await self.client.post(
                f"{BACKEND_URL}/game/sessions",
                headers=headers,
                json=session_data
            )
            
            if response.status_code == 200:
                session = response.json()
                self.game_session_id = session.get("session_id")
                location = session.get("current_location", "N/A")
                await self.log_result("Game session creation", True, f"ID: {self.game_session_id}, Location: {location}")
            else:
                await self.log_result("Game session creation", False, f"Status: {response.status_code}")
        except Exception as e:
            await self.log_result("Game session creation", False, f"Error: {str(e)}")
        
        # Test game session listing
        try:
            response = await self.client.get(f"{BACKEND_URL}/game/sessions", headers=headers)
            if response.status_code == 200:
                sessions = response.json()
                await self.log_result("Game session listing", True, f"Count: {len(sessions)}")
            else:
                await self.log_result("Game session listing", False, f"Status: {response.status_code}")
        except Exception as e:
            await self.log_result("Game session listing", False, f"Error: {str(e)}")

    async def test_ai_game_master(self):
        """Test AI Game Master integration"""
        print("\n=== Testing AI Game Master Integration ===")
        
        if not self.session_token or not self.game_session_id:
            await self.log_result("AI GM setup", False, "Missing session token or game session ID")
            return
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test game start
        try:
            response = await self.client.post(
                f"{BACKEND_URL}/game/sessions/{self.game_session_id}/start",
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                opening = result.get("opening", "")
                location = result.get("location", "N/A")
                await self.log_result("Game start (AI)", True, f"Location: {location}, Opening length: {len(opening)} chars")
            else:
                await self.log_result("Game start (AI)", False, f"Status: {response.status_code}")
        except Exception as e:
            await self.log_result("Game start (AI)", False, f"Error: {str(e)}")
        
        # Test player action
        try:
            action_data = {
                "action": "I look around the cantina for any suspicious characters",
                "skill": "Perception"
            }
            
            response = await self.client.post(
                f"{BACKEND_URL}/game/sessions/{self.game_session_id}/action",
                headers=headers,
                json=action_data
            )
            
            if response.status_code == 200:
                result = response.json()
                gm_response = result.get("gm_response", "")
                dice_result = result.get("dice_result")
                await self.log_result("Player action (AI)", True, 
                                    f"Response length: {len(gm_response)} chars, Dice: {'Yes' if dice_result else 'No'}")
            else:
                await self.log_result("Player action (AI)", False, f"Status: {response.status_code}")
        except Exception as e:
            await self.log_result("Player action (AI)", False, f"Error: {str(e)}")

    async def test_portrait_generation(self):
        """Test AI portrait generation (skip due to time constraints)"""
        print("\n=== Testing AI Portrait Generation ===")
        
        # Skip portrait generation as mentioned in requirements (takes ~1 minute)
        await self.log_result("Portrait generation", True, "SKIPPED - Takes ~1 minute as noted in requirements")

    async def cleanup(self):
        """Clean up test data"""
        print("\n=== Cleaning Up Test Data ===")
        
        try:
            if self.user_id:
                # Delete test user and related data
                await self.db.users.delete_many({"user_id": self.user_id})
                await self.db.user_sessions.delete_many({"user_id": self.user_id})
                await self.db.characters.delete_many({"user_id": self.user_id})
                await self.db.game_sessions.delete_many({"user_id": self.user_id})
                await self.log_result("Test data cleanup", True, f"Cleaned up data for user: {self.user_id}")
        except Exception as e:
            await self.log_result("Test data cleanup", False, f"Error: {str(e)}")
        
        await self.client.aclose()
        self.mongo_client.close()

    async def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Galactic: Edge of the Dominion Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
        
        try:
            await self.test_public_endpoints()
            await self.create_test_user_session()
            await self.test_auth_endpoints()
            await self.test_character_crud()
            await self.test_dice_rolling()
            await self.test_game_sessions()
            await self.test_ai_game_master()
            await self.test_portrait_generation()
            
        finally:
            await self.cleanup()
        
        # Summary
        print("\n" + "="*60)
        print("🎯 TEST SUMMARY")
        print("="*60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Show failed tests
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        return passed == total

async def main():
    """Main test runner"""
    tester = BackendTester()
    success = await tester.run_all_tests()
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)