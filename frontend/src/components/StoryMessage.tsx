import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GameMessage } from '../types/game';

interface EnvironmentTheme {
  type: string;
  primary: string;
  accent: string;
  background: string;
  border: string;
  text_glow: string;
  mood: string;
}

interface StoryMessageProps {
  message: GameMessage;
  envTheme?: EnvironmentTheme;
}

export const StoryMessage: React.FC<StoryMessageProps> = ({ message, envTheme }) => {
  const isGameMaster = message.role === 'game_master';
  const isSystem = message.role === 'system';

  const gmColor = envTheme?.primary || '#FFD700';
  const gmAccent = envTheme?.accent || '#DAA520';
  const gmBorder = envTheme?.border || '#8B6914';

  return (
    <View style={[
      styles.container,
      isGameMaster
        ? [styles.gmContainer, { borderLeftColor: gmColor, backgroundColor: `${gmColor}12` }]
        : styles.playerContainer
    ]}>
      <View style={styles.header}>
        <Ionicons
          name={isGameMaster ? 'planet' : isSystem ? 'information-circle' : 'person'}
          size={16}
          color={isGameMaster ? gmColor : isSystem ? '#03A9F4' : '#4CAF50'}
        />
        <Text style={[
          styles.roleText,
          isGameMaster ? { color: gmColor } : styles.playerRole
        ]}>
          {isGameMaster ? 'Game Master' : isSystem ? 'System' : 'You'}
        </Text>
      </View>
      <Text style={styles.content}>{message.content}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 12,
    marginVertical: 6,
    maxWidth: '95%',
  },
  gmContainer: {
    borderLeftWidth: 3,
    alignSelf: 'flex-start',
  },
  playerContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRightWidth: 3,
    borderRightColor: '#4CAF50',
    alignSelf: 'flex-end',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  playerRole: {
    color: '#4CAF50',
  },
  content: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
});
