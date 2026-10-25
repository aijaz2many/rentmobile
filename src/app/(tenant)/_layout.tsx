import { Tabs } from 'expo-router';
import React from 'react';
import { colors } from '../../components/AppUi';

export default function TenantLayout() {
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
      <Tabs.Screen name="home" options={{ title: 'My Home' }} />
      <Tabs.Screen name="rent" options={{ title: 'Rent' }} />
      <Tabs.Screen name="maintenance" options={{ title: 'Maintenance' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Updates' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
