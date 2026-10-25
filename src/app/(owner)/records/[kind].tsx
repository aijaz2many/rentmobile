import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ModuleScreen } from '../../../components/ModuleScreen';
import NotificationScreen from '../../../components/NotificationScreen';
import ProfileScreen from '../../../components/ProfileScreen';

export default function OwnerRecordScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  if (kind === 'notifications') return <NotificationScreen />;
  if (kind === 'profile') return <ProfileScreen />;
  return <ModuleScreen kind={kind} />;
}
