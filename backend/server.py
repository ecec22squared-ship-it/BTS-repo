from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import random
import base64

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# AI Integration imports
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# API Key
EMERGENT_LLM_KEY = os.getenv('EMERGENT_LLM_KEY')

# Create the main app without a prefix
app = FastAPI(title="Star Wars: Edge of the Empire RPG")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# Pydantic Models
# ============================================================================

class UserBase(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    session_token: str
    user_id: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CharacterStats(BaseModel):
    brawn: int = 2
    agility: int = 2
    intellect: int = 2
    cunning: int = 2
    willpower: int = 2
    presence: int = 2

class CharacterSkill(BaseModel):
    name: str
    rank: int = 0
    characteristic: str  # Which stat it's based on

class CharacterHealth(BaseModel):
    wounds: int = 0
    wound_threshold: int = 12
    strain: int = 0
    strain_threshold: int = 12

class CharacterExperience(BaseModel):
    total: int = 0
    available: int = 0

class Character(BaseModel):
    character_id: str = Field(default_factory=lambda: f"char_{uuid.uuid4().hex[:12]}")
    user_id: str
    name: str
    species: str
    career: str
    specialization: str
    stats: CharacterStats = Field(default_factory=CharacterStats)
    skills: List[CharacterSkill] = Field(default_factory=list)
    health: CharacterHealth = Field(default_factory=CharacterHealth)
    experience: CharacterExperience = Field(default_factory=CharacterExperience)
    equipment: List[str] = Field(default_factory=list)
    credits: int = 500
    portrait_base64: Optional[str] = None
    backstory: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CharacterCreate(BaseModel):
    name: str
    species: str
    career: str
    specialization: str
    backstory: Optional[str] = None

class GameMessage(BaseModel):
    role: str  # "player", "game_master", "system"
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Enemy(BaseModel):
    name: str
    wounds: int
    wound_threshold: int
    stats: CharacterStats = Field(default_factory=CharacterStats)
    abilities: List[str] = Field(default_factory=list)

class CombatState(BaseModel):
    in_combat: bool = False
    enemies: List[Enemy] = Field(default_factory=list)
    initiative_order: List[str] = Field(default_factory=list)
    current_turn: int = 0

class GameSession(BaseModel):
    session_id: str = Field(default_factory=lambda: f"game_{uuid.uuid4().hex[:12]}")
    user_id: str
    character_id: str
    story_context: List[str] = Field(default_factory=list)
    current_location: str = "Nar Shaddaa - The Smuggler's Moon"
    npcs: List[Dict[str, Any]] = Field(default_factory=list)
    combat_state: CombatState = Field(default_factory=CombatState)
    game_history: List[GameMessage] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DiceRoll(BaseModel):
    ability: int = 0  # Green dice
    proficiency: int = 0  # Yellow dice
    difficulty: int = 0  # Purple dice
    challenge: int = 0  # Red dice
    boost: int = 0  # Blue dice
    setback: int = 0  # Black dice
    force: int = 0  # White dice

class DiceResult(BaseModel):
    successes: int = 0
    failures: int = 0
    advantages: int = 0
    threats: int = 0
    triumphs: int = 0
    despairs: int = 0
    light_side: int = 0
    dark_side: int = 0
    net_successes: int = 0
    net_advantages: int = 0
    success: bool = False
    dice_details: List[Dict[str, Any]] = Field(default_factory=list)

class PlayerAction(BaseModel):
    action: str
    skill: Optional[str] = None

# ============================================================================
# Game Data - Species, Careers, Skills
# ============================================================================

SPECIES_DATA = {
    "Human": {
        "description": "Versatile and adaptable, humans are found throughout the galaxy.",
        "stat_bonuses": {},
        "starting_xp": 110,
        "wound_bonus": 0,
        "strain_bonus": 0,
        "special": "One free rank in two non-career skills"
    },
    "Twi'lek": {
        "description": "Colorful-skinned beings with head-tails called lekku, known for their grace.",
        "stat_bonuses": {"presence": 1},
        "starting_xp": 100,
        "wound_bonus": -1,
        "strain_bonus": 1,
        "special": "One free rank in Charm or Deception"
    },
    "Wookiee": {
        "description": "Towering, fur-covered warriors from Kashyyyk with incredible strength.",
        "stat_bonuses": {"brawn": 1},
        "starting_xp": 90,
        "wound_bonus": 4,
        "strain_bonus": -2,
        "special": "One free rank in Brawl"
    },
    "Rodian": {
        "description": "Green-skinned hunters from Rodia, known as bounty hunters across the galaxy.",
        "stat_bonuses": {"agility": 1},
        "starting_xp": 100,
        "wound_bonus": 0,
        "strain_bonus": 0,
        "special": "One free rank in Survival"
    },
    "Bothan": {
        "description": "Furry, politically-minded species renowned for their spy networks.",
        "stat_bonuses": {"cunning": 1},
        "starting_xp": 100,
        "wound_bonus": -1,
        "strain_bonus": 1,
        "special": "One free rank in Streetwise"
    },
    "Droid": {
        "description": "Mechanical beings with varied programming and capabilities.",
        "stat_bonuses": {"intellect": 1},
        "starting_xp": 175,
        "wound_bonus": 0,
        "strain_bonus": 0,
        "special": "Immune to mind-affecting abilities, does not heal naturally"
    }
}

CAREER_DATA = {
    "Bounty Hunter": {
        "description": "Trackers and killers who hunt the galaxy's most wanted for credits.",
        "career_skills": ["Athletics", "Brawl", "Perception", "Piloting (Planetary)", "Piloting (Space)", "Ranged (Heavy)", "Streetwise", "Vigilance"],
        "specializations": ["Assassin", "Gadgeteer", "Survivalist"]
    },
    "Colonist": {
        "description": "Settlers, entrepreneurs, and professionals seeking fortune in the Outer Rim.",
        "career_skills": ["Charm", "Deception", "Knowledge (Core Worlds)", "Knowledge (Education)", "Knowledge (Lore)", "Leadership", "Negotiation", "Streetwise"],
        "specializations": ["Doctor", "Politico", "Scholar"]
    },
    "Explorer": {
        "description": "Pathfinders and scouts who blaze trails through uncharted space.",
        "career_skills": ["Astrogation", "Cool", "Knowledge (Outer Rim)", "Knowledge (Xenology)", "Perception", "Piloting (Space)", "Survival", "Stealth"],
        "specializations": ["Fringer", "Scout", "Trader"]
    },
    "Hired Gun": {
        "description": "Mercenaries and soldiers who sell their combat skills to the highest bidder.",
        "career_skills": ["Athletics", "Brawl", "Discipline", "Melee", "Piloting (Planetary)", "Ranged (Light)", "Resilience", "Vigilance"],
        "specializations": ["Bodyguard", "Marauder", "Mercenary Soldier"]
    },
    "Smuggler": {
        "description": "Daring pilots and fast talkers who move goods the Empire doesn't want moved.",
        "career_skills": ["Coordination", "Deception", "Knowledge (Underworld)", "Perception", "Piloting (Space)", "Skulduggery", "Streetwise", "Vigilance"],
        "specializations": ["Pilot", "Scoundrel", "Thief"]
    },
    "Technician": {
        "description": "Mechanics, slicers, and engineers who keep everything running.",
        "career_skills": ["Astrogation", "Computers", "Coordination", "Discipline", "Knowledge (Outer Rim)", "Mechanics", "Perception", "Piloting (Planetary)"],
        "specializations": ["Mechanic", "Outlaw Tech", "Slicer"]
    }
}

ALL_SKILLS = [
    {"name": "Astrogation", "characteristic": "intellect"},
    {"name": "Athletics", "characteristic": "brawn"},
    {"name": "Brawl", "characteristic": "brawn"},
    {"name": "Charm", "characteristic": "presence"},
    {"name": "Coercion", "characteristic": "willpower"},
    {"name": "Computers", "characteristic": "intellect"},
    {"name": "Cool", "characteristic": "presence"},
    {"name": "Coordination", "characteristic": "agility"},
    {"name": "Deception", "characteristic": "cunning"},
    {"name": "Discipline", "characteristic": "willpower"},
    {"name": "Knowledge (Core Worlds)", "characteristic": "intellect"},
    {"name": "Knowledge (Education)", "characteristic": "intellect"},
    {"name": "Knowledge (Lore)", "characteristic": "intellect"},
    {"name": "Knowledge (Outer Rim)", "characteristic": "intellect"},
    {"name": "Knowledge (Underworld)", "characteristic": "intellect"},
    {"name": "Knowledge (Xenology)", "characteristic": "intellect"},
    {"name": "Leadership", "characteristic": "presence"},
    {"name": "Mechanics", "characteristic": "intellect"},
    {"name": "Medicine", "characteristic": "intellect"},
    {"name": "Melee", "characteristic": "brawn"},
    {"name": "Negotiation", "characteristic": "presence"},
    {"name": "Perception", "characteristic": "cunning"},
    {"name": "Piloting (Planetary)", "characteristic": "agility"},
    {"name": "Piloting (Space)", "characteristic": "agility"},
    {"name": "Ranged (Heavy)", "characteristic": "agility"},
    {"name": "Ranged (Light)", "characteristic": "agility"},
    {"name": "Resilience", "characteristic": "brawn"},
    {"name": "Skulduggery", "characteristic": "cunning"},
    {"name": "Stealth", "characteristic": "agility"},
    {"name": "Streetwise", "characteristic": "cunning"},
    {"name": "Survival", "characteristic": "cunning"},
    {"name": "Vigilance", "characteristic": "willpower"}
]

# Lesser-known Star Wars locations at the edge of the galaxy
LOCATIONS = [
    "Nar Shaddaa - The Smuggler's Moon",
    "Kessel - Spice Mining World",
    "Ryloth - Twi'lek Homeworld",
    "Ord Mantell - Scrapyard Planet",
    "Dathomir - Nightsister Domain",
    "Lothal - Outer Rim Frontier",
    "Florrum - Pirate Haven",
    "Takodana - Maz Kanata's Castle",
    "Jakku - Desert Wasteland",
    "Vandor - Frontier World",
    "Bracca - Ship Breaking Yards",
    "Batuu - Black Spire Outpost"
]

# ============================================================================
# Dice Rolling System - Edge of the Empire
# ============================================================================

def roll_ability_die():
    """Green die - 8 sides"""
    results = [
        {},  # Blank
        {"successes": 1},
        {"successes": 1},
        {"successes": 2},
        {"advantages": 1},
        {"advantages": 1},
        {"successes": 1, "advantages": 1},
        {"advantages": 2}
    ]
    return random.choice(results)

def roll_proficiency_die():
    """Yellow die - 12 sides"""
    results = [
        {},  # Blank
        {"successes": 1},
        {"successes": 1},
        {"successes": 2},
        {"successes": 2},
        {"advantages": 1},
        {"successes": 1, "advantages": 1},
        {"successes": 1, "advantages": 1},
        {"successes": 1, "advantages": 1},
        {"advantages": 2},
        {"advantages": 2},
        {"triumphs": 1}  # Triumph also counts as a success
    ]
    return random.choice(results)

def roll_difficulty_die():
    """Purple die - 8 sides"""
    results = [
        {},  # Blank
        {"failures": 1},
        {"failures": 2},
        {"threats": 1},
        {"threats": 1},
        {"threats": 1},
        {"threats": 2},
        {"failures": 1, "threats": 1}
    ]
    return random.choice(results)

def roll_challenge_die():
    """Red die - 12 sides"""
    results = [
        {},  # Blank
        {"failures": 1},
        {"failures": 1},
        {"failures": 2},
        {"failures": 2},
        {"threats": 1},
        {"threats": 1},
        {"failures": 1, "threats": 1},
        {"failures": 1, "threats": 1},
        {"threats": 2},
        {"threats": 2},
        {"despairs": 1}  # Despair also counts as a failure
    ]
    return random.choice(results)

def roll_boost_die():
    """Blue die - 6 sides"""
    results = [
        {},  # Blank
        {},  # Blank
        {"successes": 1},
        {"successes": 1, "advantages": 1},
        {"advantages": 2},
        {"advantages": 1}
    ]
    return random.choice(results)

def roll_setback_die():
    """Black die - 6 sides"""
    results = [
        {},  # Blank
        {},  # Blank
        {"failures": 1},
        {"failures": 1},
        {"threats": 1},
        {"threats": 1}
    ]
    return random.choice(results)

def roll_force_die():
    """White die - 12 sides"""
    results = [
        {"dark_side": 1},
        {"dark_side": 1},
        {"dark_side": 1},
        {"dark_side": 1},
        {"dark_side": 1},
        {"dark_side": 1},
        {"dark_side": 2},
        {"light_side": 1},
        {"light_side": 1},
        {"light_side": 2},
        {"light_side": 2},
        {"light_side": 2}
    ]
    return random.choice(results)

def roll_dice_pool(dice_roll: DiceRoll) -> DiceResult:
    """Roll the full dice pool and calculate results"""
    result = DiceResult()
    dice_details = []
    
    # Roll ability dice (green)
    for _ in range(dice_roll.ability):
        roll = roll_ability_die()
        dice_details.append({"type": "ability", "color": "green", "result": roll})
        result.successes += roll.get("successes", 0)
        result.advantages += roll.get("advantages", 0)
    
    # Roll proficiency dice (yellow)
    for _ in range(dice_roll.proficiency):
        roll = roll_proficiency_die()
        dice_details.append({"type": "proficiency", "color": "yellow", "result": roll})
        result.successes += roll.get("successes", 0)
        result.advantages += roll.get("advantages", 0)
        result.triumphs += roll.get("triumphs", 0)
        if roll.get("triumphs", 0) > 0:
            result.successes += 1  # Triumph counts as success
    
    # Roll difficulty dice (purple)
    for _ in range(dice_roll.difficulty):
        roll = roll_difficulty_die()
        dice_details.append({"type": "difficulty", "color": "purple", "result": roll})
        result.failures += roll.get("failures", 0)
        result.threats += roll.get("threats", 0)
    
    # Roll challenge dice (red)
    for _ in range(dice_roll.challenge):
        roll = roll_challenge_die()
        dice_details.append({"type": "challenge", "color": "red", "result": roll})
        result.failures += roll.get("failures", 0)
        result.threats += roll.get("threats", 0)
        result.despairs += roll.get("despairs", 0)
        if roll.get("despairs", 0) > 0:
            result.failures += 1  # Despair counts as failure
    
    # Roll boost dice (blue)
    for _ in range(dice_roll.boost):
        roll = roll_boost_die()
        dice_details.append({"type": "boost", "color": "blue", "result": roll})
        result.successes += roll.get("successes", 0)
        result.advantages += roll.get("advantages", 0)
    
    # Roll setback dice (black)
    for _ in range(dice_roll.setback):
        roll = roll_setback_die()
        dice_details.append({"type": "setback", "color": "black", "result": roll})
        result.failures += roll.get("failures", 0)
        result.threats += roll.get("threats", 0)
    
    # Roll force dice (white)
    for _ in range(dice_roll.force):
        roll = roll_force_die()
        dice_details.append({"type": "force", "color": "white", "result": roll})
        result.light_side += roll.get("light_side", 0)
        result.dark_side += roll.get("dark_side", 0)
    
    # Calculate net results
    result.net_successes = result.successes - result.failures
    result.net_advantages = result.advantages - result.threats
    result.success = result.net_successes > 0
    result.dice_details = dice_details
    
    return result

# ============================================================================
# Authentication Endpoints
# ============================================================================

async def get_current_user(request: Request) -> Optional[UserBase]:
    """Get current user from session token"""
    # Try cookie first
    session_token = request.cookies.get("session_token")
    
    # Fall back to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        return None
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        return None
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        return None
    
    return UserBase(**user_doc)

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    
    # Call Emergent Auth to get user data
    async with httpx.AsyncClient() as client:
        auth_response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        
        user_data = auth_response.json()
    
    # Check if user exists
    existing_user = await db.users.find_one(
        {"email": user_data["email"]},
        {"_id": 0}
    )
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user data
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": user_data["name"],
                "picture": user_data.get("picture")
            }}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(new_user)
    
    # Create session
    session_token = user_data.get("session_token", f"sess_{uuid.uuid4().hex}")
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Remove old sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        path="/",
        secure=True,
        httponly=True,
        samesite="none",
        expires=expires_at
    )
    
    # Get user
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "user": user_doc,
        "session_token": session_token
    }

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current user info"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout current user"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ============================================================================
# Game Data Endpoints
# ============================================================================

@api_router.get("/game/species")
async def get_species():
    """Get all available species"""
    return SPECIES_DATA

@api_router.get("/game/careers")
async def get_careers():
    """Get all available careers"""
    return CAREER_DATA

@api_router.get("/game/skills")
async def get_skills():
    """Get all available skills"""
    return ALL_SKILLS

@api_router.get("/game/locations")
async def get_locations():
    """Get all available locations"""
    return LOCATIONS

# ============================================================================
# Character Endpoints
# ============================================================================

@api_router.post("/characters")
async def create_character(char_data: CharacterCreate, request: Request):
    """Create a new character"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get species data
    species_info = SPECIES_DATA.get(char_data.species)
    if not species_info:
        raise HTTPException(status_code=400, detail="Invalid species")
    
    # Get career data
    career_info = CAREER_DATA.get(char_data.career)
    if not career_info:
        raise HTTPException(status_code=400, detail="Invalid career")
    
    if char_data.specialization not in career_info["specializations"]:
        raise HTTPException(status_code=400, detail="Invalid specialization for career")
    
    # Build stats with species bonuses
    stats = CharacterStats()
    for stat, bonus in species_info.get("stat_bonuses", {}).items():
        current_val = getattr(stats, stat)
        setattr(stats, stat, current_val + bonus)
    
    # Build skills with career skills at rank 1
    skills = []
    for skill_data in ALL_SKILLS:
        rank = 1 if skill_data["name"] in career_info["career_skills"] else 0
        skills.append(CharacterSkill(
            name=skill_data["name"],
            rank=rank,
            characteristic=skill_data["characteristic"]
        ))
    
    # Calculate health thresholds
    health = CharacterHealth(
        wound_threshold=10 + stats.brawn + species_info.get("wound_bonus", 0),
        strain_threshold=10 + stats.willpower + species_info.get("strain_bonus", 0)
    )
    
    # Create character
    character = Character(
        user_id=user.user_id,
        name=char_data.name,
        species=char_data.species,
        career=char_data.career,
        specialization=char_data.specialization,
        stats=stats,
        skills=skills,
        health=health,
        experience=CharacterExperience(
            total=species_info.get("starting_xp", 100),
            available=species_info.get("starting_xp", 100)
        ),
        backstory=char_data.backstory
    )
    
    # Save to database
    await db.characters.insert_one(character.model_dump())
    
    return character.model_dump()

@api_router.get("/characters")
async def get_characters(request: Request):
    """Get all characters for current user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    characters = await db.characters.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).to_list(100)
    
    return characters

@api_router.get("/characters/{character_id}")
async def get_character(character_id: str, request: Request):
    """Get a specific character"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    character = await db.characters.find_one(
        {"character_id": character_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    return character

@api_router.delete("/characters/{character_id}")
async def delete_character(character_id: str, request: Request):
    """Delete a character"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = await db.characters.delete_one(
        {"character_id": character_id, "user_id": user.user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Also delete associated game sessions
    await db.game_sessions.delete_many({"character_id": character_id})
    
    return {"message": "Character deleted"}

# ============================================================================
# Character Portrait Generation
# ============================================================================

@api_router.post("/characters/{character_id}/generate-portrait")
async def generate_portrait(character_id: str, request: Request):
    """Generate AI portrait for character"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    character = await db.characters.find_one(
        {"character_id": character_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Build portrait prompt
    species_desc = SPECIES_DATA.get(character["species"], {}).get("description", "")
    
    prompt = f"""Star Wars character portrait, cinematic lighting, detailed:
A {character['species']} {character['career']} named {character['name']}.
Species details: {species_desc}
Career: {character['career']} - {character['specialization']}
Style: Star Wars universe, dramatic lighting, space opera aesthetic, professional character art.
The character should look like they belong in the Outer Rim, weathered but determined.
Portrait style, head and shoulders, facing slightly to the side, dramatic backlighting."""
    
    try:
        image_gen = OpenAIImageGeneration(api_key=EMERGENT_LLM_KEY)
        images = await image_gen.generate_images(
            prompt=prompt,
            model="gpt-image-1",
            number_of_images=1
        )
        
        if images and len(images) > 0:
            image_base64 = base64.b64encode(images[0]).decode('utf-8')
            
            # Update character with portrait
            await db.characters.update_one(
                {"character_id": character_id},
                {"$set": {"portrait_base64": image_base64}}
            )
            
            return {"portrait_base64": image_base64}
        else:
            raise HTTPException(status_code=500, detail="No image generated")
    
    except Exception as e:
        logger.error(f"Portrait generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate portrait: {str(e)}")

# ============================================================================
# Dice Rolling Endpoints
# ============================================================================

@api_router.post("/dice/roll")
async def roll_dice(dice_roll: DiceRoll, request: Request):
    """Roll dice pool"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    result = roll_dice_pool(dice_roll)
    return result.model_dump()

@api_router.post("/dice/skill-check")
async def skill_check(request: Request):
    """Roll skill check for character"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    body = await request.json()
    character_id = body.get("character_id")
    skill_name = body.get("skill_name")
    difficulty = body.get("difficulty", 2)  # Default to Average difficulty
    
    character = await db.characters.find_one(
        {"character_id": character_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Find skill
    skill = None
    for s in character.get("skills", []):
        if s["name"] == skill_name:
            skill = s
            break
    
    if not skill:
        raise HTTPException(status_code=400, detail="Skill not found")
    
    # Get characteristic value
    char_value = character["stats"].get(skill["characteristic"], 2)
    skill_rank = skill.get("rank", 0)
    
    # Build dice pool: higher of char/skill becomes proficiency, lower becomes ability
    if char_value >= skill_rank:
        proficiency = skill_rank
        ability = char_value - skill_rank
    else:
        proficiency = char_value
        ability = skill_rank - char_value
    
    dice_roll = DiceRoll(
        ability=ability,
        proficiency=proficiency,
        difficulty=difficulty
    )
    
    result = roll_dice_pool(dice_roll)
    
    return {
        "skill": skill_name,
        "characteristic": skill["characteristic"],
        "dice_pool": {
            "ability": ability,
            "proficiency": proficiency,
            "difficulty": difficulty
        },
        "result": result.model_dump()
    }

# ============================================================================
# Game Session & AI Game Master Endpoints
# ============================================================================

@api_router.post("/game/sessions")
async def create_game_session(request: Request):
    """Create a new game session"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    body = await request.json()
    character_id = body.get("character_id")
    
    character = await db.characters.find_one(
        {"character_id": character_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Create new game session
    session = GameSession(
        user_id=user.user_id,
        character_id=character_id,
        current_location=random.choice(LOCATIONS)
    )
    
    await db.game_sessions.insert_one(session.model_dump())
    
    return session.model_dump()

@api_router.get("/game/sessions")
async def get_game_sessions(request: Request):
    """Get all game sessions for current user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    sessions = await db.game_sessions.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).to_list(100)
    
    return sessions

@api_router.get("/game/sessions/{session_id}")
async def get_game_session(session_id: str, request: Request):
    """Get a specific game session"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.game_sessions.find_one(
        {"session_id": session_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    
    return session

@api_router.post("/game/sessions/{session_id}/action")
async def player_action(session_id: str, action: PlayerAction, request: Request):
    """Process player action and get AI Game Master response"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Get game session
    session = await db.game_sessions.find_one(
        {"session_id": session_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    
    # Get character
    character = await db.characters.find_one(
        {"character_id": session["character_id"]},
        {"_id": 0}
    )
    
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Process skill check if needed
    dice_result = None
    if action.skill:
        # Find skill
        skill = None
        for s in character.get("skills", []):
            if s["name"] == action.skill:
                skill = s
                break
        
        if skill:
            char_value = character["stats"].get(skill["characteristic"], 2)
            skill_rank = skill.get("rank", 0)
            
            if char_value >= skill_rank:
                proficiency = skill_rank
                ability = char_value - skill_rank
            else:
                proficiency = char_value
                ability = skill_rank - char_value
            
            # Determine difficulty based on context
            difficulty = 2  # Average by default
            
            dice_roll = DiceRoll(
                ability=ability,
                proficiency=proficiency,
                difficulty=difficulty
            )
            
            dice_result = roll_dice_pool(dice_roll)
    
    # Build context for AI
    recent_history = session.get("game_history", [])[-10:]
    history_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in recent_history])
    
    combat_context = ""
    if session.get("combat_state", {}).get("in_combat"):
        enemies = session["combat_state"].get("enemies", [])
        enemy_text = ", ".join([f"{e['name']} ({e['wounds']}/{e['wound_threshold']} wounds)" for e in enemies])
        combat_context = f"\nCURRENT COMBAT: Fighting against {enemy_text}"
    
    dice_context = ""
    if dice_result:
        dice_context = f"""
DICE ROLL RESULT for {action.skill}:
- Net Successes: {dice_result.net_successes}
- Net Advantages: {dice_result.net_advantages}
- Triumphs: {dice_result.triumphs}
- Despairs: {dice_result.despairs}
- Success: {'Yes' if dice_result.success else 'No'}
"""
    
    system_prompt = f"""You are the Game Master for a Star Wars: Edge of the Empire tabletop RPG.
You create immersive, cinematic narratives set at the edge of the Star Wars galaxy.

CURRENT CHARACTER:
- Name: {character['name']}
- Species: {character['species']}
- Career: {character['career']} ({character['specialization']})
- Location: {session['current_location']}
- Health: {character['health']['wounds']}/{character['health']['wound_threshold']} wounds
{combat_context}

GAME CONTEXT:
{history_text}

STYLE GUIDELINES:
- Write cinematic, immersive descriptions
- Include sensory details (sounds, smells, atmosphere)
- Reference Star Wars lore and technology appropriately
- Create tension and stakes
- Give NPCs distinct personalities
- Keep responses to 2-3 paragraphs
- End with a clear situation for the player to respond to
- If combat occurs, describe it dramatically
- Reference the dice results narratively when provided

{dice_context}

The player's action: {action.action}

Respond as the Game Master, narrating what happens next."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"eote_{session_id}",
            system_message=system_prompt
        ).with_model("anthropic", "claude-4-sonnet-20250514")
        
        user_message = UserMessage(text=action.action)
        gm_response = await chat.send_message(user_message)
        
        # Add messages to history
        new_history = session.get("game_history", [])
        new_history.append({
            "role": "player",
            "content": action.action,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        new_history.append({
            "role": "game_master",
            "content": gm_response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Update session
        await db.game_sessions.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "game_history": new_history,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        response_data = {
            "gm_response": gm_response,
            "dice_result": dice_result.model_dump() if dice_result else None,
            "location": session["current_location"]
        }
        
        return response_data
        
    except Exception as e:
        logger.error(f"AI Game Master error: {e}")
        raise HTTPException(status_code=500, detail=f"AI Game Master error: {str(e)}")

@api_router.post("/game/sessions/{session_id}/start")
async def start_game_session(session_id: str, request: Request):
    """Start a game session with an opening narrative"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.game_sessions.find_one(
        {"session_id": session_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    
    character = await db.characters.find_one(
        {"character_id": session["character_id"]},
        {"_id": 0}
    )
    
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Generate opening narrative
    system_prompt = f"""You are the Game Master for a Star Wars: Edge of the Empire tabletop RPG.
Create an immersive opening scene for a new adventure.

CHARACTER:
- Name: {character['name']}
- Species: {character['species']}
- Career: {character['career']} ({character['specialization']})
- Backstory: {character.get('backstory', 'A traveler seeking fortune at the galaxy edge.')}

LOCATION: {session['current_location']}

Create a dramatic opening scene that:
1. Describes the location with vivid sensory details
2. Establishes the atmosphere (seedy cantina, busy spaceport, etc.)
3. Introduces an immediate situation or hook
4. Gives the character a reason to act
5. Ends with a clear prompt for the player

Keep it to 3-4 paragraphs. Make it feel like Star Wars!"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"eote_start_{session_id}",
            system_message=system_prompt
        ).with_model("anthropic", "claude-4-sonnet-20250514")
        
        user_message = UserMessage(text="Begin the adventure!")
        opening = await chat.send_message(user_message)
        
        # Add to history
        new_history = [{
            "role": "game_master",
            "content": opening,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }]
        
        await db.game_sessions.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "game_history": new_history,
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return {
            "opening": opening,
            "location": session["current_location"],
            "character": character
        }
        
    except Exception as e:
        logger.error(f"Start game error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start game: {str(e)}")

# ============================================================================
# Root endpoint
# ============================================================================

@api_router.get("/")
async def root():
    return {"message": "Star Wars: Edge of the Empire RPG API", "version": "1.0.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
