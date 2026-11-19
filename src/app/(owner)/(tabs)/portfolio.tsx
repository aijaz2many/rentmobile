import { router } from 'expo-router';
import React from 'react';
import { ActionCard, Page } from '../../../components/AppUi';

const sections = [
  ['properties', 'Properties', 'View property details and buildings.'],
  ['buildings', 'Buildings', 'Browse buildings across your properties.'],
  ['apartments', 'Apartments', 'Review unit status, rent, and occupancy.'],
];

export default function PortfolioScreen() {
  return (
    <Page title="Portfolio" subtitle="Properties, buildings, and apartments.">
      {sections.map(([kind, title, description]) => (
        <ActionCard key={kind} title={title} description={description} onPress={() => router.push(`/(owner)/records/${kind}`)} />
      ))}
    </Page>
  );
}
