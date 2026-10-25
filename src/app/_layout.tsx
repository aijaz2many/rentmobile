import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../auth/AuthProvider';

function RouteGuard() {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const group = segments[0];
    const isTenant = user?.roles.includes('TENANT') ?? false;

    if (!user && group !== '(auth)') {
      router.replace('/(auth)/login');
    } else if (user && group === '(auth)') {
      router.replace(isTenant ? '/(tenant)/dashboard' : '/(owner)/dashboard');
    } else if (user && isTenant && group === '(owner)') {
      router.replace('/(tenant)/dashboard');
    } else if (user && !isTenant && group === '(tenant)') {
      router.replace('/(owner)/dashboard');
    }
  }, [ready, user, segments, router]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0b1120' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(owner)" />
        <Stack.Screen name="(tenant)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RouteGuard />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
