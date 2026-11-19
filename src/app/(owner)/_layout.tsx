import { Stack } from 'expo-router';
import React from 'react';

export default function OwnerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="records/[kind]" />
      <Stack.Screen name="legacy" />
    </Stack>
  );
}
