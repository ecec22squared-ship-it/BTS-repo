import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Share, Alert, ActivityIndicator, Platform, Linking, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameStore } from '../src/stores/gameStore';
import { Character, GameSession } from '../src/types/game';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const HOLOTABLE_BG = 'https://images.unsplash.com/photo-1700863555481-b7374a3a0e50?w=1200&q=80';
const INSTAGRAM_URL = 'https://www.instagram.com/neutrano13?igsh=ZXdreHZrcnZzbHVw';
const DISCORD_URL = 'https://discord.gg/cmV4PMvW2';

const SOCIAL_LINKS = [
  { name: 'Facebook', icon: 'logo-facebook', color: '#1877F2', url: 'https://facebook.com' },
  { name: 'X (Twitter)', icon: 'logo-twitter', color: '#1DA1F2', url: 'https://x.com' },
  { name: 'Instagram', icon: 'logo-instagram', color: '#E1306C', url: 'https://www.instagram.com/neutrano13?igsh=ZXdreHZrcnZzbHVw' },
  { name: 'TikTok', icon: 'logo-tiktok', color: '#000000', url: 'https://tiktok.com' },
  { name: 'YouTube', icon: 'logo-youtube', color: '#FF0000', url: 'https://youtube.com' },
  { name: 'Discord', icon: 'logo-discord', color: '#5865F2', url: 'https://discord.gg/cmV4PMvW2' },
  { name: 'Reddit', icon: 'logo-reddit', color: '#FF4500', url: 'https://reddit.com' },
];

export default function SocialScreen() {
  const { characters, fetchCharacters } = useGameStore();
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shareTarget, setShareTarget] = useState<'app' | 'character' | 'story' | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchCharacters();
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/game/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }, credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.filter((s: any) => s.game_history && s.game_history.length > 0));
      }
    } catch (_e) {}
  };

  const shareApp = async () => {
    try {
      await Share.share({
        message: `✦ BEYOND THE STARS ✦\nA Star Wars Text RPG Powered by AI\n\nCreate your own character. Shape the galaxy. Forge your legend.\n\n🌌 Download now and begin your adventure!\n\n#BeyondTheStars #StarWars #TextRPG`,
        title: 'Beyond the Stars',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const shareCharacter = async (character: Character) => {
    setIsExporting(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/characters/${character.character_id}/export-card`, {
        headers: { 'Authorization': `Bearer ${token}` }, credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        await Share.share({
          message: data.card_text,
          title: `${character.name} - Beyond the Stars`,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export character');
    } finally {
      setIsExporting(false);
      setShowShareDialog(false);
    }
  };

  const shareStory = async (session: any) => {
    setIsExporting(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/game/sessions/${session.session_id}/export-story`, {
        headers: { 'Authorization': `Bearer ${token}` }, credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        await Share.share({
          message: data.story,
          title: `The Story of ${data.character_name} - Beyond the Stars`,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export story');
    } finally {
      setIsExporting(false);
      setShowShareDialog(false);
    }
  };

  return (
    <View style={styles.root}>
      <ImageBackground
        source={{ uri: HOLOTABLE_BG }}
        style={StyleSheet.absoluteFillObject}
        imageStyle={styles.bgImage}
        resizeMode="cover"
      />
      <View style={styles.bgOverlay} pointerEvents="none" />

      <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="planet" size={14} color="#5EC8FF" />
          <Text style={styles.headerTitle}>Holo-Comm Chamber</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Follow Us */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Follow Beyond the Stars</Text>
          <Text style={styles.sectionDesc}>Stay connected across the galaxy</Text>

          <View style={styles.socialGrid}>
            {SOCIAL_LINKS.map((link) => (
              <TouchableOpacity
                key={link.name}
                style={styles.socialCard}
                onPress={() => Linking.openURL(link.url)}
                activeOpacity={0.7}
              >
                <View style={[styles.socialIcon, { backgroundColor: `${link.color}20` }]}>
                  <Ionicons name={link.icon as any} size={24} color={link.color} />
                </View>
                <Text style={styles.socialName}>{link.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Share Section */}
        <View style={styles.section}>
          <View style={styles.shareBanner}>
            <Ionicons name="share-social" size={28} color="#FFD700" />
            <View style={styles.shareTextBox}>
              <Text style={styles.shareTitle}>Share Your Adventure</Text>
              <Text style={styles.shareDesc}>
                Spread the word across the galaxy. Share the app, your character, or an entire story.
              </Text>
            </View>
          </View>

          {/* Share Options */}
          <TouchableOpacity style={styles.shareOption} onPress={shareApp}>
            <View style={[styles.shareIcon, { backgroundColor: 'rgba(76,175,80,0.15)' }]}>
              <Ionicons name="rocket" size={22} color="#4CAF50" />
            </View>
            <View style={styles.shareInfo}>
              <Text style={styles.shareOptTitle}>Share the App</Text>
              <Text style={styles.shareOptDesc}>Invite others to Beyond the Stars</Text>
            </View>
            <Ionicons name="share-outline" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareOption}
            onPress={() => { setShareTarget('character'); setShowShareDialog(true); }}
          >
            <View style={[styles.shareIcon, { backgroundColor: 'rgba(3,169,244,0.15)' }]}>
              <Ionicons name="person" size={22} color="#03A9F4" />
            </View>
            <View style={styles.shareInfo}>
              <Text style={styles.shareOptTitle}>Share a Character</Text>
              <Text style={styles.shareOptDesc}>Show off your character card</Text>
            </View>
            <Ionicons name="share-outline" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareOption}
            onPress={() => { setShareTarget('story'); setShowShareDialog(true); }}
          >
            <View style={[styles.shareIcon, { backgroundColor: 'rgba(156,39,176,0.15)' }]}>
              <Ionicons name="book" size={22} color="#9C27B0" />
            </View>
            <View style={styles.shareInfo}>
              <Text style={styles.shareOptTitle}>Share a Story</Text>
              <Text style={styles.shareOptDesc}>Export your adventure as a clean narrative</Text>
            </View>
            <Ionicons name="share-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Watermark note */}
        <View style={styles.watermarkNote}>
          <Ionicons name="shield-checkmark" size={14} color="#555" />
          <Text style={styles.watermarkText}>
            All shared content includes the "Beyond the Stars" watermark
          </Text>
        </View>

        {/* Support Link */}
        <TouchableOpacity
          style={styles.supportCard}
          onPress={() => Linking.openURL(DISCORD_URL)}
          activeOpacity={0.8}
        >
          <View style={[styles.supportIcon, { backgroundColor: 'rgba(88,101,242,0.18)' }]}>
            <Ionicons name="logo-discord" size={22} color="#5865F2" />
          </View>
          <View style={styles.supportInfo}>
            <Text style={styles.supportTitle}>Need Help? Get Support</Text>
            <Text style={styles.supportDesc}>
              Join our Discord community for support, tips, and fellow travelers
            </Text>
          </View>
          <Ionicons name="open-outline" size={20} color="#5865F2" />
        </TouchableOpacity>

        {/* Contact Us */}
        <TouchableOpacity
          style={styles.contactCard}
          onPress={() => Linking.openURL(INSTAGRAM_URL)}
          activeOpacity={0.8}
        >
          <View style={[styles.supportIcon, { backgroundColor: 'rgba(225,48,108,0.18)' }]}>
            <Ionicons name="logo-instagram" size={22} color="#E1306C" />
          </View>
          <View style={styles.supportInfo}>
            <Text style={styles.supportTitle}>Contact Us</Text>
            <Text style={styles.supportDesc}>
              Reach out on Instagram @neutrano13 — questions, feedback, or fan stories
            </Text>
          </View>
          <Ionicons name="open-outline" size={20} color="#E1306C" />
        </TouchableOpacity>
      </ScrollView>

      {/* Share Dialog Overlay */}
      {showShareDialog && (
        <View style={styles.dialogOverlay}>
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>
                {shareTarget === 'character' ? 'Select Character' : 'Select Story'}
              </Text>
              <TouchableOpacity onPress={() => setShowShareDialog(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {isExporting && (
              <View style={styles.exportingOverlay}>
                <ActivityIndicator size="large" color="#FFD700" />
                <Text style={styles.exportingText}>Preparing for sharing...</Text>
              </View>
            )}

            <ScrollView style={styles.dialogList}>
              {shareTarget === 'character' && characters.map((char) => (
                <TouchableOpacity
                  key={char.character_id}
                  style={styles.dialogItem}
                  onPress={() => shareCharacter(char)}
                  disabled={isExporting}
                >
                  <Ionicons name="person" size={20} color="#03A9F4" />
                  <View style={styles.dialogItemInfo}>
                    <Text style={styles.dialogItemName}>{char.name}</Text>
                    <Text style={styles.dialogItemSub}>{char.species} {char.career}</Text>
                  </View>
                  <Ionicons name="share-outline" size={18} color="#666" />
                </TouchableOpacity>
              ))}

              {shareTarget === 'story' && sessions.map((sess) => (
                <TouchableOpacity
                  key={sess.session_id}
                  style={styles.dialogItem}
                  onPress={() => shareStory(sess)}
                  disabled={isExporting}
                >
                  <Ionicons name="book" size={20} color="#9C27B0" />
                  <View style={styles.dialogItemInfo}>
                    <Text style={styles.dialogItemName}>{sess.current_location}</Text>
                    <Text style={styles.dialogItemSub}>
                      {sess.game_history?.length || 0} events • {new Date(sess.updated_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons name="share-outline" size={18} color="#666" />
                </TouchableOpacity>
              ))}

              {shareTarget === 'character' && characters.length === 0 && (
                <Text style={styles.emptyText}>No characters created yet</Text>
              )}
              {shareTarget === 'story' && sessions.length === 0 && (
                <Text style={styles.emptyText}>No stories to share yet</Text>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  bgImage: { opacity: 0.35 },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,10,26,0.72)',
  },
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(94,200,255,0.25)',
    backgroundColor: 'rgba(6,15,40,0.55)',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backBtn: { padding: 8 },
  headerTitle: { color: '#5EC8FF', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  content: { flex: 1 },
  contentInner: { padding: 16 },

  section: { marginBottom: 24 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  sectionDesc: { color: '#888', fontSize: 12, marginBottom: 14 },

  // Social grid
  socialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  socialCard: {
    width: '30%', backgroundColor: 'rgba(8,20,45,0.65)', borderRadius: 12,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(94,200,255,0.25)',
  },
  socialIcon: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
  },
  socialName: { color: '#ccc', fontSize: 10, fontWeight: '600', marginTop: 6, textAlign: 'center' },

  // Share banner
  shareBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)', marginBottom: 14,
  },
  shareTextBox: { flex: 1, marginLeft: 12 },
  shareTitle: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },
  shareDesc: { color: '#999', fontSize: 12, marginTop: 2, lineHeight: 17 },

  // Share options
  shareOption: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(8,20,45,0.65)', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(94,200,255,0.2)',
  },
  shareIcon: {
    width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  shareInfo: { flex: 1 },
  shareOptTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  shareOptDesc: { color: '#888', fontSize: 11, marginTop: 1 },

  // Watermark note
  watermarkNote: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12,
  },
  watermarkText: { color: '#555', fontSize: 10, marginLeft: 6, fontStyle: 'italic' },

  // Support card
  supportCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(88,101,242,0.12)', borderRadius: 12, padding: 14,
    marginTop: 4, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(88,101,242,0.35)',
  },
  contactCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(225,48,108,0.10)', borderRadius: 12, padding: 14,
    marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(225,48,108,0.35)',
  },
  supportIcon: {
    width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  supportInfo: { flex: 1 },
  supportTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  supportDesc: { color: '#9AA3D9', fontSize: 11, marginTop: 2, lineHeight: 15 },

  // Dialog overlay
  dialogOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end', zIndex: 100,
  },
  dialog: {
    backgroundColor: '#1a1a24', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '70%', padding: 20,
  },
  dialogHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  dialogTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  dialogList: { maxHeight: 400 },
  dialogItem: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, marginBottom: 8,
  },
  dialogItemInfo: { flex: 1, marginLeft: 12 },
  dialogItemName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  dialogItemSub: { color: '#888', fontSize: 11, marginTop: 1 },
  emptyText: { color: '#666', textAlign: 'center', padding: 20, fontSize: 14 },
  exportingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center',
    zIndex: 10, borderRadius: 20,
  },
  exportingText: { color: '#FFD700', marginTop: 12, fontSize: 14 },
});
