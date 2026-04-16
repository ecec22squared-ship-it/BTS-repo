import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GameMessage } from '../types/game';

interface StoryMessageProps {
  message: GameMessage;
}

export const StoryMessage: React.FC<StoryMessageProps> = ({ message }) => {
  const isGameMaster = message.role === 'game_master';
  const isSystem = message.role === 'system';

  return (
    <View style={[styles.container, isGameMaster ? styles.gmContainer : styles.playerContainer]}>
      <View style={styles.header}>
        <Ionicons
          name={isGameMaster ? 'planet' : isSystem ? 'information-circle' : 'person'}
          size={16}
          color={isGameMaster ? '#FFD700' : isSystem ? '#03A9F4' : '#4CAF50'}
        />
        <Text style={[styles.roleText, isGameMaster ? styles.gmRole : styles.playerRole]}>
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
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#FFD700',
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
  gmRole: {
    color: '#FFD700',
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
