import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Character, GameSession, DiceResult, SpeciesData, CareerData } from '../types/game';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface GameState {
  characters: Character[];
  currentCharacter: Character | null;
  currentSession: GameSession | null;
  speciesData: Record<string, SpeciesData>;
  careerData: Record<string, CareerData>;
  skills: Array<{ name: string; characteristic: string }>;
  isLoading: boolean;

  // Actions
  fetchGameData: () => Promise<void>;
  fetchCharacters: () => Promise<void>;
  createCharacter: (data: {
    name: string;
    species: string;
    career: string;
    specialization: string;
    backstory?: string;
  }) => Promise<Character>;
  selectCharacter: (character: Character) => void;
  deleteCharacter: (characterId: string) => Promise<void>;
  generatePortrait: (characterId: string) => Promise<string>;
  
  // Game session
  createGameSession: (characterId: string) => Promise<GameSession>;
  fetchGameSessions: () => Promise<GameSession[]>;
  loadGameSession: (sessionId: string) => Promise<void>;
  startGame: (sessionId: string) => Promise<any>;
  sendAction: (sessionId: string, action: string, skill?: string) => Promise<any>;
  
  // Dice
  rollDice: (dicePool: {
    ability?: number;
    proficiency?: number;
    difficulty?: number;
    challenge?: number;
    boost?: number;
    setback?: number;
    force?: number;
  }) => Promise<DiceResult>;

  // Scene
  generateScene: (sessionId: string) => Promise<any>;
}

const getAuthHeader = async () => {
  const token = await AsyncStorage.getItem('session_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

export const useGameStore = create<GameState>((set, get) => ({
  characters: [],
  currentCharacter: null,
  currentSession: null,
  speciesData: {},
  careerData: {},
  skills: [],
  isLoading: false,

  fetchGameData: async () => {
    try {
      const [speciesRes, careersRes, skillsRes] = await Promise.all([
        fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/game/species`),
        fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/game/careers`),
        fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/game/skills`),
      ]);

      const [speciesData, careerData, skills] = await Promise.all([
        speciesRes.json(),
        careersRes.json(),
        skillsRes.json(),
      ]);

      set({ speciesData, careerData, skills });
    } catch (error) {
      console.error('Failed to fetch game data:', error);
    }
  },

  fetchCharacters: async () => {
    try {
      set({ isLoading: true });
      const headers = await getAuthHeader();
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/characters`, {
        headers,
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch characters');

      const characters = await response.json();
      set({ characters, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch characters:', error);
      set({ isLoading: false });
    }
  },

  createCharacter: async (data) => {
    const headers = await getAuthHeader();
    const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/characters`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error('Failed to create character');

    const character = await response.json();
    set((state) => ({ characters: [...state.characters, character] }));
    return character;
  },

  selectCharacter: (character) => set({ currentCharacter: character }),

  deleteCharacter: async (characterId) => {
    const headers = await getAuthHeader();
    const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/characters/${characterId}`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });

    if (!response.ok) throw new Error('Failed to delete character');

    set((state) => ({
      characters: state.characters.filter((c) => c.character_id !== characterId),
      currentCharacter: state.currentCharacter?.character_id === characterId ? null : state.currentCharacter,
    }));
  },

  generatePortrait: async (characterId) => {
    const headers = await getAuthHeader();
    const response = await fetch(
      `${EXPO_PUBLIC_BACKEND_URL}/api/characters/${characterId}/generate-portrait`,
      {
        method: 'POST',
        headers,
        credentials: 'include',
      }
    );

    if (!response.ok) throw new Error('Failed to generate portrait');

    const data = await response.json();
    
    // Update character in store
    set((state) => ({
      characters: state.characters.map((c) =>
        c.character_id === characterId ? { ...c, portrait_base64: data.portrait_base64 } : c
      ),
      currentCharacter:
        state.currentCharacter?.character_id === characterId
          ? { ...state.currentCharacter, portrait_base64: data.portrait_base64 }
          : state.currentCharacter,
    }));

    return data.portrait_base64;
  },

  createGameSession: async (characterId) => {
    const headers = await getAuthHeader();
    const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/game/sessions`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ character_id: characterId }),
    });

    if (!response.ok) throw new Error('Failed to create game session');

    const session = await response.json();
    set({ currentSession: session });
    return session;
  },

  fetchGameSessions: async () => {
    const headers = await getAuthHeader();
    const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/game/sessions`, {
      headers,
      credentials: 'include',
    });

    if (!response.ok) throw new Error('Failed to fetch game sessions');

    return response.json();
  },

  loadGameSession: async (sessionId) => {
    const headers = await getAuthHeader();
    const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/game/sessions/${sessionId}`, {
      headers,
      credentials: 'include',
    });

    if (!response.ok) throw new Error('Failed to load game session');

    const session = await response.json();
    set({ currentSession: session });
  },

  startGame: async (sessionId) => {
    const headers = await getAuthHeader();
    const response = await fetch(
      `${EXPO_PUBLIC_BACKEND_URL}/api/game/sessions/${sessionId}/start`,
      {
        method: 'POST',
        headers,
        credentials: 'include',
      }
    );

    if (!response.ok) throw new Error('Failed to start game');

    return response.json();
  },

  sendAction: async (sessionId, action, skill) => {
    const headers = await getAuthHeader();
    const response = await fetch(
      `${EXPO_PUBLIC_BACKEND_URL}/api/game/sessions/${sessionId}/action`,
      {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ action, skill }),
      }
    );

    if (!response.ok) throw new Error('Failed to send action');

    const data = await response.json();
    
    // Update current session with new history
    set((state) => {
      if (!state.currentSession) return state;
      return {
        currentSession: {
          ...state.currentSession,
          game_history: [
            ...state.currentSession.game_history,
            { role: 'player', content: action, timestamp: new Date().toISOString() },
            { role: 'game_master', content: data.gm_response, timestamp: new Date().toISOString() },
          ],
        },
      };
    });

    return data;
  },

  rollDice: async (dicePool) => {
    const headers = await getAuthHeader();
    const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/dice/roll`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        ability: dicePool.ability || 0,
        proficiency: dicePool.proficiency || 0,
        difficulty: dicePool.difficulty || 0,
        challenge: dicePool.challenge || 0,
        boost: dicePool.boost || 0,
        setback: dicePool.setback || 0,
        force: dicePool.force || 0,
      }),
    });

    if (!response.ok) throw new Error('Failed to roll dice');

    return response.json();
  },

  generateScene: async (sessionId: string) => {
    const headers = await getAuthHeader();
    const response = await fetch(
      `${EXPO_PUBLIC_BACKEND_URL}/api/game/sessions/${sessionId}/generate-scene`,
      {
        method: 'POST',
        headers,
        credentials: 'include',
      }
    );

    if (!response.ok) throw new Error('Failed to generate scene');

    return response.json();
  },
}));
