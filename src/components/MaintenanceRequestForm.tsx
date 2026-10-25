import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { apiRequest } from '../services/api';
import type { MaintenanceCategory, MaintenanceRequestInput, MaintenanceStatus, MaintenanceStatusCode } from '../modules/tenant';
import { colors, ErrorMessage, Loading, styles } from './AppUi';

type DataRecord = Record<string, unknown>;
type ApartmentOption = {
  id: string;
  apartmentNumber: string;
  buildingName: string;
};
type TenantOption = {
  id: string;
  fullName: string;
  currentApartment?: { id: string } | null;
};

function isRecord(value: unknown): value is DataRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordsFrom(payload: unknown): DataRecord[] {
  return Array.isArray(payload) ? payload.filter(isRecord) : [];
}

function isMaintenanceStatusCode(value: unknown): value is MaintenanceStatusCode {
  return typeof value === 'string' && [
    'SUBMITTED',
    'ASSIGNED',
    'IN_PROGRESS',
    'WAITING_FOR_PARTS',
    'COMPLETED',
    'CANCELLED',
  ].some((code) => code === value);
}

export default function MaintenanceRequestForm({
  onSave,
  onCancel,
  initialRecord,
}: {
  onSave: (
    input: MaintenanceRequestInput | Pick<MaintenanceRequestInput, 'categoryId' | 'priorityCode' | 'title' | 'description'>,
    requestId?: string,
  ) => Promise<void>;
  onCancel: () => void;
  initialRecord?: DataRecord | null;
}) {
  const [apartments, setApartments] = useState<ApartmentOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [categories, setCategories] = useState<MaintenanceCategory[]>([]);
  const [statuses, setStatuses] = useState<MaintenanceStatus[]>([]);
  const [apartmentId, setApartmentId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [categoryId, setCategoryId] = useState(
    typeof initialRecord?.categoryId === 'string' ? initialRecord.categoryId : '',
  );
  const [priorityCode, setPriorityCode] = useState(
    typeof initialRecord?.priority === 'string' ? initialRecord.priority : 'MEDIUM',
  );
  const [statusCode, setStatusCode] = useState(
    isMaintenanceStatusCode(initialRecord?.status) ? initialRecord.status : 'SUBMITTED',
  );
  const [title, setTitle] = useState(typeof initialRecord?.title === 'string' ? initialRecord.title : '');
  const [description, setDescription] = useState(
    typeof initialRecord?.description === 'string' ? initialRecord.description : '',
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const optionRequests = initialRecord
      ? Promise.all([
          Promise.resolve([] as DataRecord[]),
          Promise.resolve([] as DataRecord[]),
          apiRequest<{ categories?: MaintenanceCategory[]; statuses?: MaintenanceStatus[] }>('/maintenance/meta/lookups'),
        ])
      : Promise.all([
          apiRequest<unknown>('/apartments').then(recordsFrom),
          apiRequest<unknown>('/tenants').then(recordsFrom),
          apiRequest<{ categories?: MaintenanceCategory[]; statuses?: MaintenanceStatus[] }>('/maintenance/meta/lookups'),
        ]);
    optionRequests
      .then(([apartmentRecords, tenantRecords, lookupPayload]) => {
        if (!active) return;
        const apartmentOptions = apartmentRecords
          .filter((record) => typeof record.id === 'string')
          .map((record) => ({
            id: String(record.id),
            apartmentNumber: String(record.apartmentNumber ?? ''),
            buildingName: String(record.buildingName ?? ''),
          }));
        const tenantOptions = tenantRecords
          .filter((record) => typeof record.id === 'string')
          .map((record) => ({
            id: String(record.id),
            fullName: String(record.fullName ?? [record.firstName, record.lastName].filter(Boolean).join(' ')),
            currentApartment: isRecord(record.currentApartment) && typeof record.currentApartment.id === 'string'
              ? { id: record.currentApartment.id }
              : null,
          }));
        const availableCategories = Array.isArray(lookupPayload.categories) ? lookupPayload.categories : [];
        const availableStatuses = Array.isArray(lookupPayload.statuses) ? lookupPayload.statuses : [];
        setApartments(apartmentOptions);
        setTenants(tenantOptions);
        setCategories(availableCategories);
        setStatuses(availableStatuses);
        setCategoryId((current) => current || availableCategories[0]?.id || '');
        if (!initialRecord && availableStatuses[0] && isMaintenanceStatusCode(availableStatuses[0].code)) {
          setStatusCode(availableStatuses[0].code);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load maintenance options.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [initialRecord]);

  const apartmentTenants = useMemo(
    () => tenants.filter((tenant) => tenant.currentApartment?.id === apartmentId),
    [apartmentId, tenants],
  );

  async function submit() {
    if ((!initialRecord && (!apartmentId || !tenantId)) || !categoryId || title.trim().length < 3 || description.trim().length < 5) {
      setError(initialRecord
        ? 'Choose a category and enter a title and description.'
        : 'Choose an apartment, tenant, and category, then enter a title and description.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const requestDetails = {
        categoryId,
        priorityCode,
        title: title.trim(),
        description: description.trim(),
        ...(initialRecord ? { statusCode } : {}),
      };
      await onSave(initialRecord ? requestDetails : {
        ...requestDetails,
        apartmentId,
        tenantId,
      }, typeof initialRecord?.id === 'string' ? initialRecord.id : undefined);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create maintenance request.');
    } finally {
      setSaving(false);
    }
  }

  function optionButton(label: string, selected: boolean, onPress: () => void, key: string) {
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        onPress={onPress}
        style={{
          backgroundColor: selected ? '#252e50' : colors.surface,
          borderColor: selected ? colors.accent : colors.border,
          borderRadius: 10,
          borderWidth: 1,
          padding: 12,
        }}
      >
        <Text style={{ color: colors.text }}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {loading ? <Loading message="Loading maintenance options..." /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {!loading && !initialRecord ? (
        <>
          <Text style={styles.label}>Apartment *</Text>
          <View style={{ gap: 8 }}>
            {apartments.map((apartment) => optionButton(
              `${apartment.buildingName} · Unit ${apartment.apartmentNumber}`,
              apartment.id === apartmentId,
              () => {
                setApartmentId(apartment.id);
                setTenantId('');
              },
              apartment.id,
            ))}
            {apartments.length === 0 ? <Text style={styles.subtitle}>No apartments available.</Text> : null}
          </View>
          <Text style={styles.label}>Tenant *</Text>
          <View style={{ gap: 8 }}>
            {apartmentTenants.map((tenant) => optionButton(
              tenant.fullName,
              tenant.id === tenantId,
              () => setTenantId(tenant.id),
              tenant.id,
            ))}
            {apartmentId && apartmentTenants.length === 0
              ? <Text style={styles.subtitle}>No active tenant is linked to this apartment.</Text>
              : null}
          </View>
          <Text style={styles.label}>Category *</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {categories.map((category) => optionButton(
              category.name,
              category.id === categoryId,
              () => setCategoryId(category.id),
              category.id,
            ))}
          </View>
          <Text style={styles.label}>Priority</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'].map((priority) => optionButton(
              priority,
              priority === priorityCode,
              () => setPriorityCode(priority),
              priority,
            ))}
          </View>
          <TextInput
            onChangeText={setTitle}
            placeholder="Issue title"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={title}
          />
          <TextInput
            multiline
            onChangeText={setDescription}
            placeholder="Describe the issue"
            placeholderTextColor={colors.muted}
            style={[styles.input, { minHeight: 92, textAlignVertical: 'top' }]}
            value={description}
          />
        </>
      ) : null}
      {!loading && initialRecord ? (
        <>
          <Text style={styles.label}>Request status *</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {statuses.map((status) => optionButton(
              status.name,
              status.code === statusCode,
              () => setStatusCode(status.code),
              status.id,
            ))}
          </View>
          <Text style={styles.label}>Category *</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {categories.map((category) => optionButton(
              category.name,
              category.id === categoryId,
              () => setCategoryId(category.id),
              category.id,
            ))}
          </View>
          <Text style={styles.label}>Priority</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'].map((priority) => optionButton(
              priority,
              priority === priorityCode,
              () => setPriorityCode(priority),
              priority,
            ))}
          </View>
          <TextInput
            onChangeText={setTitle}
            placeholder="Issue title"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={title}
          />
          <TextInput
            multiline
            onChangeText={setDescription}
            placeholder="Describe the issue"
            placeholderTextColor={colors.muted}
            style={[styles.input, { minHeight: 92, textAlignVertical: 'top' }]}
            value={description}
          />
        </>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          disabled={saving || loading}
          onPress={() => void submit()}
          style={[styles.button, { flex: 1, opacity: saving || loading ? 0.6 : 1 }]}
        >
          <Text style={styles.buttonLabel}>{saving ? 'Saving...' : initialRecord ? 'Save changes' : 'Create request'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.secondaryButton, { flex: 1 }]}>
          <Text style={styles.buttonLabel}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
