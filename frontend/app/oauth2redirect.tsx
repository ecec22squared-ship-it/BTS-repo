/**
 * OAuth redirect handler — actually completes the sign-in.
 *
 * Why this file does the heavy lifting (not app/index.tsx):
 *
 * On native Android, when Google redirects to
 *   com.googleusercontent.apps.<reversed>:/oauth2redirect#id_token=…
 * the OS opens our APK and Expo Router navigates to THIS route. That
 * unmounts the previous `/` screen, including the `useIdTokenAuthRequest`
 * hook that was waiting for a response. By the time we get here, expo-
 * auth-session's in-memory promise is gone and the response will never
 * be observed on `/`.
 *
 * So we cut out the middleman: read the redirect URL directly, parse the
 * id_token out of it, run the Firebase + backend exchange, set the auth
 * state, and only then navigate back to `/` (which renders the main menu
 * because isAuthenticated is now true).
 */
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { exchangeGoogleIdTokenForFirebaseIdToken } from '../src/lib/firebase';
import { useAuthStore } from '../src/stores/authStore';
import { useGameStore } from '../src/stores/gameStore';

WebBrowser.maybeCompleteAuthSession();

function extractOAuthParams(url: string): Record<string, string> {
  // The OAuth response can arrive in either the query string (?id_token=…)
  // or the fragment (#id_token=…). Both are valid for implicit flow.
  const out: Record<string, string> = {};
  if (!url) return out;
  const qIdx = url.indexOf('?');
  const hIdx = url.indexOf('#');
  const tail = url.slice(Math.min(...[qIdx, hIdx].filter((i) => i >= 0)) + 1);
  for (const pair of tail.split(/[&]/)) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    out[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(
      pair.slice(eq + 1),
    );
  }
  return out;
}

export default function OAuthRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loginWithFirebase = useAuthStore((s) => s.loginWithFirebase);
  const fetchGameData = useGameStore((s) => s.fetchGameData);
  const fetchCharacters = useGameStore((s) => s.fetchCharacters);

  const [status, setStatus] = useState('Completing sign-in…');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  // Once we have a real auth state, navigate home.
  useEffect(() => {
    if (isAuthenticated) {
      setStatus('Signed in — loading…');
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

  // Drive the Google → Firebase → backend exchange directly here.
  useEffect(() => {
    let cancelled = false;

    async function processRedirectUrl(url: string | null) {
      try {
        if (!url) {
          setErrorDetail('No redirect URL detected on this screen.');
          return;
        }
        const params = extractOAuthParams(url);

        if (params.error) {
          setErrorDetail(
            `Google returned error: ${params.error}` +
              (params.error_description
                ? ` — ${params.error_description}`
                : ''),
          );
          return;
        }

        const googleIdToken = params.id_token;
        const googleAccessToken = params.access_token;

        if (!googleIdToken) {
          // Note which params DID come back so we can iterate if a future
          // build returns code-flow instead of implicit-flow.
          setErrorDetail(
            `Redirect contained no id_token. Keys: [${Object.keys(params).join(', ') || '(none)'}]`,
          );
          return;
        }

        setStatus('Exchanging with Firebase…');
        const firebaseIdToken =
          await exchangeGoogleIdTokenForFirebaseIdToken(
            googleIdToken,
            googleAccessToken,
          );

        if (cancelled) return;
        setStatus('Talking to backend…');
        await loginWithFirebase(firebaseIdToken);

        if (cancelled) return;
        setStatus('Loading game data…');
        await Promise.all([fetchGameData(), fetchCharacters()]);
        // isAuthenticated is now true — the other useEffect will navigate.
      } catch (err: any) {
        if (cancelled) return;
        console.error('OAuth redirect processing failed:', err);
        setErrorDetail(
          `${err?.code ? `[${err.code}] ` : ''}${err?.message || String(err)}`,
        );
      }
    }

    // First try the URL we were launched with…
    Linking.getInitialURL().then((url) => {
      if (cancelled) return;
      if (url) {
        processRedirectUrl(url);
        return;
      }
      // …otherwise listen for one (if Expo Router got here first).
      const sub = Linking.addEventListener('url', (event) => {
        processRedirectUrl(event.url);
      });
      // Give it 1s; if no URL ever arrives, surface the issue.
      setTimeout(() => {
        if (!cancelled && !useAuthStore.getState().isAuthenticated) {
          setErrorDetail(
            'No OAuth URL captured. The redirect may have been consumed by ' +
              'another listener. Try Sign-in again.',
          );
        }
        sub.remove();
      }, 1500);
    });

    // Fallback: if nothing happens in 12s, bounce back to '/'.
    const fallback = setTimeout(() => {
      if (!cancelled && !useAuthStore.getState().isAuthenticated) {
        try {
          router.replace('/');
        } catch {
          if (typeof window !== 'undefined') window.location.replace('/');
        }
      }
    }, 12000);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [loginWithFirebase, fetchGameData, fetchCharacters]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FFD700" />
      <Text style={styles.text}>{status}</Text>
      <Text style={styles.hint}>
        Platform: {Platform.OS}{' '}
        {isAuthenticated ? '· ✅ authenticated' : '· waiting…'}
      </Text>
      {errorDetail ? (
        <Text style={styles.errorText} selectable>
          ⚠ {errorDetail}
        </Text>
      ) : null}
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
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 24,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
});
