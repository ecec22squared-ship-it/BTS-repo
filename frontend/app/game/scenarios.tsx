import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HoloTableGalaxy } from '../../src/components/HoloTableGalaxy';
import { useGameStore } from '../../src/stores/gameStore';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const TYPE_ICONS: Record<string, string> = {
  combat: 'flash', intrigue: 'eye', exploration: 'compass',
  social: 'chatbubbles', heist: 'key', survival: 'leaf', mystery: 'search',
};
const TYPE_COLORS: Record<string, string> = {
  combat: '#F44336', intrigue: '#9C27B0', exploration: '#4CAF50',
  social: '#03A9F4', heist: '#FF9800', survival: '#8BC34A', mystery: '#00BCD4',
};
const DANGER_LABELS = ['', 'Low Risk', 'Moderate', 'Dangerous', 'High Risk', 'Lethal'];

interface Scenario {
  scenario_id: string;
  index: number;
  title: string;
  type: string;
  description: string;
  location: string;
  danger_level: number;
}

export default function ScenarioSelect() {
  const { characterId, era } = useLocalSearchParams();
  const selectedEra = (era as string) || 'Order 66 - Fall of the Republic';
  const { createGameSession } = useGameStore();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState<string | null>(null);

  useEffect(() => {
    generateScenarios();
  }, []);

  const generateScenarios = async () => {
    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/game/generate-scenarios`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ character_id: characterId }),
      });
      if (response.ok) {
        const data = await response.json();
        setScenarios(data.scenarios || []);
      }
    } catch (error) {
      console.error('Failed to generate scenarios:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectScenario = async (scenario: Scenario) => {
    setIsStarting(scenario.scenario_id);
    try {
      const token = await AsyncStorage.getItem('session_token');
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/game/sessions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ character_id: characterId, scenario, era: selectedEra }),
      });
      if (response.ok) {
        const session = await response.json();
        router.replace(`/game/play?sessionId=${session.session_id}&characterId=${characterId}`);
      }
    } catch (error) {
      console.error('Failed to start scenario:', error);
    } finally {
      setIsStarting(null);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <HoloTableGalaxy accentColor="#FFD700" />
          <Text style={styles.loadingSubtext}>Scanning for adventure hooks...</Text>
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
        <Text style={styles.headerTitle}>Choose Your Adventure</Text>
        <TouchableOpacity onPress={generateScenarios} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={22} color="#FFD700" />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        The galaxy whispers of opportunity. Which call will you answer?
      </Text>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {scenarios.map((scenario) => {
          const icon = TYPE_ICONS[scenario.type] || 'planet';
          const color = TYPE_COLORS[scenario.type] || '#FFD700';
          const isSelected = isStarting === scenario.scenario_id;

          return (
            <TouchableOpacity
              key={scenario.scenario_id}
              style={[styles.card, { borderLeftColor: color }]}
              onPress={() => handleSelectScenario(scenario)}
              disabled={!!isStarting}
              activeOpacity={0.7}
            >
              {isSelected ? (
                <View style={styles.cardLoading}>
                  <ActivityIndicator color={color} size="large" />
                  <Text style={[styles.cardLoadingText, { color }]}>Entering scenario...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.cardHeader}>
                    <View style={[styles.typeIcon, { backgroundColor: `${color}20` }]}>
                      <Ionicons name={icon as any} size={22} color={color} />
                    </View>
                    <View style={styles.cardTitleArea}>
                      <Text style={styles.cardTitle}>{scenario.title}</Text>
                      <View style={styles.cardMeta}>
                        <Text style={[styles.cardType, { color }]}>{scenario.type.toUpperCase()}</Text>
                        <View style={styles.dangerBadge}>
                          {Array.from({ length: scenario.danger_level }).map((_, i) => (
                            <Ionicons key={i} name="skull" size={10} color={scenario.danger_level >= 4 ? '#F44336' : '#FF9800'} />
                          ))}
                          <Text style={styles.dangerText}>{DANGER_LABELS[scenario.danger_level] || ''}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.cardDesc}>{scenario.description}</Text>
                  <View style={styles.cardFooter}>
                    <Ionicons name="location" size={12} color="#888" />
                    <Text style={styles.cardLocation}>{scenario.location}</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingSubtext: { color: '#888', fontSize: 13, marginTop: 12, fontStyle: 'italic' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: { padding: 8 },
  headerTitle: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },
  refreshBtn: { padding: 8 },
  subtitle: {
    color: '#888', fontSize: 13, textAlign: 'center', paddingHorizontal: 24,
    paddingVertical: 12, fontStyle: 'italic',
  },
  list: { flex: 1 },
  listContent: { padding: 16 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    padding: 16, marginBottom: 12, borderLeftWidth: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardLoading: { alignItems: 'center', paddingVertical: 20 },
  cardLoadingText: { marginTop: 8, fontSize: 14, fontWeight: '600' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  typeIcon: {
    width: 44, height: 44, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  cardTitleArea: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 12 },
  cardType: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  dangerBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dangerText: { color: '#888', fontSize: 9, marginLeft: 4 },
  cardDesc: { color: '#ccc', fontSize: 13, lineHeight: 20, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center' },
  cardLocation: { color: '#888', fontSize: 11, marginLeft: 4 },
});
