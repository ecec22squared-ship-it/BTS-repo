import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useGameStore } from '../../src/stores/gameStore';
import { useAuthStore } from '../../src/stores/authStore';
import { StoryMessage } from '../../src/components/StoryMessage';
import { DiceDisplay } from '../../src/components/DiceDisplay';
import { Character, GameSession, DiceResult, GameMessage } from '../../src/types/game';

export default function GamePlay() {
  const { sessionId, characterId } = useLocalSearchParams();
  const { currentSession, loadGameSession, startGame, sendAction, characters, fetchCharacters } = useGameStore();
  
  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [lastDiceResult, setLastDiceResult] = useState<DiceResult | null>(null);
  const [showSkills, setShowSkills] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    initGame();
  }, [sessionId, characterId]);

  const initGame = async () => {
    setIsLoading(true);
    try {
      // Load session
      if (sessionId) {
        await loadGameSession(sessionId as string);
      }
      
      // Get character
      if (characters.length === 0) {
        await fetchCharacters();
      }
      const char = useGameStore.getState().characters.find(c => c.character_id === characterId);
      if (char) setCharacter(char);
      
      // Get current session
      const session = useGameStore.getState().currentSession;
      
      // If no history, start the game
      if (session && session.game_history.length === 0) {
        const result = await startGame(session.session_id);
        setMessages([{
          role: 'game_master',
          content: result.opening,
          timestamp: new Date().toISOString()
        }]);
      } else if (session) {
        setMessages(session.game_history);
      }
    } catch (error) {
      console.error('Init game error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendAction = async () => {
    if (!inputText.trim() || !currentSession) return;
    
    const action = inputText.trim();
    setInputText('');
    setIsSending(true);
    Keyboard.dismiss();
    
    // Add player message immediately
    const playerMessage: GameMessage = {
      role: 'player',
      content: action,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, playerMessage]);
    
    try {
      const result = await sendAction(
        currentSession.session_id,
        action,
        selectedSkill || undefined
      );
      
      // Add GM response
      const gmMessage: GameMessage = {
        role: 'game_master',
        content: result.gm_response,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, gmMessage]);
      
      // Update dice result if any
      if (result.dice_result) {
        setLastDiceResult(result.dice_result);
      } else {
        setLastDiceResult(null);
      }
      
      setSelectedSkill(null);
    } catch (error) {
      console.error('Send action error:', error);
      // Remove the player message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Preparing your adventure...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const careerSkills = character?.skills.filter(s => s.rank > 0) || [];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.locationText} numberOfLines={1}>
              {currentSession?.current_location || 'Unknown Location'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/game/dice')}
            style={styles.diceButton}
          >
            <Ionicons name="dice" size={24} color="#FFD700" />
          </TouchableOpacity>
        </View>

        {/* Character Status Bar */}
        {character && (
          <View style={styles.statusBar}>
            <View style={styles.statusItem}>
              {character.portrait_base64 ? (
                <Image
                  source={{ uri: `data:image/png;base64,${character.portrait_base64}` }}
                  style={styles.miniPortrait}
                />
              ) : (
                <View style={styles.miniPortraitPlaceholder}>
                  <Ionicons name="person" size={16} color="#666" />
                </View>
              )}
              <Text style={styles.characterName}>{character.name}</Text>
            </View>
            <View style={styles.statusBars}>
              <View style={styles.statusBarItem}>
                <Ionicons name="heart" size={14} color="#F44336" />
                <Text style={styles.statusValue}>
                  {character.health.wounds}/{character.health.wound_threshold}
                </Text>
              </View>
              <View style={styles.statusBarItem}>
                <Ionicons name="flash" size={14} color="#03A9F4" />
                <Text style={styles.statusValue}>
                  {character.health.strain}/{character.health.strain_threshold}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Story Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.storyContainer}
          contentContainerStyle={styles.storyContent}
        >
          {messages.map((message, index) => (
            <StoryMessage key={index} message={message} />
          ))}
          
          {isSending && (
            <View style={styles.typingIndicator}>
              <ActivityIndicator size="small" color="#FFD700" />
              <Text style={styles.typingText}>Game Master is responding...</Text>
            </View>
          )}
          
          {lastDiceResult && (
            <View style={styles.diceResultContainer}>
              <DiceDisplay result={lastDiceResult} />
            </View>
          )}
        </ScrollView>

        {/* Skills Panel */}
        {showSkills && (
          <View style={styles.skillsPanel}>
            <View style={styles.skillsPanelHeader}>
              <Text style={styles.skillsPanelTitle}>Use a Skill</Text>
              <TouchableOpacity onPress={() => setShowSkills(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.skillsRow}>
                {careerSkills.map((skill) => (
                  <TouchableOpacity
                    key={skill.name}
                    style={[
                      styles.skillChip,
                      selectedSkill === skill.name && styles.skillChipSelected,
                    ]}
                    onPress={() => {
                      setSelectedSkill(selectedSkill === skill.name ? null : skill.name);
                    }}
                  >
                    <Text style={[
                      styles.skillChipText,
                      selectedSkill === skill.name && styles.skillChipTextSelected,
                    ]}>
                      {skill.name} ({skill.rank})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.skillToggle}
            onPress={() => setShowSkills(!showSkills)}
          >
            <Ionicons
              name={showSkills ? 'chevron-down' : 'chevron-up'}
              size={20}
              color={selectedSkill ? '#FFD700' : '#888'}
            />
            <Text style={[styles.skillToggleText, selectedSkill && styles.skillToggleActive]}>
              {selectedSkill || 'Skill'}
            </Text>
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="What do you do?"
            placeholderTextColor="#666"
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={handleSendAction}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="send" size={20} color="#000" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  loadingText: {
    color: '#FFD700',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  locationText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  diceButton: {
    padding: 8,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniPortrait: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  miniPortraitPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  characterName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBars: {
    flexDirection: 'row',
  },
  statusBarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  statusValue: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  storyContainer: {
    flex: 1,
  },
  storyContent: {
    padding: 16,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    marginTop: 8,
  },
  typingText: {
    color: '#FFD700',
    marginLeft: 8,
    fontSize: 14,
  },
  diceResultContainer: {
    marginTop: 8,
  },
  skillsPanel: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    padding: 12,
  },
  skillsPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  skillsPanelTitle: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
  },
  skillsRow: {
    flexDirection: 'row',
  },
  skillChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
  },
  skillChipSelected: {
    backgroundColor: '#FFD700',
  },
  skillChipText: {
    color: '#fff',
    fontSize: 13,
  },
  skillChipTextSelected: {
    color: '#000',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  skillToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
  },
  skillToggleText: {
    color: '#888',
    fontSize: 12,
    marginLeft: 4,
  },
  skillToggleActive: {
    color: '#FFD700',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
