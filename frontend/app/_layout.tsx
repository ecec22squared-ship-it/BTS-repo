import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0a0a0f' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="character/create" />
        <Stack.Screen name="character/list" />
        <Stack.Screen name="character/[id]" />
        <Stack.Screen name="game/dice" />
        <Stack.Screen name="game/play" />
        <Stack.Screen name="game/scenarios" />
        <Stack.Screen name="game/eras" />
        <Stack.Screen name="store" />
      </Stack>
    </SafeAreaProvider>
  );
}
