import { router } from 'expo-router';
import React from 'react';
import { ActionCard, Page } from '../../../components/AppUi';

export default function MoreScreen() {
  return (
    <Page title="More" subtitle="Account tools and updates.">
      <ActionCard title="Notifications" description="Review and mark account notifications as read." onPress={() => router.push('/(owner)/records/notifications')} />
      <ActionCard title="Profile" description="Account details, password, and sign out." onPress={() => router.push('/(owner)/records/profile')} />
      <ActionCard title="Full management tools" description="Open the existing apartment, tenant, rent, and receipt workflows." onPress={() => router.push('/(owner)/legacy')} />
    </Page>
  );
}
