import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const BANK_IMAGE = 'https://static.prod-images.emergentagent.com/jobs/7268b304-aee9-40f7-a010-ffad35539dc5/images/7bc6e3efd47a7b7400f3a1eeefe7bb2b003d945bd26fab1f9f92808a6885697c.png';

const COIN_PACKAGES = [
  { id: 'c1', coins: 100, bonus: 0, price: '$0.99', label: 'Starter' },
  { id: 'c2', coins: 300, bonus: 50, price: '$2.49', label: 'Adventurer' },
  { id: 'c3', coins: 750, bonus: 150, price: '$4.99', label: 'Explorer', popular: true },
  { id: 'c4', coins: 2000, bonus: 500, price: '$9.99', label: 'Galactic', best: true },
];

const SUB_TIERS = [
  { id: 's1', tier: 1, name: 'Basic', price: '$2.99/mo', coins: 300, bonus: 0, eras: [], desc: 'Monthly coin supply for your adventures' },
  { id: 's2', tier: 2, name: 'Republic', price: '$5.99/mo', coins: 500, bonus: 100, eras: ['New Republic Era'], desc: 'Witness the fall of the Empire and the rise of a New Republic' },
  { id: 's3', tier: 3, name: 'Sith', price: '$9.99/mo', coins: 800, bonus: 200, eras: ['New Republic Era', 'Sith Era'], desc: 'Face Darth Revan as the Sith threaten to consume the galaxy' },
  { id: 's4', tier: 4, name: 'Mandalorian', price: '$14.99/mo', coins: 1200, bonus: 400, eras: ['New Republic Era', 'Sith Era', 'Mandalorian Era'], desc: 'All eras unlocked. Command the galaxy\'s full history', best: true },
];

export default function StoreScreen() {
  const [coins, setCoins] = useState(0);
  const [subTier, setSubTier] = useState(0);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }, credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCoins(data.coins ?? 500);
        setSubTier(data.subscription_tier ?? 0);
      }
    } catch (_e) {}
  };

  const handlePurchase = (item: string) => {
    Alert.alert('Coming Soon', `${item} purchases will be available when the app launches on the Play Store. The Galactic Banking Clan appreciates your patience.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Bank background */}
      <Image source={{ uri: BANK_IMAGE }} style={styles.bgImage} />
      <View style={styles.bgOverlay} />

      {/* Bank teller frame - top */}
      <View style={styles.tellerFrameTop}>
        <View style={styles.tellerAccent} />
        <View style={styles.tellerAccentGold} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Galactic Banking Clan</Text>
        <View style={styles.coinBadge}>
          <Ionicons name="ellipse" size={14} color="#FFD700" />
          <Text style={styles.coinBadgeText}>{coins}</Text>
        </View>
      </View>

      {/* Banker greeting */}
      <View style={styles.bankerGreeting}>
        <Ionicons name="person-circle" size={36} color="#4FC3F7" />
        <View style={styles.bankerTextBox}>
          <Text style={styles.bankerText}>
            "Welcome to the Galactic Banking Clan. How may I assist you today?"
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>

        {/* === DEALS === */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pricetag" size={18} color="#FFD700" />
            <Text style={styles.sectionTitle}>Deals</Text>
          </View>
          <View style={styles.dealsRow}>
            <TouchableOpacity style={styles.dealCard} onPress={() => Linking.openURL('https://discord.gg')}>
              <Ionicons name="logo-discord" size={28} color="#5865F2" />
              <Text style={styles.dealText}>Join Discord</Text>
              <Text style={styles.dealSub}>Community & Updates</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dealCard} onPress={() => Linking.openURL('https://instagram.com')}>
              <Ionicons name="logo-instagram" size={28} color="#E1306C" />
              <Text style={styles.dealText}>Instagram</Text>
              <Text style={styles.dealSub}>News & Art</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.comingSoon}>More deals coming soon...</Text>
        </View>

        {/* === EXTRAS === */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="gift" size={18} color="#9C27B0" />
            <Text style={styles.sectionTitle}>Extras</Text>
          </View>
          <View style={styles.unavailableBanner}>
            <Ionicons name="lock-closed" size={20} color="#666" />
            <Text style={styles.unavailableText}>Currently Unavailable</Text>
          </View>
        </View>

        {/* === COINS === */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="ellipse" size={18} color="#FFD700" />
            <Text style={styles.sectionTitle}>Coins</Text>
          </View>
          <Text style={styles.sectionDesc}>"Each coin powers one response from your Game Master."</Text>
          {COIN_PACKAGES.map((pkg) => (
            <TouchableOpacity
              key={pkg.id}
              style={[styles.coinCard, pkg.popular && styles.coinCardPopular, pkg.best && styles.coinCardBest]}
              onPress={() => handlePurchase(`${pkg.coins + pkg.bonus} Coins`)}
            >
              <View style={styles.coinCardLeft}>
                {pkg.popular && <Text style={styles.popularTag}>POPULAR</Text>}
                {pkg.best && <Text style={styles.bestTag}>BEST VALUE</Text>}
                <Text style={styles.coinCardName}>{pkg.label}</Text>
                <Text style={styles.coinCardAmount}>
                  {pkg.coins} coins{pkg.bonus > 0 ? ` + ${pkg.bonus} bonus` : ''}
                </Text>
              </View>
              <View style={styles.coinCardRight}>
                <Text style={styles.coinCardPrice}>{pkg.price}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* === SUBSCRIPTIONS === */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star" size={18} color="#03A9F4" />
            <Text style={styles.sectionTitle}>Subscriptions</Text>
          </View>
          <Text style={styles.sectionDesc}>"Unlock new eras and receive monthly coin deposits."</Text>
          {SUB_TIERS.map((sub) => {
            const isActive = subTier >= sub.tier;
            return (
              <TouchableOpacity
                key={sub.id}
                style={[styles.subCard, isActive && styles.subCardActive, sub.best && styles.subCardBest]}
                onPress={() => handlePurchase(`${sub.name} Subscription`)}
              >
                {sub.best && <Text style={styles.bestTag}>ALL ACCESS</Text>}
                <View style={styles.subCardHeader}>
                  <Text style={styles.subCardName}>{sub.name}</Text>
                  <Text style={styles.subCardPrice}>{sub.price}</Text>
                </View>
                <Text style={styles.subCardDesc}>{sub.desc}</Text>
                <View style={styles.subCardDetails}>
                  <Text style={styles.subCardCoins}>
                    {sub.coins} coins/mo{sub.bonus > 0 ? ` + ${sub.bonus} bonus` : ''}
                  </Text>
                  {sub.eras.length > 0 && (
                    <View style={styles.subEras}>
                      {sub.eras.map((era, i) => (
                        <View key={i} style={styles.eraBadge}>
                          <Ionicons name="planet" size={10} color="#FFD700" />
                          <Text style={styles.eraBadgeText}>{era}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                {isActive && (
                  <View style={styles.activeTag}>
                    <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                    <Text style={styles.activeTagText}>Active</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bank teller frame - bottom */}
      <View style={styles.tellerFrameBottom}>
        <View style={styles.tellerAccentGold} />
        <View style={styles.tellerAccent} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050A12' },
  bgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.25 },
  bgOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,10,18,0.65)' },

  // Bank teller frame accents
  tellerFrameTop: { zIndex: 10 },
  tellerFrameBottom: { zIndex: 10 },
  tellerAccent: { height: 3, backgroundColor: '#2F4F4F' },
  tellerAccentGold: { height: 2, backgroundColor: '#8B7355' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, zIndex: 5,
  },
  backBtn: { padding: 8 },
  headerTitle: { color: '#FFD700', fontSize: 17, fontWeight: 'bold', letterSpacing: 0.5 },
  coinBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,215,0,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  coinBadgeText: { color: '#FFD700', fontWeight: 'bold', fontSize: 14, marginLeft: 4 },

  bankerGreeting: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'rgba(79,195,247,0.08)', borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#4FC3F7', zIndex: 5,
  },
  bankerTextBox: { flex: 1, marginLeft: 10 },
  bankerText: { color: '#4FC3F7', fontSize: 13, fontStyle: 'italic', lineHeight: 19 },

  content: { flex: 1, zIndex: 5 },
  contentInner: { padding: 16 },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  sectionDesc: { color: '#888', fontSize: 12, fontStyle: 'italic', marginBottom: 10 },
  comingSoon: { color: '#555', fontSize: 11, textAlign: 'center', marginTop: 8 },

  // Deals
  dealsRow: { flexDirection: 'row', gap: 12 },
  dealCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  dealText: { color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 8 },
  dealSub: { color: '#888', fontSize: 10, marginTop: 2 },

  // Extras
  unavailableBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderStyle: 'dashed',
  },
  unavailableText: { color: '#666', fontSize: 14, marginLeft: 8 },

  // Coins
  coinCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,215,0,0.06)', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,215,0,0.15)',
  },
  coinCardPopular: { borderColor: '#FFD700', borderWidth: 1.5 },
  coinCardBest: { borderColor: '#4CAF50', borderWidth: 1.5, backgroundColor: 'rgba(76,175,80,0.08)' },
  coinCardLeft: { flex: 1 },
  coinCardName: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  coinCardAmount: { color: '#aaa', fontSize: 12, marginTop: 2 },
  coinCardRight: {},
  coinCardPrice: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },
  popularTag: { color: '#FFD700', fontSize: 9, fontWeight: 'bold', letterSpacing: 1, marginBottom: 2 },
  bestTag: { color: '#4CAF50', fontSize: 9, fontWeight: 'bold', letterSpacing: 1, marginBottom: 2 },

  // Subscriptions
  subCard: {
    backgroundColor: 'rgba(3,169,244,0.06)', borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(3,169,244,0.15)',
  },
  subCardActive: { borderColor: '#4CAF50' },
  subCardBest: { borderColor: '#FFD700', borderWidth: 1.5, backgroundColor: 'rgba(255,215,0,0.06)' },
  subCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subCardName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  subCardPrice: { color: '#03A9F4', fontSize: 16, fontWeight: 'bold' },
  subCardDesc: { color: '#999', fontSize: 12, marginTop: 4, lineHeight: 17 },
  subCardDetails: { marginTop: 8 },
  subCardCoins: { color: '#FFD700', fontSize: 12, fontWeight: '600' },
  subEras: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 6 },
  eraBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,215,0,0.12)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  eraBadgeText: { color: '#FFD700', fontSize: 10, fontWeight: '600', marginLeft: 4 },
  activeTag: {
    flexDirection: 'row', alignItems: 'center', marginTop: 6,
  },
  activeTagText: { color: '#4CAF50', fontSize: 11, fontWeight: '600', marginLeft: 4 },
});
