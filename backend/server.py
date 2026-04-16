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
import json

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
    coins: int = 100  # Starting balance for new players
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
    characteristic: str

class CharacterHealth(BaseModel):
    wounds: int = 0
    wound_threshold: int = 12
    strain: int = 0
    strain_threshold: int = 12

class CharacterExperience(BaseModel):
    total: int = 0
    available: int = 0

class EquipmentItem(BaseModel):
    name: str
    category: str  # weapon, armor, gear, tool
    description: str

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
    equipment: List[Dict[str, str]] = Field(default_factory=list)
    credits: int = 500
    portrait_base64: Optional[str] = None
    backstory: Optional[str] = None
    skill_usage: Dict[str, int] = Field(default_factory=dict)  # tracks usage count per skill
    skill_talents: List[str] = Field(default_factory=list)  # unlocked specialist talents
    total_skill_ups: int = 0  # total rank-ups earned through use
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CharacterCreate(BaseModel):
    name: str
    species: str
    career: str
    specialization: str
    backstory: Optional[str] = None

class GameMessage(BaseModel):
    role: str
    content: str
    dice_line: Optional[str] = None
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

class StoryJournal(BaseModel):
    npcs_met: List[Dict[str, str]] = Field(default_factory=list)  # [{name, description, disposition}]
    locations_visited: List[str] = Field(default_factory=list)
    major_events: List[str] = Field(default_factory=list)
    unresolved_threads: List[str] = Field(default_factory=list)
    player_reputation: str = "unknown newcomer"
    summary: str = ""

class GameSession(BaseModel):
    session_id: str = Field(default_factory=lambda: f"game_{uuid.uuid4().hex[:12]}")
    user_id: str
    character_id: str
    scenario_id: Optional[str] = None
    story_context: List[str] = Field(default_factory=list)
    current_location: str = "Nar Shaddaa - The Smuggler's Moon"
    environment_type: str = "urban"
    era: str = "Order 66 - Fall of the Republic"
    scene_image_base64: Optional[str] = None
    npcs: List[Dict[str, Any]] = Field(default_factory=list)
    combat_state: CombatState = Field(default_factory=CombatState)
    game_history: List[GameMessage] = Field(default_factory=list)
    story_journal: StoryJournal = Field(default_factory=StoryJournal)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DiceRoll(BaseModel):
    ability: int = 0
    proficiency: int = 0
    difficulty: int = 0
    challenge: int = 0
    boost: int = 0
    setback: int = 0
    force: int = 0

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
    force_action: bool = False  # True = player confirmed after warning

# ============================================================================
# Player Profile & Global Events Models
# ============================================================================

SCENARIO_TYPES = ["combat", "intrigue", "exploration", "social", "heist", "survival", "mystery"]

class PlayerProfile(BaseModel):
    """Hidden profile tracking player preferences — never shown to user"""
    user_id: str
    scenario_preferences: Dict[str, float] = Field(default_factory=lambda: {t: 1.0 for t in SCENARIO_TYPES})
    total_responses: int = 0
    avg_response_length: float = 0.0
    scenarios_chosen: List[Dict[str, Any]] = Field(default_factory=list)  # [{type, chosen_at}]
    response_quality: Dict[str, List[float]] = Field(default_factory=lambda: {t: [] for t in SCENARIO_TYPES})
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GlobalEvent(BaseModel):
    """Shared galaxy event visible to other players in same location/era"""
    event_id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex[:12]}")
    location: str
    era: str
    event_type: str  # explosion, battle, arrest, escape, discovery, etc.
    description: str  # What happened (anonymous)
    actor_species: str  # Species of the character who caused it
    actor_career: str  # Career of the character
    actor_description: str  # Brief anonymous description for NPCification
    impact: str  # How this affects the environment
    timestamp_game: str  # In-game time reference
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source_user_id: str  # For filtering out own events
    source_session_id: str

# ============================================================================
# Player Profile Engine
# ============================================================================

async def get_or_create_player_profile(user_id: str) -> dict:
    profile = await db.player_profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not profile:
        profile = PlayerProfile(user_id=user_id).model_dump()
        await db.player_profiles.insert_one(profile)
    return profile

async def update_player_preference(user_id: str, scenario_type: str, chosen: bool):
    """Update preference when player chooses a scenario"""
    profile = await get_or_create_player_profile(user_id)
    prefs = profile.get("scenario_preferences", {t: 1.0 for t in SCENARIO_TYPES})
    if chosen:
        prefs[scenario_type] = min(3.0, prefs.get(scenario_type, 1.0) + 0.3)
    scenarios = profile.get("scenarios_chosen", [])
    scenarios.append({"type": scenario_type, "chosen_at": datetime.now(timezone.utc).isoformat()})
    await db.player_profiles.update_one(
        {"user_id": user_id},
        {"$set": {"scenario_preferences": prefs, "scenarios_chosen": scenarios[-50:], "updated_at": datetime.now(timezone.utc)}}
    )

async def analyze_response_quality(user_id: str, action_text: str, scenario_type: str):
    """Analyze player response to adapt preferences. Longer/detailed = positive."""
    profile = await get_or_create_player_profile(user_id)
    word_count = len(action_text.split())
    # Score: 0-1 based on engagement. Short replies (<5 words) = low, detailed (>20) = high
    quality = min(1.0, max(0.1, word_count / 25.0))

    prefs = profile.get("scenario_preferences", {t: 1.0 for t in SCENARIO_TYPES})
    response_quality = profile.get("response_quality", {t: [] for t in SCENARIO_TYPES})

    # Keep last 10 quality scores per type
    if scenario_type in response_quality:
        response_quality[scenario_type].append(quality)
        response_quality[scenario_type] = response_quality[scenario_type][-10:]
    else:
        response_quality[scenario_type] = [quality]

    # Adjust preference based on average quality
    avg_quality = sum(response_quality.get(scenario_type, [0.5])) / max(1, len(response_quality.get(scenario_type, [1])))
    if avg_quality > 0.6:
        prefs[scenario_type] = min(3.0, prefs.get(scenario_type, 1.0) + 0.05)
    elif avg_quality < 0.3:
        prefs[scenario_type] = max(0.2, prefs.get(scenario_type, 1.0) - 0.05)

    total = profile.get("total_responses", 0) + 1
    running_avg = profile.get("avg_response_length", 0)
    new_avg = ((running_avg * (total - 1)) + word_count) / total

    await db.player_profiles.update_one(
        {"user_id": user_id},
        {"$set": {
            "scenario_preferences": prefs,
            "response_quality": response_quality,
            "total_responses": total,
            "avg_response_length": new_avg,
            "updated_at": datetime.now(timezone.utc),
        }}
    )

def get_weighted_scenario_types(profile: dict, count: int = 7) -> List[str]:
    """Select scenario types weighted by player preference"""
    prefs = profile.get("scenario_preferences", {t: 1.0 for t in SCENARIO_TYPES})
    types = list(prefs.keys())
    weights = [prefs.get(t, 1.0) for t in types]
    total_weight = sum(weights)
    weights = [w / total_weight for w in weights]
    # Weighted selection with some variety
    selected = []
    for _ in range(count):
        r = random.random()
        cumulative = 0
        for i, w in enumerate(weights):
            cumulative += w
            if r <= cumulative:
                selected.append(types[i])
                break
    return selected

# ============================================================================
# Global Events Engine
# ============================================================================

async def save_global_event(session: dict, character: dict, event_description: str, event_type: str, impact: str):
    """Save a significant event to the global events collection"""
    event = GlobalEvent(
        location=session.get("current_location", "Unknown"),
        era=session.get("era", "Galactic Civil War"),
        event_type=event_type,
        description=event_description,
        actor_species=character.get("species", "Unknown"),
        actor_career=character.get("career", "Unknown"),
        actor_description=f"a {character.get('species', 'mysterious')} {character.get('career', 'traveler')}",
        impact=impact,
        timestamp_game=datetime.now(timezone.utc).isoformat(),
        source_user_id=session.get("user_id", ""),
        source_session_id=session.get("session_id", ""),
    )
    await db.global_events.insert_one(event.model_dump())

async def get_nearby_global_events(location: str, era: str, exclude_user_id: str, limit: int = 5) -> List[dict]:
    """Get recent global events at the same location/era from other players"""
    events = await db.global_events.find(
        {
            "location": location,
            "era": era,
            "source_user_id": {"$ne": exclude_user_id},
            "created_at": {"$gte": datetime.now(timezone.utc) - timedelta(hours=48)},
        },
        {"_id": 0, "source_user_id": 0, "source_session_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return events

async def detect_and_save_significant_event(gm_response: str, session: dict, character: dict):
    """Detect if the GM response contains a significant event worth sharing globally"""
    lower = gm_response.lower()
    event_keywords = {
        "explosion": ["explosion", "explode", "detonat", "blast", "blew up"],
        "battle": ["battle", "firefight", "skirmish", "combat broke out", "war zone"],
        "arrest": ["arrested", "captured", "imprisoned", "detained", "taken into custody"],
        "escape": ["escaped", "fled", "broke free", "getaway", "evaded"],
        "discovery": ["discovered", "found", "uncovered", "revealed", "ancient"],
        "crash": ["crashed", "wreck", "collision", "impact", "smashed into"],
        "murder": ["killed", "assassinated", "murdered", "slain", "dead body"],
        "theft": ["stole", "robbed", "heist", "stolen", "burglary"],
    }
    for event_type, keywords in event_keywords.items():
        if any(kw in lower for kw in keywords):
            # Extract a brief impact description
            sentences = gm_response.split('.')
            relevant = [s.strip() for s in sentences if any(kw in s.lower() for kw in keywords)]
            if relevant:
                desc = relevant[0][:200]
                impact = f"Witnesses reported {event_type} activity in the area."
                await save_global_event(session, character, desc, event_type, impact)
                break  # One event per response

# ============================================================================
# Game Data - Species, Careers, Skills, Equipment, Environments
# ============================================================================

SPECIES_DATA = {
    "Human": {
        "description": "Versatile and adaptable, humans are found throughout the galaxy.",
        "stat_bonuses": {},
        "starting_xp": 110,
        "wound_bonus": 0,
        "strain_bonus": 0,
        "special": "One free rank in two non-career skills",
        "appearance": "Varied skin tones, builds and hair colors. Adaptable and numerous."
    },
    "Twi'lek": {
        "description": "Colorful-skinned beings with head-tails called lekku, known for their grace.",
        "stat_bonuses": {"presence": 1},
        "starting_xp": 100,
        "wound_bonus": -1,
        "strain_bonus": 1,
        "special": "One free rank in Charm or Deception",
        "appearance": "Brightly colored skin (blue, green, red, orange), twin head-tails (lekku), expressive eyes."
    },
    "Wookiee": {
        "description": "Towering, fur-covered warriors from Kashyyyk with incredible strength.",
        "stat_bonuses": {"brawn": 1},
        "starting_xp": 90,
        "wound_bonus": 4,
        "strain_bonus": -2,
        "special": "One free rank in Brawl",
        "appearance": "Over 2 meters tall, covered in thick brown/auburn/white fur, powerful build, fierce eyes."
    },
    "Rodian": {
        "description": "Green-skinned hunters from Rodia, known as bounty hunters across the galaxy.",
        "stat_bonuses": {"agility": 1},
        "starting_xp": 100,
        "wound_bonus": 0,
        "strain_bonus": 0,
        "special": "One free rank in Survival",
        "appearance": "Green scaly skin, large multifaceted eyes, snout-like face, suction-cupped fingers, antennae."
    },
    "Bothan": {
        "description": "Furry, politically-minded species renowned for their spy networks.",
        "stat_bonuses": {"cunning": 1},
        "starting_xp": 100,
        "wound_bonus": -1,
        "strain_bonus": 1,
        "special": "One free rank in Streetwise",
        "appearance": "Short tan/brown fur, tapering face, large pointed ears, sharp inquisitive eyes."
    },
    "Droid": {
        "description": "Mechanical beings with varied programming and capabilities.",
        "stat_bonuses": {"intellect": 1},
        "starting_xp": 175,
        "wound_bonus": 0,
        "strain_bonus": 0,
        "special": "Immune to mind-affecting abilities, does not heal naturally",
        "appearance": "Metallic chassis, photoreceptor eyes that glow, varied plating from polished to battle-scarred."
    },
    "Trandoshan": {
        "description": "Fearsome reptilian hunters from Trandosha who worship the Scorekeeper. They earn honor through the hunt, and their brutal claws and regeneration make them terrifying combatants.",
        "stat_bonuses": {"brawn": 1},
        "starting_xp": 90,
        "wound_bonus": 1,
        "strain_bonus": -1,
        "special": "Claws (+1 Brawl damage), Regeneration (heal 1 extra wound per rest), free rank in Perception",
        "appearance": "Thick green, orange, or brown reptilian scales, heavy brow ridges, slit-pupil predatory eyes, three clawed fingers, hunched powerful build, sharp teeth visible in a perpetual snarl."
    },
    "Chiss": {
        "description": "Blue-skinned near-humans from the Unknown Regions. Cold, calculating, and supremely tactical, the Chiss Ascendancy values discipline and strategic brilliance above all.",
        "stat_bonuses": {"intellect": 1},
        "starting_xp": 100,
        "wound_bonus": 1,
        "strain_bonus": 1,
        "special": "Infrared Vision (remove setback from darkness), free rank in Cool",
        "appearance": "Blue skin ranging from pale frost to deep cobalt, glowing red eyes with no visible pupil, jet-black hair, sharp aristocratic features, impeccable military posture."
    },
    "Zabrak": {
        "description": "Proud, fierce near-humans from Iridonia, recognizable by their crown of vestigial horns. Two hearts give them extraordinary endurance, and a cultural tradition of pain tolerance makes them relentless.",
        "stat_bonuses": {"willpower": 1},
        "starting_xp": 100,
        "wound_bonus": 0,
        "strain_bonus": 0,
        "special": "Fearsome Countenance (+1 Boost to Coercion), second heart grants +1 Boost to Resilience checks",
        "appearance": "Crown of short horns ringing the skull, bold geometric facial tattoos in black or red, skin tones from pale to dark brown or red (Dathomirian), intense focused eyes, lean muscular frame."
    },
    "Togruta": {
        "description": "Communal hunters from the grasslands of Shili. Their hollow montrals grant passive echolocation, and their pack-hunting instincts make them natural team players and perceptive combatants.",
        "stat_bonuses": {"cunning": 1},
        "starting_xp": 100,
        "wound_bonus": -1,
        "strain_bonus": 1,
        "special": "Echolocation (spatial awareness, +1 Boost to Perception), Pack Instinct (+1 Boost when assisting allies)",
        "appearance": "Vibrant skin in orange, red, or blue-gray, bold white facial markings, tall hollow montrals (head horns) with blue-and-white striped patterns, three colorful head-tails (lekku), large expressive eyes."
    },
    "Mon Calamari": {
        "description": "Amphibious beings from the ocean world of Mon Cala. Brilliant engineers and tacticians, they built the Rebel Alliance's finest warships. Their large eyes see perfectly in darkness and underwater.",
        "stat_bonuses": {"intellect": 1},
        "starting_xp": 100,
        "wound_bonus": 0,
        "strain_bonus": 0,
        "special": "Amphibious (breathe underwater), Enhanced Vision (see in darkness and murky water), free rank in Knowledge (Education)",
        "appearance": "Salmon or russet-colored rubbery skin with lighter underbelly, large bulbous eyes on the sides of the head providing wide-angle vision, webbed hands, high domed cranium, moist glistening skin."
    }
}

# ============================================================================
# Species Cultural Gear
# ============================================================================

SPECIES_CULTURAL_GEAR = {
    "Human": [
        {"name": "Personal Holoprojector", "category": "gear", "description": "Portable hologram device for messages and star charts, ubiquitous among spacers"},
        {"name": "Imperial Travel Papers", "category": "gear", "description": "Forged or legitimate documentation for crossing Imperial checkpoints"},
    ],
    "Twi'lek": [
        {"name": "Ceremonial Lekku Wraps", "category": "gear", "description": "Embroidered silk wraps in clan colors, worn during important negotiations"},
        {"name": "Rylothean Heat Stone", "category": "gear", "description": "Polished volcanic stone from Ryloth, radiates warmth and cultural pride"},
    ],
    "Wookiee": [
        {"name": "Ryyk Blade", "category": "weapon", "description": "Traditional Kashyyyk war blade, curved wood-and-metal construction, +1 Melee damage"},
        {"name": "Braided Honor Bandolier", "category": "armor", "description": "Woven from wroshyr tree bark, each braid represents a life debt or victory"},
    ],
    "Rodian": [
        {"name": "Hunting Trophy Collection", "category": "gear", "description": "Preserved teeth, claws, and horns from past hunts, displayed with pride"},
        {"name": "Rodian Tracking Goggles", "category": "gear", "description": "Multi-spectrum lenses calibrated for Rodian eyes, +1 Boost to tracking"},
    ],
    "Bothan": [
        {"name": "Encrypted Spy Datapad", "category": "gear", "description": "Military-grade encryption, connects to the Bothan Spynet's dead-drop network"},
        {"name": "Information Broker Token", "category": "gear", "description": "Black market credential chip granting access to underworld data exchanges"},
    ],
    "Droid": [
        {"name": "Self-Repair Module", "category": "gear", "description": "Autonomous micro-welder and circuit patcher, heals 1 wound per rest without tools"},
        {"name": "Memory Core Backup Chip", "category": "gear", "description": "Encrypted personality and memory backup, protection against memory wipes"},
    ],
    "Trandoshan": [
        {"name": "Scorekeeper Tally Device", "category": "gear", "description": "Sacred wrist-mounted counter tracking jagannath points from each hunt"},
        {"name": "Trandoshan Hunting Claws", "category": "weapon", "description": "Sharpened natural claw sheaths, ritual-hardened bone tips, +1 Brawl damage"},
    ],
    "Chiss": [
        {"name": "Ascendancy Insignia", "category": "gear", "description": "Charric-metal rank pin from the Chiss Defense Fleet, commands respect in the Unknown Regions"},
        {"name": "Tactical Analysis Monocle", "category": "gear", "description": "Heads-up display lens with threat assessment overlay, +1 Boost to initiative"},
    ],
    "Zabrak": [
        {"name": "Iridonian War Paint Kit", "category": "gear", "description": "Ritual pigments in clan patterns, applied before battle for intimidation and focus"},
        {"name": "Horn-Care Ritual Oil", "category": "gear", "description": "Sacred oil that hardens vestigial horns, part of the coming-of-age ceremony"},
    ],
    "Togruta": [
        {"name": "Akul-Tooth Trophy Necklace", "category": "gear", "description": "Fangs from the deadly akul beast, proving the wearer survived the solo hunt rite"},
        {"name": "Shili Hunting Horn", "category": "gear", "description": "Curved bone horn used to coordinate pack hunts, carries for kilometers across grassland"},
    ],
    "Mon Calamari": [
        {"name": "Aquatic Rebreather", "category": "gear", "description": "Keeps gills moist in dry environments, doubles as emergency underwater oxygen supply"},
        {"name": "Mon Cala Ship Schematics", "category": "gear", "description": "Encrypted cruiser blueprints passed down through shipwright families, invaluable to Rebels"},
    ],
}

# ============================================================================
# Skill Advancement System - Use-Based XP
# ============================================================================

# Doubled thresholds: uses required for each rank
SKILL_RANK_THRESHOLDS = {
    2: 6,    # 6 uses to reach rank 2
    3: 16,   # 16 uses to reach rank 3
    4: 30,   # 30 uses to reach rank 4
    5: 50,   # 50 uses to reach rank 5
}

# Specialist talents unlocked at certain ranks
SKILL_SPECIALIST_TALENTS = {
    "Ranged (Light)": {
        3: {"name": "Quick Draw", "description": "Draw and fire in a single action, +1 Boost on first attack"},
        5: {"name": "Deadeye", "description": "Spend an action aiming to add +2 Boost to next Ranged (Light) attack"},
    },
    "Ranged (Heavy)": {
        3: {"name": "Suppressive Fire", "description": "Pin enemies behind cover, adding +1 Setback to their next action"},
        5: {"name": "Heavy Hitter", "description": "Critical hits with heavy weapons deal +10 critical result"},
    },
    "Brawl": {
        3: {"name": "Iron Fist", "description": "+1 damage to all Brawl attacks permanently"},
        5: {"name": "Bone Breaker", "description": "On 3+ net successes, target suffers a Critical Injury"},
    },
    "Melee": {
        3: {"name": "Blade Dancer", "description": "+1 Boost to Melee when wielding a bladed weapon"},
        5: {"name": "Whirlwind Strike", "description": "Attack two adjacent enemies with a single Melee check"},
    },
    "Stealth": {
        3: {"name": "Shadow Meld", "description": "Remain hidden after attacking once per encounter"},
        5: {"name": "Ghost Walk", "description": "Move at full speed while maintaining Stealth, no penalty"},
    },
    "Perception": {
        3: {"name": "Keen Senses", "description": "Automatically detect hidden enemies within short range"},
        5: {"name": "Danger Sense", "description": "+1 Boost to all initiative checks, cannot be surprised"},
    },
    "Piloting (Space)": {
        3: {"name": "Evasive Maneuvers", "description": "+1 Setback to enemy attacks while piloting"},
        5: {"name": "Ace Pilot", "description": "Perform two pilot actions per turn instead of one"},
    },
    "Piloting (Planetary)": {
        3: {"name": "Terrain Specialist", "description": "Ignore difficult terrain penalties while driving"},
        5: {"name": "Stunt Driver", "description": "Perform impossible vehicle maneuvers at reduced difficulty"},
    },
    "Charm": {
        3: {"name": "Silver Tongue", "description": "+1 Boost to Charm when first meeting someone"},
        5: {"name": "Irresistible", "description": "Targets of Charm checks cannot spend Threat against you"},
    },
    "Deception": {
        3: {"name": "Convincing Liar", "description": "Targets need an extra Success to see through your lies"},
        5: {"name": "Master of Disguise", "description": "Maintain false identity indefinitely, +2 Boost to disguise checks"},
    },
    "Coercion": {
        3: {"name": "Menacing Presence", "description": "Intimidated targets suffer +1 Setback to their next check"},
        5: {"name": "Terrifying", "description": "Weak-willed NPCs flee or surrender on a successful Coercion"},
    },
    "Negotiation": {
        3: {"name": "Shrewd Bargainer", "description": "Always get 10% better prices on purchases and sales"},
        5: {"name": "Master Dealer", "description": "Once per session, change the terms of any deal retroactively"},
    },
    "Computers": {
        3: {"name": "Back Door", "description": "Leave a hidden access point in any system you slice"},
        5: {"name": "Ghost in the Machine", "description": "Slice remotely through any connected network without physical access"},
    },
    "Mechanics": {
        3: {"name": "Jury Rig", "description": "Temporarily repair any device with improvised materials"},
        5: {"name": "Master Tinkerer", "description": "Add a permanent modification to any weapon or device"},
    },
    "Medicine": {
        3: {"name": "Field Surgeon", "description": "Heal 2 extra wounds when using Medicine to treat injuries"},
        5: {"name": "Miracle Worker", "description": "Revive an incapacitated ally once per session"},
    },
    "Athletics": {
        3: {"name": "Peak Fitness", "description": "+1 to wound threshold permanently"},
        5: {"name": "Unstoppable", "description": "Ignore the first Critical Injury suffered each session"},
    },
    "Vigilance": {
        3: {"name": "Always Ready", "description": "+1 Boost to initiative checks in unexpected situations"},
        5: {"name": "Combat Prescience", "description": "Act first in the initiative order once per session"},
    },
    "Survival": {
        3: {"name": "Forager", "description": "Find food and water in any environment, no check required"},
        5: {"name": "One With Nature", "description": "+1 Boost to all checks while outdoors or in wilderness"},
    },
    "Streetwise": {
        3: {"name": "Connected", "description": "Always know a contact in any settlement you visit"},
        5: {"name": "Underworld King", "description": "Access black market goods at half price, fences ask no questions"},
    },
    "Cool": {
        3: {"name": "Unflappable", "description": "Recover 2 strain at the start of each encounter"},
        5: {"name": "Ice Cold", "description": "Immune to Fear effects, allies within short range get +1 Boost to Discipline"},
    },
    "Discipline": {
        3: {"name": "Iron Will", "description": "+1 strain threshold permanently"},
        5: {"name": "Indomitable", "description": "Once per session, automatically succeed on a Discipline check"},
    },
    "Leadership": {
        3: {"name": "Inspiring Words", "description": "Allies recover 1 strain when you succeed on a Leadership check"},
        5: {"name": "Born Leader", "description": "Grant an ally an extra action once per encounter"},
    },
    "Skulduggery": {
        3: {"name": "Sleight of Hand", "description": "Palm objects or plant items undetected, +1 Boost"},
        5: {"name": "Master Thief", "description": "Bypass any mechanical lock or electronic security without a check"},
    },
    "Coordination": {
        3: {"name": "Cat-like Reflexes", "description": "Reduce fall damage by half, +1 Boost to dodge"},
        5: {"name": "Acrobatic Strike", "description": "Use Coordination instead of combat skill once per encounter"},
    },
    "Resilience": {
        3: {"name": "Tough as Nails", "description": "+1 soak against all damage sources"},
        5: {"name": "Indestructible", "description": "Reduce all Critical Injury results by 20"},
    },
}

# Stat improvement milestones (every 20 total skill-ups)
STAT_IMPROVEMENT_THRESHOLD = 20

def process_skill_advancement(character: dict, skill_name: str) -> dict:
    """Process skill usage and check for rank-up / talent unlock.
    Returns advancement info dict."""
    skill_usage = character.get("skill_usage", {})
    current_uses = skill_usage.get(skill_name, 0) + 1
    skill_usage[skill_name] = current_uses

    advancement = {"skill_name": skill_name, "new_uses": current_uses, "ranked_up": False, "new_rank": 0, "talent_unlocked": None, "stat_improved": False}

    # Find current skill rank
    current_rank = 0
    for s in character.get("skills", []):
        if s["name"] == skill_name:
            current_rank = s.get("rank", 0)
            break

    # Check for rank-up
    next_rank = current_rank + 1
    if next_rank <= 5:
        threshold = SKILL_RANK_THRESHOLDS.get(next_rank, 999)
        if current_uses >= threshold:
            advancement["ranked_up"] = True
            advancement["new_rank"] = next_rank

            # Check for talent unlock
            talents = SKILL_SPECIALIST_TALENTS.get(skill_name, {})
            if next_rank in talents:
                advancement["talent_unlocked"] = talents[next_rank]

    return advancement, skill_usage

def assess_action_difficulty(character: dict, skill_name: str, action_text: str) -> dict:
    """Assess whether the action is beyond the character's capability and generate a warning."""
    # Find skill rank
    skill_rank = 0
    skill_char = "brawn"
    for s in character.get("skills", []):
        if s["name"] == skill_name:
            skill_rank = s.get("rank", 0)
            skill_char = s.get("characteristic", "brawn")
            break
    else:
        # Completely unknown skill - check ALL_SKILLS for the characteristic
        for sk in ALL_SKILLS:
            if sk["name"] == skill_name:
                skill_char = sk["characteristic"]
                break

    stat_value = character.get("stats", {}).get(skill_char, 2)
    total_dice = skill_rank + stat_value

    # Determine difficulty context
    is_untrained = skill_rank == 0
    is_low_stat = stat_value <= 2
    is_very_hard = total_dice <= 2  # Only 2 green dice vs any difficulty

    warning = None
    severity = "none"

    if is_untrained and is_low_stat:
        severity = "severe"
        career = character.get("career", "adventurer")
        species = character.get("species", "being")
        warning = (
            f"Your character {character.get('name', 'you')} has NO training in {skill_name} "
            f"and lacks natural aptitude in {skill_char.title()} (stat: {stat_value}). "
            f"As a {species} {career}, this is far outside your expertise. "
            f"With only {total_dice} dice against the challenge, failure is very likely "
            f"and could have serious consequences. "
            f"Consider using a skill you're trained in, or finding another approach."
        )
    elif is_untrained and not is_low_stat:
        severity = "moderate"
        warning = (
            f"Your character has no formal training in {skill_name}. "
            f"You're relying entirely on raw {skill_char.title()} ({stat_value}). "
            f"You might pull it off on instinct, but don't count on it."
        )
    elif is_very_hard:
        severity = "hard"
        warning = (
            f"This action requires exceptional {skill_name} ability. "
            f"Your current skill pool ({total_dice} dice) makes success unlikely against this challenge. "
            f"The odds are stacked heavily against you."
        )

    return {
        "warning": warning,
        "severity": severity,
        "skill_rank": skill_rank,
        "stat_value": stat_value,
        "total_dice": total_dice,
        "is_untrained": is_untrained,
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

# ============================================================================
# Starter Equipment Packages
# ============================================================================

CAREER_EQUIPMENT = {
    "Bounty Hunter": {
        "base": [
            {"name": "Blaster Rifle", "category": "weapon", "description": "BlasTech E-11 blaster rifle, reliable and deadly at range"},
            {"name": "Heavy Clothing", "category": "armor", "description": "Reinforced spacer garb, +1 soak"},
            {"name": "Binder Cuffs", "category": "gear", "description": "Durasteel restraints for live captures"},
            {"name": "Comlink (handheld)", "category": "gear", "description": "Standard frequency communicator"},
            {"name": "Bounty Hunter License", "category": "gear", "description": "Imperial Guild authorization chip"},
        ],
        "Assassin": [
            {"name": "Vibroknife", "category": "weapon", "description": "Molecularly sharpened blade, near-silent kills"},
            {"name": "Optical Camouflage Cloak", "category": "gear", "description": "Light-bending shroud, +1 Boost to Stealth"},
        ],
        "Gadgeteer": [
            {"name": "Extra Reload", "category": "gear", "description": "Spare power packs and ammunition"},
            {"name": "Utility Belt", "category": "gear", "description": "Modular tool harness with built-in scanner"},
        ],
        "Survivalist": [
            {"name": "Survival Knife", "category": "weapon", "description": "Durasteel bush knife with fire starter pommel"},
            {"name": "Wilderness Ration Pack", "category": "gear", "description": "7-day concentrated sustenance pack"},
        ],
    },
    "Colonist": {
        "base": [
            {"name": "Hold-out Blaster", "category": "weapon", "description": "Compact CDEF blaster, easily concealed"},
            {"name": "Datapad", "category": "gear", "description": "Portable computer terminal with encrypted storage"},
            {"name": "Comlink (handheld)", "category": "gear", "description": "Standard frequency communicator"},
            {"name": "Fine Clothing", "category": "armor", "description": "Well-tailored Outer Rim fashion, projects authority"},
        ],
        "Doctor": [
            {"name": "Medpac", "category": "gear", "description": "Field surgery kit with bacta patches and stim injectors"},
            {"name": "Stimpack (x3)", "category": "gear", "description": "Emergency healing syringes, recover 5 wounds each"},
        ],
        "Politico": [
            {"name": "Holo-Messenger", "category": "gear", "description": "Encrypted portable hologram projector"},
            {"name": "Forged Credentials", "category": "gear", "description": "High-quality falsified Imperial documentation"},
        ],
        "Scholar": [
            {"name": "Holocron Fragment", "category": "gear", "description": "Ancient data crystal containing lost knowledge"},
            {"name": "Scanner", "category": "gear", "description": "Multi-spectrum analysis device"},
        ],
    },
    "Explorer": {
        "base": [
            {"name": "Blaster Pistol", "category": "weapon", "description": "Reliable DL-18 sidearm for frontier survival"},
            {"name": "Heavy Clothing", "category": "armor", "description": "Environment-adapted spacer garb"},
            {"name": "Backpack", "category": "gear", "description": "Durable field pack with thermal lining"},
            {"name": "Macrobinoculars", "category": "gear", "description": "Long-range optical scanner with night vision"},
            {"name": "Comlink (handheld)", "category": "gear", "description": "Standard frequency communicator"},
        ],
        "Fringer": [
            {"name": "Vibro-Ax", "category": "weapon", "description": "Broad-bladed survival tool and fearsome weapon"},
            {"name": "Emergency Repair Kit", "category": "gear", "description": "Compact hull-patching and engine tools"},
        ],
        "Scout": [
            {"name": "Electrobinoculars", "category": "gear", "description": "Advanced scouting optics with rangefinder and recording"},
            {"name": "Glow Rod (x3)", "category": "gear", "description": "Long-lasting portable illumination sticks"},
        ],
        "Trader": [
            {"name": "Encrypted Ledger", "category": "gear", "description": "Secure transaction records and market data"},
            {"name": "Falsified Cargo Manifest", "category": "gear", "description": "Blank Imperial cargo documentation"},
        ],
    },
    "Hired Gun": {
        "base": [
            {"name": "Blaster Carbine", "category": "weapon", "description": "SoroSuub EE-3, compact but punishing mid-range fire"},
            {"name": "Vibrosword", "category": "weapon", "description": "Durasteel blade with vibro-generator, for when it gets personal"},
            {"name": "Padded Armor", "category": "armor", "description": "Ballistic-weave vest, +2 soak"},
            {"name": "Comlink (handheld)", "category": "gear", "description": "Standard frequency communicator"},
        ],
        "Bodyguard": [
            {"name": "Shield Gauntlet", "category": "armor", "description": "Wrist-mounted deflector emitter"},
            {"name": "Stimpack (x3)", "category": "gear", "description": "Emergency healing syringes"},
        ],
        "Marauder": [
            {"name": "Vibroknucklers", "category": "weapon", "description": "Fist-mounted vibro-blades for devastating brawling"},
            {"name": "Battle Scars", "category": "gear", "description": "Marks of countless fights, intimidation +1 Boost"},
        ],
        "Mercenary Soldier": [
            {"name": "Frag Grenade (x2)", "category": "weapon", "description": "Anti-personnel explosive ordinance"},
            {"name": "Field Rations", "category": "gear", "description": "Military-grade sustenance, 14 days"},
        ],
    },
    "Smuggler": {
        "base": [
            {"name": "Heavy Blaster Pistol", "category": "weapon", "description": "Modified DL-44, the smuggler's best friend"},
            {"name": "Concealed Holster", "category": "gear", "description": "Quick-draw magnetic holster, hidden under jacket"},
            {"name": "Comlink (handheld)", "category": "gear", "description": "Standard frequency communicator"},
            {"name": "Sabacc Deck", "category": "gear", "description": "Well-worn card set, weighted slightly in your favor"},
            {"name": "Spacer's Jacket", "category": "armor", "description": "Leather duster with hidden pockets, +1 soak"},
        ],
        "Pilot": [
            {"name": "Flight Suit", "category": "armor", "description": "Pressurized pilot suit with emergency rebreather"},
            {"name": "Astromech Droid Interface", "category": "gear", "description": "Portable R-series datalink adapter"},
        ],
        "Scoundrel": [
            {"name": "Disguise Kit", "category": "gear", "description": "Facial prosthetics, hair dyes, and voice modulator"},
            {"name": "Loaded Chance Cube", "category": "gear", "description": "Always lands on your color, mostly"},
        ],
        "Thief": [
            {"name": "Lockpicking Tools", "category": "gear", "description": "Electronic lockbreaker and mechanical picks"},
            {"name": "Climbing Gear", "category": "gear", "description": "Magnetic grips and synthrope coil"},
        ],
    },
    "Technician": {
        "base": [
            {"name": "Blaster Pistol", "category": "weapon", "description": "Simple but reliable sidearm"},
            {"name": "Tool Kit", "category": "gear", "description": "Comprehensive mechanic's toolkit with hydrospanner"},
            {"name": "Datapad", "category": "gear", "description": "Portable terminal with technical schematics library"},
            {"name": "Comlink (handheld)", "category": "gear", "description": "Standard frequency communicator"},
            {"name": "Utility Jumpsuit", "category": "armor", "description": "Fire-resistant workwear with tool loops"},
        ],
        "Mechanic": [
            {"name": "Emergency Repair Kit", "category": "gear", "description": "Heavy-duty hull patching and welding set"},
            {"name": "Salvaged Droid Parts", "category": "gear", "description": "Assorted servos, processors and power cells"},
        ],
        "Outlaw Tech": [
            {"name": "Weapon Modding Kit", "category": "gear", "description": "Aftermarket blaster modification tools"},
            {"name": "Contraband Scanner Jammer", "category": "gear", "description": "Scrambles Imperial cargo scanners"},
        ],
        "Slicer": [
            {"name": "Slicer Gear", "category": "gear", "description": "Advanced code-breaking rig and data spikes"},
            {"name": "Decoy Transponder", "category": "gear", "description": "Ship identity spoofer, one-use per transponder code"},
        ],
    },
}

# ============================================================================
# Environment Themes
# ============================================================================

ENVIRONMENT_THEMES = {
    "cantina": {
        "type": "cantina",
        "primary": "#FF6B35",
        "accent": "#FFB347",
        "background": "#1A0A00",
        "border": "#8B4513",
        "text_glow": "#FF8C00",
        "mood": "smoky amber warmth",
    },
    "desert": {
        "type": "desert",
        "primary": "#EDC9AF",
        "accent": "#C2A36E",
        "background": "#1A1200",
        "border": "#8B7355",
        "text_glow": "#DAA520",
        "mood": "scorching sandstorm haze",
    },
    "jungle": {
        "type": "jungle",
        "primary": "#2ECC71",
        "accent": "#27AE60",
        "background": "#001A0A",
        "border": "#1B4332",
        "text_glow": "#00FF7F",
        "mood": "dense bioluminescent canopy",
    },
    "space": {
        "type": "space",
        "primary": "#7B68EE",
        "accent": "#4169E1",
        "background": "#050510",
        "border": "#191970",
        "text_glow": "#6A5ACD",
        "mood": "cold starlight void",
    },
    "urban": {
        "type": "urban",
        "primary": "#00CED1",
        "accent": "#20B2AA",
        "background": "#0A0A14",
        "border": "#2F4F4F",
        "text_glow": "#40E0D0",
        "mood": "neon-washed duracrete streets",
    },
    "ruins": {
        "type": "ruins",
        "primary": "#BC8F8F",
        "accent": "#A0522D",
        "background": "#0F0A0A",
        "border": "#4A3728",
        "text_glow": "#D2691E",
        "mood": "crumbling ancient stone",
    },
    "ice": {
        "type": "ice",
        "primary": "#B0E0E6",
        "accent": "#87CEEB",
        "background": "#040A10",
        "border": "#4682B4",
        "text_glow": "#ADD8E6",
        "mood": "biting glacial wind",
    },
    "industrial": {
        "type": "industrial",
        "primary": "#CD853F",
        "accent": "#D2691E",
        "background": "#0A0800",
        "border": "#8B6914",
        "text_glow": "#FF8C00",
        "mood": "grinding machinery and sparks",
    },
    "dark_side": {
        "type": "dark_side",
        "primary": "#DC143C",
        "accent": "#8B0000",
        "background": "#0A0005",
        "border": "#4B0020",
        "text_glow": "#FF0000",
        "mood": "oppressive dark side energy",
    },
}

# Location to environment mapping
LOCATION_ENVIRONMENTS = {
    "Nar Shaddaa - The Smuggler's Moon": "urban",
    "Kessel - Spice Mining World": "industrial",
    "Ryloth - Twi'lek Homeworld": "desert",
    "Ord Mantell - Scrapyard Planet": "industrial",
    "Dathomir - Nightsister Domain": "dark_side",
    "Lothal - Outer Rim Frontier": "jungle",
    "Florrum - Pirate Haven": "desert",
    "Takodana - Maz Kanata's Castle": "jungle",
    "Jakku - Desert Wasteland": "desert",
    "Vandor - Frontier World": "ice",
    "Bracca - Ship Breaking Yards": "industrial",
    "Batuu - Black Spire Outpost": "ruins",
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
# Skill Auto-Detection for Contested Actions
# ============================================================================

ACTION_SKILL_MAP = {
    "shoot": "Ranged (Light)", "fire": "Ranged (Light)", "blast": "Ranged (Heavy)",
    "snipe": "Ranged (Heavy)", "aim": "Ranged (Light)",
    "punch": "Brawl", "kick": "Brawl", "wrestle": "Brawl", "grapple": "Brawl",
    "strike": "Melee", "slash": "Melee", "stab": "Melee", "swing": "Melee",
    "sneak": "Stealth", "hide": "Stealth", "creep": "Stealth", "shadow": "Stealth",
    "look": "Perception", "search": "Perception", "scan": "Perception", "notice": "Perception", "observe": "Perception",
    "persuade": "Charm", "flirt": "Charm", "convince": "Charm", "sweet-talk": "Charm",
    "lie": "Deception", "bluff": "Deception", "deceive": "Deception", "trick": "Deception",
    "intimidate": "Coercion", "threaten": "Coercion", "frighten": "Coercion",
    "negotiate": "Negotiation", "bargain": "Negotiation", "haggle": "Negotiation", "deal": "Negotiation",
    "hack": "Computers", "slice": "Computers", "decrypt": "Computers",
    "fly": "Piloting (Space)", "pilot": "Piloting (Space)", "navigate": "Astrogation",
    "drive": "Piloting (Planetary)", "ride": "Piloting (Planetary)",
    "repair": "Mechanics", "fix": "Mechanics", "tinker": "Mechanics", "modify": "Mechanics",
    "heal": "Medicine", "treat": "Medicine", "bandage": "Medicine", "patch": "Medicine",
    "climb": "Athletics", "jump": "Athletics", "run": "Athletics", "swim": "Athletics",
    "dodge": "Coordination", "tumble": "Coordination", "evade": "Coordination",
    "endure": "Resilience", "resist": "Discipline", "concentrate": "Discipline",
    "pickpocket": "Skulduggery", "lockpick": "Skulduggery", "steal": "Skulduggery",
    "survive": "Survival", "forage": "Survival", "track": "Survival",
    "lead": "Leadership", "command": "Leadership", "rally": "Leadership",
    "calm": "Cool", "compose": "Cool",
    "streetwise": "Streetwise", "ask around": "Streetwise", "gather info": "Streetwise",
}

def detect_skill_from_action(action_text: str) -> Optional[str]:
    """Auto-detect which skill a player's action should use"""
    lower_action = action_text.lower()
    for keyword, skill in ACTION_SKILL_MAP.items():
        if keyword in lower_action:
            return skill
    return None

def determine_difficulty(action_text: str, in_combat: bool) -> int:
    """Determine dice difficulty based on action context"""
    lower = action_text.lower()
    if any(w in lower for w in ["easy", "simple", "basic"]):
        return 1
    if any(w in lower for w in ["hard", "difficult", "impossible", "daunting"]):
        return 4
    if any(w in lower for w in ["carefully", "cautious", "precise"]):
        return 3
    if in_combat:
        return 2
    return 2  # Average difficulty default

def build_dice_pool_for_skill(character: dict, skill_name: str, difficulty: int) -> tuple:
    """Build a dice pool for a skill check, returning (DiceRoll, skill_info)"""
    skill = None
    for s in character.get("skills", []):
        if s["name"] == skill_name:
            skill = s
            break
    if not skill:
        # Fallback: unskilled check with base stat
        for sk in ALL_SKILLS:
            if sk["name"] == skill_name:
                skill = {"name": skill_name, "rank": 0, "characteristic": sk["characteristic"]}
                break
    if not skill:
        return None, None

    char_value = character["stats"].get(skill["characteristic"], 2)
    skill_rank = skill.get("rank", 0)

    if char_value >= skill_rank:
        proficiency = skill_rank
        ability = char_value - skill_rank
    else:
        proficiency = char_value
        ability = skill_rank - char_value

    dice_roll = DiceRoll(ability=ability, proficiency=proficiency, difficulty=difficulty)
    return dice_roll, skill

def format_dice_line(skill_name: str, dice_roll: DiceRoll, result: DiceResult) -> str:
    """Format the mechanical dice line for display"""
    pool_parts = []
    if dice_roll.proficiency > 0:
        pool_parts.append(f"{dice_roll.proficiency} Proficiency")
    if dice_roll.ability > 0:
        pool_parts.append(f"{dice_roll.ability} Ability")
    if dice_roll.boost > 0:
        pool_parts.append(f"{dice_roll.boost} Boost")

    opp_parts = []
    if dice_roll.challenge > 0:
        opp_parts.append(f"{dice_roll.challenge} Challenge")
    if dice_roll.difficulty > 0:
        opp_parts.append(f"{dice_roll.difficulty} Difficulty")
    if dice_roll.setback > 0:
        opp_parts.append(f"{dice_roll.setback} Setback")

    pool_str = " + ".join(pool_parts) if pool_parts else "0"
    opp_str = " + ".join(opp_parts) if opp_parts else "0"

    outcome_parts = []
    if result.net_successes != 0:
        outcome_parts.append(f"{abs(result.net_successes)} {'Success' if result.net_successes > 0 else 'Failure'}{'es' if abs(result.net_successes) > 1 else ''}")
    if result.net_advantages != 0:
        outcome_parts.append(f"{abs(result.net_advantages)} {'Advantage' if result.net_advantages > 0 else 'Threat'}{'s' if abs(result.net_advantages) > 1 else ''}")
    if result.triumphs > 0:
        outcome_parts.append(f"{result.triumphs} Triumph{'s' if result.triumphs > 1 else ''}")
    if result.despairs > 0:
        outcome_parts.append(f"{result.despairs} Despair{'s' if result.despairs > 1 else ''}")

    outcome_str = ", ".join(outcome_parts) if outcome_parts else "Wash"
    verdict = "SUCCESS" if result.success else "FAILURE"

    return f"[DICE: {skill_name} | {pool_str} vs {opp_str} | {verdict}: {outcome_str}]"

def detect_environment_from_text(text: str) -> Optional[str]:
    """Detect environment changes from narrative text"""
    lower = text.lower()
    env_keywords = {
        "cantina": ["cantina", "bar", "tavern", "saloon", "pub", "drinking"],
        "desert": ["desert", "sand", "dune", "scorching", "arid", "wasteland", "dry heat"],
        "jungle": ["jungle", "forest", "trees", "canopy", "vegetation", "swamp", "marsh"],
        "space": ["space", "hyperspace", "cockpit", "starship", "asteroid", "vacuum", "orbit"],
        "urban": ["city", "street", "building", "neon", "alley", "market", "spaceport", "landing pad"],
        "ruins": ["ruins", "temple", "ancient", "crumbling", "monument", "tomb", "chamber"],
        "ice": ["ice", "snow", "frozen", "glacier", "cold", "blizzard", "tundra"],
        "industrial": ["factory", "refinery", "machinery", "shipyard", "foundry", "scrapyard", "mine"],
        "dark_side": ["dark side", "sith", "nightmare", "darkness", "corruption", "witch"],
    }
    for env, keywords in env_keywords.items():
        if any(kw in lower for kw in keywords):
            return env
    return None


# ============================================================================
# Dice Rolling System - Edge of the Empire
# ============================================================================

def roll_ability_die():
    results = [{}, {"successes": 1}, {"successes": 1}, {"successes": 2},
               {"advantages": 1}, {"advantages": 1}, {"successes": 1, "advantages": 1}, {"advantages": 2}]
    return random.choice(results)

def roll_proficiency_die():
    results = [{}, {"successes": 1}, {"successes": 1}, {"successes": 2}, {"successes": 2},
               {"advantages": 1}, {"successes": 1, "advantages": 1}, {"successes": 1, "advantages": 1},
               {"successes": 1, "advantages": 1}, {"advantages": 2}, {"advantages": 2}, {"triumphs": 1}]
    return random.choice(results)

def roll_difficulty_die():
    results = [{}, {"failures": 1}, {"failures": 2}, {"threats": 1}, {"threats": 1},
               {"threats": 1}, {"threats": 2}, {"failures": 1, "threats": 1}]
    return random.choice(results)

def roll_challenge_die():
    results = [{}, {"failures": 1}, {"failures": 1}, {"failures": 2}, {"failures": 2},
               {"threats": 1}, {"threats": 1}, {"failures": 1, "threats": 1},
               {"failures": 1, "threats": 1}, {"threats": 2}, {"threats": 2}, {"despairs": 1}]
    return random.choice(results)

def roll_boost_die():
    results = [{}, {}, {"successes": 1}, {"successes": 1, "advantages": 1}, {"advantages": 2}, {"advantages": 1}]
    return random.choice(results)

def roll_setback_die():
    results = [{}, {}, {"failures": 1}, {"failures": 1}, {"threats": 1}, {"threats": 1}]
    return random.choice(results)

def roll_force_die():
    results = [{"dark_side": 1}, {"dark_side": 1}, {"dark_side": 1}, {"dark_side": 1},
               {"dark_side": 1}, {"dark_side": 1}, {"dark_side": 2}, {"light_side": 1},
               {"light_side": 1}, {"light_side": 2}, {"light_side": 2}, {"light_side": 2}]
    return random.choice(results)

def roll_dice_pool(dice_roll: DiceRoll) -> DiceResult:
    result = DiceResult()
    dice_details = []
    for _ in range(dice_roll.ability):
        roll = roll_ability_die()
        dice_details.append({"type": "ability", "color": "green", "result": roll})
        result.successes += roll.get("successes", 0); result.advantages += roll.get("advantages", 0)
    for _ in range(dice_roll.proficiency):
        roll = roll_proficiency_die()
        dice_details.append({"type": "proficiency", "color": "yellow", "result": roll})
        result.successes += roll.get("successes", 0); result.advantages += roll.get("advantages", 0)
        result.triumphs += roll.get("triumphs", 0)
        if roll.get("triumphs", 0) > 0: result.successes += 1
    for _ in range(dice_roll.difficulty):
        roll = roll_difficulty_die()
        dice_details.append({"type": "difficulty", "color": "purple", "result": roll})
        result.failures += roll.get("failures", 0); result.threats += roll.get("threats", 0)
    for _ in range(dice_roll.challenge):
        roll = roll_challenge_die()
        dice_details.append({"type": "challenge", "color": "red", "result": roll})
        result.failures += roll.get("failures", 0); result.threats += roll.get("threats", 0)
        result.despairs += roll.get("despairs", 0)
        if roll.get("despairs", 0) > 0: result.failures += 1
    for _ in range(dice_roll.boost):
        roll = roll_boost_die()
        dice_details.append({"type": "boost", "color": "blue", "result": roll})
        result.successes += roll.get("successes", 0); result.advantages += roll.get("advantages", 0)
    for _ in range(dice_roll.setback):
        roll = roll_setback_die()
        dice_details.append({"type": "setback", "color": "black", "result": roll})
        result.failures += roll.get("failures", 0); result.threats += roll.get("threats", 0)
    for _ in range(dice_roll.force):
        roll = roll_force_die()
        dice_details.append({"type": "force", "color": "white", "result": roll})
        result.light_side += roll.get("light_side", 0); result.dark_side += roll.get("dark_side", 0)
    result.net_successes = result.successes - result.failures
    result.net_advantages = result.advantages - result.threats
    result.success = result.net_successes > 0
    result.dice_details = dice_details
    return result

# ============================================================================
# Authentication Endpoints
# ============================================================================

async def get_current_user(request: Request) -> Optional[UserBase]:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        return None
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        return None
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        return None
    return UserBase(**user_doc)

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    async with httpx.AsyncClient() as http_client:
        auth_response = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        user_data = auth_response.json()
    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": user_data["name"], "picture": user_data.get("picture")}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({"user_id": user_id, "email": user_data["email"], "name": user_data["name"], "picture": user_data.get("picture"), "coins": 100, "created_at": datetime.now(timezone.utc)})
    session_token = user_data.get("session_token", f"sess_{uuid.uuid4().hex}")
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({"session_token": session_token, "user_id": user_id, "expires_at": expires_at, "created_at": datetime.now(timezone.utc)})
    response.set_cookie(key="session_token", value=session_token, path="/", secure=True, httponly=True, samesite="none", expires=expires_at)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user_doc, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # Ensure coins field exists for older users
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if "coins" not in user_doc:
        await db.users.update_one({"user_id": user.user_id}, {"$set": {"coins": 100}})
        user_doc["coins"] = 100
    return user_doc

@api_router.get("/auth/coins")
async def get_coins(request: Request):
    """Get current coin balance"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    coins = user_doc.get("coins", 100) if user_doc else 0
    return {"coins": coins}

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
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
    return SPECIES_DATA

@api_router.get("/game/careers")
async def get_careers():
    return CAREER_DATA

@api_router.get("/game/skills")
async def get_skills():
    return ALL_SKILLS

@api_router.get("/game/locations")
async def get_locations():
    return LOCATIONS

@api_router.get("/game/equipment")
async def get_equipment():
    return CAREER_EQUIPMENT

@api_router.get("/game/environments")
async def get_environments():
    return ENVIRONMENT_THEMES

# ============================================================================
# Character Endpoints
# ============================================================================

@api_router.post("/characters")
async def create_character(char_data: CharacterCreate, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    species_info = SPECIES_DATA.get(char_data.species)
    if not species_info:
        raise HTTPException(status_code=400, detail="Invalid species")
    career_info = CAREER_DATA.get(char_data.career)
    if not career_info:
        raise HTTPException(status_code=400, detail="Invalid career")
    if char_data.specialization not in career_info["specializations"]:
        raise HTTPException(status_code=400, detail="Invalid specialization for career")

    stats = CharacterStats()
    for stat, bonus in species_info.get("stat_bonuses", {}).items():
        setattr(stats, stat, getattr(stats, stat) + bonus)

    skills = []
    for skill_data in ALL_SKILLS:
        rank = 1 if skill_data["name"] in career_info["career_skills"] else 0
        skills.append(CharacterSkill(name=skill_data["name"], rank=rank, characteristic=skill_data["characteristic"]))

    health = CharacterHealth(
        wound_threshold=10 + stats.brawn + species_info.get("wound_bonus", 0),
        strain_threshold=10 + stats.willpower + species_info.get("strain_bonus", 0)
    )

    # Build starter equipment from career + specialization
    equipment = []
    career_equip = CAREER_EQUIPMENT.get(char_data.career, {})
    for item in career_equip.get("base", []):
        equipment.append(item)
    for item in career_equip.get(char_data.specialization, []):
        equipment.append(item)

    # Add species cultural gear
    cultural_gear = SPECIES_CULTURAL_GEAR.get(char_data.species, [])
    for item in cultural_gear:
        equipment.append(item)

    character = Character(
        user_id=user.user_id,
        name=char_data.name,
        species=char_data.species,
        career=char_data.career,
        specialization=char_data.specialization,
        stats=stats,
        skills=skills,
        health=health,
        equipment=equipment,
        experience=CharacterExperience(total=species_info.get("starting_xp", 100), available=species_info.get("starting_xp", 100)),
        backstory=char_data.backstory
    )
    await db.characters.insert_one(character.model_dump())
    return character.model_dump()

@api_router.get("/characters")
async def get_characters(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    characters = await db.characters.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    return characters

@api_router.get("/characters/{character_id}")
async def get_character(character_id: str, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    character = await db.characters.find_one({"character_id": character_id, "user_id": user.user_id}, {"_id": 0})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character

@api_router.delete("/characters/{character_id}")
async def delete_character(character_id: str, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    result = await db.characters.delete_one({"character_id": character_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Character not found")
    await db.game_sessions.delete_many({"character_id": character_id})
    return {"message": "Character deleted"}

# ============================================================================
# Enhanced Character Portrait Generation
# ============================================================================

@api_router.post("/characters/{character_id}/generate-portrait")
async def generate_portrait(character_id: str, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    character = await db.characters.find_one({"character_id": character_id, "user_id": user.user_id}, {"_id": 0})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    species_info = SPECIES_DATA.get(character["species"], {})
    species_appearance = species_info.get("appearance", species_info.get("description", ""))

    # Build equipment description for the portrait
    weapons = [e["name"] for e in character.get("equipment", []) if e.get("category") == "weapon"]
    armor = [e["name"] for e in character.get("equipment", []) if e.get("category") == "armor"]
    gear_highlights = [e["name"] for e in character.get("equipment", []) if e.get("category") == "gear"][:3]

    weapon_desc = f"Carrying {', '.join(weapons)}." if weapons else ""
    armor_desc = f"Wearing {', '.join(armor)}." if armor else ""
    gear_desc = f"Visible gear: {', '.join(gear_highlights)}." if gear_highlights else ""

    backstory_tone = ""
    if character.get("backstory"):
        backstory_tone = f"Backstory vibe: {character['backstory'][:150]}."

    # Career-specific visual cues
    career_visual = {
        "Bounty Hunter": "Tactical stance, alert eyes scanning for prey, worn Mandalorian-inspired armor plates, utility bandolier.",
        "Colonist": "Composed posture, intelligent eyes, well-groomed appearance, datapad visible, business-like confidence.",
        "Explorer": "Weathered face, distant gaze of someone who has seen countless worlds, dust-covered travel gear.",
        "Hired Gun": "Battle-hardened expression, scars visible, muscular build, weapons within easy reach, soldier's bearing.",
        "Smuggler": "Cocky half-grin, relaxed but ready posture, blaster at hip, lived-in spacer clothes, rakish charm.",
        "Technician": "Grease-stained hands, goggles pushed up on forehead, tools hanging from belt, bright curious eyes."
    }.get(character["career"], "")

    spec_visual = {
        "Assassin": "Cold calculating eyes, dark hood partially obscuring face, blade glint at waist.",
        "Gadgeteer": "Custom modified armor with visible tech attachments, wrist-mounted devices.",
        "Survivalist": "Wild untamed look, animal pelts or trophies, hardened by nature.",
        "Doctor": "Clean precise hands, medical scanner visible, compassionate but weary expression.",
        "Politico": "Silver-tongued confidence, expensive accessories, political insignia.",
        "Scholar": "Wise knowing eyes, ancient artifacts, dust of forgotten libraries.",
        "Fringer": "Trail-worn ruggedness, frontier survival gear, multi-tool at belt.",
        "Scout": "Sharp observant eyes, camouflage elements, binoculars hanging from neck.",
        "Trader": "Shrewd appraising gaze, cargo manifest in hand, credits pouch at waist.",
        "Bodyguard": "Vigilant protective stance, shield arm forward, scanning for threats.",
        "Marauder": "Feral aggression, ritual scarification, oversized melee weapon.",
        "Mercenary Soldier": "Military discipline, tactical vest with ammo, dog tags.",
        "Pilot": "Flight jacket with patches, aviator goggles, confident flyboy posture.",
        "Scoundrel": "Charming rogue smile, hidden holdout blaster, sabacc cards peeking from pocket.",
        "Thief": "Shadow-hugging posture, lockpicks visible, dark form-fitting clothes.",
        "Mechanic": "Oil-stained coveralls, hydrospanner in hand, droid parts in pockets.",
        "Outlaw Tech": "Modified blaster with visible mods, tech-heavy bandolier, defiant stance.",
        "Slicer": "Cybernetic implants or data-jacks, holographic interfaces, digital rebel aesthetic."
    }.get(character["specialization"], "")

    prompt = f"""Cinematic Star Wars character portrait, photorealistic digital painting, dramatic rim lighting:

SPECIES: {character['species']} - {species_appearance}
CHARACTER: {character['name']}, a {character['career']} ({character['specialization']})

VISUAL IDENTITY:
{career_visual}
{spec_visual}

EQUIPMENT & ATTIRE:
{weapon_desc} {armor_desc} {gear_desc}

{backstory_tone}

ARTISTIC DIRECTION: Portrait framing (head to mid-chest), Outer Rim setting background blur, cinematic color grading, Star Wars concept art quality. The character should feel lived-in and authentic to the galaxy's edge - not pristine, but real. Dramatic side-lighting with environmental color spill."""

    try:
        image_gen = OpenAIImageGeneration(api_key=EMERGENT_LLM_KEY)
        images = await image_gen.generate_images(prompt=prompt, model="gpt-image-1", number_of_images=1)
        if images and len(images) > 0:
            image_base64 = base64.b64encode(images[0]).decode('utf-8')
            await db.characters.update_one({"character_id": character_id}, {"$set": {"portrait_base64": image_base64}})
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
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    result = roll_dice_pool(dice_roll)
    return result.model_dump()

@api_router.post("/dice/skill-check")
async def skill_check(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    character_id = body.get("character_id")
    skill_name = body.get("skill_name")
    difficulty = body.get("difficulty", 2)
    character = await db.characters.find_one({"character_id": character_id, "user_id": user.user_id}, {"_id": 0})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    dice_roll, skill = build_dice_pool_for_skill(character, skill_name, difficulty)
    if not dice_roll:
        raise HTTPException(status_code=400, detail="Skill not found")
    result = roll_dice_pool(dice_roll)
    return {
        "skill": skill_name,
        "characteristic": skill["characteristic"],
        "dice_pool": {"ability": dice_roll.ability, "proficiency": dice_roll.proficiency, "difficulty": difficulty},
        "result": result.model_dump()
    }

# ============================================================================
# Story Journal & Memory System
# ============================================================================

async def update_story_journal(session_id: str, gm_response: str, player_action_text: str, character: dict):
    """Extract key story elements from the latest exchange and update the journal."""
    session = await db.game_sessions.find_one({"session_id": session_id}, {"_id": 0})
    if not session:
        return

    journal = session.get("story_journal", {})
    npcs_met = journal.get("npcs_met", [])
    locations_visited = journal.get("locations_visited", [])
    major_events = journal.get("major_events", [])
    unresolved_threads = journal.get("unresolved_threads", [])

    # Add current location if new
    current_loc = session.get("current_location", "")
    if current_loc and current_loc not in locations_visited:
        locations_visited.append(current_loc)

    # Build a running summary from recent history (last 20 messages)
    history = session.get("game_history", [])
    gm_messages = [m["content"] for m in history if m.get("role") == "game_master"]
    player_messages = [m["content"] for m in history if m.get("role") == "player"]

    # Build concise summary of story so far
    summary_parts = []
    if locations_visited:
        summary_parts.append(f"Visited: {', '.join(locations_visited[-5:])}")
    if len(gm_messages) > 0:
        # Use the first and most recent GM messages as bookends
        summary_parts.append(f"Story began: {gm_messages[0][:150]}...")
        if len(gm_messages) > 2:
            summary_parts.append(f"Recent events: {gm_messages[-1][:200]}...")

    summary = " | ".join(summary_parts)

    # Keep journal manageable
    if len(major_events) > 20:
        major_events = major_events[-20:]

    await db.game_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "story_journal": {
                "npcs_met": npcs_met[-15:],  # Keep last 15 NPCs
                "locations_visited": locations_visited[-10:],
                "major_events": major_events,
                "unresolved_threads": unresolved_threads[-5:],
                "player_reputation": journal.get("player_reputation", "unknown newcomer"),
                "summary": summary,
            }
        }}
    )

def build_story_memory_prompt(session: dict) -> str:
    """Build the story memory context for the AI from the journal and full history."""
    journal = session.get("story_journal", {})
    history = session.get("game_history", [])

    memory_parts = []

    # Locations
    locations = journal.get("locations_visited", [])
    if locations:
        memory_parts.append(f"LOCATIONS VISITED: {', '.join(locations)}")

    # NPCs
    npcs = journal.get("npcs_met", [])
    if npcs:
        npc_list = ", ".join([f"{n.get('name', 'Unknown')} ({n.get('disposition', 'neutral')})" for n in npcs])
        memory_parts.append(f"NPCS ENCOUNTERED: {npc_list}")

    # Major events
    events = journal.get("major_events", [])
    if events:
        memory_parts.append(f"KEY EVENTS: {'; '.join(events[-5:])}")

    # Unresolved threads
    threads = journal.get("unresolved_threads", [])
    if threads:
        memory_parts.append(f"UNRESOLVED PLOT THREADS: {'; '.join(threads)}")

    # Full conversation history (expanded from 10 to 20)
    recent = history[-20:]
    if recent:
        hist_text = "\n".join([f"{'[Player]' if m.get('role') == 'player' else '[GM]'}: {m.get('content', '')[:300]}" for m in recent])
        memory_parts.append(f"RECENT STORY:\n{hist_text}")

    return "\n\n".join(memory_parts)

# ============================================================================
# Scenario Generation & Game Session Endpoints
# ============================================================================

@api_router.post("/game/generate-scenarios")
async def generate_scenarios(request: Request):
    """Generate 7 adventure scenarios tailored to the character and player preferences"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    character_id = body.get("character_id")
    character = await db.characters.find_one({"character_id": character_id, "user_id": user.user_id}, {"_id": 0})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # Get player profile for weighted scenario types
    profile = await get_or_create_player_profile(user.user_id)
    weighted_types = get_weighted_scenario_types(profile, 7)

    prompt = f"""Generate exactly 7 unique Star Wars adventure scenarios for this character.
Each scenario must be a different type from this list (in order): {json.dumps(weighted_types)}

CHARACTER:
- Name: {character['name']}
- Species: {character['species']}
- Career: {character['career']} ({character['specialization']})
- Backstory: {character.get('backstory', 'A traveler at the galaxy edge')}

Respond ONLY with a valid JSON array of 7 objects. Each object must have:
- "title": A compelling 3-6 word title
- "type": The scenario type from the list above (use the exact type for each position)
- "description": A 2-3 sentence vivid hook that makes the player WANT to choose this adventure. Reference the character's career/species where relevant.
- "location": A Star Wars location from: {json.dumps(LOCATIONS)}
- "danger_level": 1-5 (1=low stakes, 5=extremely dangerous)

Example format: [{{"title":"...", "type":"combat", "description":"...", "location":"...", "danger_level":3}}]
Return ONLY the JSON array, no other text."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"scenarios_{uuid.uuid4().hex[:8]}",
            system_message="You are a Star Wars scenario designer. Respond ONLY with valid JSON arrays."
        ).with_model("anthropic", "claude-4-sonnet-20250514")

        result = await chat.send_message(UserMessage(text=prompt))

        # Parse JSON from response
        result_clean = result.strip()
        if result_clean.startswith("```"):
            result_clean = result_clean.split("\n", 1)[1].rsplit("```", 1)[0]

        scenarios = json.loads(result_clean)

        # Assign IDs
        for i, s in enumerate(scenarios):
            s["scenario_id"] = f"scn_{uuid.uuid4().hex[:8]}"
            s["index"] = i

        return {"scenarios": scenarios}

    except json.JSONDecodeError:
        # Fallback: generate hardcoded scenarios
        fallback = []
        for i, stype in enumerate(weighted_types):
            loc = random.choice(LOCATIONS)
            fallback.append({
                "scenario_id": f"scn_{uuid.uuid4().hex[:8]}",
                "index": i,
                "title": f"{stype.title()} on {loc.split(' - ')[0]}",
                "type": stype,
                "description": f"A {stype} scenario awaits your {character['career']} on {loc}.",
                "location": loc,
                "danger_level": random.randint(1, 5),
            })
        return {"scenarios": fallback}
    except Exception as e:
        logger.error(f"Scenario generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate scenarios: {str(e)}")

@api_router.post("/game/sessions")
async def create_game_session(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    character_id = body.get("character_id")
    scenario = body.get("scenario")  # Optional: chosen scenario object
    character = await db.characters.find_one({"character_id": character_id, "user_id": user.user_id}, {"_id": 0})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # Use scenario location if provided, otherwise random
    if scenario:
        location = scenario.get("location", random.choice(LOCATIONS))
        scenario_id = scenario.get("scenario_id")
        # Update player profile with chosen scenario type
        await update_player_preference(user.user_id, scenario.get("type", "exploration"), True)
    else:
        location = random.choice(LOCATIONS)
        scenario_id = None

    env_type = LOCATION_ENVIRONMENTS.get(location, "urban")
    session = GameSession(
        user_id=user.user_id,
        character_id=character_id,
        current_location=location,
        environment_type=env_type,
        scenario_id=scenario_id,
    )
    await db.game_sessions.insert_one(session.model_dump())
    session_dict = session.model_dump()
    session_dict["environment_theme"] = ENVIRONMENT_THEMES.get(env_type, ENVIRONMENT_THEMES["urban"])
    session_dict["scenario"] = scenario
    return session_dict

@api_router.get("/game/sessions")
async def get_game_sessions(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    sessions = await db.game_sessions.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    return sessions

@api_router.get("/game/sessions/latest/{character_id}")
async def get_latest_session(character_id: str, request: Request):
    """Get the most recent game session for a character (for Continue Adventure)"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.game_sessions.find_one(
        {"character_id": character_id, "user_id": user.user_id, "game_history": {"$ne": []}},
        {"_id": 0},
        sort=[("updated_at", -1)]
    )
    if not session:
        return {"has_session": False, "session": None}
    env_type = session.get("environment_type", "urban")
    session["environment_theme"] = ENVIRONMENT_THEMES.get(env_type, ENVIRONMENT_THEMES["urban"])
    return {"has_session": True, "session": session}

@api_router.get("/game/sessions/{session_id}")
async def get_game_session(session_id: str, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.game_sessions.find_one({"session_id": session_id, "user_id": user.user_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    env_type = session.get("environment_type", "urban")
    session["environment_theme"] = ENVIRONMENT_THEMES.get(env_type, ENVIRONMENT_THEMES["urban"])
    return session

@api_router.post("/game/sessions/{session_id}/action")
async def player_action(session_id: str, action: PlayerAction, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # === COIN CHECK & DEDUCTION ===
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    coins = user_doc.get("coins", 0) if user_doc else 0
    if coins <= 0:
        return {
            "warning": True,
            "warning_message": "You have run out of coins. Each response costs 1 coin. Purchase more coins to continue your adventure.",
            "warning_severity": "out_of_coins",
            "requires_confirmation": False,
            "gm_response": None,
            "dice_result": None,
            "coins": 0,
        }

    # Handle blank input as "Continue"
    if not action.action or not action.action.strip():
        action.action = "Continue"

    session = await db.game_sessions.find_one({"session_id": session_id, "user_id": user.user_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    character = await db.characters.find_one({"character_id": session["character_id"]}, {"_id": 0})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # Deduct 1 coin
    await db.users.update_one({"user_id": user.user_id}, {"$inc": {"coins": -1}})
    new_coins = coins - 1

    # Auto-detect skill for contested interaction
    skill_name = action.skill or detect_skill_from_action(action.action)
    in_combat = session.get("combat_state", {}).get("in_combat", False)
    difficulty = determine_difficulty(action.action, in_combat)

    # === ACTION CAPABILITY WARNING SYSTEM ===
    if skill_name and not action.force_action:
        assessment = assess_action_difficulty(character, skill_name, action.action)
        if assessment["warning"] and assessment["severity"] in ("severe", "hard"):
            # Return warning — don't process yet. Player must confirm.
            return {
                "warning": True,
                "warning_message": assessment["warning"],
                "warning_severity": assessment["severity"],
                "skill_assessed": skill_name,
                "skill_rank": assessment["skill_rank"],
                "stat_value": assessment["stat_value"],
                "total_dice": assessment["total_dice"],
                "requires_confirmation": True,
                "gm_response": None,
                "dice_result": None,
            }

    # === DICE ROLL ===
    dice_result = None
    dice_roll_obj = None
    dice_line = None

    if skill_name:
        dice_roll_obj, skill_info = build_dice_pool_for_skill(character, skill_name, difficulty)
        if dice_roll_obj:
            dice_result = roll_dice_pool(dice_roll_obj)
            dice_line = format_dice_line(skill_name, dice_roll_obj, dice_result)

    # === SKILL ADVANCEMENT ===
    advancement_info = None
    if skill_name and dice_result:
        advancement, updated_usage = process_skill_advancement(character, skill_name)
        
        # Apply advancement to database
        update_ops = {"$set": {"skill_usage": updated_usage}}
        
        if advancement["ranked_up"]:
            # Update the skill rank in the skills array
            new_skills = character.get("skills", [])
            for i, s in enumerate(new_skills):
                if s["name"] == skill_name:
                    new_skills[i]["rank"] = advancement["new_rank"]
                    break
            update_ops["$set"]["skills"] = new_skills
            update_ops["$inc"] = {"total_skill_ups": 1}
            
            # Check for stat improvement milestone
            total_ups = character.get("total_skill_ups", 0) + 1
            if total_ups > 0 and total_ups % STAT_IMPROVEMENT_THRESHOLD == 0:
                advancement["stat_improved"] = True
            
            # Unlock talent if applicable
            if advancement["talent_unlocked"]:
                talent_name = advancement["talent_unlocked"]["name"]
                existing_talents = character.get("skill_talents", [])
                if talent_name not in existing_talents:
                    existing_talents.append(talent_name)
                    update_ops["$set"]["skill_talents"] = existing_talents
        
        await db.characters.update_one({"character_id": character["character_id"]}, update_ops)
        
        if advancement["ranked_up"]:
            advancement_info = advancement

    # === BUILD AI CONTEXT ===
    recent_history = session.get("game_history", [])[-10:]
    history_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in recent_history])

    combat_context = ""
    if in_combat:
        enemies = session["combat_state"].get("enemies", [])
        enemy_text = ", ".join([f"{e['name']} ({e['wounds']}/{e['wound_threshold']} wounds)" for e in enemies])
        combat_context = f"\nCURRENT COMBAT: Fighting against {enemy_text}"

    # Capability context for the AI GM
    capability_context = ""
    if skill_name:
        assessment = assess_action_difficulty(character, skill_name, action.action)
        if assessment["severity"] == "severe":
            capability_context = f"""
CHARACTER LIMITATION: {character['name']} is UNTRAINED in {skill_name} with low {assessment.get('stat_value', 2)} in the governing characteristic.
This should be reflected in the narrative — describe the character's hesitation, unfamiliarity, and struggle with this task.
They're clearly out of their depth. Even if the dice succeed, describe it as barely scraping by or lucky instinct."""
        elif assessment["severity"] == "moderate":
            capability_context = f"""
CHARACTER NOTE: {character['name']} has no formal training in {skill_name} but is attempting it on raw talent alone.
Reflect this in the narrative — they're improvising, not executing with practiced skill."""

    dice_context = ""
    if dice_result:
        dice_context = f"""
DICE ROLL RESULT for {skill_name}:
- Net Successes: {dice_result.net_successes}
- Net Advantages: {dice_result.net_advantages}
- Triumphs: {dice_result.triumphs}
- Despairs: {dice_result.despairs}
- Overall: {'SUCCESS' if dice_result.success else 'FAILURE'}

IMPORTANT: Weave the dice result into your narrative naturally. If the roll succeeded, describe the action going well with flair proportional to the number of successes. If it failed, describe a dramatic setback. Advantages should add bonus narrative benefits. Threats should introduce minor complications. Triumphs are extraordinary lucky breaks. Despairs are catastrophic twists.
Do NOT mention dice, numbers, or game mechanics directly in your story text - keep it purely narrative.
"""

    # Advancement narrative hint
    advancement_context = ""
    if advancement_info and advancement_info["ranked_up"]:
        talent_text = ""
        if advancement_info["talent_unlocked"]:
            talent_text = f" They have also unlocked a new ability: {advancement_info['talent_unlocked']['name']} - {advancement_info['talent_unlocked']['description']}."
        advancement_context = f"""
SKILL GROWTH: Through repeated use, {character['name']}'s {skill_name} has improved to rank {advancement_info['new_rank']}!{talent_text}
Subtly weave this growth into the narrative - perhaps they notice their reflexes are sharper, their aim more steady, their words more persuasive. Don't state it mechanically."""

    equipment_list = ", ".join([e["name"] for e in character.get("equipment", [])]) if character.get("equipment") else "basic gear"
    talents_list = ", ".join(character.get("skill_talents", [])) if character.get("skill_talents") else "none"

    # Build story memory from journal
    story_memory = build_story_memory_prompt(session)

    # Fetch global events from other players at same location/era
    global_events = await get_nearby_global_events(
        session["current_location"],
        session.get("era", "Galactic Civil War"),
        user.user_id
    )
    global_events_context = ""
    if global_events:
        event_descriptions = []
        for evt in global_events:
            event_descriptions.append(
                f"- {evt['actor_description']} was involved in a {evt['event_type']}: {evt['description']} ({evt['impact']})"
            )
        global_events_context = f"""
WORLD STATE — OTHER CHARACTERS' IMPACT ON THIS LOCATION:
The following events were caused by other characters in this area recently. Weave these naturally into the background — distant sounds, NPC gossip, environmental evidence. The player may encounter these characters as NPCs. Portray them faithfully based on their description. Do NOT reveal they are other players.
{chr(10).join(event_descriptions)}
"""

    # Fetch NPC versions of other players' characters at this location
    other_sessions = await db.game_sessions.find(
        {
            "current_location": session["current_location"],
            "era": session.get("era", "Galactic Civil War"),
            "user_id": {"$ne": user.user_id},
            "game_history": {"$ne": []},
            "updated_at": {"$gte": datetime.now(timezone.utc) - timedelta(hours=72)},
        },
        {"_id": 0, "character_id": 1}
    ).to_list(5)

    npc_characters_context = ""
    if other_sessions:
        npc_parts = []
        for os_sess in other_sessions:
            npc_char = await db.characters.find_one({"character_id": os_sess["character_id"]}, {"_id": 0})
            if npc_char and npc_char.get("user_id") != user.user_id:
                npc_profile = await get_or_create_player_profile(npc_char["user_id"])
                # Determine personality from preferences
                top_prefs = sorted(npc_profile.get("scenario_preferences", {}).items(), key=lambda x: x[1], reverse=True)[:2]
                personality_hint = ", ".join([p[0] for p in top_prefs])
                avg_len = npc_profile.get("avg_response_length", 10)
                demeanor = "quiet and cautious" if avg_len < 10 else "talkative and bold" if avg_len > 25 else "measured and alert"

                npc_equip = ", ".join([e["name"] for e in npc_char.get("equipment", [])[:3]]) if npc_char.get("equipment") else "basic gear"
                npc_parts.append(
                    f"- A {npc_char['species']} {npc_char['career']} ({npc_char['specialization']}) named {npc_char['name']}: "
                    f"Carries {npc_equip}. Demeanor: {demeanor}. Drawn to {personality_hint} situations. "
                    f"They are present in this location and may be glimpsed or encountered."
                )

        if npc_parts:
            npc_characters_context = f"""
OTHER CHARACTERS PRESENT (portray as NPCs — these are real characters from this world):
{chr(10).join(npc_parts)}
Rules: Give brief glimpses of these characters in the background or as passing encounters. If direct interaction is unavoidable, act on their behalf using their personality profile. NEVER identify them as other players. They are simply other beings in this galaxy.
"""

    system_prompt = f"""You are the Game Master for a Star Wars: Edge of the Empire tabletop RPG.
You are a master storyteller creating a DEEPLY IMMERSIVE experience — the player should feel like they are physically standing in the Star Wars universe.

CURRENT CHARACTER:
- Name: {character['name']}
- Species: {character['species']} — use species-specific mannerisms (Trandoshan hisses, Wookiee growls, Twi'lek lekku gestures)
- Career: {character['career']} ({character['specialization']})
- Location: {session['current_location']}
- Health: {character['health']['wounds']}/{character['health']['wound_threshold']} wounds, {character['health']['strain']}/{character['health']['strain_threshold']} strain
- Equipment: {equipment_list}
- Specialist Talents: {talents_list}
{combat_context}
{capability_context}
{global_events_context}
{npc_characters_context}

STORY MEMORY (reference when player mentions past events, people, or places):
{story_memory}

IMMERSION RULES — Write as if the player IS the character:
1. SENSORY OVERLOAD: Every scene must engage at least 3 senses. The smell of ozone from a blaster shot, the vibration of a ship's hull, the metallic taste of fear, the distant thrum of a hyperdrive.
2. FIRST-PERSON ENVIRONMENT: Describe what the character sees, hears, and feels in their immediate surroundings. Make the reader feel the ground under their boots, the air on their skin.
3. NPC REALISM: NPCs have distinct speech patterns, accents, motivations, and body language. A Rodian bounty hunter speaks differently than a Mon Calamari admiral. NPCs remember the player. NPCs have self-preservation instincts and don't act like video game mannequins.
4. CONSEQUENCE & WEIGHT: Actions have ripple effects. If the player caused a scene at a cantina, the word spreads. If they helped someone, that person might return the favor. The world reacts.
5. PACING: Vary between tense action, quiet atmospheric moments, and character-driven dialogue. Don't rush — let moments breathe.
6. PHYSICAL REALITY: Characters get tired, hungry, cold. Blasters run low. Ships need fuel. Injuries hurt. The galaxy is dangerous and unforgiving.
7. SHOW, DON'T TELL: Instead of "you feel scared," write "your hand trembles on the grip of your blaster, and your breath comes in short, sharp pulls."
8. ENVIRONMENTAL STORYTELLING: The world tells stories — blast marks on walls, abandoned cargo, a child's toy in a war zone. Scatter details that build atmosphere.
9. DIALOGUE: Use actual dialogue for NPCs. Give them personality. A grizzled smuggler doesn't speak like a protocol droid.
10. NEVER break the fourth wall. No game mechanics, no dice references, no "your character." The player IS the character.

Keep responses to 2-3 rich paragraphs. End with a visceral, present-tense moment that demands the player's response.

{dice_context}
{advancement_context}

The player's action: {action.action}

Respond as the Game Master. Make the player feel like they're THERE."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"eote_{session_id}_{uuid.uuid4().hex[:6]}",
            system_message=system_prompt
        ).with_model("anthropic", "claude-4-sonnet-20250514")

        user_message = UserMessage(text=action.action)
        gm_response = await chat.send_message(user_message)

        # Detect environment change from the narrative
        new_env = detect_environment_from_text(gm_response)
        current_env = session.get("environment_type", "urban")
        if new_env and new_env != current_env:
            current_env = new_env

        # Add messages to history
        new_history = session.get("game_history", [])
        player_msg = {"role": "player", "content": action.action, "timestamp": datetime.now(timezone.utc).isoformat()}
        gm_msg = {"role": "game_master", "content": gm_response, "timestamp": datetime.now(timezone.utc).isoformat()}
        if dice_line:
            gm_msg["dice_line"] = dice_line
        new_history.append(player_msg)
        new_history.append(gm_msg)

        await db.game_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"game_history": new_history, "updated_at": datetime.now(timezone.utc), "environment_type": current_env}}
        )

        # Update story journal with new story elements
        await update_story_journal(session_id, gm_response, action.action, character)

        # Track player response quality for preference adaptation
        scenario_type = "exploration"  # Default
        if skill_name:
            if skill_name in ("Brawl", "Melee", "Ranged (Light)", "Ranged (Heavy)"):
                scenario_type = "combat"
            elif skill_name in ("Charm", "Negotiation", "Leadership"):
                scenario_type = "social"
            elif skill_name in ("Stealth", "Skulduggery", "Coordination"):
                scenario_type = "heist"
            elif skill_name in ("Deception", "Coercion", "Streetwise"):
                scenario_type = "intrigue"
            elif skill_name in ("Survival", "Resilience", "Athletics"):
                scenario_type = "survival"
            elif skill_name in ("Perception", "Vigilance", "Computers"):
                scenario_type = "mystery"
        await analyze_response_quality(user.user_id, action.action, scenario_type)

        # Detect and save significant events for the living galaxy
        await detect_and_save_significant_event(gm_response, session, character)

        response_data = {
            "warning": False,
            "gm_response": gm_response,
            "dice_result": dice_result.model_dump() if dice_result else None,
            "dice_line": dice_line,
            "location": session["current_location"],
            "environment_type": current_env,
            "environment_theme": ENVIRONMENT_THEMES.get(current_env, ENVIRONMENT_THEMES["urban"]),
            "skill_used": skill_name,
            "advancement": advancement_info,
            "coins": new_coins,
        }
        return response_data

    except Exception as e:
        logger.error(f"AI Game Master error: {e}")
        raise HTTPException(status_code=500, detail=f"AI Game Master error: {str(e)}")

@api_router.post("/game/sessions/{session_id}/start")
async def start_game_session(session_id: str, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.game_sessions.find_one({"session_id": session_id, "user_id": user.user_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")
    character = await db.characters.find_one({"character_id": session["character_id"]}, {"_id": 0})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    equipment_list = ", ".join([e["name"] for e in character.get("equipment", [])]) if character.get("equipment") else "basic gear"

    # Get scenario context if available
    scenario_context = ""
    if session.get("scenario_id"):
        scenario_context = "Use the chosen scenario as the adventure hook."

    # Era-specific context
    era = session.get("era", "Order 66 - Fall of the Republic")
    era_context = ""
    if "Order 66" in era:
        era_context = """ERA: ORDER 66 — THE FALL OF THE REPUBLIC
The galaxy is being torn apart RIGHT NOW. Chancellor Palpatine has just issued Order 66.
- Clone troopers across the galaxy are turning on their Jedi generals — blaster bolts from soldiers who were allies moments ago
- The Jedi Temple on Coruscant burns, pillars of smoke visible from orbit
- Republic military channels are flooded with confusion — conflicting orders, panicked communications
- The newly declared GALACTIC EMPIRE is seizing control — Star Destroyers are repositioning, blockades forming
- Civilians are terrified — markets closing, streets emptying, rumors spreading like wildfire
- Former Separatist worlds don't know if the war is over or just beginning
- Surviving Jedi are being hunted, their comm signals becoming beacons for death squads
This is happening TODAY. The character is caught in the middle of it. Open with the immediate chaos and danger."""

    # Fetch global events for this location to weave in other players' impact
    global_events = await get_nearby_global_events(
        session["current_location"], era, user.user_id, limit=3
    )
    global_context = ""
    if global_events:
        evt_parts = [f"- {e['actor_description']} caused a {e['event_type']}: {e['description'][:150]}" for e in global_events]
        global_context = f"\nOTHER EVENTS AT THIS LOCATION (weave naturally into background):\n" + "\n".join(evt_parts)

    system_prompt = f"""You are the Game Master for a Star Wars: Edge of the Empire tabletop RPG.
Create an immersive opening scene for a new adventure. Make the player feel like they're PHYSICALLY THERE.

{era_context}

CHARACTER:
- Name: {character['name']}
- Species: {character['species']}
- Career: {character['career']} ({character['specialization']})
- Equipment: {equipment_list}
- Backstory: {character.get('backstory', 'A traveler seeking fortune at the galaxy edge.')}

LOCATION: {session['current_location']}
{scenario_context}
{global_context}

IMMERSION RULES:
1. Engage at least 3 senses in the opening — sounds, smells, physical sensations
2. Show, don't tell — make the reader feel the ground shake, hear the distant blaster fire
3. The world is ALIVE and in chaos (if Order 66 era) — NPCs are reacting, ships are moving, alarms are sounding
4. Reference the character's equipment and career naturally
5. End with a visceral, present-tense moment that demands immediate response
6. NEVER reference dice, game mechanics, or break the fourth wall

Keep it to 3-4 rich paragraphs."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"eote_start_{session_id}",
            system_message=system_prompt
        ).with_model("anthropic", "claude-4-sonnet-20250514")

        user_message = UserMessage(text="Begin the adventure!")
        opening = await chat.send_message(user_message)

        new_history = [{"role": "game_master", "content": opening, "timestamp": datetime.now(timezone.utc).isoformat()}]
        await db.game_sessions.update_one({"session_id": session_id}, {"$set": {"game_history": new_history, "updated_at": datetime.now(timezone.utc)}})

        env_type = session.get("environment_type", LOCATION_ENVIRONMENTS.get(session["current_location"], "urban"))

        return {
            "opening": opening,
            "location": session["current_location"],
            "character": character,
            "environment_type": env_type,
            "environment_theme": ENVIRONMENT_THEMES.get(env_type, ENVIRONMENT_THEMES["urban"]),
        }

    except Exception as e:
        logger.error(f"Start game error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start game: {str(e)}")

# ============================================================================
# Scene Image Generation
# ============================================================================

SCENE_PROMPTS = {
    "cantina": "First-person POV inside a dimly lit alien cantina, worn durasteel bar counter in foreground, exotic alien patrons in shadows, holographic advertisements flickering on walls, smoke curling through amber light, glasses and bottles on the bar, a band stage in the far corner",
    "desert": "First-person POV standing on cracked red sandstone overlooking a vast desert canyon, twin suns low on the horizon casting long shadows, wind-carved rock spires in the distance, heat shimmer rising from the sand, a distant moisture vaporator silhouette",
    "jungle": "First-person POV pushing through dense alien jungle, massive bioluminescent flowers and curling vines framing the view, mist hanging between enormous tree trunks, strange insects glowing in the undergrowth, a narrow trail leading into green-blue canopy darkness",
    "space": "First-person POV from a starship cockpit looking into deep space, control panels visible at bottom edge, a nebula of purple and blue swirling ahead, distant star systems as pinpoints, hyperspace lane markers glowing faintly, an asteroid field to the right",
    "urban": "First-person POV standing on a rain-slicked landing platform, massive neon-lit skyscrapers towering overhead, speeders flying between buildings, holographic billboards in alien scripts, steam rising from vents below, the glow of a thousand windows stretching into the sky",
    "ruins": "First-person POV entering an ancient stone temple, crumbling carved pillars on either side, roots growing through cracked walls, shafts of dusty light from holes in the ceiling, worn hieroglyphs visible on dark stone surfaces, a long corridor vanishing into darkness",
    "ice": "First-person POV on a frozen cliff edge, jagged ice formations towering like blue-white crystal spires, a howling blizzard partially obscuring the distant frozen wasteland, northern lights shimmering green above, a cave entrance carved from glacial ice",
    "industrial": "First-person POV on a catwalk inside a massive starship scrapyard, enormous rusted hull sections stacked high, sparks raining from cutting torches above, heavy machinery moving in the background, grease-stained durasteel platforms, chains and cables hanging",
    "dark_side": "First-person POV in a cave pulsing with dark energy, crimson veins of light running through black obsidian walls, red mist pooling at floor level, jagged stalactites dripping shadowy substance, the feeling of ancient malevolent power, distant echoes of whispers",
}

@api_router.post("/game/sessions/{session_id}/generate-scene")
async def generate_scene(session_id: str, request: Request):
    """Generate a first-person scene image for the current game environment"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.game_sessions.find_one({"session_id": session_id, "user_id": user.user_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")

    env_type = session.get("environment_type", "urban")
    location = session.get("current_location", "Unknown")
    
    # Get recent story context for a more specific scene
    recent_history = session.get("game_history", [])[-3:]
    story_context = ""
    for msg in recent_history:
        if msg.get("role") == "game_master":
            story_context = msg.get("content", "")[:300]
            break

    base_scene = SCENE_PROMPTS.get(env_type, SCENE_PROMPTS["urban"])

    prompt = f"""Cinematic first-person point-of-view digital painting, Star Wars universe, ultra-wide 16:9 aspect:

SCENE: {base_scene}

LOCATION: {location}
{f'STORY CONTEXT: {story_context}' if story_context else ''}

ARTISTIC DIRECTION: Hyper-detailed environment art, cinematic lighting, volumetric atmosphere, Star Wars aesthetic. First-person perspective looking into the scene. Rich environmental textures - if outdoors show terrain material (rock, sand, ice, vegetation). Moody atmospheric lighting. No text, no UI elements, no characters in extreme foreground. The image should feel like a window into this world."""

    try:
        image_gen = OpenAIImageGeneration(api_key=EMERGENT_LLM_KEY)
        images = await image_gen.generate_images(prompt=prompt, model="gpt-image-1", number_of_images=1)
        if images and len(images) > 0:
            image_base64 = base64.b64encode(images[0]).decode('utf-8')
            await db.game_sessions.update_one(
                {"session_id": session_id},
                {"$set": {"scene_image_base64": image_base64}}
            )
            return {"scene_image_base64": image_base64, "environment_type": env_type}
        else:
            raise HTTPException(status_code=500, detail="No scene image generated")
    except Exception as e:
        logger.error(f"Scene generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate scene: {str(e)}")

# ============================================================================
# Root endpoint
# ============================================================================

@api_router.get("/")
async def root():
    return {"message": "Star Wars: Edge of the Empire RPG API", "version": "2.0.0"}

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
