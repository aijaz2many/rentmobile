import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiRequest, invalidateApiCache } from '../services/api';
import ApartmentForm from './ApartmentForm';
import { ActionCard, Card, colors, ErrorMessage, Loading, Page, styles } from './AppUi';
import CoreRecordForm, { supportsCoreRecordForm } from './CoreRecordForm';
import TenantForm from './TenantForm';
import { formatDate, isDateField } from '../lib/date';
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

function getTenantApartmentNumber(record: DataRecord): string | null {
  const apartment = [
    record.currentApartment,
    record.current_apartment,
    record.apartment,
    record.tsmib_apartments,
  ].find(isRecord);
  return firstValue(record, ['apartmentNumber', 'apartment_number']) ??
    (apartment ? firstValue(apartment, ['apartmentNumber', 'apartment_number']) : null);
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function paymentPeriodLabel(period: unknown): string {
  if (typeof period !== 'string') return 'Unknown period';
  const match = /^(\d{1,2})\/(\d{4})$/.exec(period);
  if (!match) return period;
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? `${monthNames[month - 1]} ${match[2]}` : period;
}

function paymentSearchText(record: DataRecord): string {
  const tenant = isRecord(record.tenant) ? record.tenant : {};
  const apartment = isRecord(record.apartment) ? record.apartment : {};
  const allocations = Array.isArray(record.allocations) ? record.allocations.filter(isRecord) : [];
  return [
    tenant.name,
    apartment.apartmentNumber,
    record.paymentReference,
    record.transactionId,
    record.receiptNumber,
    record.amount,
    record.methodName,
    record.status,
    ...allocations.flatMap((allocation) => [allocation.period, allocation.amount]),
  ].filter((value) => value !== null && value !== undefined).join(' ').toLowerCase();
}

export function RecordCard({ record, kind }: { record: DataRecord; kind?: string }) {
  const apartment = isRecord(record.tsmib_apartments) ? record.tsmib_apartments : null;
  const apartmentNumber = firstValue(record, ['apartmentNumber']) ??
    (apartment ? firstValue(apartment, ['apartment_number', 'apartmentNumber']) : null);
  const tenantApartmentNumber = getTenantApartmentNumber(record);
  const tenantName = firstValue(record, ['fullName', 'full_name', 'name']) ??
    [firstValue(record, ['firstName', 'first_name']), firstValue(record, ['lastName', 'last_name'])]
      .filter((name): name is string => Boolean(name))
      .join(' ');
  const tenantDetails = [
    { label: 'Phone Number', value: firstValue(record, ['phoneNumber', 'phone_number', 'phone']) },
  ].filter((detail): detail is { label: string; value: string } => Boolean(detail.value));
  const leaseTenants = Array.isArray(record.tsmib_lease_tenants)
    ? record.tsmib_lease_tenants.filter(isRecord)
    : [];
  const leaseTenant = leaseTenants.find((item) => isRecord(item.tsmib_tenants))?.tsmib_tenants;
  const leaseTenantName = isRecord(leaseTenant)
    ? firstValue(leaseTenant, ['fullName']) ??
      [leaseTenant.first_name ?? leaseTenant.firstName, leaseTenant.last_name ?? leaseTenant.lastName]
        .filter((name): name is string => typeof name === 'string' && name.length > 0)
        .join(' ')
    : firstValue(record, ['tenantName', 'fullName']);
  const leaseStartDate = record.startDate ?? record.start_date;
  const leaseEndDate = record.endDate ?? record.end_date;
  const leaseMonthlyRent = record.monthlyRent ?? record.monthly_rent;
  const paymentTenant = isRecord(record.tenant) ? record.tenant : null;
  const paymentApartment = isRecord(record.apartment) ? record.apartment : null;
  const paymentAllocations = Array.isArray(record.allocations)
    ? record.allocations.filter(isRecord)
    : [];
  const title =
    (kind === 'tenants'
      ? [tenantApartmentNumber, tenantName].filter(Boolean).join(' : ') || 'Tenant'
      : null) ??
    (kind === 'payments' ? firstValue(paymentTenant ?? {}, ['name']) ?? 'Payment' : null) ??
    (kind === 'expenses'
      ? firstValue(record, ['vendor_name', 'vendorName', 'expense_number', 'expenseNumber']) ??
        (isRecord(record.tsmib_expense_categories) ? firstValue(record.tsmib_expense_categories, ['name']) : null)
      : null) ??
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
      {status && kind !== 'apartments' && kind !== 'leases' ? <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>{kind === 'tenants' ? status.toUpperCase() : status}</Text> : null}
      {kind === 'tenants' ? (
        tenantDetails.map(({ label, value }) => (
          <Text key={label} style={styles.subtitle}>{`${label}: ${value}`}</Text>
        ))
      ) : kind === 'apartments' ? (
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
          {leaseTenantName ? <Text style={styles.subtitle}>Tenant: {leaseTenantName}</Text> : null}
          {leaseStartDate !== undefined && leaseStartDate !== null
            ? <Text style={styles.subtitle}>Start date: {formatDate(leaseStartDate)}</Text>
            : null}
          {leaseEndDate !== undefined && leaseEndDate !== null
            ? <Text style={styles.subtitle}>End date: {formatDate(leaseEndDate)}</Text>
            : <Text style={styles.subtitle}>End date: No end date</Text>}
          {leaseMonthlyRent !== undefined && leaseMonthlyRent !== null
            ? <Text style={styles.subtitle}>Monthly rent: {String(leaseMonthlyRent)}</Text>
            : null}
        </>
      ) : kind === 'payments' ? (
        <>
          {paymentApartment ? (
            <Text style={styles.subtitle}>Apartment: {firstValue(paymentApartment, ['apartmentNumber']) ?? '—'}</Text>
          ) : null}
          <Text style={styles.subtitle}>Payment: {firstValue(record, ['amount']) ?? '0'}</Text>
          <Text style={styles.subtitle}>Date: {record.paymentDate ? formatDate(record.paymentDate) : '—'}</Text>
          {paymentAllocations.length > 0
            ? paymentAllocations.map((allocation, index) => (
                <Text key={String(allocation.id ?? index)} style={styles.subtitle}>
                  Paid for: {paymentPeriodLabel(allocation.period)} · {firstValue(allocation, ['amount']) ?? '0'} allocated
                </Text>
              ))
            : <Text style={styles.subtitle}>Paid for: No rent charge allocation</Text>}
        </>
      ) : kind === 'expenses' ? (
        <>
          <Text style={styles.subtitle}>
            Category: {isRecord(record.tsmib_expense_categories)
              ? firstValue(record.tsmib_expense_categories, ['name']) ?? 'Uncategorized'
              : 'Uncategorized'}
          </Text>
          <Text style={styles.subtitle}>Amount: {firstValue(record, ['amount']) ?? '—'}</Text>
          {(record.expense_date ?? record.expenseDate) !== undefined
            ? <Text style={styles.subtitle}>Date: {formatDate(record.expense_date ?? record.expenseDate)}</Text>
            : null}
          {firstValue(record, ['vendor_name', 'vendorName'])
            ? <Text style={styles.subtitle}>Vendor: {firstValue(record, ['vendor_name', 'vendorName'])}</Text>
            : null}
          {firstValue(record, ['invoice_number', 'invoiceNumber'])
            ? <Text style={styles.subtitle}>Invoice: {firstValue(record, ['invoice_number', 'invoiceNumber'])}</Text>
            : null}
          {firstValue(record, ['description'])
            ? <Text style={styles.subtitle}>{firstValue(record, ['description'])}</Text>
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
  if (kind === 'tenants') {
    return rows.sort((left, right) => {
      const leftNumber = getTenantApartmentNumber(left);
      const rightNumber = getTenantApartmentNumber(right);
      if (!leftNumber) return rightNumber ? 1 : 0;
      if (!rightNumber) return -1;
      return leftNumber.localeCompare(rightNumber, undefined, { numeric: true, sensitivity: 'base' });
    });
  }
  if (kind !== 'leases') return rows;

  return rows
    .filter((lease) => ['ACTIVE', 'EXPIRED'].includes(String(lease.status ?? '').toUpperCase()))
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
  const [paymentSearch, setPaymentSearch] = useState('');

  const canManage = ['properties', 'buildings', 'apartments', 'tenants', 'leases', 'expenses'].includes(kind);
  const canCreateMaintenance = kind === 'maintenance';
  const visibleRows = kind === 'payments' && paymentSearch.trim()
    ? rows.filter((record) => paymentSearchText(record).includes(paymentSearch.trim().toLowerCase()))
    : rows;

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
    invalidateApiCache();
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
      : kind === 'expenses'
        ? firstValue(record, ['vendor_name', 'vendorName', 'expense_number', 'expenseNumber']) ?? 'this expense'
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
            {canCreateMaintenance
              ? 'Add request for tenant'
              : `Add ${{ properties: 'Property', buildings: 'Building', apartments: 'Apartment', tenants: 'Tenant', leases: 'Lease', expenses: 'Expense' }[kind]}`}
          </Text>
        </Pressable>
      ) : null}
      {kind === 'payments' && !loading && !error ? (
        <TextInput
          accessibilityLabel="Search payments"
          onChangeText={setPaymentSearch}
          placeholder="Search tenant, apartment, month, year..."
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={paymentSearch}
        />
      ) : null}
      {!loading && !error && visibleRows.length === 0 ? (
        <Card><Text style={styles.subtitle}>{kind === 'payments' && paymentSearch.trim() ? 'No payments match your search.' : 'No records found.'}</Text></Card>
      ) : null}
      {visibleRows.map((record, index) => (
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
                  : `${formRecord ? 'Edit' : 'Create'} ${{ properties: 'Property', buildings: 'Building', apartments: 'Apartment', tenants: 'Tenant', leases: 'Lease', expenses: 'Expense' }[kind]}`}
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
