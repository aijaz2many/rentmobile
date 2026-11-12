import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ModuleScreen } from '../../../components/ModuleScreen';
import NotificationScreen from '../../../components/NotificationScreen';
import ProfileScreen from '../../../components/ProfileScreen';
import RentChargesScreen from '../../../components/RentChargesScreen';

export default function OwnerRecordScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  if (kind === 'notifications') return <NotificationScreen />;
  if (kind === 'profile') return <ProfileScreen />;
  if (kind === 'rent') return <RentChargesScreen />;
  return <ModuleScreen kind={kind} />;
}
