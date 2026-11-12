import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiRequest, invalidateApiCache } from '../services/api';
import { formatDate, parseDateInput } from '../lib/date';
import { filterRentCharges, summarizeRentCharges } from '../lib/rentCharges';
import { Card, colors, ErrorMessage, Loading, Page, styles } from './AppUi';

type DataRecord = Record<string, unknown>;
type PropertyOption = { id: string; name: string };
type BuildingOption = { id: string; name: string; propertyId: string };
type ApartmentOption = { id: string; buildingId: string };
type StatusOption = { code: string; name: string };
type PaymentMethodOption = { code: string; name: string };
type RentCharge = DataRecord & {
  id: string;
  propertyId?: string;
  propertyName?: string;
  buildingId?: string;
  buildingName?: string;
  apartmentId?: string;
  apartmentNumber?: string;
  tenantId?: string | null;
  tenantName?: string;
  dueDate?: string;
  status?: string;
  statusName?: string;
  rentAmount?: number;
  lateFee?: number;
  totalAmount?: number;
  paidAmount?: number;
  pendingAmount?: number;
  payments?: DataRecord[];
};

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const statusColors: Record<string, { background: string; text: string }> = {
  PAID: { background: '#14532d', text: '#86efac' },
  PENDING: { background: '#78350f', text: '#fcd34d' },
  PARTIALLY_PAID: { background: '#713f12', text: '#fde68a' },
  OVERDUE: { background: '#7f1d1d', text: '#fca5a5' },
  CANCELLED: { background: '#334155', text: '#cbd5e1' },
};

function isRecord(value: unknown): value is DataRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordsFrom(payload: unknown, key?: string): DataRecord[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  const nested = key ? payload[key] : undefined;
  return Array.isArray(nested) ? nested.filter(isRecord) : [];
}

function amountOf(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function statusLabel(charge: RentCharge): string {
  return charge.statusName || String(charge.status || 'UNKNOWN').replaceAll('_', ' ');
}

function ChargeStatus({ charge }: { charge: RentCharge }) {
  const appearance = statusColors[charge.status ?? ''] ?? { background: colors.border, text: colors.text };
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: appearance.background, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ color: appearance.text, fontSize: 12, fontWeight: '700' }}>{statusLabel(charge)}</Text>
    </View>
  );
}

function FilterButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.secondaryButton, { flex: 1, minWidth: 105, paddingHorizontal: 10 }]}
    >
      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{label}: {value}</Text>
    </Pressable>
  );
}

export default function RentChargesScreen() {
  const [charges, setCharges] = useState<RentCharge[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyFilter, setPropertyFilter] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterModal, setFilterModal] = useState<'property' | 'building' | 'status' | 'month' | null>(null);
  const [selectedCharge, setSelectedCharge] = useState<RentCharge | null>(null);
  const [generationVisible, setGenerationVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const now = new Date();
  const [billingMonth, setBillingMonth] = useState(now.getMonth() + 1);
  const [billingYear, setBillingYear] = useState(String(now.getFullYear()));
  const [generationPropertyId, setGenerationPropertyId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [editRentAmount, setEditRentAmount] = useState('');
  const [editLateFee, setEditLateFee] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodCode, setPaymentMethodCode] = useState('UPI');
  const [transactionId, setTransactionId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const loadData = useCallback(async (): Promise<RentCharge[]> => {
    const results = await Promise.all([
      apiRequest<unknown>('/rent/charges'),
      apiRequest<unknown>('/properties'),
      apiRequest<unknown>('/apartments'),
      apiRequest<{ statuses?: StatusOption[]; methods?: PaymentMethodOption[] }>('/rent/meta/lookups'),
    ]);
    const loadedCharges = recordsFrom(results[0]).filter(
      (record): record is RentCharge => typeof record.id === 'string',
    );
    const propertyRows = recordsFrom(results[1]);
    const propertyOptions: PropertyOption[] = [];
    const buildingOptions: BuildingOption[] = [];
    const buildingById = new Map<string, BuildingOption>();
    const apartmentRows = recordsFrom(results[2]);
    const apartmentById = new Map<string, ApartmentOption>();
    for (const property of propertyRows) {
      if (typeof property.id !== 'string') continue;
      propertyOptions.push({ id: property.id, name: String(property.name ?? 'Property') });
      const propertyBuildings = Array.isArray(property.tsmib_buildings) ? property.tsmib_buildings : [];
      for (const building of propertyBuildings) {
        if (!isRecord(building) || typeof building.id !== 'string') continue;
        const buildingOption = {
          id: building.id,
          name: String(building.name ?? 'Building'),
          propertyId: property.id,
        };
        buildingOptions.push(buildingOption);
        buildingById.set(buildingOption.id, buildingOption);
      }
    }
    for (const apartment of apartmentRows) {
      if (typeof apartment.id !== 'string' || typeof apartment.buildingId !== 'string') continue;
      apartmentById.set(apartment.id, { id: apartment.id, buildingId: apartment.buildingId });
    }
    const enrichedCharges = loadedCharges.map((charge) => {
      const buildingId = charge.buildingId ??
        (charge.apartmentId ? apartmentById.get(charge.apartmentId)?.buildingId : undefined);
      const building = buildingId ? buildingById.get(buildingId) : undefined;
      const propertyId = charge.propertyId ?? building?.propertyId;
      const propertyName = charge.propertyName ??
        propertyOptions.find((property) => property.id === propertyId)?.name;
      const buildingName = charge.buildingName ?? building?.name;
      return { ...charge, buildingId, buildingName, propertyId, propertyName };
    });
    setCharges(enrichedCharges);
    setProperties(propertyOptions);
    setBuildings(buildingOptions);
    const lookups = isRecord(results[3]) ? results[3] : {};
    setStatuses(Array.isArray(lookups.statuses) ? lookups.statuses.filter(isRecord).map((status) => ({
      code: String(status.code),
      name: String(status.name),
    })) : []);
    const methods = Array.isArray(lookups.methods) ? lookups.methods.filter(isRecord).map((method) => ({
      code: String(method.code),
      name: String(method.name),
    })) : [];
    setPaymentMethods(methods);
    if (methods.length > 0) setPaymentMethodCode((current) => methods.some((method) => method.code === current) ? current : methods[0].code);
    return enrichedCharges;
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => loadData())
      .then(() => { if (active) setError(null); })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load rent charges.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadData]);

  const refresh = async () => {
    invalidateApiCache();
    setLoading(true);
    setError(null);
    try {
      await loadData();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load rent charges.');
    } finally {
      setLoading(false);
    }
  };

  const visibleBuildings = useMemo(
    () => buildings.filter((building) => !propertyFilter || building.propertyId === propertyFilter),
    [buildings, propertyFilter],
  );
  const filteredCharges = useMemo(
    () => filterRentCharges(charges, {
      propertyId: propertyFilter,
      buildingId: buildingFilter,
      status: statusFilter,
      month: monthFilter,
      search: searchText,
    }),
    [buildingFilter, charges, monthFilter, propertyFilter, searchText, statusFilter],
  );

  const summary = useMemo(() => summarizeRentCharges(filteredCharges), [filteredCharges]);

  function openEdit(charge: RentCharge) {
    setSelectedCharge(charge);
    setEditRentAmount(String(charge.rentAmount ?? ''));
    setEditLateFee(String(charge.lateFee ?? 0));
    setEditDueDate(charge.dueDate ? formatDate(charge.dueDate) : '');
    setEditVisible(true);
  }

  async function saveChargeEdit() {
    if (!selectedCharge) return;
    const rentAmount = Number(editRentAmount);
    const lateFee = Number(editLateFee || 0);
    const dueDate = parseDateInput(editDueDate);
    if (!Number.isFinite(rentAmount) || rentAmount <= 0 || !Number.isFinite(lateFee) || lateFee < 0 || !dueDate) {
      Alert.alert('Check charge details', 'Enter a valid rent amount, late fee, and due date (dd-MMM-YYYY).');
      return;
    }
    setSavingEdit(true);
    try {
      const result = await apiRequest<{ charge: Partial<RentCharge> }>(`/rent/charges/${encodeURIComponent(selectedCharge.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ rentAmount, lateFee, dueDate }),
      });
      const saved = result.charge;
      if (
        saved.id !== selectedCharge.id
        || Number(saved.rentAmount) !== rentAmount
        || Number(saved.lateFee) !== lateFee
        || !saved.dueDate
        || String(saved.dueDate).slice(0, 10) !== dueDate
      ) {
        throw new Error('The server did not confirm the requested rent charge values.');
      }
      const updatedCharge = {
        ...selectedCharge,
        rentAmount,
        lateFee,
        totalAmount: Number(saved.totalAmount),
        dueDate: String(saved.dueDate),
        pendingAmount: Number(saved.pendingAmount),
      };
      setCharges((current) => current.map((charge) => charge.id === updatedCharge.id ? updatedCharge : charge));
      setSelectedCharge(updatedCharge);
      setEditVisible(false);
      Alert.alert('Charge updated', 'Rent charge details were saved.');
    } catch (saveError) {
      Alert.alert('Unable to update charge', saveError instanceof Error ? saveError.message : 'Please try again.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function generateCharges() {
    const year = Number(billingYear);
    if (!Number.isInteger(year) || year < 2020 || year > 2100) {
      Alert.alert('Invalid billing year', 'Enter a year from 2020 to 2100.');
      return;
    }
    setGenerating(true);
    try {
      const result = await apiRequest<DataRecord>('/rent/generate-charges', {
        method: 'POST',
        body: JSON.stringify({
          billingYear: year,
          billingMonth,
          prorate: true,
          ...(generationPropertyId ? { propertyId: generationPropertyId } : {}),
        }),
      });
      setGenerationVisible(false);
      await loadData();
      Alert.alert(
        'Rent generation complete',
        `${String(result.chargesCreated ?? 0)} charges created; ${String(result.chargesSkipped ?? 0)} skipped for ${months[billingMonth - 1]} ${year}.`,
      );
    } catch (generationError) {
      Alert.alert('Unable to generate charges', generationError instanceof Error ? generationError.message : 'Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  function openPayment(charge: RentCharge) {
    setSelectedCharge(charge);
    setPaymentAmount(amountOf(charge.pendingAmount).toFixed(2));
    setTransactionId('');
    setPaymentNotes('');
    setPaymentVisible(true);
  }

  async function recordPayment() {
    if (!selectedCharge?.tenantId || !selectedCharge.apartmentId) {
      Alert.alert('Payment unavailable', 'This rent charge is not linked to a tenant and apartment.');
      return;
    }
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > amountOf(selectedCharge.pendingAmount)) {
      Alert.alert('Invalid payment amount', 'Enter an amount greater than zero and no more than the remaining balance.');
      return;
    }
    setSavingPayment(true);
    try {
      await apiRequest('/rent/payments', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: selectedCharge.tenantId,
          apartmentId: selectedCharge.apartmentId,
          rentChargeId: selectedCharge.id,
          amount,
          paymentMethodCode,
          transactionId: transactionId.trim() || null,
          notes: paymentNotes.trim() || null,
        }),
      });
      setPaymentVisible(false);
      const refreshedCharges = await loadData();
      setSelectedCharge(refreshedCharges.find((charge) => charge.id === selectedCharge.id) ?? null);
      Alert.alert('Payment recorded', 'The payment and receipt were saved.');
    } catch (paymentError) {
      Alert.alert('Unable to record payment', paymentError instanceof Error ? paymentError.message : 'Please try again.');
    } finally {
      setSavingPayment(false);
    }
  }

  const modalOptions = filterModal === 'property'
    ? [{ id: '', name: 'All properties' }, ...properties]
    : filterModal === 'building'
      ? [{ id: '', name: 'All buildings' }, ...visibleBuildings]
      : filterModal === 'status'
        ? [{ id: '', name: 'All statuses' }, ...statuses.map((status) => ({ id: status.code, name: status.name }))]
        : [{ id: '', name: 'All months' }, ...months.map((name, index) => ({ id: String(index + 1), name }))];
  const currentFilterValue = filterModal === 'property'
    ? propertyFilter
    : filterModal === 'building'
      ? buildingFilter
      : filterModal === 'status'
        ? statusFilter
        : monthFilter;
  const setFilterValue = filterModal === 'property'
    ? setPropertyFilter
    : filterModal === 'building'
      ? setBuildingFilter
      : filterModal === 'status'
        ? setStatusFilter
        : setMonthFilter;
  const selectedPropertyName = properties.find((property) => property.id === propertyFilter)?.name ?? 'All';
  const selectedBuildingName = buildings.find((building) => building.id === buildingFilter)?.name ?? 'All';
  const selectedStatusName = statuses.find((status) => status.code === statusFilter)?.name ?? 'All';
  const selectedMonthName = monthFilter ? months[Number(monthFilter) - 1] ?? 'All' : 'All';

  return (
    <Page
      title="Rent Charges"
      subtitle="Track and manage monthly rent charges."
      refreshing={loading}
      onRefresh={() => void refresh()}
    >
      {loading ? <Loading /> : null}
      {error ? <ErrorMessage message={error} onRetry={() => void refresh()} /> : null}
      {!loading && !error ? (
        <>
          <Card style={{ backgroundColor: '#172c4a' }}>
            <Text style={styles.label}>Total rent charges</Text>
            <Text style={styles.metricValue}>{currency.format(summary.totalAmount)}</Text>
            <Text style={styles.subtitle}>{summary.totalCount} charges · {summary.paidCount} paid · {summary.pendingCount} pending</Text>
          </Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Card style={{ flex: 1, minWidth: '46%' }}>
              <Text style={{ color: '#86efac', fontWeight: '700' }}>Paid · {summary.paidCount}</Text>
              <Text style={styles.actionTitle}>{currency.format(summary.paidAmount)}</Text>
            </Card>
            <Card style={{ flex: 1, minWidth: '46%' }}>
              <Text style={{ color: '#fcd34d', fontWeight: '700' }}>Pending · {summary.pendingCount}</Text>
              <Text style={styles.actionTitle}>{currency.format(summary.pendingAmount)}</Text>
            </Card>
            <Card style={{ flex: 1, minWidth: '46%' }}>
              <Text style={{ color: '#fca5a5', fontWeight: '700' }}>Overdue · {summary.overdueCount}</Text>
              <Text style={styles.actionTitle}>{currency.format(summary.overdueAmount)}</Text>
            </Card>
            <Card style={{ flex: 1, minWidth: '46%' }}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Total · {summary.totalCount}</Text>
              <Text style={styles.actionTitle}>{currency.format(summary.totalAmount)}</Text>
            </Card>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <FilterButton label="Property" value={selectedPropertyName} onPress={() => setFilterModal('property')} />
            <FilterButton label="Building" value={selectedBuildingName} onPress={() => setFilterModal('building')} />
            <FilterButton label="Status" value={selectedStatusName} onPress={() => setFilterModal('status')} />
            <FilterButton label="Month" value={selectedMonthName} onPress={() => setFilterModal('month')} />
          </View>
          <View style={[styles.row, { marginTop: 6 }]}>
            <Text style={styles.sectionTitle}>Rent charges</Text>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={searchVisible ? 'Close rent charge search' : 'Search rent charges'}
                onPress={() => {
                  setSearchVisible((visible) => {
                    if (visible) setSearchText('');
                    return !visible;
                  });
                }}
                style={[styles.secondaryButton, { height: 48, justifyContent: 'center' }]}
              >
                <Text style={{ color: colors.text, fontWeight: '600' }}>{searchVisible ? 'Close search' : 'Search'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Generate monthly rent charges"
                onPress={() => setGenerationVisible(true)}
                style={[styles.button, { borderRadius: 28, height: 48, justifyContent: 'center', width: 48 }]}
              >
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '600' }}>+</Text>
              </Pressable>
            </View>
          </View>
          {searchVisible ? (
            <TextInput
              accessibilityLabel="Search rent charges"
              autoCapitalize="none"
              onChangeText={setSearchText}
              placeholder="Tenant, apartment, property, month..."
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={searchText}
            />
          ) : null}
          {filteredCharges.length === 0 ? (
            <Card><Text style={styles.subtitle}>No rent charges match these filters. Generate charges for a billing month to get started.</Text></Card>
          ) : null}
          {filteredCharges.map((charge) => (
            <Pressable
              key={charge.id}
              accessibilityRole="button"
              onPress={() => setSelectedCharge(charge)}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <Card>
                <View style={[styles.row, { alignItems: 'flex-start' }]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.actionTitle}>{charge.propertyName || 'Property'}</Text>
                    <Text style={styles.subtitle}>{charge.buildingName || 'Building'} · Apt {charge.apartmentNumber || '—'}</Text>
                    <Text style={styles.subtitle}>{charge.tenantName || 'Tenant'} · Due {charge.dueDate ? formatDate(charge.dueDate) : '—'}</Text>
                    <Text style={styles.subtitle}>{months[Math.max(0, Math.min(11, Number(charge.billingMonth) - 1))]} {String(charge.billingYear ?? '')}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <Text style={styles.actionTitle}>{currency.format(amountOf(charge.totalAmount))}</Text>
                    <ChargeStatus charge={charge} />
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </>
      ) : null}

      <Modal visible={filterModal !== null} transparent animationType="fade" onRequestClose={() => setFilterModal(null)}>
        <View style={{ backgroundColor: 'rgba(2, 6, 23, 0.78)', flex: 1, justifyContent: 'center', padding: 20 }}>
          <Card style={{ maxHeight: '80%' }}>
            <Text style={styles.actionTitle}>
              {filterModal === 'property'
                ? 'Filter by property'
                : filterModal === 'building'
                  ? 'Filter by building'
                  : filterModal === 'status'
                    ? 'Filter by status'
                    : 'Filter by month'}
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {modalOptions.map((option) => (
                <Pressable
                  key={option.id || 'all'}
                  accessibilityRole="button"
                  onPress={() => {
                    setFilterValue(option.id);
                    if (filterModal === 'property' && buildingFilter && !buildings.some((building) => building.id === buildingFilter && building.propertyId === option.id)) {
                      setBuildingFilter('');
                    }
                    setFilterModal(null);
                  }}
                  style={[styles.secondaryButton, { marginTop: 8 }]}
                >
                  <Text style={{ color: option.id === currentFilterValue ? colors.accent : colors.text }}>{option.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setFilterModal(null)} style={styles.secondaryButton}><Text style={styles.buttonLabel}>Close</Text></Pressable>
          </Card>
        </View>
      </Modal>

      <Modal visible={generationVisible} transparent animationType="fade" onRequestClose={() => setGenerationVisible(false)}>
        <View style={{ backgroundColor: 'rgba(2, 6, 23, 0.78)', flex: 1, justifyContent: 'center', padding: 20 }}>
          <Card>
            <Text style={styles.actionTitle}>Generate monthly rent charges</Text>
            <Text style={styles.label}>Billing month</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {months.map((month, index) => (
                <Pressable
                  key={month}
                  accessibilityRole="button"
                  onPress={() => setBillingMonth(index + 1)}
                  style={[styles.secondaryButton, { backgroundColor: billingMonth === index + 1 ? '#252e50' : colors.surface, padding: 8 }]}
                >
                  <Text style={{ color: colors.text, fontSize: 12 }}>{month.slice(0, 3)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Billing year</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setBillingYear}
              placeholder="Year"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={billingYear}
            />
            <Text style={styles.label}>Property (optional)</Text>
            <ScrollView style={{ maxHeight: 130 }}>
              <Pressable onPress={() => setGenerationPropertyId('')} style={styles.secondaryButton}>
                <Text style={{ color: colors.text }}>All properties</Text>
              </Pressable>
              {properties.map((property) => (
                <Pressable
                  key={property.id}
                  onPress={() => setGenerationPropertyId(property.id)}
                  style={[styles.secondaryButton, { marginTop: 6, borderColor: generationPropertyId === property.id ? colors.accent : colors.border }]}
                >
                  <Text style={{ color: colors.text }}>{property.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.subtitle}>Existing charges for this month will be skipped; charges are generated from active leases.</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable disabled={generating} onPress={() => void generateCharges()} style={[styles.button, { flex: 1, opacity: generating ? 0.6 : 1 }]}>
                <Text style={styles.buttonLabel}>{generating ? 'Generating...' : 'Generate charges'}</Text>
              </Pressable>
              <Pressable onPress={() => setGenerationVisible(false)} style={[styles.secondaryButton, { flex: 1 }]}>
                <Text style={styles.buttonLabel}>Close</Text>
              </Pressable>
            </View>
          </Card>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedCharge) && !editVisible && !paymentVisible} transparent animationType="slide" onRequestClose={() => setSelectedCharge(null)}>
        {selectedCharge ? (
          <View style={{ backgroundColor: 'rgba(2, 6, 23, 0.82)', flex: 1, justifyContent: 'flex-end' }}>
            <ScrollView style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%' }} contentContainerStyle={{ gap: 12, padding: 20 }}>
              <View style={[styles.row, { alignItems: 'flex-start' }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.pageTitle}>{selectedCharge.propertyName || 'Rent charge'}</Text>
                  <Text style={styles.subtitle}>{selectedCharge.buildingName} · Apt {selectedCharge.apartmentNumber}</Text>
                  <Text style={styles.subtitle}>{selectedCharge.tenantName}</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => setSelectedCharge(null)}><Text style={{ color: colors.accent }}>Close</Text></Pressable>
              </View>
              <Card>
                <ChargeStatus charge={selectedCharge} />
                <Text style={styles.subtitle}>Billing period: {months[Math.max(0, Math.min(11, Number(selectedCharge.billingMonth) - 1))]} {String(selectedCharge.billingYear ?? '')}</Text>
                <Text style={styles.subtitle}>Due: {selectedCharge.dueDate ? formatDate(selectedCharge.dueDate) : '—'}</Text>
                <Text style={styles.subtitle}>Rent: {currency.format(amountOf(selectedCharge.rentAmount))}</Text>
                <Text style={styles.subtitle}>Late fee: {currency.format(amountOf(selectedCharge.lateFee))}</Text>
                <Text style={styles.subtitle}>Total: {currency.format(amountOf(selectedCharge.totalAmount))}</Text>
                <Text style={styles.subtitle}>Paid: {currency.format(amountOf(selectedCharge.paidAmount))}</Text>
                <Text style={styles.subtitle}>Remaining: {currency.format(amountOf(selectedCharge.pendingAmount))}</Text>
              </Card>
              <Text style={styles.sectionTitle}>Payment history</Text>
              {(selectedCharge.payments ?? []).length === 0
                ? <Card><Text style={styles.subtitle}>No payments allocated to this charge.</Text></Card>
                : (selectedCharge.payments ?? []).map((payment, index) => (
                    <Card key={String(payment.id ?? index)}>
                      <Text style={styles.actionTitle}>{currency.format(amountOf(payment.amount))} allocated</Text>
                      <Text style={styles.subtitle}>{String(payment.method ?? 'Payment')} · {payment.paymentDate ? formatDate(payment.paymentDate) : ''}</Text>
                      {payment.paymentReference ? <Text style={styles.subtitle}>Reference: {String(payment.paymentReference)}</Text> : null}
                      {payment.receiptNumber ? <Text style={styles.subtitle}>Receipt: {String(payment.receiptNumber)}</Text> : null}
                    </Card>
                  ))}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {selectedCharge.status !== 'PAID' && selectedCharge.status !== 'CANCELLED' ? (
                  <>
                    <Pressable onPress={() => openEdit(selectedCharge)} style={[styles.secondaryButton, { flex: 1 }]}>
                      <Text style={styles.buttonLabel}>Edit charge</Text>
                    </Pressable>
                    {amountOf(selectedCharge.pendingAmount) > 0 && selectedCharge.tenantId ? (
                      <Pressable onPress={() => openPayment(selectedCharge)} style={[styles.button, { flex: 1 }]}>
                        <Text style={styles.buttonLabel}>Record payment</Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : null}
              </View>
            </ScrollView>
          </View>
        ) : null}
      </Modal>

      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <View style={{ backgroundColor: 'rgba(2, 6, 23, 0.78)', flex: 1, justifyContent: 'center', padding: 20 }}>
          <Card>
            <Text style={styles.actionTitle}>Edit rent charge</Text>
            <Text style={styles.label}>Due date (dd-MMM-YYYY)</Text>
            <TextInput onChangeText={setEditDueDate} placeholder="05-Jan-2026" placeholderTextColor={colors.muted} style={styles.input} value={editDueDate} />
            <Text style={styles.label}>Rent amount</Text>
            <TextInput keyboardType="decimal-pad" onChangeText={setEditRentAmount} placeholder="Rent amount" placeholderTextColor={colors.muted} style={styles.input} value={editRentAmount} />
            <Text style={styles.label}>Late fee</Text>
            <TextInput keyboardType="decimal-pad" onChangeText={setEditLateFee} placeholder="Late fee" placeholderTextColor={colors.muted} style={styles.input} value={editLateFee} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable disabled={savingEdit} onPress={() => void saveChargeEdit()} style={[styles.button, { flex: 1, opacity: savingEdit ? 0.6 : 1 }]}>
                <Text style={styles.buttonLabel}>{savingEdit ? 'Saving...' : 'Save changes'}</Text>
              </Pressable>
              <Pressable onPress={() => setEditVisible(false)} style={[styles.secondaryButton, { flex: 1 }]}><Text style={styles.buttonLabel}>Cancel</Text></Pressable>
            </View>
          </Card>
        </View>
      </Modal>

      <Modal visible={paymentVisible} transparent animationType="fade" onRequestClose={() => setPaymentVisible(false)}>
        <View style={{ backgroundColor: 'rgba(2, 6, 23, 0.78)', flex: 1, justifyContent: 'center', padding: 20 }}>
          <Card>
            <Text style={styles.actionTitle}>Record payment</Text>
            <Text style={styles.subtitle}>Remaining balance: {currency.format(amountOf(selectedCharge?.pendingAmount))}</Text>
            <TextInput keyboardType="decimal-pad" onChangeText={setPaymentAmount} placeholder="Payment amount" placeholderTextColor={colors.muted} style={styles.input} value={paymentAmount} />
            <Text style={styles.label}>Payment method</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {paymentMethods.map((method) => (
                <Pressable
                  key={method.code}
                  onPress={() => setPaymentMethodCode(method.code)}
                  style={[styles.secondaryButton, { backgroundColor: paymentMethodCode === method.code ? '#252e50' : colors.surface }]}
                >
                  <Text style={{ color: colors.text }}>{method.name}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput onChangeText={setTransactionId} placeholder="Transaction/reference ID (optional)" placeholderTextColor={colors.muted} style={styles.input} value={transactionId} />
            <TextInput onChangeText={setPaymentNotes} placeholder="Notes (optional)" placeholderTextColor={colors.muted} style={styles.input} value={paymentNotes} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable disabled={savingPayment} onPress={() => void recordPayment()} style={[styles.button, { flex: 1, opacity: savingPayment ? 0.6 : 1 }]}>
                <Text style={styles.buttonLabel}>{savingPayment ? 'Recording...' : 'Save payment'}</Text>
              </Pressable>
              <Pressable onPress={() => setPaymentVisible(false)} style={[styles.secondaryButton, { flex: 1 }]}><Text style={styles.buttonLabel}>Cancel</Text></Pressable>
            </View>
          </Card>
        </View>
      </Modal>
    </Page>
  );
}
