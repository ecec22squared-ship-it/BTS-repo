/**
 * OAuth redirect handler — `expo-auth-session` redirects here after Google
 * sign-in completes (HTTPS redirect on web, custom scheme on native).
 *
 * Why this route exists:
 *   • On web, Google does a full-page navigation; without this route, Expo
 *     Router shows "Unmatched Route" because the redirect URL hits a path
 *     the bundler doesn't know about.
 *   • On native, the Custom Tab posts the URL back through Android's intent
 *     system; Expo Router may still navigate here as a side effect.
 *
 * Why we DO NOT immediately navigate back to '/':
 *   The OAuth response is processed by the useIdTokenAuthRequest hook in
 *   app/index.tsx (the ORIGINAL instance that called promptAsync). That
 *   processing is async (Firebase token exchange + backend session + write
 *   to AsyncStorage). If we navigate back to '/' too quickly, Expo Router
 *   creates a *new* '/' instance whose checkAuth() reads AsyncStorage
 *   BEFORE the original instance has written the new session_token —
 *   resulting in a race that sets isAuthenticated back to false and lands
 *   the user back on the login screen even though auth succeeded.
 *
 * The fix: subscribe to the auth store and only navigate back to '/' once
 * isAuthenticated has actually flipped to true (or after a generous 8s
 * fallback in case auth silently fails — at which point the user lands on
 * the login screen and can see any error in the debug panel).
 */
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../src/stores/authStore';

WebBrowser.maybeCompleteAuthSession();

export default function OAuthRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [status, setStatus] = useState('Completing sign-in…');

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  // As soon as the original screen finishes the Firebase + backend
  // exchange, the store flips isAuthenticated → true. THEN we navigate.
  useEffect(() => {
    if (isAuthenticated) {
      setStatus('Signed in! Loading…');
      const t = setTimeout(() => {
        try {
          router.replace('/');
        } catch {
          if (typeof window !== 'undefined') window.location.replace('/');
        }
      }, 120);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated]);

  // Fallback for the case where auth genuinely failed silently — after 8s,
  // bounce back to '/' so the user can see the error in the debug panel
  // instead of being stuck on a spinner forever.
  useEffect(() => {
    const fallback = setTimeout(() => {
      if (!useAuthStore.getState().isAuthenticated) {
        setStatus('Sign-in did not complete — returning to login');
        try {
          router.replace('/');
        } catch {
          if (typeof window !== 'undefined') window.location.replace('/');
        }
      }
    }, 8000);
    return () => clearTimeout(fallback);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FFD700" />
      <Text style={styles.text}>{status}</Text>
      <Text style={styles.hint}>
        Platform: {Platform.OS} · waiting for auth state…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: {
    color: '#FFD700',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  hint: {
    color: '#888',
    fontSize: 11,
    marginTop: 8,
  },
});
