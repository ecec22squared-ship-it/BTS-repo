import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useGameStore } from '../../src/stores/gameStore';
import { CharacterCard } from '../../src/components/CharacterCard';
import { Character } from '../../src/types/game';

export default function CharacterList() {
  const { startGame } = useLocalSearchParams();
  const { characters, fetchCharacters, deleteCharacter, createGameSession, isLoading } =
    useGameStore();
  const [refreshing, setRefreshing] = useState(false);
  const [startingGame, setStartingGame] = useState<string | null>(null);

  useEffect(() => {
    fetchCharacters();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCharacters();
    setRefreshing(false);
  };

  const handleDelete = (character: Character) => {
    Alert.alert(
      'Delete Character',
      `Are you sure you want to delete ${character.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCharacter(character.character_id),
        },
      ]
    );
  };

  const handleStartGame = async (character: Character) => {
    setStartingGame(character.character_id);
    try {
      const session = await createGameSession(character.character_id);
      router.push(`/game/play?sessionId=${session.session_id}&characterId=${character.character_id}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to start game session');
    } finally {
      setStartingGame(null);
    }
  };

  const handleCharacterPress = (character: Character) => {
    if (startGame) {
      handleStartGame(character);
    } else {
      router.push(`/character/${character.character_id}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {startGame ? 'Select Character' : 'My Characters'}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/character/create')}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>

      {startGame && (
        <View style={styles.instructionBanner}>
          <Ionicons name="game-controller" size={20} color="#FFD700" />
          <Text style={styles.instructionText}>Choose a character to begin your adventure</Text>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
        }
      >
        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
          </View>
        ) : characters.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="person-add" size={64} color="#444" />
            <Text style={styles.emptyText}>No characters yet</Text>
            <Text style={styles.emptySubtext}>Create your first character to begin</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/character/create')}
            >
              <Ionicons name="add" size={20} color="#000" />
              <Text style={styles.createButtonText}>Create Character</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {characters.map((character) => (
              <View key={character.character_id}>
                {startingGame === character.character_id ? (
                  <View style={styles.loadingCard}>
                    <ActivityIndicator color="#FFD700" />
                    <Text style={styles.loadingCardText}>Starting adventure...</Text>
                  </View>
                ) : (
                  <CharacterCard
                    character={character}
                    onPress={() => handleCharacterPress(character)}
                    onDelete={startGame ? undefined : () => handleDelete(character)}
                  />
                )}
              </View>
            ))}
          </>
        )}
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
  addButton: {
    padding: 8,
  },
  instructionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.3)',
  },
  instructionText: {
    color: '#FFD700',
    marginLeft: 8,
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 24,
  },
  createButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  loadingCardText: {
    color: '#FFD700',
    marginLeft: 12,
    fontSize: 16,
  },
});
