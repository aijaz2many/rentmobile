import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { apiRequest } from '../services/api';
import { Card, colors, ErrorMessage, Loading, Page, styles } from './AppUi';

type Notification = {
  id: string;
  title?: string;
  message?: string;
  type?: string;
  is_read?: boolean;
  created_at?: string;
};

export default function NotificationScreen() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<{ notifications: Notification[] }>('/notifications')
      .then((response) => {
        if (active) {
          setItems(response.notifications);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<{ notifications: Notification[] }>('/notifications');
      setItems(response.notifications);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  async function markRead(id: string) {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
      setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item));
    } catch (actionError) {
      Alert.alert('Unable to update notification', actionError instanceof Error ? actionError.message : 'Please try again.');
    }
  }

  async function markAllRead() {
    try {
      await apiRequest('/notifications/read-all', { method: 'PATCH' });
      setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch (actionError) {
      Alert.alert('Unable to update notifications', actionError instanceof Error ? actionError.message : 'Please try again.');
    }
  }

  return (
    <Page title="Notifications" subtitle="Updates for your account." refreshing={loading} onRefresh={() => void refresh()}>
      <Pressable onPress={() => void markAllRead()} style={styles.secondaryButton}>
        <Text style={{ color: colors.accent, fontWeight: '700' }}>Mark all as read</Text>
      </Pressable>
      {loading ? <Loading /> : null}
      {error ? <ErrorMessage message={error} onRetry={() => void refresh()} /> : null}
      {!loading && !error && items.length === 0 ? <Card><Text style={styles.subtitle}>You are all caught up.</Text></Card> : null}
      {items.map((item) => (
        <Pressable
          accessibilityRole="button"
          key={item.id}
          onPress={() => !item.is_read && void markRead(item.id)}
        >
          <Card>
            <Text style={styles.actionTitle}>{item.title || item.type || 'Notification'}</Text>
            {item.message ? <Text style={styles.subtitle}>{item.message}</Text> : null}
            <Text style={{ color: item.is_read ? colors.muted : colors.accent, fontSize: 12 }}>
              {item.is_read ? 'Read' : 'Unread'}{item.created_at ? `  ·  ${new Date(item.created_at).toLocaleDateString()}` : ''}
            </Text>
          </Card>
        </Pressable>
      ))}
    </Page>
  );
}
