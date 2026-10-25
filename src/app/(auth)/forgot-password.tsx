import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { Card, colors, Page, styles } from '../../components/AppUi';

export default function ForgotPasswordScreen() {
  return (
    <Page title="Password help" subtitle="Account recovery">
      <Card>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Contact your property administrator</Text>
        <Text style={styles.subtitle}>
          Password reset by email is not available in the backend yet. Ask your property administrator to help restore access.
          After signing in, you can change your password from Profile.
        </Text>
      </Card>
      <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.button}>
        <Text style={styles.buttonLabel}>Back to sign in</Text>
      </Pressable>
    </Page>
  );
}
