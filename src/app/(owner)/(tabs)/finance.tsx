import { router } from 'expo-router';
import React from 'react';
import { ActionCard, Page } from '../../../components/AppUi';

const sections = [
  ['rent', 'Rent', 'Monthly charges and collection status.'],
  ['payments', 'Payments', 'Payment history and allocations.'],
  ['expenses', 'Expenses', 'Operating expenses and categories.'],
  ['reports', 'Reports', 'Rent collection report for the current period.'],
];

export default function FinanceScreen() {
  return (
    <Page title="Finance" subtitle="Rent, payments, expenses, and reports.">
      {sections.map(([kind, title, description]) => (
        <ActionCard key={kind} title={title} description={description} onPress={() => router.push(`/(owner)/records/${kind}`)} />
      ))}
    </Page>
  );
}
