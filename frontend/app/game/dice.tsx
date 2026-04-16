import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useGameStore } from '../../src/stores/gameStore';
import { DiceDisplay } from '../../src/components/DiceDisplay';
import { DiceResult } from '../../src/types/game';

interface DicePool {
  ability: number;
  proficiency: number;
  difficulty: number;
  challenge: number;
  boost: number;
  setback: number;
  force: number;
}

const DICE_TYPES = [
  { key: 'ability', name: 'Ability', color: '#4CAF50', icon: 'square' },
  { key: 'proficiency', name: 'Proficiency', color: '#FFD700', icon: 'diamond' },
  { key: 'difficulty', name: 'Difficulty', color: '#9C27B0', icon: 'square' },
  { key: 'challenge', name: 'Challenge', color: '#F44336', icon: 'diamond' },
  { key: 'boost', name: 'Boost', color: '#03A9F4', icon: 'cube' },
  { key: 'setback', name: 'Setback', color: '#212121', icon: 'cube' },
  { key: 'force', name: 'Force', color: '#FFFFFF', icon: 'ellipse' },
] as const;

export default function DiceRoller() {
  const { rollDice } = useGameStore();
  const [dicePool, setDicePool] = useState<DicePool>({
    ability: 0,
    proficiency: 0,
    difficulty: 0,
    challenge: 0,
    boost: 0,
    setback: 0,
    force: 0,
  });
  const [result, setResult] = useState<DiceResult | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const handleRoll = async () => {
    const totalDice = Object.values(dicePool).reduce((a, b) => a + b, 0);
    if (totalDice === 0) return;

    setIsRolling(true);
    try {
      const res = await rollDice(dicePool);
      setResult(res);
    } catch (error) {
      console.error('Roll error:', error);
    } finally {
      setIsRolling(false);
    }
  };

  const handleClear = () => {
    setDicePool({
      ability: 0,
      proficiency: 0,
      difficulty: 0,
      challenge: 0,
      boost: 0,
      setback: 0,
      force: 0,
    });
    setResult(null);
  };

  const updateDice = (type: keyof DicePool, delta: number) => {
    setDicePool((prev) => ({
      ...prev,
      [type]: Math.max(0, Math.min(10, prev[type] + delta)),
    }));
  };

  const totalDice = Object.values(dicePool).reduce((a, b) => a + b, 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dice Roller</Text>
        <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
          <Ionicons name="refresh" size={24} color="#F44336" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Dice Selection */}
        <View style={styles.diceSection}>
          <Text style={styles.sectionTitle}>Build Your Dice Pool</Text>
          
          {DICE_TYPES.map((dice) => (
            <View key={dice.key} style={styles.diceRow}>
              <View style={styles.diceInfo}>
                <View style={[styles.dicePreview, { backgroundColor: dice.color }]}>
                  <Ionicons
                    name={dice.icon as any}
                    size={20}
                    color={dice.key === 'setback' ? '#fff' : '#000'}
                  />
                </View>
                <Text style={styles.diceName}>{dice.name}</Text>
              </View>
              
              <View style={styles.diceControls}>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => updateDice(dice.key, -1)}
                >
                  <Ionicons name="remove" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.diceCount}>{dicePool[dice.key]}</Text>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => updateDice(dice.key, 1)}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Quick Presets */}
        <View style={styles.presetsSection}>
          <Text style={styles.sectionTitle}>Quick Presets</Text>
          <View style={styles.presetsRow}>
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => setDicePool({ ...dicePool, ability: 2, difficulty: 2 })}
            >
              <Text style={styles.presetText}>Easy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => setDicePool({ ...dicePool, ability: 3, difficulty: 2 })}
            >
              <Text style={styles.presetText}>Average</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => setDicePool({ ...dicePool, ability: 2, proficiency: 1, difficulty: 3 })}
            >
              <Text style={styles.presetText}>Hard</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Roll Button */}
        <TouchableOpacity
          style={[styles.rollButton, totalDice === 0 && styles.rollButtonDisabled]}
          onPress={handleRoll}
          disabled={totalDice === 0 || isRolling}
        >
          {isRolling ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="dice" size={28} color="#000" />
              <Text style={styles.rollButtonText}>Roll {totalDice} Dice</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Results */}
        {result && <DiceDisplay result={result} isRolling={isRolling} />}

        {/* Legend */}
        <View style={styles.legendSection}>
          <Text style={styles.sectionTitle}>Symbol Legend</Text>
          <View style={styles.legendGrid}>
            <View style={styles.legendItem}>
              <Text style={[styles.legendSymbol, { color: '#4CAF50' }]}>S</Text>
              <Text style={styles.legendText}>Success</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={[styles.legendSymbol, { color: '#F44336' }]}>F</Text>
              <Text style={styles.legendText}>Failure</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={[styles.legendSymbol, { color: '#03A9F4' }]}>A</Text>
              <Text style={styles.legendText}>Advantage</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={[styles.legendSymbol, { color: '#FF9800' }]}>T</Text>
              <Text style={styles.legendText}>Threat</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={[styles.legendSymbol, { color: '#FFD700' }]}>!</Text>
              <Text style={styles.legendText}>Triumph</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={[styles.legendSymbol, { color: '#9C27B0' }]}>X</Text>
              <Text style={styles.legendText}>Despair</Text>
            </View>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: 'bold',
  },
  clearButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  sectionTitle: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  diceSection: {
    marginBottom: 24,
  },
  diceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  diceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dicePreview: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  diceName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  diceControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  diceCount: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    width: 40,
    textAlign: 'center',
  },
  presetsSection: {
    marginBottom: 24,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  presetButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  presetText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '500',
  },
  rollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  rollButtonDisabled: {
    opacity: 0.5,
  },
  rollButtonText: {
    color: '#000',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  legendSection: {
    marginTop: 16,
    marginBottom: 32,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    width: '33%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  legendSymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    width: 24,
  },
  legendText: {
    color: '#888',
    fontSize: 12,
  },
});
