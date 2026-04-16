import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DiceResult } from '../types/game';

interface DiceDisplayProps {
  result: DiceResult | null;
  isRolling?: boolean;
}

const DICE_COLORS = {
  ability: '#4CAF50',      // Green
  proficiency: '#FFD700',   // Yellow
  difficulty: '#9C27B0',    // Purple
  challenge: '#F44336',     // Red
  boost: '#03A9F4',         // Blue
  setback: '#212121',       // Black
  force: '#FFFFFF',         // White
};

export const DiceDisplay: React.FC<DiceDisplayProps> = ({ result, isRolling }) => {
  if (!result) return null;

  return (
    <View style={styles.container}>
      {/* Dice visuals */}
      <View style={styles.diceRow}>
        {result.dice_details.map((die, index) => (
          <View
            key={index}
            style={[
              styles.die,
              { backgroundColor: DICE_COLORS[die.type as keyof typeof DICE_COLORS] || '#666' },
            ]}
          >
            <Text style={[styles.dieText, die.type === 'force' && styles.darkText]}>
              {getDieSymbol(die.result)}
            </Text>
          </View>
        ))}
      </View>

      {/* Results summary */}
      <View style={styles.resultsContainer}>
        <View style={styles.resultRow}>
          <View style={styles.resultItem}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={styles.resultLabel}>Successes</Text>
            <Text style={styles.resultValue}>{result.successes}</Text>
          </View>
          <View style={styles.resultItem}>
            <Ionicons name="close-circle" size={20} color="#F44336" />
            <Text style={styles.resultLabel}>Failures</Text>
            <Text style={styles.resultValue}>{result.failures}</Text>
          </View>
        </View>

        <View style={styles.resultRow}>
          <View style={styles.resultItem}>
            <Ionicons name="add-circle" size={20} color="#03A9F4" />
            <Text style={styles.resultLabel}>Advantages</Text>
            <Text style={styles.resultValue}>{result.advantages}</Text>
          </View>
          <View style={styles.resultItem}>
            <Ionicons name="remove-circle" size={20} color="#FF9800" />
            <Text style={styles.resultLabel}>Threats</Text>
            <Text style={styles.resultValue}>{result.threats}</Text>
          </View>
        </View>

        {(result.triumphs > 0 || result.despairs > 0) && (
          <View style={styles.resultRow}>
            {result.triumphs > 0 && (
              <View style={styles.resultItem}>
                <Ionicons name="star" size={20} color="#FFD700" />
                <Text style={styles.resultLabel}>Triumphs</Text>
                <Text style={styles.resultValue}>{result.triumphs}</Text>
              </View>
            )}
            {result.despairs > 0 && (
              <View style={styles.resultItem}>
                <Ionicons name="skull" size={20} color="#9C27B0" />
                <Text style={styles.resultLabel}>Despairs</Text>
                <Text style={styles.resultValue}>{result.despairs}</Text>
              </View>
            )}
          </View>
        )}

        {(result.light_side > 0 || result.dark_side > 0) && (
          <View style={styles.resultRow}>
            <View style={styles.resultItem}>
              <Ionicons name="sunny" size={20} color="#FFFFFF" />
              <Text style={styles.resultLabel}>Light Side</Text>
              <Text style={styles.resultValue}>{result.light_side}</Text>
            </View>
            <View style={styles.resultItem}>
              <Ionicons name="moon" size={20} color="#9C27B0" />
              <Text style={styles.resultLabel}>Dark Side</Text>
              <Text style={styles.resultValue}>{result.dark_side}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Final outcome */}
      <View style={[styles.outcomeContainer, result.success ? styles.successOutcome : styles.failOutcome]}>
        <Text style={styles.outcomeText}>
          {result.success ? 'SUCCESS' : 'FAILURE'}
        </Text>
        <Text style={styles.netText}>
          Net: {result.net_successes} successes, {result.net_advantages} advantages
        </Text>
      </View>
    </View>
  );
};

function getDieSymbol(result: Record<string, number>): string {
  const symbols: string[] = [];
  if (result.successes) symbols.push('S'.repeat(result.successes));
  if (result.failures) symbols.push('F'.repeat(result.failures));
  if (result.advantages) symbols.push('A'.repeat(result.advantages));
  if (result.threats) symbols.push('T'.repeat(result.threats));
  if (result.triumphs) symbols.push('!');
  if (result.despairs) symbols.push('X');
  if (result.light_side) symbols.push('L'.repeat(result.light_side));
  if (result.dark_side) symbols.push('D'.repeat(result.dark_side));
  return symbols.join('') || '-';
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 16,
    margin: 8,
  },
  diceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  die: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  dieText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  darkText: {
    color: '#000',
  },
  resultsContainer: {
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  resultItem: {
    alignItems: 'center',
    flex: 1,
  },
  resultLabel: {
    color: '#aaa',
    fontSize: 10,
    marginTop: 2,
  },
  resultValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  outcomeContainer: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  successOutcome: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  failOutcome: {
    backgroundColor: 'rgba(244, 67, 54, 0.3)',
    borderColor: '#F44336',
    borderWidth: 1,
  },
  outcomeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  netText: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
  },
});
