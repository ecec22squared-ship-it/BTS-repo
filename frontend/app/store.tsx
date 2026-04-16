import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Alert, ActivityIndicator, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const GALAXY_IMAGE = 'https://images.unsplash.com/photo-1707057539184-27e90364e30a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwxfHxnYWxheHklMjBzcGlyYWwlMjBzdGFycyUyMGNvc21vc3xlbnwwfHx8fDE3NzYzMzkwMjl8MA&ixlib=rb-4.1.0&q=85';
const BANK_IMAGE = 'https://static.prod-images.emergentagent.com/jobs/7268b304-aee9-40f7-a010-ffad35539dc5/images/7bc6e3efd47a7b7400f3a1eeefe7bb2b003d945bd26fab1f9f92808a6885697c.png';

const COIN_PACKAGES = [
  { id: 'c1', coins: 100, bonus: 0, price: '$0.99', label: 'Starter' },
  { id: 'c2', coins: 300, bonus: 50, price: '$2.49', label: 'Adventurer' },
  { id: 'c3', coins: 750, bonus: 150, price: '$4.99', label: 'Explorer', popular: true },
  { id: 'c4', coins: 2000, bonus: 500, price: '$9.99', label: 'Galactic', best: true },
];

const SUB_TIERS = [
  { id: 's1', tier: 1, name: 'Basic', price: '$2.99/mo', coins: 300, bonus: 0, eras: [], desc: 'Monthly coin supply' },
  { id: 's2', tier: 2, name: 'Republic', price: '$5.99/mo', coins: 500, bonus: 100, eras: ['New Republic Era'], desc: 'Witness the Empire fall' },
  { id: 's3', tier: 3, name: 'Sith', price: '$9.99/mo', coins: 800, bonus: 200, eras: ['New Republic Era', 'Sith Era'], desc: 'Face Darth Revan' },
  { id: 's4', tier: 4, name: 'Mandalorian', price: '$14.99/mo', coins: 1200, bonus: 400, eras: ['New Republic Era', 'Sith Era', 'Mandalorian Era'], desc: 'All eras unlocked', best: true },
];

export default function StoreScreen() {
  const params = useLocalSearchParams();
  const [coins, setCoins] = useState(0);
  const [subTier, setSubTier] = useState(0);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    fetchUserData();
    // Check for returning from Stripe checkout
    const sessionId = params.session_id as string;
    if (sessionId) {
      pollPaymentStatus(sessionId);
    }
  }, [params.session_id]);

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

  const pollPaymentStatus = async (sessionId: string, attempts: number = 0) => {
    if (attempts >= 5) {
      setIsPolling(false);
      Alert.alert('Status Unknown', 'Could not confirm payment. Check your balance.');
      return;
    }
    setIsPolling(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      const res = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/payments/status/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }, credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.payment_status === 'paid') {
          setCoins(data.coins);
          setIsPolling(false);
          Alert.alert('Purchase Complete', `Credits deposited. Balance: ${data.coins} coins.`);
          await fetchUserData();
          return;
        } else if (data.status === 'expired') {
          setIsPolling(false);
          Alert.alert('Expired', 'Payment session expired.');
          return;
        }
      }
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), 2000);
    } catch (_e) {
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), 2000);
    }
  };

  const handlePurchase = async (packageId: string, packageType: string) => {
    setIsProcessing(packageId);
    try {
      const token = await AsyncStorage.getItem('session_token');
      let originUrl = EXPO_PUBLIC_BACKEND_URL;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        originUrl = window.location.origin;
      }

      const res = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/payments/checkout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ package_id: packageId, package_type: packageType, origin_url: originUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          if (Platform.OS === 'web') {
            window.location.href = data.url;
          } else {
            Linking.openURL(data.url);
          }
        }
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'Payment failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to initiate payment');
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Image source={{ uri: BANK_IMAGE }} style={styles.bgImage} />
      <View style={styles.bgOverlay} />

      {/* Bank teller accents */}
      <View style={styles.tellerTop}>
        <View style={styles.accentDark} />
        <View style={styles.accentGold} />
      </View>

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
        <Ionicons name="person-circle" size={32} color="#4FC3F7" />
        <Text style={styles.bankerText}>
          "Welcome. How may the Banking Clan serve you today?"
        </Text>
      </View>

      {isPolling && (
        <View style={styles.pollingBanner}>
          <ActivityIndicator size="small" color="#FFD700" />
          <Text style={styles.pollingText}>Processing payment...</Text>
        </View>
      )}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>

        {/* DEALS */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Ionicons name="pricetag" size={16} color="#FFD700" />
            <Text style={styles.sectionTitle}>Deals</Text>
          </View>
          <View style={styles.dealsRow}>
            <TouchableOpacity style={styles.dealCard} onPress={() => Linking.openURL('https://discord.gg/cmV4PMvW2')}>
              <Ionicons name="logo-discord" size={24} color="#5865F2" />
              <Text style={styles.dealLabel}>Discord</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dealCard} onPress={() => Linking.openURL('https://instagram.com')}>
              <Ionicons name="logo-instagram" size={24} color="#E1306C" />
              <Text style={styles.dealLabel}>Instagram</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* EXTRAS */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Ionicons name="gift" size={16} color="#9C27B0" />
            <Text style={styles.sectionTitle}>Extras</Text>
          </View>
          <View style={styles.unavailable}>
            <Ionicons name="lock-closed" size={18} color="#555" />
            <Text style={styles.unavailableText}>Currently Unavailable</Text>
          </View>
        </View>

        {/* COINS */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Ionicons name="ellipse" size={16} color="#FFD700" />
            <Text style={styles.sectionTitle}>Coins</Text>
          </View>
          {COIN_PACKAGES.map((pkg) => (
            <TouchableOpacity
              key={pkg.id}
              style={[styles.purchaseCard, pkg.best && styles.bestCard]}
              onPress={() => handlePurchase(pkg.id, 'coins')}
              disabled={!!isProcessing}
            >
              {pkg.popular && <Text style={styles.tagPopular}>POPULAR</Text>}
              {pkg.best && <Text style={styles.tagBest}>BEST VALUE</Text>}
              <View style={styles.purchaseRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.purchaseName}>{pkg.label}</Text>
                  <Text style={styles.purchaseDetail}>
                    {pkg.coins}{pkg.bonus > 0 ? ` + ${pkg.bonus} bonus` : ''} coins
                  </Text>
                </View>
                {isProcessing === pkg.id ? (
                  <ActivityIndicator color="#FFD700" />
                ) : (
                  <Text style={styles.purchasePrice}>{pkg.price}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* SUBSCRIPTIONS */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Ionicons name="star" size={16} color="#03A9F4" />
            <Text style={styles.sectionTitle}>Subscriptions</Text>
          </View>
          {SUB_TIERS.map((sub) => {
            const active = subTier >= sub.tier;
            return (
              <TouchableOpacity
                key={sub.id}
                style={[styles.subCard, active && styles.subActive, sub.best && styles.bestCard]}
                onPress={() => handlePurchase(sub.id, 'subscription')}
                disabled={!!isProcessing || active}
              >
                {sub.best && <Text style={styles.tagBest}>ALL ACCESS</Text>}
                <View style={styles.purchaseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.purchaseName}>{sub.name}</Text>
                    <Text style={styles.purchaseDetail}>
                      {sub.coins}{sub.bonus > 0 ? `+${sub.bonus}` : ''} coins/mo
                    </Text>
                  </View>
                  {isProcessing === sub.id ? (
                    <ActivityIndicator color="#03A9F4" />
                  ) : (
                    <Text style={[styles.purchasePrice, { color: '#03A9F4' }]}>{sub.price}</Text>
                  )}
                </View>
                <Text style={styles.subDesc}>{sub.desc}</Text>
                {sub.eras.length > 0 && (
                  <View style={styles.erasRow}>
                    {sub.eras.map((era, i) => (
                      <View key={i} style={styles.eraPill}>
                        <Ionicons name="planet" size={9} color="#FFD700" />
                        <Text style={styles.eraPillText}>{era}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {active && (
                  <View style={styles.activeBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                    <Text style={styles.activeText}>Active</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <View style={styles.tellerBottom}>
        <View style={styles.accentGold} />
        <View style={styles.accentDark} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050A12' },
  bgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.2 },
  bgOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,10,18,0.7)' },
  tellerTop: { zIndex: 10 },
  tellerBottom: { zIndex: 10 },
  accentDark: { height: 3, backgroundColor: '#2F4F4F' },
  accentGold: { height: 2, backgroundColor: '#8B7355' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, zIndex: 5,
  },
  backBtn: { padding: 6 },
  headerTitle: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },
  coinBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,215,0,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  coinBadgeText: { color: '#FFD700', fontWeight: 'bold', fontSize: 13, marginLeft: 4 },

  bankerGreeting: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8,
    backgroundColor: 'rgba(79,195,247,0.08)', borderRadius: 10, padding: 10,
    borderLeftWidth: 3, borderLeftColor: '#4FC3F7', zIndex: 5,
  },
  bankerText: { flex: 1, color: '#4FC3F7', fontSize: 12, fontStyle: 'italic', marginLeft: 8 },

  pollingBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,215,0,0.1)', padding: 8, marginHorizontal: 16,
    borderRadius: 8, marginBottom: 4, zIndex: 5,
  },
  pollingText: { color: '#FFD700', marginLeft: 8, fontSize: 12 },

  content: { flex: 1, zIndex: 5 },
  contentInner: { padding: 16 },

  section: { marginBottom: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginLeft: 6 },

  dealsRow: { flexDirection: 'row', gap: 10 },
  dealCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  dealLabel: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 6 },

  unavailable: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed',
  },
  unavailableText: { color: '#555', fontSize: 13, marginLeft: 6 },

  purchaseCard: {
    backgroundColor: 'rgba(255,215,0,0.05)', borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,215,0,0.12)',
  },
  bestCard: { borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.06)' },
  purchaseRow: { flexDirection: 'row', alignItems: 'center' },
  purchaseName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  purchaseDetail: { color: '#aaa', fontSize: 11, marginTop: 1 },
  purchasePrice: { color: '#FFD700', fontSize: 17, fontWeight: 'bold' },
  tagPopular: { color: '#FFD700', fontSize: 8, fontWeight: 'bold', letterSpacing: 1, marginBottom: 2 },
  tagBest: { color: '#4CAF50', fontSize: 8, fontWeight: 'bold', letterSpacing: 1, marginBottom: 2 },

  subCard: {
    backgroundColor: 'rgba(3,169,244,0.05)', borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(3,169,244,0.12)',
  },
  subActive: { borderColor: '#4CAF50' },
  subDesc: { color: '#888', fontSize: 11, marginTop: 4 },
  erasRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4 },
  eraPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  eraPillText: { color: '#FFD700', fontSize: 9, fontWeight: '600', marginLeft: 3 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  activeText: { color: '#4CAF50', fontSize: 10, fontWeight: '600', marginLeft: 3 },
});
