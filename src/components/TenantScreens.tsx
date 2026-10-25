import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  getMaintenanceCategories,
  getOutstandingBalance,
  getPaymentHistory,
  getTenantLeases,
  getTenantProfile,
  getTenantRentCharges,
  submitMaintenanceRequest,
  updateMaintenanceRequest,
  withdrawMaintenanceRequest,
  type MaintenanceCategory,
  type TenantProfile,
} from '../modules/tenant';
import { apiRequest } from '../services/api';
import { formatDate, isDateField } from '../lib/date';
import { ActionCard, Card, colors, ErrorMessage, Loading, Page, styles } from './AppUi';
import { RecordCard } from './ModuleScreen';

type DataRecord = Record<string, unknown>;

type ScreenKind = 'dashboard' | 'home' | 'rent' | 'maintenance';

function recordsFrom(payload: unknown, key?: string): DataRecord[] {
  if (Array.isArray(payload)) return payload.filter((item): item is DataRecord => typeof item === 'object' && item !== null);
  if (typeof payload !== 'object' || payload === null) return [];
  const list = key ? (payload as DataRecord)[key] : undefined;
  return Array.isArray(list) ? list.filter((item): item is DataRecord => typeof item === 'object' && item !== null) : [];
}

type TenantScreenData = {
  tenant?: TenantProfile;
  outstanding?: DataRecord;
  records?: DataRecord[];
  payments?: DataRecord[];
  categories?: MaintenanceCategory[];
};

async function fetchTenantScreen(kind: ScreenKind, tenantId: string): Promise<TenantScreenData> {
  if (kind === 'maintenance') {
    const [tenant, maintenance, categories] = await Promise.all([
      getTenantProfile(tenantId),
      apiRequest<unknown>('/maintenance'),
      getMaintenanceCategories(),
    ]);
    return { tenant, records: recordsFrom(maintenance, 'requests'), categories };
  }

  const tenant = await getTenantProfile(tenantId);
  if (kind === 'home') {
    const leases = await getTenantLeases(tenantId);
    return { tenant, records: recordsFrom(leases) };
  }
  if (kind === 'rent') {
    const [charges, paymentResult, outstanding] = await Promise.all([
      getTenantRentCharges(tenantId),
      getPaymentHistory(tenantId),
      getOutstandingBalance(tenantId),
    ]);
    return {
      tenant,
      records: recordsFrom(charges),
      payments: recordsFrom(paymentResult),
      outstanding,
    };
  }

  const [outstanding, paymentResult] = await Promise.all([
    getOutstandingBalance(tenantId),
    getPaymentHistory(tenantId),
  ]);
  return { tenant, outstanding, payments: recordsFrom(paymentResult) };
}

export default function TenantScreen({ kind }: { kind: ScreenKind }) {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const [tenant, setTenant] = useState<TenantProfile | null>(null);
  const [outstanding, setOutstanding] = useState<DataRecord | null>(null);
  const [rows, setRows] = useState<DataRecord[]>([]);
  const [payments, setPayments] = useState<DataRecord[]>([]);
  const [categories, setCategories] = useState<MaintenanceCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [priorityCode, setPriorityCode] = useState('MEDIUM');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [editingMaintenanceId, setEditingMaintenanceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    fetchTenantScreen(kind, tenantId)
      .then((data) => {
        if (!active) return;
        setTenant(data.tenant ?? null);
        setRows(data.records ?? []);
        setPayments(data.payments ?? []);
        setOutstanding(data.outstanding ?? null);
        if (data.categories) {
          setCategories(data.categories);
          setSelectedCategoryId((current) => current || data.categories?.[0]?.id || '');
        }
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load your information.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [kind, tenantId]);

  const refresh = async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTenantScreen(kind, tenantId);
      setTenant(data.tenant ?? null);
      setRows(data.records ?? []);
      setPayments(data.payments ?? []);
      setOutstanding(data.outstanding ?? null);
      if (data.categories) {
        setCategories(data.categories);
        setSelectedCategoryId((current) => current || data.categories?.[0]?.id || '');
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your information.');
    } finally {
      setLoading(false);
    }
  };

  async function requestMaintenance() {
    const apartmentId = tenant?.currentApartment?.id;
    if ((!editingMaintenanceId && (!tenantId || !apartmentId)) || !selectedCategoryId || requestTitle.trim().length < 3 || requestDescription.trim().length < 5) {
      Alert.alert('Complete the request', 'Choose a category and enter a title and description for your active apartment.');
      return;
    }
    setSubmitting(true);
    try {
      const request = {
        categoryId: selectedCategoryId,
        priorityCode,
        title: requestTitle.trim(),
        description: requestDescription.trim(),
      };
      if (editingMaintenanceId) {
        await updateMaintenanceRequest(editingMaintenanceId, request);
      } else {
        await submitMaintenanceRequest({ ...request, apartmentId: apartmentId!, tenantId: tenantId! });
      }
      setRequestTitle('');
      setRequestDescription('');
      setEditingMaintenanceId(null);
      await refresh();
      Alert.alert(
        editingMaintenanceId ? 'Request updated' : 'Request submitted',
        editingMaintenanceId ? 'Your changes have been saved.' : 'Your maintenance request has been sent to the property manager.',
      );
    } catch (submitError) {
      Alert.alert('Unable to submit request', submitError instanceof Error ? submitError.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function editMaintenanceRequest(record: DataRecord) {
    if (typeof record.id !== 'string') return;
    setEditingMaintenanceId(record.id);
    setSelectedCategoryId(typeof record.categoryId === 'string' ? record.categoryId : '');
    setPriorityCode(typeof record.priority === 'string' ? record.priority : 'MEDIUM');
    setRequestTitle(typeof record.title === 'string' ? record.title : '');
    setRequestDescription(typeof record.description === 'string' ? record.description : '');
  }

  function confirmWithdrawMaintenanceRequest(record: DataRecord) {
    if (typeof record.id !== 'string') return;
    Alert.alert(
      'Withdraw maintenance request?',
      'This request will be marked as withdrawn. Its history will remain available.',
      [
        { text: 'Keep request', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: () => {
            setSubmitting(true);
            withdrawMaintenanceRequest(record.id as string)
              .then(async () => {
                if (editingMaintenanceId === record.id) {
                  setEditingMaintenanceId(null);
                  setRequestTitle('');
                  setRequestDescription('');
                }
                await refresh();
              })
              .then(() => Alert.alert('Request withdrawn', 'The maintenance request has been withdrawn.'))
              .catch((withdrawError: unknown) => {
                Alert.alert('Unable to withdraw request', withdrawError instanceof Error ? withdrawError.message : 'Please try again.');
              })
              .finally(() => setSubmitting(false));
          },
        },
      ],
    );
  }

  const title = kind === 'dashboard'
    ? 'My dashboard'
    : kind === 'home'
      ? 'My apartment and lease'
      : kind === 'rent'
        ? 'Rent and payments'
        : 'Maintenance';
  const displayedError = tenantId
    ? error
    : 'This account is not linked to a tenant profile. Contact your property administrator.';

  const mvpActions = [
    { title: 'My apartment', description: 'Review your lease, unit, and resident details.', onPress: () => router.push('/(tenant)/home') },
    { title: 'Rent overview', description: 'Check rent charges and outstanding balance.', onPress: () => router.push('/(tenant)/rent') },
    { title: 'Pay rent', description: 'Review payment history and complete rent payment.', onPress: () => router.push('/(tenant)/rent') },
    { title: 'Maintenance', description: 'Report issues and track the request status.', onPress: () => router.push('/(tenant)/maintenance') },
  ];

  return (
    <Page title={title} subtitle="Your rental account." refreshing={loading} onRefresh={refresh}>
      {loading ? <Loading /> : null}
      {displayedError ? <ErrorMessage message={displayedError} onRetry={refresh} /> : null}
      {kind === 'dashboard' ? (
        <>
          <Text style={styles.sectionTitle}>MVP release flow</Text>
          {mvpActions.map((action) => (
            <ActionCard key={action.title} title={action.title} description={action.description} onPress={action.onPress} />
          ))}
        </>
      ) : null}
      {tenant && kind !== 'maintenance' ? (
        <Card>
          <Text style={styles.actionTitle}>Hello, {String(tenant.fullName || tenant.firstName || 'Tenant')}</Text>
          {tenant.currentApartment ? (
            <>
              <Text style={styles.subtitle}>{tenant.currentApartment.buildingName} · Unit {tenant.currentApartment.apartmentNumber}</Text>
              <Text style={styles.subtitle}>Monthly rent: {tenant.currentApartment.monthlyRent.toLocaleString()}</Text>
            </>
          ) : (
            <Text style={styles.subtitle}>No active apartment is linked to your profile.</Text>
          )}
        </Card>
      ) : null}
      {outstanding ? (
        <Card>
          <Text style={styles.actionTitle}>Rent balance</Text>
          {Object.entries(outstanding).map(([key, value]) => (
            <Text key={key} style={styles.subtitle}>
              {`${key.replace(/([A-Z])/g, ' $1')}: ${isDateField(key) ? formatDate(value) : String(value)}`}
            </Text>
          ))}
        </Card>
      ) : null}
      {kind === 'home' || kind === 'rent' || kind === 'maintenance' ? (
        <>
          {kind === 'maintenance' ? (
            <Card>
              <Text style={styles.actionTitle}>{editingMaintenanceId ? 'Edit maintenance request' : 'Report a maintenance issue'}</Text>
              {tenant?.currentApartment ? (
                <Text style={styles.subtitle}>
                  {tenant.currentApartment.buildingName} · Unit {tenant.currentApartment.apartmentNumber}
                </Text>
              ) : (
                <Text style={styles.subtitle}>An active apartment is required to submit a request.</Text>
              )}
              {categories.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {categories.map((category) => (
                    <Pressable
                      key={category.id}
                      onPress={() => setSelectedCategoryId(category.id)}
                      style={{
                        backgroundColor: category.id === selectedCategoryId ? '#4338ca' : '#0e1728',
                        borderColor: colors.border,
                        borderRadius: 8,
                        borderWidth: 1,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={{ color: colors.text }}>{category.name}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'].map((priority) => (
                  <Pressable
                    key={priority}
                    onPress={() => setPriorityCode(priority)}
                    style={{
                      backgroundColor: priority === priorityCode ? '#4338ca' : '#0e1728',
                      borderColor: colors.border,
                      borderRadius: 8,
                      borderWidth: 1,
                      padding: 8,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 11 }}>{priority}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                onChangeText={setRequestTitle}
                placeholder="Issue title"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={requestTitle}
              />
              <TextInput
                multiline
                onChangeText={setRequestDescription}
                placeholder="Describe the issue"
                placeholderTextColor={colors.muted}
                style={[styles.input, { minHeight: 92, textAlignVertical: 'top' }]}
                value={requestDescription}
              />
              <Pressable disabled={submitting || (!editingMaintenanceId && !tenant?.currentApartment)} onPress={() => void requestMaintenance()} style={styles.button}>
                <Text style={styles.buttonLabel}>
                  {submitting ? 'Saving...' : editingMaintenanceId ? 'Save changes' : 'Submit request'}
                </Text>
              </Pressable>
              {editingMaintenanceId ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setEditingMaintenanceId(null);
                    setRequestTitle('');
                    setRequestDescription('');
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.buttonLabel}>Cancel editing</Text>
                </Pressable>
              ) : null}
            </Card>
          ) : null}
          <Text style={styles.sectionTitle}>
            {kind === 'home' ? 'Lease history' : kind === 'rent' ? 'Rent charges' : 'Maintenance requests'}
          </Text>
          {!loading && !error && rows.length === 0 ? <Card><Text style={styles.subtitle}>No records found.</Text></Card> : null}
          {rows.map((record, index) => (
            <View key={typeof record.id === 'string' ? record.id : `${kind}-${index}`} style={{ gap: 8 }}>
              <RecordCard record={record} kind={kind === 'maintenance' ? kind : undefined} />
              {kind === 'maintenance' && record.status === 'SUBMITTED' ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={submitting}
                    onPress={() => editMaintenanceRequest(record)}
                    style={[styles.secondaryButton, { flex: 1 }]}
                  >
                    <Text style={styles.buttonLabel}>Edit</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={submitting}
                    onPress={() => confirmWithdrawMaintenanceRequest(record)}
                    style={[styles.secondaryButton, { borderColor: colors.danger, flex: 1 }]}
                  >
                    <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '700' }}>Withdraw</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </>
      ) : null}
      {kind !== 'home' && kind !== 'maintenance' ? (
        <>
          <Text style={styles.sectionTitle}>Payment history and receipts</Text>
          {!loading && !error && payments.length === 0 ? <Card><Text style={styles.subtitle}>No payments recorded yet.</Text></Card> : null}
          {payments.map((record, index) => (
            <RecordCard key={typeof record.id === 'string' ? record.id : `payment-${index}`} record={record} />
          ))}
        </>
      ) : null}
    </Page>
  );
}