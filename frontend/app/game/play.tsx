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
  ImageBackground,
  Dimensions,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameStore } from '../../src/stores/gameStore';
import { DiceDisplay } from '../../src/components/DiceDisplay';
import { HoloTableGalaxy } from '../../src/components/HoloTableGalaxy';
import { Character, DiceResult, GameMessage } from '../../src/types/game';
import {
  startAmbientAudio,
  stopAmbientAudio,
  playDiceRollSound,
  playCommBeep,
  playWarningKlaxon,
} from '../../src/utils/audioEngine';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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

// Environment-specific textured border configurations
const BORDER_TEXTURES: Record<string, { top: string; side: string; accent: string; pattern: string }> = {
  cantina:    { top: '#8B4513', side: '#5C3317', accent: '#FF6B35', pattern: 'rivets' },
  desert:     { top: '#A0522D', side: '#8B4513', accent: '#DAA520', pattern: 'sandstone' },
  jungle:     { top: '#1B4332', side: '#0B2B1A', accent: '#2ECC71', pattern: 'vines' },
  space:      { top: '#0D0D2B', side: '#05051A', accent: '#7B68EE', pattern: 'stars' },
  urban:      { top: '#2F4F4F', side: '#1C3030', accent: '#00CED1', pattern: 'marble' },
  ruins:      { top: '#4A3728', side: '#2E221A', accent: '#D2691E', pattern: 'stone' },
  ice:        { top: '#4682B4', side: '#2F5B8A', accent: '#ADD8E6', pattern: 'crystal' },
  industrial: { top: '#5C4033', side: '#3A2820', accent: '#FF8C00', pattern: 'metal' },
  dark_side:  { top: '#2B0015', side: '#1A000D', accent: '#DC143C', pattern: 'energy' },
};

export default function GamePlay() {
  const { sessionId, characterId } = useLocalSearchParams();
  const { currentSession, loadGameSession, startGame, sendAction, characters, fetchCharacters, generateScene } = useGameStore();

  const [character, setCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Array<GameMessage & { dice_line?: string }>>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [lastDiceResult, setLastDiceResult] = useState<DiceResult | null>(null);
  const [showSkills, setShowSkills] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [envTheme, setEnvTheme] = useState<EnvironmentTheme>(DEFAULT_THEME);
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);
  const [pendingWarning, setPendingWarning] = useState<any>(null);
  const [pendingAction, setPendingAction] = useState<string>('');
  const [pendingSkill, setPendingSkill] = useState<string | null>(null);
  const [advancementNotif, setAdvancementNotif] = useState<any>(null);
  const [audioStarted, setAudioStarted] = useState(false);
  const [coins, setCoins] = useState<number>(100);

  const scrollViewRef = useRef<ScrollView>(null);
  const prevEnvRef = useRef<string>('urban');

  useEffect(() => {
    initGame();
    return () => {
      // Cleanup audio on unmount
      stopAmbientAudio();
    };
  }, [sessionId, characterId]);

  // Start/switch ambient audio when environment changes
  useEffect(() => {
    if (!isLoading && envTheme.type && audioStarted) {
      startAmbientAudio(envTheme.type);
    }
  }, [envTheme.type, isLoading, audioStarted]);

  // Handle app state for auto-save and audio pause
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        stopAmbientAudio();
      } else if (nextState === 'active' && audioStarted) {
        startAmbientAudio(envTheme.type);
      }
    });
    return () => subscription.remove();
  }, [envTheme.type, audioStarted]);

  const initGame = async () => {
    setIsLoading(true);
    try {
      // Fetch coin balance
      const token = await AsyncStorage.getItem('session_token');
      const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || '';
      try {
        const coinRes = await fetch(`${BACKEND}/api/auth/coins`, {
          headers: { 'Authorization': `Bearer ${token}` }, credentials: 'include'
        });
        if (coinRes.ok) {
          const coinData = await coinRes.json();
          setCoins(coinData.coins ?? 100);
        }
      } catch (_e) { /* coin fetch failed, use default */ }
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
        if (result.environment_theme) {
          setEnvTheme(result.environment_theme);
          prevEnvRef.current = result.environment_type || 'urban';
        }
        // Generate scene image async after game starts
        generateSceneAsync(session.session_id);
      } else if (session) {
        setMessages(session.game_history);
        // Load existing scene image if available
        if ((session as any).scene_image_base64) {
          setSceneImage((session as any).scene_image_base64);
        }
      }
    } catch (error) {
      console.error('Init game error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSceneAsync = async (sid: string) => {
    setIsGeneratingScene(true);
    try {
      const result = await generateScene(sid);
      if (result.scene_image_base64) {
        setSceneImage(result.scene_image_base64);
      }
    } catch (error) {
      console.error('Scene generation error:', error);
    } finally {
      setIsGeneratingScene(false);
    }
  };

  const handleSendAction = async (forceAction: boolean = false, overrideAction?: string, overrideSkill?: string | null) => {
    const action = overrideAction || inputText.trim();
    const skill = overrideSkill !== undefined ? overrideSkill : (selectedSkill || undefined);
    if (!action || !currentSession) return;
    
    if (!overrideAction) setInputText('');
    setIsSending(true);
    setPendingWarning(null);
    Keyboard.dismiss();

    const playerMessage: GameMessage & { dice_line?: string } = {
      role: 'player', content: action, timestamp: new Date().toISOString()
    };
    if (!overrideAction) setMessages(prev => [...prev, playerMessage]);

    // Start audio on first interaction (browser autoplay policy)
    if (!audioStarted) {
      setAudioStarted(true);
      startAmbientAudio(envTheme.type);
    }
    playCommBeep();

    try {
      const result = await sendAction(currentSession.session_id, action, skill, forceAction);

      // Handle out-of-coins
      if (result.warning && result.warning_severity === 'out_of_coins') {
        setPendingWarning(result);
        setIsSending(false);
        if (!overrideAction) setMessages(prev => prev.slice(0, -1));
        return;
      }

      // Handle warning response
      if (result.warning && result.requires_confirmation) {
        playWarningKlaxon();
        setPendingWarning(result);
        setPendingAction(action);
        setPendingSkill(skill || null);
        setIsSending(false);
        // Remove the premature player message since we're pausing
        if (!overrideAction) setMessages(prev => prev.slice(0, -1));
        return;
      }

      const gmMessage: GameMessage & { dice_line?: string } = {
        role: 'game_master', content: result.gm_response,
        dice_line: result.dice_line || undefined, timestamp: new Date().toISOString()
      };
      // If this was a forced action, add the player msg first
      if (overrideAction) {
        setMessages(prev => [...prev, playerMessage, gmMessage]);
      } else {
        setMessages(prev => [...prev, gmMessage]);
      }

      if (result.dice_result) setLastDiceResult(result.dice_result);
      else setLastDiceResult(null);

      // Play dice roll sound if dice were rolled
      if (result.dice_result) playDiceRollSound();

      // Update coin balance from response
      if (result.coins !== undefined) setCoins(result.coins);

      if (result.environment_theme) {
        setEnvTheme(result.environment_theme);
        if (result.environment_type && result.environment_type !== prevEnvRef.current) {
          prevEnvRef.current = result.environment_type;
          generateSceneAsync(currentSession.session_id);
        }
      }

      // Show advancement notification
      if (result.advancement && result.advancement.ranked_up) {
        setAdvancementNotif(result.advancement);
        setTimeout(() => setAdvancementNotif(null), 6000);
      }

      setSelectedSkill(null);
    } catch (error) {
      console.error('Send action error:', error);
      if (!overrideAction) setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  };

  const handleForceAction = () => {
    setPendingWarning(null);
    handleSendAction(true, pendingAction, pendingSkill);
  };

  const handleCancelAction = () => {
    setPendingWarning(null);
    setPendingAction('');
    setPendingSkill(null);
  };

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: '#050510' }]}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.loadingContainer}>
            <HoloTableGalaxy accentColor={envTheme.primary} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const careerSkills = character?.skills.filter(s => s.rank > 0) || [];
  const borderTex = BORDER_TEXTURES[envTheme.type] || BORDER_TEXTURES['urban'];

  // --- Render Environment-Textured Border Decorations ---
  const renderBorderDecoration = (position: 'top' | 'bottom' | 'left' | 'right') => {
    const isHorizontal = position === 'top' || position === 'bottom';
    const pattern = borderTex.pattern;

    // Create pattern elements based on environment type
    const patternElements = [];
    const count = isHorizontal ? 12 : 8;

    for (let i = 0; i < count; i++) {
      const offset = (i / count) * 100;
      let element;

      switch (pattern) {
        case 'vines':
          element = (
            <View key={i} style={[
              styles.borderElement,
              isHorizontal ? { left: `${offset}%` } : { top: `${offset}%` },
              {
                width: isHorizontal ? 14 : 6,
                height: isHorizontal ? 6 : 14,
                backgroundColor: i % 2 === 0 ? '#2ECC71' : '#1B4332',
                borderRadius: 3,
                opacity: 0.6 + Math.random() * 0.4,
                transform: [{ rotate: `${Math.random() * 30 - 15}deg` }],
              }
            ]} />
          );
          break;
        case 'sandstone':
          element = (
            <View key={i} style={[
              styles.borderElement,
              isHorizontal ? { left: `${offset}%` } : { top: `${offset}%` },
              {
                width: isHorizontal ? 20 : 8,
                height: isHorizontal ? 8 : 20,
                backgroundColor: i % 3 === 0 ? '#C19A6B' : i % 3 === 1 ? '#A0522D' : '#8B4513',
                borderRadius: 2,
                opacity: 0.7,
              }
            ]} />
          );
          break;
        case 'crystal':
          element = (
            <View key={i} style={[
              styles.borderElement,
              isHorizontal ? { left: `${offset}%` } : { top: `${offset}%` },
              {
                width: isHorizontal ? 8 : 4,
                height: isHorizontal ? 4 : 8,
                backgroundColor: i % 2 === 0 ? '#B0E0E6' : '#87CEEB',
                borderRadius: 1,
                opacity: 0.4 + Math.random() * 0.6,
              }
            ]} />
          );
          break;
        case 'energy':
          element = (
            <View key={i} style={[
              styles.borderElement,
              isHorizontal ? { left: `${offset}%` } : { top: `${offset}%` },
              {
                width: isHorizontal ? 16 : 3,
                height: isHorizontal ? 3 : 16,
                backgroundColor: '#DC143C',
                borderRadius: 1,
                opacity: 0.3 + Math.random() * 0.7,
              }
            ]} />
          );
          break;
        case 'stars':
          element = (
            <View key={i} style={[
              styles.borderElement,
              isHorizontal ? { left: `${offset}%` } : { top: `${offset}%` },
              {
                width: 3,
                height: 3,
                backgroundColor: '#fff',
                borderRadius: 1.5,
                opacity: 0.2 + Math.random() * 0.8,
              }
            ]} />
          );
          break;
        default: // rivets, marble, metal, stone
          element = (
            <View key={i} style={[
              styles.borderElement,
              isHorizontal ? { left: `${offset}%` } : { top: `${offset}%` },
              {
                width: isHorizontal ? 6 : 4,
                height: isHorizontal ? 4 : 6,
                backgroundColor: borderTex.accent,
                borderRadius: pattern === 'rivets' ? 3 : 1,
                opacity: 0.4,
              }
            ]} />
          );
      }
      patternElements.push(element);
    }

    const borderStyle = {
      top: { top: 0, left: 0, right: 0, height: 6, backgroundColor: borderTex.top },
      bottom: { bottom: 0, left: 0, right: 0, height: 6, backgroundColor: borderTex.top },
      left: { top: 0, bottom: 0, left: 0, width: 6, backgroundColor: borderTex.side },
      right: { top: 0, bottom: 0, right: 0, width: 6, backgroundColor: borderTex.side },
    };

    return (
      <View style={[styles.borderStrip, borderStyle[position] as any]} pointerEvents="none">
        {patternElements}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: envTheme.background }]}>
      {/* Full-screen scene background */}
      {sceneImage ? (
        <Image
          source={{ uri: `data:image/png;base64,${sceneImage}` }}
          style={styles.sceneBackground}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.sceneBackground, { backgroundColor: envTheme.background }]} />
      )}

      {/* Dark overlay for text readability */}
      <View style={styles.darkOverlay} />

      {/* Environment-textured borders */}
      {renderBorderDecoration('top')}
      {renderBorderDecoration('bottom')}
      {renderBorderDecoration('left')}
      {renderBorderDecoration('right')}

      {/* Corner accents */}
      <View style={[styles.cornerAccent, styles.cornerTL, { borderTopColor: borderTex.accent, borderLeftColor: borderTex.accent }]} />
      <View style={[styles.cornerAccent, styles.cornerTR, { borderTopColor: borderTex.accent, borderRightColor: borderTex.accent }]} />
      <View style={[styles.cornerAccent, styles.cornerBL, { borderBottomColor: borderTex.accent, borderLeftColor: borderTex.accent }]} />
      <View style={[styles.cornerAccent, styles.cornerBR, { borderBottomColor: borderTex.accent, borderRightColor: borderTex.accent }]} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header - translucent */}
          <View style={[styles.header, { backgroundColor: `${envTheme.background}CC` }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={[styles.locationText, { color: envTheme.primary }]} numberOfLines={1}>
                {currentSession?.current_location || 'Unknown'}
              </Text>
              <Text style={[styles.moodText, { color: `${envTheme.accent}AA` }]}>
                {envTheme.mood}
              </Text>
            </View>
            <View style={styles.headerRight}>
              {isGeneratingScene && (
                <ActivityIndicator size="small" color={envTheme.accent} style={{ marginRight: 8 }} />
              )}
              <TouchableOpacity onPress={() => router.push('/game/dice')} style={styles.diceButton}>
                <Ionicons name="dice" size={22} color={envTheme.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Character Status Bar - translucent */}
          {character && (
            <View style={[styles.statusBar, { backgroundColor: `${envTheme.background}99` }]}>
              <View style={styles.statusItem}>
                {character.portrait_base64 ? (
                  <Image
                    source={{ uri: `data:image/png;base64,${character.portrait_base64}` }}
                    style={[styles.miniPortrait, { borderColor: envTheme.primary }]}
                  />
                ) : (
                  <View style={[styles.miniPortraitPlaceholder, { borderColor: envTheme.border }]}>
                    <Ionicons name="person" size={14} color="#666" />
                  </View>
                )}
                <Text style={styles.charName}>{character.name}</Text>
              </View>
              <View style={styles.statusBars}>
                <View style={styles.coinCounter}>
                  <Ionicons name="ellipse" size={12} color="#FFD700" />
                  <Text style={styles.coinText}>{coins}</Text>
                </View>
                <View style={styles.hpBar}>
                  <View style={[styles.hpFill, {
                    width: `${Math.max(0, (1 - character.health.wounds / character.health.wound_threshold) * 100)}%`,
                    backgroundColor: '#F44336',
                  }]} />
                  <Text style={styles.hpText}>{character.health.wounds}/{character.health.wound_threshold}</Text>
                </View>
                <View style={styles.hpBar}>
                  <View style={[styles.hpFill, {
                    width: `${Math.max(0, (1 - character.health.strain / character.health.strain_threshold) * 100)}%`,
                    backgroundColor: '#03A9F4',
                  }]} />
                  <Text style={styles.hpText}>{character.health.strain}/{character.health.strain_threshold}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Story Content - the main viewport */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.storyContainer}
            contentContainerStyle={styles.storyContent}
          >
            {messages.map((message, index) => {
              const isGM = message.role === 'game_master';
              const isPlayer = message.role === 'player';

              return (
                <View key={index}>
                  {/* Immersive message bubble */}
                  <View style={[
                    styles.msgBubble,
                    isGM ? [styles.gmBubble, { borderLeftColor: envTheme.primary }] : styles.playerBubble,
                  ]}>
                    <View style={styles.msgHeader}>
                      <Ionicons
                        name={isGM ? 'planet' : 'person'}
                        size={14}
                        color={isGM ? envTheme.primary : '#4CAF50'}
                      />
                      <Text style={[styles.msgRole, { color: isGM ? envTheme.primary : '#4CAF50' }]}>
                        {isGM ? 'Game Master' : 'You'}
                      </Text>
                    </View>
                    <Text style={[styles.msgText, isGM && { color: '#e8e8e8' }]}>
                      {message.content}
                    </Text>
                  </View>

                  {/* Dice line - styled mechanically */}
                  {message.dice_line && (
                    <View style={[styles.diceLine, { borderColor: `${envTheme.accent}40` }]}>
                      <Ionicons name="dice" size={12} color={envTheme.accent} />
                      <Text style={[styles.diceLineText, { color: envTheme.accent }]}>
                        {message.dice_line}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Galaxy Map Loading while AI thinks */}
            {isSending && (
              <View style={styles.loadingBubble}>
                <HoloTableGalaxy accentColor={envTheme.primary} />
              </View>
            )}

            {lastDiceResult && !isSending && (
              <DiceDisplay result={lastDiceResult} />
            )}
          </ScrollView>

          {/* Warning Overlay - when character attempts something beyond their capability */}
          {pendingWarning && (
            <View style={styles.warningOverlay}>
              <View style={[styles.warningCard, { borderColor: pendingWarning.warning_severity === 'severe' ? '#F44336' : '#FF9800' }]}>
                <View style={styles.warningHeader}>
                  <Ionicons name="warning" size={24} color={pendingWarning.warning_severity === 'severe' ? '#F44336' : '#FF9800'} />
                  <Text style={[styles.warningTitle, { color: pendingWarning.warning_severity === 'severe' ? '#F44336' : '#FF9800' }]}>
                    {pendingWarning.warning_severity === 'severe' ? 'Extremely Risky' : 'Difficult Challenge'}
                  </Text>
                </View>
                <Text style={styles.warningText}>{pendingWarning.warning_message}</Text>
                <View style={styles.warningStats}>
                  <Text style={styles.warningStat}>Skill: {pendingWarning.skill_assessed} (Rank {pendingWarning.skill_rank})</Text>
                  <Text style={styles.warningStat}>Dice Pool: {pendingWarning.total_dice} dice</Text>
                </View>
                <View style={styles.warningButtons}>
                  <TouchableOpacity style={styles.warningCancelBtn} onPress={handleCancelAction}>
                    <Text style={styles.warningCancelText}>Reconsider</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.warningForceBtn, { backgroundColor: pendingWarning.warning_severity === 'severe' ? '#F44336' : '#FF9800' }]} onPress={handleForceAction}>
                    <Text style={styles.warningForceText}>Attempt Anyway</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Advancement Notification */}
          {advancementNotif && (
            <View style={[styles.advancementBanner, { borderColor: envTheme.primary }]}>
              <Ionicons name="arrow-up-circle" size={20} color={envTheme.primary} />
              <View style={styles.advancementText}>
                <Text style={[styles.advancementTitle, { color: envTheme.primary }]}>
                  {advancementNotif.skill_name} Rank {advancementNotif.new_rank}!
                </Text>
                {advancementNotif.talent_unlocked && (
                  <Text style={styles.advancementTalent}>
                    Unlocked: {advancementNotif.talent_unlocked.name} - {advancementNotif.talent_unlocked.description}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Skills Panel */}
          {showSkills && (
            <View style={[styles.skillsPanel, { backgroundColor: `${envTheme.background}E6` }]}>
              <View style={styles.skillsPanelHeader}>
                <Text style={[styles.skillsPanelTitle, { color: envTheme.primary }]}>Use a Skill</Text>
                <TouchableOpacity onPress={() => setShowSkills(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.skillsRow}>
                  {careerSkills.map((skill) => (
                    <TouchableOpacity
                      key={skill.name}
                      style={[
                        styles.skillChip,
                        selectedSkill === skill.name && { backgroundColor: envTheme.primary },
                      ]}
                      onPress={() => setSelectedSkill(selectedSkill === skill.name ? null : skill.name)}
                    >
                      <Text style={[
                        styles.skillChipText,
                        selectedSkill === skill.name && { color: '#000', fontWeight: '700' },
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
          <View style={[styles.inputContainer, { backgroundColor: `${envTheme.background}DD` }]}>
            <TouchableOpacity
              style={[styles.skillToggle, selectedSkill && { borderColor: envTheme.primary }]}
              onPress={() => setShowSkills(!showSkills)}
            >
              <Ionicons
                name={showSkills ? 'chevron-down' : 'chevron-up'}
                size={18}
                color={selectedSkill ? envTheme.primary : '#666'}
              />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="What do you do?"
              placeholderTextColor="#555"
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: envTheme.primary },
                (!inputText.trim() || isSending) && styles.sendButtonDisabled
              ]}
              onPress={handleSendAction}
              disabled={!inputText.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Ionicons name="send" size={18} color="#000" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sceneBackground: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    width: '100%', height: '100%',
  },
  darkOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  borderStrip: {
    position: 'absolute', zIndex: 20, overflow: 'hidden',
  },
  borderElement: {
    position: 'absolute',
  },
  cornerAccent: {
    position: 'absolute', width: 20, height: 20, zIndex: 25,
    borderWidth: 2, borderColor: 'transparent',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderBottomWidth: 0, borderRightWidth: 0 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderBottomWidth: 0, borderLeftWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderTopWidth: 0, borderRightWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2, borderTopWidth: 0, borderLeftWidth: 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: { padding: 6 },
  headerCenter: { flex: 1, marginHorizontal: 8, alignItems: 'center' },
  locationText: { fontSize: 14, fontWeight: 'bold' },
  moodText: { fontSize: 9, fontStyle: 'italic', marginTop: 1, letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  diceButton: { padding: 6 },

  // Status bar
  statusBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
  },
  statusItem: { flexDirection: 'row', alignItems: 'center' },
  miniPortrait: {
    width: 28, height: 28, borderRadius: 14, marginRight: 8, borderWidth: 1,
  },
  miniPortraitPlaceholder: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center', marginRight: 8, borderWidth: 1,
  },
  charName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  statusBars: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  coinCounter: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.15)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3, marginRight: 4,
  },
  coinText: {
    color: '#FFD700', fontSize: 12, fontWeight: 'bold', marginLeft: 4,
  },
  hpBar: {
    width: 60, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden', justifyContent: 'center',
  },
  hpFill: {
    position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 8,
  },
  hpText: {
    color: '#fff', fontSize: 9, fontWeight: 'bold',
    textAlign: 'center', zIndex: 1,
  },

  // Story
  storyContainer: { flex: 1 },
  storyContent: { padding: 12, paddingBottom: 20 },

  // Message bubbles - translucent glass effect
  msgBubble: {
    padding: 12, borderRadius: 12, marginVertical: 4,
    maxWidth: '95%',
  },
  gmBubble: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderLeftWidth: 3,
    alignSelf: 'flex-start',
  },
  playerBubble: {
    backgroundColor: 'rgba(76,175,80,0.15)',
    borderRightWidth: 3,
    borderRightColor: '#4CAF50',
    alignSelf: 'flex-end',
  },
  msgHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 4,
  },
  msgRole: {
    fontSize: 11, fontWeight: 'bold', marginLeft: 6,
  },
  msgText: {
    color: '#ddd', fontSize: 14, lineHeight: 21,
  },

  // Dice line
  diceLine: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 5, paddingHorizontal: 10,
    marginVertical: 3, marginLeft: 12,
    borderLeftWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
  },
  diceLineText: {
    fontSize: 10, fontWeight: '600', marginLeft: 6,
    fontFamily: 'monospace', letterSpacing: 0.3,
  },

  loadingBubble: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12, marginVertical: 8,
    overflow: 'hidden',
  },

  // Skills panel
  skillsPanel: {
    padding: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
  },
  skillsPanelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
  },
  skillsPanelTitle: { fontSize: 13, fontWeight: 'bold' },
  skillsRow: { flexDirection: 'row' },
  skillChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: 18, marginRight: 8,
  },
  skillChipText: { color: '#ccc', fontSize: 12 },

  // Input
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
  },
  skillToggle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8, borderWidth: 1, borderColor: 'transparent',
  },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, color: '#fff', fontSize: 14,
    maxHeight: 90, marginRight: 8,
  },
  sendButton: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },

  // Warning overlay
  warningOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center',
    alignItems: 'center', zIndex: 100, padding: 20,
  },
  warningCard: {
    backgroundColor: 'rgba(20,10,10,0.95)', borderRadius: 16,
    padding: 20, borderWidth: 2, width: '100%', maxWidth: 360,
  },
  warningHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
  },
  warningTitle: {
    fontSize: 18, fontWeight: 'bold', marginLeft: 10,
  },
  warningText: {
    color: '#ccc', fontSize: 14, lineHeight: 21, marginBottom: 12,
  },
  warningStats: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8,
    padding: 10, marginBottom: 16,
  },
  warningStat: {
    color: '#999', fontSize: 12, marginBottom: 2, fontFamily: 'monospace',
  },
  warningButtons: {
    flexDirection: 'row', justifyContent: 'space-between',
  },
  warningCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 8,
    alignItems: 'center',
  },
  warningCancelText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  warningForceBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    alignItems: 'center',
  },
  warningForceText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // Advancement notification
  advancementBanner: {
    position: 'absolute', bottom: 80, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 12,
    padding: 14, borderWidth: 1, zIndex: 50,
  },
  advancementText: { flex: 1, marginLeft: 10 },
  advancementTitle: { fontSize: 15, fontWeight: 'bold' },
  advancementTalent: { color: '#aaa', fontSize: 12, marginTop: 2 },
});
