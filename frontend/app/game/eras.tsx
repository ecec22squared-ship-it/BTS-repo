import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const ALL_ERAS = [
  {
    id: 'vex_directive_66',
    name: 'Vex Directive 66 - Fall of the Concordat',
    period: 'Year 0 · The Culling',
    description: 'The Concordat crumbles as Supreme Regent executes Vex Directive 66. Replicant sentinels turn on their Qyrith generals. The Dominion rises from the ashes of democracy.',
    color: '#F44336',
    icon: 'flame',
    free: true,
  },
  {
    id: 'neo_concordat',
    name: 'Neo-Concordat Era',
    period: 'Year 23 · The Awakening',
    description: "The Vhor'Zul Station is destroyed. The Dominion fractures as the Insurgents unite the galaxy under a Neo-Concordat. But shadows of the old regime linger.",
    color: '#4CAF50',
    icon: 'sunny',
    tier: 2,
  },
  {
    id: 'vrakxul_era',
    name: 'Vrakxul Era',
    period: 'Year -3940 · Ancient War',
    description: 'Dark Lord Kr\'vex leads a devastating Vrakxul invasion. The Qyrith Order is pushed to the brink. The Concordat teeters on the edge of annihilation.',
    color: '#9C27B0',
    icon: 'skull',
    tier: 3,
  },
  {
    id: 'vorthak_era',
    name: 'Vorthak Era',
    period: 'Year -3957 · Iron Crusade',
    description: 'The Vorthak Wars rage across the galaxy. The Concordat goes to war against the most formidable warriors the galaxy has ever known.',
    color: '#FF9800',
    icon: 'shield',
    tier: 4,
  },
];

export default function EraSelect() {
  const { characterId } = useLocalSearchParams();
  const [unlockedEras, setUnlockedEras] = useState<string[]>(['Vex Directive 66 - Fall of the Republic']);
  const [subTier, setSubTier] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

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
        setUnlockedEras(data.unlocked_eras || ['Vex Directive 66 - Fall of the Republic']);
        setSubTier(data.subscription_tier || 0);
      }
    } catch (_e) {}
    setIsLoading(false);
  };

  const handleSelectEra = (era: typeof ALL_ERAS[0]) => {
    // Pass era to scenario selection
    router.push(`/game/scenarios?characterId=${characterId}&era=${encodeURIComponent(era.name)}`);
  };

  // Filter: show only unlocked eras
  const availableEras = ALL_ERAS.filter(era =>
    era.free || (era.tier && subTier >= era.tier)
  );

  // If only Vex Directive 66 available, skip directly to scenarios
  if (!isLoading && availableEras.length <= 1) {
    router.replace(`/game/scenarios?characterId=${characterId}&era=${encodeURIComponent('Vex Directive 66 - Fall of the Republic')}`);
    return null;
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Era</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.subtitle}>
        When in the galaxy's history will your story unfold?
      </Text>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {availableEras.map((era) => (
          <TouchableOpacity
            key={era.id}
            style={[styles.eraCard, { borderLeftColor: era.color }]}
            onPress={() => handleSelectEra(era)}
            activeOpacity={0.7}
          >
            <View style={[styles.eraIcon, { backgroundColor: `${era.color}20` }]}>
              <Ionicons name={era.icon as any} size={28} color={era.color} />
            </View>
            <View style={styles.eraInfo}>
              <Text style={styles.eraName}>{era.name}</Text>
              <Text style={[styles.eraPeriod, { color: era.color }]}>{era.period}</Text>
              <Text style={styles.eraDesc}>{era.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#666" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: { padding: 8 },
  headerTitle: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },
  subtitle: {
    color: '#888', fontSize: 13, textAlign: 'center', paddingHorizontal: 24,
    paddingVertical: 12, fontStyle: 'italic',
  },
  list: { flex: 1 },
  listContent: { padding: 16 },
  eraCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    padding: 16, marginBottom: 12, borderLeftWidth: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  eraIcon: {
    width: 50, height: 50, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  eraInfo: { flex: 1 },
  eraName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  eraPeriod: { fontSize: 11, fontWeight: '600', marginTop: 2, letterSpacing: 0.5 },
  eraDesc: { color: '#999', fontSize: 12, lineHeight: 17, marginTop: 4 },
});
