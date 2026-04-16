import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Character } from '../types/game';

interface CharacterCardProps {
  character: Character;
  onPress: () => void;
  onDelete?: () => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({ character, onPress, onDelete }) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.portraitContainer}>
        {character.portrait_base64 ? (
          <Image
            source={{ uri: `data:image/png;base64,${character.portrait_base64}` }}
            style={styles.portrait}
          />
        ) : (
          <View style={styles.placeholderPortrait}>
            <Ionicons name="person" size={40} color="#666" />
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.name}>{character.name}</Text>
        <Text style={styles.species}>{character.species}</Text>
        <Text style={styles.career}>
          {character.career} - {character.specialization}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="heart" size={14} color="#F44336" />
            <Text style={styles.statText}>
              {character.health.wounds}/{character.health.wound_threshold}
            </Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="flash" size={14} color="#03A9F4" />
            <Text style={styles.statText}>
              {character.health.strain}/{character.health.strain_threshold}
            </Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="cash" size={14} color="#FFD700" />
            <Text style={styles.statText}>{character.credits}</Text>
          </View>
        </View>
      </View>

      {onDelete && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Ionicons name="trash" size={20} color="#F44336" />
        </TouchableOpacity>
      )}

      <Ionicons name="chevron-forward" size={24} color="#666" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  portraitContainer: {
    marginRight: 12,
  },
  portrait: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  placeholderPortrait: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  species: {
    color: '#aaa',
    fontSize: 14,
  },
  career: {
    color: '#03A9F4',
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  deleteButton: {
    padding: 8,
    marginRight: 8,
  },
});
