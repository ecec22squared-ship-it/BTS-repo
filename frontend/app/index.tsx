import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as Clipboard from 'expo-clipboard';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useAuthStore } from '../src/stores/authStore';
import { useGameStore } from '../src/stores/gameStore';
import { exchangeGoogleIdTokenForFirebaseIdToken } from '../src/lib/firebase';

WebBrowser.maybeCompleteAuthSession();

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

export default function Index() {
  const { user, isAuthenticated, isLoading, checkAuth, loginWithFirebase, logout } = useAuthStore();
  const { characters, fetchCharacters, fetchGameData } = useGameStore();
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  const [authErrorDetail, setAuthErrorDetail] = useState<string | null>(null);
  const [authFlowDebug, setAuthFlowDebug] = useState<string>('');
  const [showDebug, setShowDebug] = useState(false);

  // -------- Firebase + Google Sign-In ----------------------------------
  // expo-auth-session/providers/google automatically picks the right
  // client ID per platform:
  //   • web      → webClientId (Web OAuth client w/ HTTPS redirect URIs registered)
  //   • Android  → androidClientId (auto-derives redirect URI from package name + SHA-1)
  //   • iOS      → iosClientId
  //
  // On Android we must use the reversed Google Android client ID as the
  // redirect URI scheme — Google rejects anything else for Android OAuth,
  // and nothing on the device will catch the generic package-name scheme
  // that AuthSession.makeRedirectUri() returns by default.
  const androidGoogleRedirectUri = (() => {
    if (Platform.OS !== 'android' || !GOOGLE_ANDROID_CLIENT_ID) return undefined;
    const reversed = GOOGLE_ANDROID_CLIENT_ID.split('.').reverse().join('.');
    return `${reversed}:/oauth2redirect`;
  })();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    // Only override redirectUri on Android — let the lib pick the right
    // one for web (https) and iOS (custom scheme).
    ...(androidGoogleRedirectUri ? { redirectUri: androidGoogleRedirectUri } : {}),
  });

  const redirectUri =
    androidGoogleRedirectUri || (request as any)?.redirectUri || '';

  useEffect(() => {
    // Always log the redirect URI so the developer can copy-paste it into
    // Google Cloud Console → OAuth Client → Authorized redirect URIs.
    if (redirectUri) {
      console.log('[GoogleAuth] redirect_uri =', redirectUri);
    }
  }, [redirectUri]);

  useEffect(() => {
    if (!response) return;

    // Capture the response shape into the debug panel so we can see exactly
    // what came back from Google on real devices (logs aren't visible in
    // production APKs).
    const paramKeys = response.params
      ? Object.keys(response.params).join(', ')
      : '(none)';
    setAuthFlowDebug(
      `type=${response.type} | params=[${paramKeys}]` +
        (response.type === 'error'
          ? ` | err=${(response as any).error?.message || ''}`
          : ''),
    );

    if (response.type === 'success') {
      const params = (response.params as Record<string, string> | undefined) || {};
      const googleIdToken = params.id_token;
      const authCode = params.code;

      if (!googleIdToken) {
        // Native Android OAuth often returns an auth code, not an id_token.
        // Surface the actual response so we can iterate.
        setAuthErrorDetail(
          `Google sign-in returned no id_token. Got params: [${paramKeys}]. ` +
            (authCode
              ? 'Got authorization code instead — Android client is using code flow.'
              : 'No code or id_token in response.'),
        );
        return;
      }
      (async () => {
        setIsProcessingAuth(true);
        setAuthErrorDetail(null);
        try {
          setAuthFlowDebug((d) => d + ' | exchanging w/ Firebase…');
          const firebaseIdToken =
            await exchangeGoogleIdTokenForFirebaseIdToken(googleIdToken);
          setAuthFlowDebug((d) => d + ' | OK → backend…');
          await loginWithFirebase(firebaseIdToken);
          setAuthFlowDebug((d) => d + ' | backend OK → fetching game data');
          await fetchGameData();
          await fetchCharacters();
          setAuthFlowDebug((d) => d + ' | ✅ DONE');
        } catch (err: any) {
          console.error('Firebase sign-in flow failed:', err);
          setAuthErrorDetail(
            `[stage: ${
              (err as any)?.stage || 'unknown'
            }] ${String(err?.code || '')} ${String(err?.message || err)}`,
          );
        } finally {
          setIsProcessingAuth(false);
        }
      })();
    } else if (response.type === 'error') {
      const errMsg =
        response.error?.message ||
        (response.params as Record<string, string> | undefined)?.error ||
        'Unknown auth error';
      console.warn('Google auth error:', errMsg, response);
      setAuthErrorDetail(`${errMsg}`);
    }
  }, [response]);

  // -------- Legacy Emergent OAuth callback REMOVED ---------------------
  // The /api/auth/session endpoint and Emergent's auth.emergentagent.com
  // redirect were retired during the Firebase Auth migration. If you ever
  // need to re-enable a deep-link callback, restore this useEffect from
  // git history.

  // Check auth on mount
  useEffect(() => {
    checkAuth().then(() => {
      if (useAuthStore.getState().isAuthenticated) {
        fetchGameData();
        fetchCharacters();
      }
    });
  }, []);

  const handleGoogleLogin = async () => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      console.warn('Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID env var');
      setAuthErrorDetail('Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID env var');
      return;
    }
    setAuthErrorDetail(null);
    try {
      await promptAsync();
    } catch (err: any) {
      console.error('promptAsync failed:', err);
      setAuthErrorDetail(String(err?.message || err));
    }
  };

  const copyRedirectUri = async () => {
    try {
      await Clipboard.setStringAsync(redirectUri || '');
    } catch {
      // ignore
    }
  };

  if (isLoading || isProcessingAuth) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>
            {isProcessingAuth ? 'Logging in...' : 'Loading...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* IP Disclaimer - shown prominently at the top */}
          <View style={styles.ipDisclaimerBanner}>
            <Ionicons name="warning-outline" size={14} color="#FF3EC8" />
            <Text style={styles.ipDisclaimerText}>
              This Game is not Endorsed, Supported, or Affiliated with Star Wars or any associated company.
            </Text>
          </View>

          <View style={styles.loginContainer}>
            {/* Logo/Title */}
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1707057539184-27e90364e30a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwxfHxnYWxheHklMjBzcGlyYWwlMjBzdGFycyUyMGNvc21vc3xlbnwwfHx8fDE3NzYzMzkwMjl8MA&ixlib=rb-4.1.0&q=85' }}
                style={styles.galaxyIcon}
              />
              <Text style={styles.title}>BEYOND THE STARS</Text>
              <Text style={styles.subtitle}>A Galactic Text RPG Powered by AI</Text>
            </View>

            {/* Description */}
            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>
                Live the Galactic universe through immersive AI storytelling. 
                Create your character, shape the galaxy, and forge your legend at the edge of the stars.
              </Text>
            </View>

            {/* Features */}
            <View style={styles.featuresContainer}>
              <View style={styles.featureItem}>
                <Ionicons name="dice" size={24} color="#4CAF50" />
                <Text style={styles.featureText}>Authentic Dice System</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="chatbubbles" size={24} color="#03A9F4" />
                <Text style={styles.featureText}>AI Game Master</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="person" size={24} color="#9C27B0" />
                <Text style={styles.featureText}>Character Creation</Text>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity style={styles.loginButton} onPress={handleGoogleLogin}>
              <Ionicons name="logo-google" size={24} color="#fff" />
              <Text style={styles.loginButtonText}>Sign in with Google</Text>
            </TouchableOpacity>

            {/* Debug toggle — quiet by default, visible only when needed */}
            {!authErrorDetail && !showDebug && (
              <TouchableOpacity
                onPress={() => setShowDebug(true)}
                style={styles.debugToggle}
                activeOpacity={0.7}
              >
                <Ionicons name="information-circle-outline" size={12} color="#666" />
                <Text style={styles.debugToggleText}>Show OAuth debug info</Text>
              </TouchableOpacity>
            )}

            {/* Debug box — auto-shows on auth error, or manually via toggle */}
            {(authErrorDetail || showDebug || authFlowDebug) && (
              <View style={styles.debugBox}>
                {authErrorDetail ? (
                  <Text style={styles.debugError}>⚠ {authErrorDetail}</Text>
                ) : null}
                {authFlowDebug ? (
                  <>
                    <Text style={styles.debugLabel}>Auth flow:</Text>
                    <Text selectable style={styles.debugUri}>{authFlowDebug}</Text>
                  </>
                ) : null}
                <Text style={styles.debugLabel}>Redirect URI in use:</Text>
                <Text selectable style={styles.debugUri}>{redirectUri}</Text>
                <View style={styles.debugBtnRow}>
                  <TouchableOpacity style={styles.debugCopyBtn} onPress={copyRedirectUri}>
                    <Ionicons name="copy-outline" size={14} color="#FFD700" />
                    <Text style={styles.debugCopyText}>Copy redirect URI</Text>
                  </TouchableOpacity>
                  {!authErrorDetail && (
                    <TouchableOpacity
                      style={styles.debugCopyBtn}
                      onPress={() => setShowDebug(false)}
                    >
                      <Ionicons name="close" size={14} color="#FFD700" />
                      <Text style={styles.debugCopyText}>Hide</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.debugHelp}>
                  If you see <Text style={{ fontWeight: '700' }}>redirect_uri_mismatch</Text>, add the URI above to Google Cloud Console → Credentials → Web OAuth client → Authorized redirect URIs.
                </Text>
              </View>
            )}

            <Text style={styles.disclaimer}>
              A long time ago in a not so distant galaxy...
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Authenticated - Main Menu
  const openSocial = () => router.push('/social');
  const swipeRightGesture = Gesture.Pan()
    .activeOffsetX([30, 9999])
    .failOffsetY([-20, 20])
    .onEnd((e) => {
      if (e.translationX > 80 && Math.abs(e.translationY) < 120) {
        runOnJS(openSocial)();
      }
    });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <GestureDetector gesture={swipeRightGesture}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1707057539184-27e90364e30a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwxfHxnYWxheHklMjBzcGlyYWwlMjBzdGFycyUyMGNvc21vc3xlbnwwfHx8fDE3NzYzMzkwMjl8MA&ixlib=rb-4.1.0&q=85' }}
                style={styles.headerIcon}
              />
              <Text style={styles.headerTitle}>Beyond the Stars</Text>
            </View>
            <TouchableOpacity onPress={logout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={24} color="#F44336" />
            </TouchableOpacity>
          </View>

          {/* Swipe Hint */}
          <TouchableOpacity style={styles.swipeHint} onPress={openSocial} activeOpacity={0.7}>
            <Ionicons name="chevron-forward" size={14} color="#5865F2" />
            <Text style={styles.swipeHintText}>Swipe right for Social Media</Text>
            <Ionicons name="share-social-outline" size={14} color="#5865F2" />
          </TouchableOpacity>

        {/* User Info */}
        <View style={styles.userInfo}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.userAvatar} />
          ) : (
            <View style={styles.userAvatarPlaceholder}>
              <Ionicons name="person" size={24} color="#666" />
            </View>
          )}
          <Text style={styles.userName}>Welcome, {user?.name}</Text>
        </View>

        {/* Menu Options */}
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/character/create')}
          >
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
              <Ionicons name="person-add" size={32} color="#4CAF50" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Create Character</Text>
              <Text style={styles.menuDescription}>Build a new hero for the The Rim</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/character/list')}
          >
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(3, 169, 244, 0.2)' }]}>
              <Ionicons name="people" size={32} color="#03A9F4" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>My Characters</Text>
              <Text style={styles.menuDescription}>
                {characters.length} character{characters.length !== 1 ? 's' : ''} created
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/game/dice')}
          >
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(156, 39, 176, 0.2)' }]}>
              <Ionicons name="dice" size={32} color="#9C27B0" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Dice Roller</Text>
              <Text style={styles.menuDescription}>Roll Edge of the Dominion dice</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          {characters.length > 0 && (
            <TouchableOpacity
              style={[styles.menuItem, styles.playButton]}
              onPress={() => router.push('/character/list?startGame=true')}
            >
              <View style={[styles.menuIcon, { backgroundColor: 'rgba(255, 215, 0, 0.2)' }]}>
                <Ionicons name="play" size={32} color="#FFD700" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuTitle, { color: '#FFD700' }]}>Start Adventure</Text>
                <Text style={styles.menuDescription}>Begin your journey in the galaxy</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#FFD700" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/store')}
          >
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(255, 215, 0, 0.15)' }]}>
              <Ionicons name="cart" size={32} color="#DAA520" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Extras & Subscriptions</Text>
              <Text style={styles.menuDescription}>Coins, eras, and galactic deals</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/social')}
          >
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(88, 101, 242, 0.15)' }]}>
              <Ionicons name="share-social" size={32} color="#5865F2" />
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>Social Media</Text>
              <Text style={styles.menuDescription}>Follow us & share your adventures</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        </ScrollView>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  ipDisclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: -10,
    marginBottom: 10,
    backgroundColor: 'rgba(255,62,200,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,62,200,0.4)',
    borderRadius: 6,
  },
  ipDisclaimerText: {
    color: '#FF3EC8',
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    lineHeight: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFD700',
    marginTop: 16,
    fontSize: 16,
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  galaxyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  title: {
    color: '#FFD700',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    color: '#aaa',
    fontSize: 16,
    marginTop: 4,
  },
  descriptionContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  description: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 24,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  debugBox: {
    width: '100%',
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderColor: 'rgba(255,215,0,0.4)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
    marginTop: -8,
  },
  debugError: {
    color: '#FF6B6B',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  debugLabel: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  debugUri: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 8,
  },
  debugCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,215,0,0.12)',
    gap: 6,
    marginBottom: 8,
  },
  debugBtnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  debugToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  debugToggleText: {
    color: '#666',
    fontSize: 11,
    fontStyle: 'italic',
  },
  debugCopyText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  debugHelp: {
    color: '#aaa',
    fontSize: 11,
    lineHeight: 16,
  },
  disclaimer: {
    color: '#555',
    fontSize: 12,
    fontStyle: 'italic',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  logoutButton: {
    padding: 8,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(88,101,242,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(88,101,242,0.35)',
    marginBottom: 14,
    gap: 6,
  },
  swipeHintText: {
    color: '#9AA3D9',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  userAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  menuContainer: {
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  playButton: {
    borderColor: 'rgba(255, 215, 0, 0.3)',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  menuIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  menuDescription: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
});
