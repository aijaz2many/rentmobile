import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { apiRequest } from '../services/api';
import { Card, colors, ErrorMessage, Loading, Page, styles } from './AppUi';
import { RecordCard } from './ModuleScreen';

type DataRecord = Record<string, unknown>;
type TenantProfile = DataRecord & {
  currentApartment?: {
    id: string;
    apartmentNumber: string;
    buildingName: string;
    monthlyRent: number;
  } | null;
};

type ScreenKind = 'dashboard' | 'home' | 'rent' | 'maintenance';
type MaintenanceCategory = { id: string; name: string };

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
    const [tenant, maintenance, lookups] = await Promise.all([
      apiRequest<TenantProfile>(`/tenants/${tenantId}`),
      apiRequest<unknown>('/maintenance'),
      apiRequest<{ categories: MaintenanceCategory[] }>('/maintenance/meta/lookups'),
    ]);
    return { tenant, records: recordsFrom(maintenance, 'requests'), categories: lookups.categories };
  }

  const tenant = await apiRequest<TenantProfile>(`/tenants/${tenantId}`);
  if (kind === 'home') {
    const leases = await apiRequest<unknown>(`/leases?tenantId=${encodeURIComponent(tenantId)}`);
    return { tenant, records: recordsFrom(leases) };
  }
  if (kind === 'rent') {
    const [charges, paymentResult, outstanding] = await Promise.all([
      apiRequest<unknown>('/rent/charges'),
      apiRequest<unknown>(`/payments?tenantId=${encodeURIComponent(tenantId)}`),
      apiRequest<DataRecord>(`/payments/outstanding?tenantId=${encodeURIComponent(tenantId)}`),
    ]);
    return {
      tenant,
      records: recordsFrom(charges),
      payments: recordsFrom(paymentResult, 'payments'),
      outstanding,
    };
  }

  const [outstanding, paymentResult] = await Promise.all([
    apiRequest<DataRecord>(`/payments/outstanding?tenantId=${encodeURIComponent(tenantId)}`),
    apiRequest<unknown>(`/payments?tenantId=${encodeURIComponent(tenantId)}`),
  ]);
  return { tenant, outstanding, payments: recordsFrom(paymentResult, 'payments') };
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

  async function submitMaintenanceRequest() {
    const apartmentId = tenant?.currentApartment?.id;
    if (!tenantId || !apartmentId || !selectedCategoryId || requestTitle.trim().length < 3 || requestDescription.trim().length < 5) {
      Alert.alert('Complete the request', 'Choose a category and enter a title and description for your active apartment.');
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest('/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          apartmentId,
          tenantId,
          categoryId: selectedCategoryId,
          priorityCode,
          title: requestTitle.trim(),
          description: requestDescription.trim(),
        }),
      });
      setRequestTitle('');
      setRequestDescription('');
      await refresh();
      Alert.alert('Request submitted', 'Your maintenance request has been sent to the property manager.');
    } catch (submitError) {
      Alert.alert('Unable to submit request', submitError instanceof Error ? submitError.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
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

  return (
    <Page title={title} subtitle="Your rental account." refreshing={loading} onRefresh={refresh}>
      {loading ? <Loading /> : null}
      {displayedError ? <ErrorMessage message={displayedError} onRetry={refresh} /> : null}
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
            <Text key={key} style={styles.subtitle}>{`${key.replace(/([A-Z])/g, ' $1')}: ${String(value)}`}</Text>
          ))}
        </Card>
      ) : null}
      {kind === 'home' || kind === 'rent' || kind === 'maintenance' ? (
        <>
          {kind === 'maintenance' ? (
            <Card>
              <Text style={styles.actionTitle}>Report a maintenance issue</Text>
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
              <Pressable disabled={submitting || !tenant?.currentApartment} onPress={() => void submitMaintenanceRequest()} style={styles.button}>
                <Text style={styles.buttonLabel}>{submitting ? 'Submitting...' : 'Submit request'}</Text>
              </Pressable>
            </Card>
          ) : null}
          <Text style={styles.sectionTitle}>
            {kind === 'home' ? 'Lease history' : kind === 'rent' ? 'Rent charges' : 'Maintenance requests'}
          </Text>
          {!loading && !error && rows.length === 0 ? <Card><Text style={styles.subtitle}>No records found.</Text></Card> : null}
          {rows.map((record, index) => (
            <RecordCard key={typeof record.id === 'string' ? record.id : `${kind}-${index}`} record={record} />
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
