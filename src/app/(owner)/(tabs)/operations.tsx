import { router } from 'expo-router';
import React from 'react';
import { ActionCard, Page } from '../../../components/AppUi';

const sections = [
  ['tenants', 'Tenants', 'Tenant contact and occupancy records.'],
  ['leases', 'Leases', 'Active and previous lease information.'],
  ['maintenance', 'Maintenance', 'Requests, status, and assigned workers.'],
];

export default function OperationsScreen() {
  return (
    <Page title="Operations" subtitle="People, leases, and property upkeep.">
      {sections.map(([kind, title, description]) => (
        <ActionCard key={kind} title={title} description={description} onPress={() => router.push(`/(owner)/records/${kind}`)} />
      ))}
    </Page>
  );
}
