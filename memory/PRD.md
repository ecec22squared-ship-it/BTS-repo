# Star Wars: Edge of the Empire RPG - Product Requirements Document

## Overview
A text-based role-playing mobile game based on the Star Wars: Edge of the Empire tabletop game system, featuring AI-powered storytelling, authentic dice mechanics, and immersive character creation.

## Core Features

### 1. Authentication
- Google OAuth via Emergent Auth
- Persistent sessions (7 days)
- User profile management

### 2. Character Creation
- **Species Selection**: Human, Twi'lek, Wookiee, Rodian, Bothan, Droid
- **Careers**: Bounty Hunter, Colonist, Explorer, Hired Gun, Smuggler, Technician
- **Specializations**: 3 per career
- **Stats**: Brawn, Agility, Intellect, Cunning, Willpower, Presence
- **Skills**: 32 skills based on careers
- **AI Portrait Generation**: OpenAI gpt-image-1 integration

### 3. Edge of the Empire Dice System
Full implementation of the unique dice mechanics:
- **Ability Dice** (Green): Success, Advantage
- **Proficiency Dice** (Yellow): Success, Advantage, Triumph
- **Difficulty Dice** (Purple): Failure, Threat
- **Challenge Dice** (Red): Failure, Threat, Despair
- **Boost Dice** (Blue): Success, Advantage
- **Setback Dice** (Black): Failure, Threat
- **Force Dice** (White): Light Side, Dark Side

Results calculated as net successes/advantages with special Triumph/Despair effects.

### 4. AI Game Master (Claude Sonnet 4)
- Immersive narrative storytelling
- Dynamic story generation
- Combat narration
- NPC interactions
- Context-aware responses based on character and game state

### 5. Game Locations
Featured locations at the galaxy's edge:
- Nar Shaddaa, Kessel, Ryloth, Ord Mantell
- Dathomir, Lothal, Florrum, Takodana
- Jakku, Vandor, Bracca, Batuu

## Tech Stack
- **Frontend**: Expo React Native
- **Backend**: FastAPI + MongoDB
- **AI**: Claude Sonnet 4 (narrative), OpenAI gpt-image-1 (portraits)
- **Auth**: Emergent Google OAuth

## Play Store Requirements
- Package: com.starwars.edgeoftheempire
- Dark theme UI optimized for immersive gaming
- Offline-capable for saved game states
