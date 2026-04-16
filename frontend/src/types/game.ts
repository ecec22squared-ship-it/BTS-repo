// Star Wars: Edge of the Empire Game Types

export interface CharacterStats {
  brawn: number;
  agility: number;
  intellect: number;
  cunning: number;
  willpower: number;
  presence: number;
}

export interface CharacterSkill {
  name: string;
  rank: number;
  characteristic: string;
}

export interface CharacterHealth {
  wounds: number;
  wound_threshold: number;
  strain: number;
  strain_threshold: number;
}

export interface CharacterExperience {
  total: number;
  available: number;
}

export interface Character {
  character_id: string;
  user_id: string;
  name: string;
  species: string;
  career: string;
  specialization: string;
  stats: CharacterStats;
  skills: CharacterSkill[];
  health: CharacterHealth;
  experience: CharacterExperience;
  equipment: string[];
  credits: number;
  portrait_base64?: string;
  backstory?: string;
  created_at: string;
}

export interface DiceRoll {
  ability: number;
  proficiency: number;
  difficulty: number;
  challenge: number;
  boost: number;
  setback: number;
  force: number;
}

export interface DiceResult {
  successes: number;
  failures: number;
  advantages: number;
  threats: number;
  triumphs: number;
  despairs: number;
  light_side: number;
  dark_side: number;
  net_successes: number;
  net_advantages: number;
  success: boolean;
  dice_details: Array<{
    type: string;
    color: string;
    result: Record<string, number>;
  }>;
}

export interface GameMessage {
  role: 'player' | 'game_master' | 'system';
  content: string;
  timestamp: string;
}

export interface Enemy {
  name: string;
  wounds: number;
  wound_threshold: number;
  stats: CharacterStats;
  abilities: string[];
}

export interface CombatState {
  in_combat: boolean;
  enemies: Enemy[];
  initiative_order: string[];
  current_turn: number;
}

export interface GameSession {
  session_id: string;
  user_id: string;
  character_id: string;
  story_context: string[];
  current_location: string;
  npcs: any[];
  combat_state: CombatState;
  game_history: GameMessage[];
  created_at: string;
  updated_at: string;
}

export interface SpeciesData {
  description: string;
  stat_bonuses: Partial<CharacterStats>;
  starting_xp: number;
  wound_bonus: number;
  strain_bonus: number;
  special: string;
}

export interface CareerData {
  description: string;
  career_skills: string[];
  specializations: string[];
}

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  created_at: string;
}
