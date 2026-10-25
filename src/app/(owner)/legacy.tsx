import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { colors, Loading } from '../../components/AppUi';
import LegacyOwnerApp from '../../../App';

export default function LegacyOwnerScreen() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <View style={{ alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' }}>
        <Loading message="Returning to sign in..." />
      </View>
    );
  }

  return <LegacyOwnerApp initialUser={user} onLogout={logout} onBack={() => router.back()} />;
}
