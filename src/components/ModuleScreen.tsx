import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { apiRequest } from '../services/api';
import ApartmentForm from './ApartmentForm';
import { ActionCard, Card, colors, ErrorMessage, Loading, Page, styles } from './AppUi';
import CoreRecordForm, { supportsCoreRecordForm } from './CoreRecordForm';
import TenantForm from './TenantForm';
import { formatDate, hasNoEndDateOrEndsAfter, isDateField } from '../lib/date';
import MaintenanceRequestForm from './MaintenanceRequestForm';
import type { MaintenanceRequestInput } from '../modules/tenant';

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

export function RecordCard({ record, kind }: { record: DataRecord; kind?: string }) {
  const apartment = isRecord(record.tsmib_apartments) ? record.tsmib_apartments : null;
  const apartmentNumber = firstValue(record, ['apartmentNumber']) ??
    (apartment ? firstValue(apartment, ['apartment_number', 'apartmentNumber']) : null);
  const leaseStartDate = record.startDate ?? record.start_date;
  const leaseMonthlyRent = record.monthlyRent ?? record.monthly_rent;
  const title =
    (kind === 'leases' ? apartmentNumber ?? 'Apartment' : null) ??
    firstValue(record, ['title', 'name', 'fullName', 'apartmentNumber', 'lease_number', 'leaseNumber', 'requestNumber', 'receiptNumber', 'reference', 'id']) ??
    'Record';
  const status = firstValue(record, ['status', 'statusName']);
  const ignored = new Set([
    'id', 'organization_id', 'organizationId', 'property_id', 'propertyId', 'building_id', 'buildingId',
    'apartmentId', 'categoryId',
    'floor_id', 'floorId', 'floor_number', 'floorNumber', 'floor_name', 'floorName', 'block',
    'title', 'name', 'fullName', 'apartmentNumber', 'lease_number', 'leaseNumber',
    'requestNumber', 'receiptNumber', 'reference', 'status', 'statusName', 'currentTenant', 'buildingName',
  ]);
  const details = Object.entries(record)
    .filter(([key, value]) => !ignored.has(key) && !key.startsWith('tsmib_') && value !== null && value !== undefined)
    .map(([key, value]) => [
    key,
    isDateField(key) ? formatDate(value) : stringValue(value),
    ] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
    .slice(0, 3);

  return (
    <Card>
      <Text style={styles.actionTitle}>{title}</Text>
      {status && kind !== 'apartments' && kind !== 'leases' ? <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>{status}</Text> : null}
      {kind === 'apartments' ? (
        <>
          {typeof record.buildingName === 'string' && record.buildingName
            ? <Text style={styles.subtitle}>Building: {record.buildingName}</Text>
            : null}
          {isRecord(record.currentTenant) && typeof record.currentTenant.name === 'string'
            ? <Text style={styles.subtitle}>Tenant: {record.currentTenant.name}</Text>
            : <Text style={styles.subtitle}>Tenant: Unassigned</Text>}
        </>
      ) : kind === 'leases' ? (
        <>
          {leaseStartDate !== undefined && leaseStartDate !== null
            ? <Text style={styles.subtitle}>Start date: {formatDate(leaseStartDate)}</Text>
            : null}
          {leaseMonthlyRent !== undefined && leaseMonthlyRent !== null
            ? <Text style={styles.subtitle}>Monthly rent: {String(leaseMonthlyRent)}</Text>
            : null}
        </>
      ) : kind === 'maintenance' ? (
        <>
          {firstValue(record, ['buildingName', 'apartmentNumber'])
            ? <Text style={styles.subtitle}>{[record.buildingName, record.apartmentNumber ? `Unit ${record.apartmentNumber}` : null].filter(Boolean).join(' · ')}</Text>
            : null}
          {firstValue(record, ['tenantName']) ? <Text style={styles.subtitle}>Tenant: {String(record.tenantName)}</Text> : null}
          {firstValue(record, ['category']) ? <Text style={styles.subtitle}>Category: {String(record.category)}</Text> : null}
          {firstValue(record, ['priority']) ? <Text style={styles.subtitle}>Priority: {String(record.priority)}</Text> : null}
          {firstValue(record, ['description']) ? <Text style={styles.subtitle}>{String(record.description)}</Text> : null}
        </>
      ) : details.map(([key, value]) => (
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
      propertyId: property.id,
    }));
  });
}

function rowsFor(kind: string, definition: { endpoint: string; key?: string }, payload: unknown): DataRecord[] {
  const rows = kind === 'buildings' ? propertyBuildings(payload) : extractRows(payload, definition.key);
  if (kind !== 'leases') return rows;

  const today = new Date().toISOString().slice(0, 10);
  return rows
    .filter((lease) => hasNoEndDateOrEndsAfter(lease.endDate ?? lease.end_date, today))
    .sort((left, right) => {
    const leftApartment = isRecord(left.tsmib_apartments) ? left.tsmib_apartments : null;
    const rightApartment = isRecord(right.tsmib_apartments) ? right.tsmib_apartments : null;
    const leftNumber = firstValue(left, ['apartmentNumber', 'apartment_number']) ??
      (leftApartment ? firstValue(leftApartment, ['apartment_number', 'apartmentNumber']) : '') ?? '';
    const rightNumber = firstValue(right, ['apartmentNumber', 'apartment_number']) ??
      (rightApartment ? firstValue(rightApartment, ['apartment_number', 'apartmentNumber']) : '') ?? '';
    return leftNumber.localeCompare(rightNumber, undefined, { numeric: true, sensitivity: 'base' });
    });
}

function persistedValueMatches(key: string, expected: unknown, actual: unknown): boolean {
  if (expected === null) return actual === null || actual === undefined;
  if (actual === null || actual === undefined) return false;
  if (isDateField(key)) return String(actual).slice(0, 10) === String(expected).slice(0, 10);
  if (typeof expected === 'number') return Number(actual) === expected;
  return String(actual) === String(expected);
}

export function ModuleScreen({ kind }: { kind: string }) {
  const definition = definitions[kind];
  const [rows, setRows] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(definition));
  const [error, setError] = useState<string | null>(null);
  const [formRecord, setFormRecord] = useState<DataRecord | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  const canManage = ['properties', 'buildings', 'apartments', 'tenants', 'leases'].includes(kind);
  const canCreateMaintenance = kind === 'maintenance';

  const loadRows = useCallback(async () => {
    if (!definition) return;
    const payload = await apiRequest<unknown>(definition.endpoint);
    setRows(rowsFor(kind, definition, payload));
  }, [definition, kind]);

  useEffect(() => {
    if (!definition) return;
    let active = true;
    apiRequest<unknown>(definition.endpoint)
      .then((payload) => {
        if (active) {
          setRows(rowsFor(kind, definition, payload));
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
      await loadRows();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this section.');
    } finally {
      setLoading(false);
    }
  };

  const openForm = (record: DataRecord | null = null) => {
    setFormRecord(record);
    setFormVersion((version) => version + 1);
    setFormVisible(true);
  };

  const saveCoreRecord = async (payload: DataRecord) => {
    const id = formRecord?.id;
    let endpoint = definition?.endpoint ?? '';
    const method = id ? 'PATCH' : 'POST';

    if (kind === 'buildings' && !id) {
      const propertyId = payload.propertyId;
      if (typeof propertyId !== 'string' || !propertyId) throw new Error('Choose a property for this building.');
      endpoint = `/properties/${encodeURIComponent(propertyId)}/buildings`;
    } else if (kind === 'leases' && !id) {
      endpoint = '/leases';
    } else if (id) {
      const recordEndpoint = kind === 'buildings' ? '/properties/buildings' : endpoint;
      endpoint = `${recordEndpoint}/${encodeURIComponent(String(id))}`;
    }

    await apiRequest(endpoint, {
      method: id && ['properties', 'buildings'].includes(kind) ? 'PUT' : method,
      body: JSON.stringify(payload),
    });

    if (kind === 'leases' && id) {
      const listPayload = await apiRequest<unknown>(definition?.endpoint ?? '/leases');
      const refreshedRows = rowsFor(kind, definition ?? { endpoint: '/leases' }, listPayload);
      const savedLease = refreshedRows.find((row) => row.id === id);
      if (!savedLease) {
        throw new Error('Lease update was sent, but the updated lease could not be verified. Reload the lease list before retrying.');
      }

      for (const [key, expected] of Object.entries(payload)) {
        const snakeCaseKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        if (!persistedValueMatches(key, expected, savedLease[key] ?? savedLease[snakeCaseKey])) {
          throw new Error(`Lease update was sent, but the saved ${key} value could not be verified. Reload the lease list before retrying.`);
        }
      }

      setRows(refreshedRows);
      setError(null);
      setFormVisible(false);
      setFormRecord(null);
      Alert.alert('Lease updated', 'Changes were saved and verified.');
      return;
    }

    setFormVisible(false);
    setFormRecord(null);
    await refresh();
  };

  const saveMaintenanceRequest = async (
    payload: MaintenanceRequestInput | Pick<MaintenanceRequestInput, 'categoryId' | 'priorityCode' | 'title' | 'description'>,
    requestId?: string,
  ) => {
    await apiRequest(requestId ? `/maintenance/${encodeURIComponent(requestId)}` : '/maintenance', {
      method: requestId ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    setFormVisible(false);
    setFormRecord(null);
    await refresh();
  };

  const cancelMaintenanceRequest = (record: DataRecord) => {
    if (typeof record.id !== 'string') return;
    Alert.alert(
      'Cancel maintenance request?',
      'The request will be marked as cancelled, and its history will be retained.',
      [
        { text: 'Keep request', style: 'cancel' },
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: () => {
            setLoading(true);
            apiRequest(`/maintenance/${encodeURIComponent(record.id as string)}`, { method: 'DELETE' })
              .then(refresh)
              .catch((cancelError: unknown) => {
                setError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel this maintenance request.');
              })
              .finally(() => setLoading(false));
          },
        },
      ],
    );
  };

  const removeRecord = (record: DataRecord) => {
    const id = record.id;
    if (typeof id !== 'string' || !definition) return;
    const title = kind === 'leases'
      ? 'this lease'
      : firstValue(record, ['name', 'fullName', 'apartmentNumber', 'leaseNumber', 'lease_number']) ?? 'this record';
    const actionTitle = kind === 'leases' ? 'Terminate lease?' : `Delete ${title}?`;
    const actionDescription = kind === 'leases'
      ? 'The lease will be marked terminated and its apartment returned to vacant status.'
      : 'This cannot be undone. The server will reject deletion if this record still has dependent records.';
    Alert.alert(
      actionTitle,
      actionDescription,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: kind === 'leases' ? 'Terminate' : 'Delete',
          style: 'destructive',
          onPress: () => {
            setLoading(true);
            setError(null);
            const recordEndpoint = kind === 'buildings' ? '/properties/buildings' : definition.endpoint;
            apiRequest(`${recordEndpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' })
              .then(refresh)
              .catch((deleteError: unknown) => {
                setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this record.');
              })
              .finally(() => setLoading(false));
          },
        },
      ],
    );
  };

  const renderEditForm = () => {
    if (kind === 'maintenance') {
      return (
        <MaintenanceRequestForm
          key={formVersion}
          onSave={saveMaintenanceRequest}
          onCancel={() => setFormVisible(false)}
          initialRecord={formRecord}
        />
      );
    }
    if (kind === 'apartments') {
      return (
        <ApartmentForm
          key={formVersion}
          initialData={formRecord ?? undefined}
          onSuccess={() => { setFormVisible(false); setFormRecord(null); void refresh(); }}
          onCancel={() => setFormVisible(false)}
        />
      );
    }
    if (kind === 'tenants') {
      return (
        <TenantForm
          key={formVersion}
          initialData={formRecord ?? undefined}
          onSuccess={() => { setFormVisible(false); setFormRecord(null); void refresh(); }}
          onCancel={() => setFormVisible(false)}
        />
      );
    }
    return (
      <CoreRecordForm
        key={formVersion}
        kind={kind}
        record={formRecord}
        onSave={saveCoreRecord}
        onCancel={() => setFormVisible(false)}
      />
    );
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
      {canManage || canCreateMaintenance ? (
        <Pressable accessibilityRole="button" onPress={() => openForm()} style={styles.button}>
          <Text style={styles.buttonLabel}>
            {canCreateMaintenance ? 'Add request for tenant' : `Add ${{ properties: 'Property', buildings: 'Building', apartments: 'Apartment', tenants: 'Tenant', leases: 'Lease' }[kind]}`}
          </Text>
        </Pressable>
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <Card><Text style={styles.subtitle}>No records found.</Text></Card>
      ) : null}
      {rows.map((record, index) => (
        <View key={typeof record.id === 'string' ? record.id : `${kind}-${index}`} style={{ gap: 8 }}>
          <RecordCard record={record} kind={kind} />
          {canManage ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable accessibilityRole="button" onPress={() => openForm(record)} style={[styles.secondaryButton, { flex: 1 }]}>
                <Text style={styles.buttonLabel}>Edit</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => removeRecord(record)} style={[styles.secondaryButton, { borderColor: colors.danger, flex: 1 }]}>
                <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '700' }}>Delete</Text>
              </Pressable>
            </View>
          ) : null}
          {kind === 'maintenance' && record.status !== 'COMPLETED' && record.status !== 'CANCELLED' ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => openForm(record)}
                style={[styles.secondaryButton, { flex: 1 }]}
              >
                <Text style={styles.buttonLabel}>Edit request</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => cancelMaintenanceRequest(record)}
                style={[styles.secondaryButton, { borderColor: colors.danger, flex: 1 }]}
              >
                <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '700' }}>Cancel request</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}
      <Modal visible={formVisible} animationType="slide" onRequestClose={() => setFormVisible(false)}>
        <View style={{ backgroundColor: colors.background, flex: 1, paddingTop: 24 }}>
          <ScrollView contentContainerStyle={{ gap: 16, padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.pageTitle}>
                {kind === 'maintenance'
                  ? `${formRecord ? 'Edit' : 'Add'} maintenance request`
                  : `${formRecord ? 'Edit' : 'Create'} ${{ properties: 'Property', buildings: 'Building', apartments: 'Apartment', tenants: 'Tenant', leases: 'Lease' }[kind]}`}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setFormVisible(false)}><Text style={{ color: colors.accent }}>Close</Text></Pressable>
            </View>
            {supportsCoreRecordForm(kind) || kind === 'apartments' || kind === 'tenants' || kind === 'maintenance'
              ? renderEditForm()
              : <ActionCard title="Unsupported operation" description="This record type does not have an editable form." onPress={() => setFormVisible(false)} />}
          </ScrollView>
        </View>
      </Modal>
    </Page>
  );
}
