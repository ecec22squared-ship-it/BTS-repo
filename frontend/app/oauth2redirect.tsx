/**
 * OAuth redirect handler — `expo-auth-session` redirects the popup/tab here
 * after Google sign-in completes. We call `maybeCompleteAuthSession()` so the
 * popup closes (browser flow) and then bounce the user back to `/` so the
 * existing in-app `useEffect(response, ...)` in app/index.tsx can pick up the
 * response and finish the Firebase exchange.
 */
import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export default function OAuthRedirect() {
  useEffect(() => {
    // Closes the auth popup if we're inside one. On full-page redirects (mobile
    // browser, web preview) we then send the user back to the app root where
    // expo-auth-session will read the URL params and continue the flow.
    WebBrowser.maybeCompleteAuthSession();
    const t = setTimeout(() => {
      try {
        router.replace('/');
      } catch {
        // Fallback for web full-page reloads — manual nav.
        if (typeof window !== 'undefined') {
          window.location.replace('/');
        }
      }
    }, 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FFD700" />
      <Text style={styles.text}>Completing sign-in…</Text>
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
  },
});
