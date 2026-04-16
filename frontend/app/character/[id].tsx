import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useGameStore } from '../../src/stores/gameStore';
import { Character } from '../../src/types/game';

export default function CharacterDetail() {
  const { id } = useLocalSearchParams();
  const { characters, fetchCharacters, generatePortrait, createGameSession } = useGameStore();
  const [character, setCharacter] = useState<Character | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const char = characters.find((c) => c.character_id === id);
    if (char) {
      setCharacter(char);
    } else {
      fetchCharacters().then(() => {
        const c = useGameStore.getState().characters.find((c) => c.character_id === id);
        if (c) setCharacter(c);
      });
    }
  }, [id, characters]);

  const handleGeneratePortrait = async () => {
    if (!character) return;
    setIsGenerating(true);
    try {
      const portrait = await generatePortrait(character.character_id);
      setCharacter({ ...character, portrait_base64: portrait });
    } catch (error) {
      Alert.alert('Error', 'Failed to generate portrait. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartGame = async () => {
    if (!character) return;
    setIsStarting(true);
    try {
      const session = await createGameSession(character.character_id);
      router.push(`/game/play?sessionId=${session.session_id}&characterId=${character.character_id}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to start game session');
    } finally {
      setIsStarting(false);
    }
  };

  if (!character) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      </SafeAreaView>
    );
  }

  const stats = [
    { name: 'Brawn', value: character.stats.brawn, icon: 'fitness', color: '#F44336' },
    { name: 'Agility', value: character.stats.agility, icon: 'flash', color: '#4CAF50' },
    { name: 'Intellect', value: character.stats.intellect, icon: 'bulb', color: '#03A9F4' },
    { name: 'Cunning', value: character.stats.cunning, icon: 'eye', color: '#9C27B0' },
    { name: 'Willpower', value: character.stats.willpower, icon: 'shield', color: '#FF9800' },
    { name: 'Presence', value: character.stats.presence, icon: 'star', color: '#FFD700' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Character Sheet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Portrait & Basic Info */}
        <View style={styles.topSection}>
          <View style={styles.portraitContainer}>
            {character.portrait_base64 ? (
              <Image
                source={{ uri: `data:image/png;base64,${character.portrait_base64}` }}
                style={styles.portrait}
              />
            ) : (
              <View style={styles.placeholderPortrait}>
                <Ionicons name="person" size={60} color="#444" />
              </View>
            )}
            <TouchableOpacity
              style={styles.generateButton}
              onPress={handleGeneratePortrait}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="image" size={16} color="#000" />
                  <Text style={styles.generateButtonText}>
                    {character.portrait_base64 ? 'Regenerate' : 'Generate'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.basicInfo}>
            <Text style={styles.characterName}>{character.name}</Text>
            <Text style={styles.characterSpecies}>{character.species}</Text>
            <Text style={styles.characterCareer}>
              {character.career} - {character.specialization}
            </Text>

            <View style={styles.healthBars}>
              <View style={styles.healthBar}>
                <Text style={styles.healthLabel}>Wounds</Text>
                <View style={styles.healthBarBg}>
                  <View
                    style={[
                      styles.healthBarFill,
                      {
                        width: `${(1 - character.health.wounds / character.health.wound_threshold) * 100}%`,
                        backgroundColor: '#F44336',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.healthValue}>
                  {character.health.wounds}/{character.health.wound_threshold}
                </Text>
              </View>
              <View style={styles.healthBar}>
                <Text style={styles.healthLabel}>Strain</Text>
                <View style={styles.healthBarBg}>
                  <View
                    style={[
                      styles.healthBarFill,
                      {
                        width: `${(1 - character.health.strain / character.health.strain_threshold) * 100}%`,
                        backgroundColor: '#03A9F4',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.healthValue}>
                  {character.health.strain}/{character.health.strain_threshold}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Characteristics</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat) => (
              <View key={stat.name} style={styles.statItem}>
                <Ionicons name={stat.icon as any} size={24} color={stat.color} />
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statName}>{stat.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Skills */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Career Skills</Text>
          <View style={styles.skillsList}>
            {character.skills
              .filter((s) => s.rank > 0)
              .map((skill) => (
                <View key={skill.name} style={styles.skillItem}>
                  <Text style={styles.skillName}>{skill.name}</Text>
                  <View style={styles.skillRanks}>
                    {[...Array(5)].map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.skillDot,
                          i < skill.rank && styles.skillDotFilled,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ))}
          </View>
        </View>

        {/* Equipment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipment</Text>
          <View style={styles.equipmentList}>
            {(character.equipment || []).map((item: any, index: number) => {
              const isObj = typeof item === 'object';
              const name = isObj ? item.name : item;
              const category = isObj ? item.category : 'gear';
              const description = isObj ? item.description : '';
              const catIcon = category === 'weapon' ? 'flash' : category === 'armor' ? 'shield' : 'cube';
              const catColor = category === 'weapon' ? '#F44336' : category === 'armor' ? '#03A9F4' : '#FFD700';
              return (
                <View key={index} style={styles.equipmentItem}>
                  <View style={[styles.equipmentIcon, { backgroundColor: `${catColor}20` }]}>
                    <Ionicons name={catIcon as any} size={18} color={catColor} />
                  </View>
                  <View style={styles.equipmentInfo}>
                    <Text style={styles.equipmentName}>{name}</Text>
                    {description ? <Text style={styles.equipmentDesc}>{description}</Text> : null}
                  </View>
                  <Text style={[styles.equipmentCategory, { color: catColor }]}>{category}</Text>
                </View>
              );
            })}
            {(!character.equipment || character.equipment.length === 0) && (
              <Text style={styles.emptyEquipment}>No equipment</Text>
            )}
          </View>
        </View>

        {/* Resources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resources</Text>
          <View style={styles.resourcesRow}>
            <View style={styles.resourceItem}>
              <Ionicons name="cash" size={24} color="#FFD700" />
              <Text style={styles.resourceValue}>{character.credits}</Text>
              <Text style={styles.resourceLabel}>Credits</Text>
            </View>
            <View style={styles.resourceItem}>
              <Ionicons name="ribbon" size={24} color="#9C27B0" />
              <Text style={styles.resourceValue}>{character.experience.available}</Text>
              <Text style={styles.resourceLabel}>XP Available</Text>
            </View>
            <View style={styles.resourceItem}>
              <Ionicons name="trophy" size={24} color="#4CAF50" />
              <Text style={styles.resourceValue}>{character.experience.total}</Text>
              <Text style={styles.resourceLabel}>Total XP</Text>
            </View>
          </View>
        </View>

        {/* Backstory */}
        {character.backstory && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Backstory</Text>
            <Text style={styles.backstoryText}>{character.backstory}</Text>
          </View>
        )}

        {/* Start Game Button */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={handleStartGame}
          disabled={isStarting}
        >
          {isStarting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="play" size={24} color="#000" />
              <Text style={styles.playButtonText}>Start Adventure</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  topSection: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  portraitContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  portrait: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  placeholderPortrait: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
  },
  generateButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  basicInfo: {
    flex: 1,
  },
  characterName: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: 'bold',
  },
  characterSpecies: {
    color: '#aaa',
    fontSize: 16,
  },
  characterCareer: {
    color: '#03A9F4',
    fontSize: 14,
    marginTop: 2,
  },
  healthBars: {
    marginTop: 16,
  },
  healthBar: {
    marginBottom: 8,
  },
  healthLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  healthBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  healthBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  healthValue: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '30%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statName: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  skillsList: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
  },
  skillItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  skillName: {
    color: '#fff',
    fontSize: 14,
  },
  skillRanks: {
    flexDirection: 'row',
  },
  skillDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginLeft: 4,
  },
  skillDotFilled: {
    backgroundColor: '#4CAF50',
  },
  resourcesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  resourceItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
  },
  resourceValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  resourceLabel: {
    color: '#888',
    fontSize: 11,
    marginTop: 4,
  },
  backstoryText: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  equipmentList: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  equipmentIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  equipmentInfo: {
    flex: 1,
  },
  equipmentName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  equipmentDesc: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  equipmentCategory: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyEquipment: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  playButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
