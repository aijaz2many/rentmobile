import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { apiRequest } from '../services/api';
import { formatDate, isDateField, parseDateInput } from '../lib/date';
import { colors, ErrorMessage, Loading, styles } from './AppUi';

type DataRecord = Record<string, unknown>;

type Field = {
  key: string;
  label: string;
  required?: boolean;
  numeric?: boolean;
  emptyAsZero?: boolean;
  optionsEndpoint?: string;
  options?: string[];
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formDefinitions: Record<string, { fields: Field[] }> = {
  properties: {
    fields: [
      { key: 'name', label: 'Property name', required: true },
      { key: 'code', label: 'Property code' },
      { key: 'addressLine1', label: 'Address line 1' },
      { key: 'addressLine2', label: 'Address line 2' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'country', label: 'Country', required: true },
      { key: 'postalCode', label: 'Postal code' },
      { key: 'description', label: 'Description' },
    ],
  },
  buildings: {
    fields: [
      { key: 'propertyId', label: 'Property', required: true, optionsEndpoint: '/properties' },
      { key: 'name', label: 'Building name', required: true },
      { key: 'code', label: 'Building code' },
      { key: 'numberOfFloors', label: 'Number of floors', numeric: true },
      { key: 'description', label: 'Description' },
    ],
  },
  leases: {
    fields: [
      { key: 'tenantId', label: 'Tenant', required: true, optionsEndpoint: '/tenants' },
      { key: 'apartmentId', label: 'Apartment', required: true, optionsEndpoint: '/apartments' },
      { key: 'startDate', label: 'Start date (dd-MMM-YYYY)', required: true },
      { key: 'endDate', label: 'End date (dd-MMM-YYYY)' },
      { key: 'monthlyRent', label: 'Monthly rent', required: true, numeric: true },
      { key: 'securityDeposit', label: 'Security deposit', numeric: true },
      { key: 'rentDueDay', label: 'Rent due day', numeric: true },
      { key: 'lateFee', label: 'Late fee', numeric: true, emptyAsZero: true },
      { key: 'status', label: 'Lease status', options: ['ACTIVE', 'EXPIRED', 'TERMINATED'] },
    ],
  },
  expenses: {
    fields: [
      { key: 'categoryId', label: 'Category', optionsEndpoint: '/expenses/categories' },
      { key: 'amount', label: 'Amount', required: true, numeric: true },
      { key: 'expenseDate', label: 'Expense date (dd-MMM-YYYY)', required: true },
      { key: 'vendorName', label: 'Vendor name' },
      { key: 'invoiceNumber', label: 'Invoice number' },
      { key: 'description', label: 'Description' },
    ],
  },
};

function isRecord(value: unknown): value is DataRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rowsFrom(payload: unknown): DataRecord[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  const nested = Object.values(payload).find(Array.isArray);
  return Array.isArray(nested) ? nested.filter(isRecord) : [];
}

function optionLabel(record: DataRecord): string {
  const name = record.name ?? record.fullName;
  if (name) return String(name);
  const personName = [record.firstName, record.lastName].filter(Boolean).join(' ');
  if (personName) return personName;
  if (record.apartmentNumber) {
    const buildingName = typeof record.buildingName === 'string' ? record.buildingName : '';
    return buildingName ? `${buildingName} · ${String(record.apartmentNumber)}` : String(record.apartmentNumber);
  }
  return String(record.id ?? 'Record');
}

function initialValues(kind: string, record: DataRecord | null): Record<string, string> {
  const fields = formDefinitions[kind]?.fields ?? [];
  return Object.fromEntries(fields.map(({ key }) => {
    const snakeCaseKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    const value = record?.[key] ?? record?.[snakeCaseKey];
    const text = value === null || value === undefined
      ? kind === 'properties' && key === 'country' ? 'India' : ''
      : String(value);
    return [key, isDateField(key) ? formatDate(text) : text];
  }));
}

export function supportsCoreRecordForm(kind: string): boolean {
  return Boolean(formDefinitions[kind]);
}

export default function CoreRecordForm({
  kind,
  record,
  onSave,
  onCancel,
}: {
  kind: string;
  record: DataRecord | null;
  onSave: (payload: DataRecord) => Promise<void>;
  onCancel: () => void;
}) {
  const fields = useMemo(() => formDefinitions[kind]?.fields ?? [], [kind]);
  const visibleFields = useMemo(
    () => record && kind === 'leases'
      ? fields.filter((field) => !['tenantId', 'apartmentId'].includes(field.key))
      : kind === 'leases'
        ? fields.filter((field) => field.key !== 'status')
        : record && kind === 'buildings'
          ? fields.filter((field) => field.key !== 'propertyId')
        : fields,
    [fields, kind, record],
  );
  const [values, setValues] = useState(() => initialValues(kind, record));
  const [options, setOptions] = useState<Record<string, DataRecord[]>>({});
  const [loading, setLoading] = useState(() => visibleFields.some((field) => field.optionsEndpoint));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarField, setCalendarField] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    let active = true;
    const optionFields = visibleFields.filter((field) => field.optionsEndpoint);
    Promise.all(optionFields.map(async (field) => {
      const payload = await apiRequest<unknown>(field.optionsEndpoint!);
      return [field.key, rowsFrom(payload)] as const;
    }))
      .then((entries) => {
        if (active) setOptions(Object.fromEntries(entries));
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load form options.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [visibleFields]);

  function openCalendar(fieldKey: string) {
    const currentDate = parseDateInput(values[fieldKey] ?? '');
    const parsed = currentDate ? new Date(`${currentDate}T00:00:00Z`) : new Date();
    if (!Number.isNaN(parsed.getTime())) {
      setCalendarMonth(parsed.getUTCMonth());
      setCalendarYear(parsed.getUTCFullYear());
    }
    setCalendarField(fieldKey);
  }

  function moveCalendarMonth(offset: number) {
    const date = new Date(Date.UTC(calendarYear, calendarMonth + offset, 1));
    setCalendarYear(date.getUTCFullYear());
    setCalendarMonth(date.getUTCMonth());
  }

  function selectCalendarDay(day: number) {
    if (!calendarField) return;
    const isoDate = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setValues((current) => ({ ...current, [calendarField]: formatDate(isoDate) }));
    setCalendarField(null);
  }

  async function submit() {
    const missing = visibleFields.find((field) => field.required && !values[field.key]?.trim());
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }

    const payload: DataRecord = {};
    for (const field of visibleFields) {
      const value = values[field.key]?.trim();
      if (isDateField(field.key)) {
        if (!value) {
          if (record && !field.required) payload[field.key] = null;
          continue;
        }
        const parsedDate = parseDateInput(value);
        if (!parsedDate) {
          setError(`${field.label} must use dd-MMM-YYYY, for example 05-Jan-2026.`);
          return;
        }
        payload[field.key] = parsedDate;
        continue;
      }
      if (!value) {
        if (field.numeric && field.emptyAsZero) {
          payload[field.key] = 0;
          continue;
        }
        if (record && !field.required && !field.numeric) payload[field.key] = null;
        continue;
      }
      if (field.numeric) {
        const number = Number(value);
        if (!Number.isFinite(number)) {
          setError(`${field.label} must be a valid number.`);
          return;
        }
        payload[field.key] = number;
      } else {
        payload[field.key] = value;
      }
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(payload);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this record.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      {loading ? <Loading message="Loading options..." /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {record && kind === 'buildings' ? (
        <Text style={styles.subtitle}>Property: {String(record.propertyName ?? 'Current property')}</Text>
      ) : null}
      {visibleFields.map((field) => (
        <View key={field.key} style={{ gap: 6 }}>
          <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
          {field.options ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {field.options.map((option) => {
                const selected = values[field.key] === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setValues((current) => ({ ...current, [field.key]: option }))}
                    style={{
                      backgroundColor: selected ? '#252e50' : colors.surface,
                      borderColor: selected ? colors.accent : colors.border,
                      borderRadius: 10,
                      borderWidth: 1,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  >
                    <Text style={{ color: colors.text }}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : field.optionsEndpoint ? (
            <View style={{ gap: 8 }}>
              {!field.required ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: !values[field.key] }}
                  onPress={() => setValues((current) => ({ ...current, [field.key]: '' }))}
                  style={[styles.secondaryButton, { borderColor: !values[field.key] ? colors.accent : colors.border }]}
                >
                  <Text style={{ color: !values[field.key] ? colors.accent : colors.text }}>Not assigned</Text>
                </Pressable>
              ) : null}
              {(options[field.key] ?? []).map((option) => {
                const selected = values[field.key] === String(option.id ?? '');
                return (
                  <Pressable
                    key={String(option.id)}
                    accessibilityRole="button"
                    onPress={() => setValues((current) => ({ ...current, [field.key]: String(option.id ?? '') }))}
                    style={({ pressed }) => [
                      { backgroundColor: selected ? '#252e50' : colors.surface, borderColor: selected ? colors.accent : colors.border, borderRadius: 10, borderWidth: 1, opacity: pressed ? 0.75 : 1, padding: 12 },
                    ]}
                  >
                    <Text style={{ color: colors.text }}>{optionLabel(option)}</Text>
                  </Pressable>
                );
              })}
              {(options[field.key] ?? []).length === 0 && !loading
                ? <Text style={styles.subtitle}>No choices available. Create the required record first.</Text>
                : null}
            </View>
          ) : isDateField(field.key) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Select ${field.label}`}
              onPress={() => openCalendar(field.key)}
              style={({ pressed }) => [
                styles.input,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={{ color: values[field.key] ? colors.text : colors.muted }}>
                {values[field.key] || 'Select date'}
              </Text>
            </Pressable>
          ) : (
            <TextInput
              style={styles.input}
              value={values[field.key] ?? ''}
              onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
              placeholder={field.label}
              placeholderTextColor={colors.muted}
              keyboardType={field.numeric ? 'numeric' : 'default'}
              multiline={field.key === 'description'}
              accessibilityLabel={field.label}
            />
          )}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable accessibilityRole="button" disabled={saving || loading} onPress={() => void submit()} style={[styles.button, { flex: 1, opacity: saving || loading ? 0.6 : 1 }]}>
          <Text style={styles.buttonLabel}>{saving ? 'Saving...' : record ? 'Save changes' : 'Create'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.secondaryButton, { flex: 1 }]}>
          <Text style={styles.buttonLabel}>Cancel</Text>
        </Pressable>
      </View>
      <Modal
        visible={calendarField !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarField(null)}
      >
        <View style={{ alignItems: 'center', backgroundColor: 'rgba(2, 6, 23, 0.76)', flex: 1, justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, maxWidth: 380, padding: 18, width: '100%' }}>
            <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
              <Pressable accessibilityRole="button" onPress={() => moveCalendarMonth(-1)} style={styles.secondaryButton}>
                <Text style={styles.buttonLabel}>‹</Text>
              </Pressable>
              <Text style={styles.actionTitle}>{monthNames[calendarMonth]} {calendarYear}</Text>
              <Pressable accessibilityRole="button" onPress={() => moveCalendarMonth(1)} style={styles.secondaryButton}>
                <Text style={styles.buttonLabel}>›</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 6 }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <Text key={day} style={{ color: colors.muted, flex: 1, fontSize: 12, textAlign: 'center' }}>{day}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Array.from({ length: new Date(Date.UTC(calendarYear, calendarMonth, 1)).getUTCDay() }).map((_, index) => (
                <View key={`empty-${index}`} style={{ height: 42, width: '14.2857%' }} />
              ))}
              {Array.from({ length: new Date(Date.UTC(calendarYear, calendarMonth + 1, 0)).getUTCDate() }, (_, index) => index + 1).map((day) => (
                <Pressable
                  key={day}
                  accessibilityRole="button"
                  accessibilityLabel={`${day} ${monthNames[calendarMonth]} ${calendarYear}`}
                  onPress={() => selectCalendarDay(day)}
                  style={({ pressed }) => [
                    { alignItems: 'center', backgroundColor: pressed ? '#3730a3' : 'transparent', borderRadius: 10, height: 42, justifyContent: 'center', width: '14.2857%' },
                  ]}
                >
                  <Text style={{ color: colors.text }}>{day}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ alignItems: 'flex-end', marginTop: 12 }}>
              <Pressable accessibilityRole="button" onPress={() => setCalendarField(null)} style={styles.secondaryButton}>
                <Text style={styles.buttonLabel}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
