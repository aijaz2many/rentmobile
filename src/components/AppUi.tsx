import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export const colors = {
  background: '#0b1120',
  surface: '#151f32',
  border: '#29364b',
  text: '#f8fafc',
  muted: '#9aa9bf',
  accent: '#818cf8',
  danger: '#fca5a5',
};

export function Page({
  title,
  subtitle,
  children,
  refreshing = false,
  onRefresh,
}: React.PropsWithChildren<{
  title: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}>) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined
      }
    >
      <Text style={styles.pageTitle}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: React.PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ActionCard({
  title,
  description,
  onPress,
}: {
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.subtitle}>{description}</Text>
    </Pressable>
  );
}

export function Loading({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.subtitle}>{message}</Text>
    </View>
  );
}

export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.buttonLabel}>Try again</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14, paddingBottom: 36 },
  pageTitle: { color: colors.text, fontSize: 26, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    padding: 16,
  },
  actionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  metricValue: { color: colors.text, fontSize: 24, fontWeight: '700' },
  metricLabel: { color: colors.muted, fontSize: 12, textTransform: 'uppercase' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: colors.muted, flex: 1, fontSize: 13 },
  value: { color: colors.text, flex: 1, fontSize: 14, textAlign: 'right' },
  errorText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  loading: { alignItems: 'center', gap: 12, justifyContent: 'center', padding: 32 },
  button: {
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  buttonLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 10, borderWidth: 1, padding: 12 },
  retryButton: { alignSelf: 'flex-start', backgroundColor: '#4338ca', borderRadius: 8, marginTop: 6, paddingHorizontal: 14, paddingVertical: 9 },
  pressed: { opacity: 0.75 },
  input: {
    backgroundColor: '#0e1728',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
});
