import React, { useState } from 'react';
import { Link, router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { colors, Page, styles } from './AppUi';

export function LoginForm() {
  const { login, error, clearError } = useAuth();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!emailOrPhone.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email or phone number and password.');
      return;
    }
    setSubmitting(true);
    try {
      await login(emailOrPhone.trim(), password);
    } catch (submitError) {
      Alert.alert('Sign in failed', submitError instanceof Error ? submitError.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Page title="Welcome back" subtitle="Sign in to manage your rental account.">
        <TextInput
          accessibilityLabel="Email or phone"
          autoCapitalize="none"
          autoComplete="username"
          keyboardType="email-address"
          onChangeText={(value) => { clearError(); setEmailOrPhone(value); }}
          placeholder="Email or phone"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={emailOrPhone}
        />
        <TextInput
          accessibilityLabel="Password"
          autoComplete="current-password"
          onChangeText={(value) => { clearError(); setPassword(value); }}
          onSubmitEditing={() => void submit()}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
          value={password}
        />
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void submit()} style={styles.button}>
          <Text style={styles.buttonLabel}>{submitting ? 'Signing in...' : 'Sign in'}</Text>
        </Pressable>
        <Link href="/(auth)/forgot-password" style={{ color: colors.accent, textAlign: 'center' }}>
          Forgot password?
        </Link>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text style={styles.subtitle}>New to Rent Manager?</Text>
          <Link href="/(auth)/register" style={{ color: colors.accent, fontWeight: '700' }}>
            Create an account
          </Link>
        </View>
      </Page>
    </KeyboardAvoidingView>
  );
}

export function RegisterForm() {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!firstName.trim() || !email.trim() || !organizationName.trim() || password.length < 6) {
      Alert.alert('Check your details', 'First name, email, organization, and a password of at least 6 characters are required.');
      return;
    }
    setSubmitting(true);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim(),
        phone: phone.trim() || undefined,
        organizationName: organizationName.trim(),
        password,
      });
    } catch (submitError) {
      Alert.alert('Registration failed', submitError instanceof Error ? submitError.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Page title="Create your account" subtitle="Set up an owner account and property organization.">
        <TextInput autoCapitalize="words" onChangeText={setFirstName} placeholder="First name" placeholderTextColor={colors.muted} style={styles.input} value={firstName} />
        <TextInput autoCapitalize="words" onChangeText={setLastName} placeholder="Last name (optional)" placeholderTextColor={colors.muted} style={styles.input} value={lastName} />
        <TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.muted} style={styles.input} value={email} />
        <TextInput keyboardType="phone-pad" onChangeText={setPhone} placeholder="Phone (optional)" placeholderTextColor={colors.muted} style={styles.input} value={phone} />
        <TextInput autoCapitalize="words" onChangeText={setOrganizationName} placeholder="Organization name" placeholderTextColor={colors.muted} style={styles.input} value={organizationName} />
        <TextInput autoComplete="new-password" onChangeText={setPassword} placeholder="Password (at least 6 characters)" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} value={password} />
        <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void submit()} style={styles.button}>
          <Text style={styles.buttonLabel}>{submitting ? 'Creating account...' : 'Create account'}</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.secondaryButton}>
          <Text style={{ color: colors.text }}>Back to sign in</Text>
        </Pressable>
      </Page>
    </KeyboardAvoidingView>
  );
}
