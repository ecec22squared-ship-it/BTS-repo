# Star Wars: Edge of the Empire RPG - Product Requirements Document

## Overview
A text-based role-playing mobile game based on the Star Wars: Edge of the Empire tabletop game system, featuring AI-powered storytelling, authentic dice mechanics, immersive character creation, and dynamic environment theming.

## Core Features

### 1. Authentication
- Google OAuth via Emergent Auth
- Persistent sessions (7 days)
- User profile management

### 2. Character Creation
- **Species Selection**: Human, Twi'lek, Wookiee, Rodian, Bothan, Droid (with detailed appearance data)
- **Careers**: Bounty Hunter, Colonist, Explorer, Hired Gun, Smuggler, Technician
- **Specializations**: 3 per career (18 total)
- **Stats**: Brawn, Agility, Intellect, Cunning, Willpower, Presence
- **Skills**: 32 skills based on careers
- **Starter Equipment Packages**: Career-specific + specialization bonus items (weapons, armor, gear)
- **AI Portrait Generation**: OpenAI gpt-image-1 with enhanced prompts incorporating species appearance, career visual cues, equipment details, and backstory tone

### 3. Starter Equipment System
Each career provides:
- **Base equipment** (4-5 items): Weapons, armor, and essential gear for the career
- **Specialization bonus** (2 items): Additional items specific to the specialization
- Items have name, category (weapon/armor/gear/tool), and rich descriptions

### 4. Edge of the Empire Dice System
Full implementation with:
- All 7 dice types (Ability, Proficiency, Difficulty, Challenge, Boost, Setback, Force)
- Symbols: Success, Failure, Advantage, Threat, Triumph, Despair, Light Side, Dark Side
- **Auto-Skill Detection**: Actions automatically mapped to skills via keyword detection (30+ keywords)
- **Auto-Difficulty Scaling**: Context-based difficulty determination
- **Formatted Dice Lines**: `[DICE: skill | pool vs opposition | verdict: outcome]`

### 5. AI Game Master (Claude Sonnet 4)
- Immersive narrative storytelling blending dice outcomes naturally
- Dynamic story generation with equipment references
- Combat narration with narrative consequence of rolls
- NPC interactions
- **Never breaks fourth wall** - game mechanics invisible in narrative
- Equipment-aware descriptions

### 6. Dynamic Environment Theming
9 environment types with full color schemes:
- **Cantina**: Smoky amber warmth (#FF6B35)
- **Desert**: Scorching sandstorm haze (#EDC9AF)
- **Jungle**: Dense bioluminescent canopy (#2ECC71)
- **Space**: Cold starlight void (#7B68EE)
- **Urban**: Neon-washed duracrete streets (#00CED1)
- **Ruins**: Crumbling ancient stone (#BC8F8F)
- **Ice**: Biting glacial wind (#B0E0E6)
- **Industrial**: Grinding machinery and sparks (#CD853F)
- **Dark Side**: Oppressive dark side energy (#DC143C)

Each theme includes: primary, accent, background, border, text_glow, and mood descriptor. Themes dynamically shift based on narrative context.

### 7. Galaxy Map Loading Animation
- Animated Star Wars galaxy sector grid (6×5)
- Hyperspace route plotting with animated path drawing
- Scan line effect and pulsing active node
- Sector coordinate readout
- Shown during AI "thinking" time

### 8. Game Locations
Featured locations at the galaxy's edge:
- Nar Shaddaa, Kessel, Ryloth, Ord Mantell, Dathomir, Lothal, Florrum, Takodana, Jakku, Vandor, Bracca, Batuu

## Tech Stack
- **Frontend**: Expo React Native (Play Store ready, SDK 54)
- **Backend**: FastAPI + MongoDB
- **AI**: Claude Sonnet 4 (narrative), OpenAI gpt-image-1 (portraits)
- **Auth**: Emergent Google OAuth

## API Version
v2.0.0

## Play Store Configuration
- Package: com.starwars.edgeoftheempire
- Dark theme UI optimized for immersive gaming
- Portrait orientation
- Edge-to-edge enabled on Android
