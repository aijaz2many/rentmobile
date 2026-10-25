import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { apiRequest } from '../services/api';
import { Card, colors, ErrorMessage, Loading, Page, styles } from './AppUi';

type DataRecord = Record<string, unknown>;

const definitions: Record<string, { title: string; endpoint: string; key?: string }> = {
  properties: { title: 'Properties', endpoint: '/properties' },
  buildings: { title: 'Buildings', endpoint: '/properties' },
  apartments: { title: 'Apartments', endpoint: '/apartments' },
  tenants: { title: 'Tenants', endpoint: '/tenants' },
  leases: { title: 'Leases', endpoint: '/leases' },
  maintenance: { title: 'Maintenance', endpoint: '/maintenance', key: 'requests' },
  rent: { title: 'Rent charges', endpoint: '/rent/charges' },
  payments: { title: 'Payments', endpoint: '/payments', key: 'payments' },
  expenses: { title: 'Expenses', endpoint: '/expenses', key: 'expenses' },
  reports: { title: 'Rent report', endpoint: '/reports/rent', key: 'charges' },
  notifications: { title: 'Notifications', endpoint: '/notifications', key: 'notifications' },
  receipts: { title: 'Receipts', endpoint: '/receipts', key: 'receipts' },
};

function isRecord(value: unknown): value is DataRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractRows(payload: unknown, key?: string): DataRecord[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  if (key && Array.isArray(payload[key])) return (payload[key] as unknown[]).filter(isRecord);
  const array = Object.values(payload).find(Array.isArray);
  return Array.isArray(array) ? array.filter(isRecord) : [];
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(stringValue).filter(Boolean).join(', ');
  return null;
}

function firstValue(record: DataRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) return value;
  }
  return null;
}

export function RecordCard({ record }: { record: DataRecord }) {
  const title =
    firstValue(record, ['title', 'name', 'fullName', 'apartmentNumber', 'lease_number', 'leaseNumber', 'requestNumber', 'receiptNumber', 'reference', 'id']) ??
    'Record';
  const status = firstValue(record, ['status', 'statusName']);
  const ignored = new Set(['id', 'title', 'name', 'fullName', 'apartmentNumber', 'lease_number', 'leaseNumber', 'requestNumber', 'receiptNumber', 'reference', 'status', 'statusName']);
  const details = Object.entries(record)
    .filter(([key, value]) => !ignored.has(key) && !key.startsWith('tsmib_') && value !== null && value !== undefined)
    .map(([key, value]) => [key, stringValue(value)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
    .slice(0, 3);

  return (
    <Card>
      <Text style={styles.actionTitle}>{title}</Text>
      {status ? <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>{status}</Text> : null}
      {details.map(([key, value]) => (
        <Text key={key} style={styles.subtitle}>{`${key.replace(/([A-Z])/g, ' $1')}: ${value}`}</Text>
      ))}
    </Card>
  );
}

function propertyBuildings(payload: unknown): DataRecord[] {
  if (!Array.isArray(payload)) return [];
  return payload.filter(isRecord).flatMap((property) => {
    const buildings = property.tsmib_buildings;
    if (!Array.isArray(buildings)) return [];
    return buildings.filter(isRecord).map((building) => ({
      ...building,
      propertyName: property.name,
    }));
  });
}

export function ModuleScreen({ kind }: { kind: string }) {
  const definition = definitions[kind];
  const [rows, setRows] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(definition));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!definition) return;
    let active = true;
    apiRequest<unknown>(definition.endpoint)
      .then((payload) => {
        if (active) {
          setRows(kind === 'buildings' ? propertyBuildings(payload) : extractRows(payload, definition.key));
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load this section.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [definition, kind]);

  const refresh = async () => {
    if (!definition) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<unknown>(definition.endpoint);
      setRows(kind === 'buildings' ? propertyBuildings(payload) : extractRows(payload, definition.key));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this section.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page
      title={definition?.title ?? 'Section'}
      subtitle="Pull down to refresh."
      refreshing={loading}
      onRefresh={() => void refresh()}
    >
      {loading ? <Loading /> : null}
      {!definition ? <ErrorMessage message={`Unknown section: ${kind}`} /> : null}
      {error ? <ErrorMessage message={error} onRetry={() => void refresh()} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <Card><Text style={styles.subtitle}>No records found.</Text></Card>
      ) : null}
      {rows.map((record, index) => (
        <RecordCard key={typeof record.id === 'string' ? record.id : `${kind}-${index}`} record={record} />
      ))}
    </Page>
  );
}
