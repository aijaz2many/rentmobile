import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { apiRequest } from '../services/api';
import { Card, colors, Page, styles } from './AppUi';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function changePassword() {
    if (!currentPassword || newPassword.length < 6) {
      Alert.alert('Check your password', 'Enter your current password and a new password with at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert('Password updated', 'Your password has been changed.');
    } catch (error) {
      Alert.alert('Password update failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    try {
      await logout();
    } catch (error) {
      Alert.alert('Signed out', error instanceof Error ? error.message : 'The saved session could not be removed.');
    }
  }

  return (
    <Page title="Profile" subtitle="Account and security settings.">
      <Card>
        <Text style={styles.actionTitle}>{[user?.firstName, user?.lastName].filter(Boolean).join(' ')}</Text>
        {user?.email ? <Text style={styles.subtitle}>{user.email}</Text> : null}
        {user?.phone ? <Text style={styles.subtitle}>{user.phone}</Text> : null}
        {user?.organizationName ? <Text style={styles.subtitle}>{user.organizationName}</Text> : null}
        <Text style={{ color: colors.accent, fontSize: 12 }}>{user?.roles.join(', ')}</Text>
      </Card>
      <Text style={styles.sectionTitle}>Change password</Text>
      <TextInput
        autoComplete="current-password"
        onChangeText={setCurrentPassword}
        placeholder="Current password"
        placeholderTextColor={colors.muted}
        secureTextEntry
        style={styles.input}
        value={currentPassword}
      />
      <TextInput
        autoComplete="new-password"
        onChangeText={setNewPassword}
        placeholder="New password (at least 6 characters)"
        placeholderTextColor={colors.muted}
        secureTextEntry
        style={styles.input}
        value={newPassword}
      />
      <Pressable disabled={saving} onPress={() => void changePassword()} style={styles.button}>
        <Text style={styles.buttonLabel}>{saving ? 'Saving...' : 'Update password'}</Text>
      </Pressable>
      <Pressable onPress={() => void signOut()} style={styles.secondaryButton}>
        <Text style={{ color: colors.danger, fontWeight: '700' }}>Sign out</Text>
      </Pressable>
    </Page>
  );
}
