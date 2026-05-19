import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/game';
import { firebaseLogout } from '../lib/firebase';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionToken: string | null;
  setUser: (user: User | null) => void;
  setSessionToken: (token: string | null) => void;
  /**
   * Send a Firebase ID token (obtained on the client via the Firebase JS
   * SDK after a Google sign-in) to the backend. The backend verifies it
   * with firebase-admin and returns a backend session_token + user.
   */
  loginWithFirebase: (firebaseIdToken: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  sessionToken: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setSessionToken: async (token) => {
    if (token) {
      await AsyncStorage.setItem('session_token', token);
    } else {
      await AsyncStorage.removeItem('session_token');
    }
    set({ sessionToken: token });
  },

  loginWithFirebase: async (firebaseIdToken: string) => {
    try {
      const response = await fetch(
        `${EXPO_PUBLIC_BACKEND_URL}/api/auth/firebase`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: firebaseIdToken }),
          credentials: 'include',
        },
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Firebase login failed (${response.status}): ${detail}`);
      }

      const data = await response.json();
      await AsyncStorage.setItem('session_token', data.session_token);
      set({
        user: data.user,
        sessionToken: data.session_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Firebase login error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Also sign out from Firebase so the next sign-in picks the right account
      await firebaseLogout().catch(() => {});
      await AsyncStorage.removeItem('session_token');
      set({
        user: null,
        sessionToken: null,
        isAuthenticated: false,
      });
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true });
      const token = await AsyncStorage.getItem('session_token');

      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      if (!response.ok) {
        await AsyncStorage.removeItem('session_token');
        set({ isLoading: false, isAuthenticated: false, user: null });
        return;
      }

      const user = await response.json();
      set({
        user,
        sessionToken: token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Auth check error:', error);
      await AsyncStorage.removeItem('session_token');
      set({ isLoading: false, isAuthenticated: false, user: null });
    }
  },
}));
