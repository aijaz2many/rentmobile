import { Tabs } from 'expo-router';
import React from 'react';
import { colors } from '../../components/AppUi';

export default function OwnerLayout() {
  return (
    <Tabs
      initialRouteName="dashboard"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: '#151f32', borderTopColor: '#29364b' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="portfolio" options={{ title: 'Portfolio' }} />
      <Tabs.Screen name="operations" options={{ title: 'Operations' }} />
      <Tabs.Screen name="finance" options={{ title: 'Finance' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
      <Tabs.Screen name="records/[kind]" options={{ href: null }} />
      <Tabs.Screen name="legacy" options={{ href: null }} />
    </Tabs>
  );
}
