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
import { useAuthStore } from '../src/stores/authStore';
import { useGameStore } from '../src/stores/gameStore';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function Index() {
  const { user, isAuthenticated, isLoading, checkAuth, login, logout } = useAuthStore();
  const { characters, fetchCharacters, fetchGameData } = useGameStore();
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);

  // Handle OAuth callback
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (url.includes('session_id=')) {
        setIsProcessingAuth(true);
        const sessionId = url.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          try {
            await login(sessionId);
            await fetchGameData();
            await fetchCharacters();
          } catch (error) {
            console.error('Login error:', error);
          }
        }
        setIsProcessingAuth(false);
      }
    };

    // Check initial URL
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // For web, check hash
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.includes('session_id=')) {
        const sessionId = hash.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          setIsProcessingAuth(true);
          login(sessionId)
            .then(() => {
              fetchGameData();
              fetchCharacters();
              // Clear the hash
              window.history.replaceState(null, '', window.location.pathname);
            })
            .catch(console.error)
            .finally(() => setIsProcessingAuth(false));
        }
      }
    }

    // Listen for URL changes
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  // Check auth on mount
  useEffect(() => {
    checkAuth().then(() => {
      if (useAuthStore.getState().isAuthenticated) {
        fetchGameData();
        fetchCharacters();
      }
    });
  }, []);

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    let redirectUrl: string;
    
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      redirectUrl = window.location.origin;
    } else {
      redirectUrl = Linking.createURL('/');
    }
    
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    
    if (Platform.OS === 'web') {
      window.location.href = authUrl;
    } else {
      Linking.openURL(authUrl);
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
          <View style={styles.loginContainer}>
            {/* Logo/Title */}
            <View style={styles.logoContainer}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1707057539184-27e90364e30a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwxfHxnYWxheHklMjBzcGlyYWwlMjBzdGFycyUyMGNvc21vc3xlbnwwfHx8fDE3NzYzMzkwMjl8MA&ixlib=rb-4.1.0&q=85' }}
                style={styles.galaxyIcon}
              />
              <Text style={styles.title}>BEYOND THE STARS</Text>
              <Text style={styles.subtitle}>A Star Wars Text RPG Powered by AI</Text>
            </View>

            {/* Description */}
            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>
                Live the Star Wars universe through immersive AI storytelling. 
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

            <Text style={styles.disclaimer}>
              A long time ago in a galaxy far, far away...
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Authenticated - Main Menu
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
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
              <Text style={styles.menuDescription}>Build a new hero for the Outer Rim</Text>
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
              <Text style={styles.menuDescription}>Roll Edge of the Empire dice</Text>
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
