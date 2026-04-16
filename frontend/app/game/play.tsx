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
import { StoryMessage } from '../../src/components/StoryMessage';
import { DiceDisplay } from '../../src/components/DiceDisplay';
import { GalaxyMapLoading } from '../../src/components/GalaxyMapLoading';
import { Character, DiceResult, GameMessage } from '../../src/types/game';

interface EnvironmentTheme {
  type: string;
  primary: string;
  accent: string;
  background: string;
  border: string;
  text_glow: string;
  mood: string;
}

const DEFAULT_THEME: EnvironmentTheme = {
  type: 'urban',
  primary: '#00CED1',
  accent: '#20B2AA',
  background: '#0A0A14',
  border: '#2F4F4F',
  text_glow: '#40E0D0',
  mood: 'neon-washed duracrete streets',
};

export default function GamePlay() {
  const { sessionId, characterId } = useLocalSearchParams();
  const { currentSession, loadGameSession, startGame, sendAction, characters, fetchCharacters } = useGameStore();

  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Array<GameMessage & { dice_line?: string }>>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [lastDiceResult, setLastDiceResult] = useState<DiceResult | null>(null);
  const [showSkills, setShowSkills] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [envTheme, setEnvTheme] = useState<EnvironmentTheme>(DEFAULT_THEME);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    initGame();
  }, [sessionId, characterId]);

  const initGame = async () => {
    setIsLoading(true);
    try {
      if (sessionId) {
        await loadGameSession(sessionId as string);
      }
      if (characters.length === 0) {
        await fetchCharacters();
      }
      const char = useGameStore.getState().characters.find(c => c.character_id === characterId);
      if (char) setCharacter(char);

      const session = useGameStore.getState().currentSession;

      if (session && session.game_history.length === 0) {
        const result = await startGame(session.session_id);
        setMessages([{
          role: 'game_master' as const,
          content: result.opening,
          timestamp: new Date().toISOString()
        }]);
        if (result.environment_theme) setEnvTheme(result.environment_theme);
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

    const playerMessage: GameMessage & { dice_line?: string } = {
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

      const gmMessage: GameMessage & { dice_line?: string } = {
        role: 'game_master',
        content: result.gm_response,
        dice_line: result.dice_line || undefined,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, gmMessage]);

      if (result.dice_result) {
        setLastDiceResult(result.dice_result);
      } else {
        setLastDiceResult(null);
      }

      // Update environment theme if changed
      if (result.environment_theme) {
        setEnvTheme(result.environment_theme);
      }

      setSelectedSkill(null);
    } catch (error) {
      console.error('Send action error:', error);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: envTheme.background }]}>
        <View style={styles.loadingContainer}>
          <GalaxyMapLoading accentColor={envTheme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const careerSkills = character?.skills.filter(s => s.rank > 0) || [];

  // Dynamic styles based on environment
  const dynamicStyles = {
    headerBorder: { borderBottomColor: `${envTheme.border}80` },
    statusBarBg: { backgroundColor: `${envTheme.primary}10` },
    locationText: { color: envTheme.primary },
    inputBorder: { borderTopColor: `${envTheme.border}80` },
    sendBtn: { backgroundColor: envTheme.primary },
    skillChipSelected: { backgroundColor: envTheme.primary },
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: envTheme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {/* Header with environment color */}
        <View style={[styles.header, dynamicStyles.headerBorder]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.locationText, dynamicStyles.locationText]} numberOfLines={1}>
              {currentSession?.current_location || 'Unknown Location'}
            </Text>
            <Text style={[styles.moodText, { color: `${envTheme.accent}99` }]}>
              {envTheme.mood}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/game/dice')}
            style={styles.diceButton}
          >
            <Ionicons name="dice" size={24} color={envTheme.primary} />
          </TouchableOpacity>
        </View>

        {/* Character Status Bar */}
        {character && (
          <View style={[styles.statusBar, dynamicStyles.statusBarBg, { borderBottomColor: `${envTheme.border}60` }]}>
            <View style={styles.statusItem}>
              {character.portrait_base64 ? (
                <Image
                  source={{ uri: `data:image/png;base64,${character.portrait_base64}` }}
                  style={[styles.miniPortrait, { borderColor: envTheme.primary }]}
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
            <View key={index}>
              <StoryMessage message={message} envTheme={envTheme} />
              {/* Dice line rendered separately below GM messages */}
              {message.dice_line && (
                <View style={[styles.diceLineContainer, { borderColor: `${envTheme.accent}60` }]}>
                  <Ionicons name="dice" size={14} color={envTheme.accent} />
                  <Text style={[styles.diceLineText, { color: envTheme.accent }]}>
                    {message.dice_line}
                  </Text>
                </View>
              )}
            </View>
          ))}

          {/* Galaxy Map Loading while AI thinks */}
          {isSending && (
            <GalaxyMapLoading accentColor={envTheme.primary} />
          )}

          {lastDiceResult && !isSending && (
            <View style={styles.diceResultContainer}>
              <DiceDisplay result={lastDiceResult} />
            </View>
          )}
        </ScrollView>

        {/* Skills Panel */}
        {showSkills && (
          <View style={[styles.skillsPanel, { borderTopColor: `${envTheme.border}80` }]}>
            <View style={styles.skillsPanelHeader}>
              <Text style={[styles.skillsPanelTitle, { color: envTheme.primary }]}>Use a Skill</Text>
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
                      selectedSkill === skill.name && dynamicStyles.skillChipSelected,
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
        <View style={[styles.inputContainer, dynamicStyles.inputBorder]}>
          <TouchableOpacity
            style={[styles.skillToggle, selectedSkill && { borderColor: envTheme.primary }]}
            onPress={() => setShowSkills(!showSkills)}
          >
            <Ionicons
              name={showSkills ? 'chevron-down' : 'chevron-up'}
              size={20}
              color={selectedSkill ? envTheme.primary : '#888'}
            />
            <Text style={[styles.skillToggleText, selectedSkill && { color: envTheme.primary }]}>
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
            style={[
              styles.sendButton,
              dynamicStyles.sendBtn,
              (!inputText.trim() || isSending) && styles.sendButtonDisabled
            ]}
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
    padding: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },
  headerCenter: { flex: 1, marginHorizontal: 12, alignItems: 'center' },
  locationText: { fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
  moodText: { fontSize: 10, fontStyle: 'italic', marginTop: 2 },
  diceButton: { padding: 8 },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  statusItem: { flexDirection: 'row', alignItems: 'center' },
  miniPortrait: {
    width: 32, height: 32, borderRadius: 16, marginRight: 8, borderWidth: 1,
  },
  miniPortraitPlaceholder: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center', marginRight: 8,
  },
  characterName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  statusBars: { flexDirection: 'row' },
  statusBarItem: { flexDirection: 'row', alignItems: 'center', marginLeft: 16 },
  statusValue: { color: '#fff', fontSize: 12, marginLeft: 4 },
  storyContainer: { flex: 1 },
  storyContent: { padding: 16 },
  diceLineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginVertical: 4,
    marginLeft: 12,
    borderLeftWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
  },
  diceLineText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'monospace',
    letterSpacing: 0.3,
  },
  diceResultContainer: { marginTop: 8 },
  skillsPanel: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderTopWidth: 1,
    padding: 12,
  },
  skillsPanelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  skillsPanelTitle: { fontSize: 14, fontWeight: 'bold' },
  skillsRow: { flexDirection: 'row' },
  skillChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginRight: 8,
  },
  skillChipText: { color: '#fff', fontSize: 13 },
  skillChipTextSelected: { color: '#000', fontWeight: '600' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 12, borderTopWidth: 1, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  skillToggle: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginRight: 8,
    borderWidth: 1, borderColor: 'transparent',
  },
  skillToggleText: { color: '#888', fontSize: 12, marginLeft: 4 },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, color: '#fff', fontSize: 15,
    maxHeight: 100, marginRight: 8,
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
});
