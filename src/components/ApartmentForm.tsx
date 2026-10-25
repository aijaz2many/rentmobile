import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { apiRequest } from '../services/api';

export interface ApartmentFormData {
  id?: string;
  buildingId: string;
  floorId?: string;
  apartmentNumber: string;
  block?: string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  defaultRent: number | string;
  securityDeposit?: number | string;
  statusId?: string;
  typeId?: string;
  notes?: string;
}

type Props = {
  initialData?: any;
  onSuccess: () => void;
  onCancel?: () => void;
};

export default function ApartmentForm({ initialData = {}, onSuccess, onCancel }: Props) {
  const isEditing = Boolean(initialData?.id);

  const initialFormState: ApartmentFormData = {
    buildingId: initialData?.buildingId || initialData?.tsmib_buildings?.id || '',
    floorId: initialData?.floorId || initialData?.tsmib_floors?.id || '',
    apartmentNumber: initialData?.apartmentNumber || initialData?.apartment_number || '',
    defaultRent: initialData?.defaultRent !== undefined ? String(initialData.defaultRent) : (initialData?.default_rent !== undefined ? String(initialData.default_rent) : '15000'),
    securityDeposit: initialData?.securityDeposit !== undefined
      ? String(initialData.securityDeposit)
      : (initialData?.security_deposit !== undefined ? String(initialData.security_deposit) : '0'),
    bedrooms: initialData?.bedrooms !== undefined && initialData?.bedrooms !== null ? String(initialData.bedrooms) : '',
    bathrooms: initialData?.bathrooms !== undefined && initialData?.bathrooms !== null ? String(initialData.bathrooms) : '',
    block: initialData?.block || '',
    statusId: initialData?.statusId || initialData?.status_id || '',
    typeId: initialData?.apartmentTypeId || initialData?.apartment_type_id || initialData?.typeId || '',
    notes: initialData?.notes || '',
    id: initialData?.id,
  };

  const [form, setForm] = useState<ApartmentFormData>(initialFormState);
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);
  const [allFloors, setAllFloors] = useState<{ id: string; name: string; buildingId: string }[]>([]);
  const [floors, setFloors] = useState<{ id: string; name: string }[]>([]);
  const [statusOptions, setStatusOptions] = useState<{ id: string; label: string; code?: string }[]>([]);
  const [typeOptions, setTypeOptions] = useState<{ id: string; label: string; code?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardModalVisible, setDiscardModalVisible] = useState(false);

  // Check if user changed any field
  const isDirty =
    form.buildingId !== initialFormState.buildingId ||
    form.apartmentNumber !== initialFormState.apartmentNumber ||
    form.defaultRent !== initialFormState.defaultRent ||
    form.securityDeposit !== initialFormState.securityDeposit ||
    form.bedrooms !== initialFormState.bedrooms ||
    form.bathrooms !== initialFormState.bathrooms ||
    form.block !== initialFormState.block ||
    form.notes !== initialFormState.notes;

  const handleCancel = () => {
    if (isDirty) {
      setDiscardModalVisible(true);
    } else {
      onCancel?.();
    }
  };

  const discardChanges = () => {
    setDiscardModalVisible(false);
    onCancel?.();
  };

  useEffect(() => {
    // Fetch available buildings for selection
    apiRequest<any[]>('/properties')
      .then((properties) => {
        const bList: { id: string; name: string }[] = [];
        const fListTemp: { id: string; name: string; buildingId: string }[] = [];
        properties.forEach((p) => {
          if (p.tsmib_buildings) {
            p.tsmib_buildings.forEach((b: any) => {
              bList.push({ id: b.id, name: `${p.name} - ${b.name}` });
              if (b.tsmib_floors && Array.isArray(b.tsmib_floors)) {
                b.tsmib_floors.forEach((f: any) => {
                  fListTemp.push({
                    id: f.id,
                    name: f.name || `Floor ${f.floor_number === 0 ? 'G' : f.floor_number}`,
                    buildingId: b.id,
                  });
                });
              }
            });
          }
        });
        setBuildings(bList);
        if (fListTemp.length > 0) {
          setAllFloors(fListTemp);
        }
        if (!form.buildingId && bList.length > 0) {
          setForm((prev) => ({ ...prev, buildingId: bList[0].id }));
        }
      })
      .catch((err) => console.log('Error fetching buildings:', err));

    // Fetch lookups for statuses and types
    apiRequest<{ types: any[]; statuses: any[] }>('/apartments/meta/lookups')
      .then((data) => {
        if (data.statuses && data.statuses.length > 0) {
          const mappedStatuses = data.statuses.map((s) => ({
            id: s.id,
            label: s.name,
            code: s.code,
          }));
          setStatusOptions(mappedStatuses);

          // Find match from initialData: either statusId, status code, or status name
          const initialStatusKey = initialData?.statusId || initialData?.status_id;
          const initialStatusCode = (initialData?.status || '').toUpperCase();
          const initialStatusName = (initialData?.statusName || '').toUpperCase();

          const matchedStatus = mappedStatuses.find(
            (s) =>
              (initialStatusKey && s.id === initialStatusKey) ||
              (initialStatusCode && s.code?.toUpperCase() === initialStatusCode) ||
              (initialStatusName && s.label?.toUpperCase() === initialStatusName)
          );

          if (matchedStatus) {
            setForm((prev) => ({ ...prev, statusId: matchedStatus.id }));
          } else if (!form.statusId) {
            const vacant = mappedStatuses.find((s) => s.code === 'VACANT');
            setForm((prev) => ({ ...prev, statusId: vacant ? vacant.id : mappedStatuses[0].id }));
          }
        }

        if (data.types && data.types.length > 0) {
          const mappedTypes = data.types.map((t) => ({
            id: t.id,
            label: t.name,
            code: t.code,
          }));
          setTypeOptions(mappedTypes);

          // Find match from initialData: either typeId, apartmentTypeId, apartmentTypeCode, or apartmentTypeName
          const initialTypeKey =
            initialData?.apartmentTypeId ||
            initialData?.apartment_type_id ||
            initialData?.typeId;
          const initialTypeCode = (initialData?.apartmentTypeCode || '').toUpperCase();
          const initialTypeName = (initialData?.apartmentTypeName || '').toUpperCase();

          const matchedType = mappedTypes.find(
            (t) =>
              (initialTypeKey && t.id === initialTypeKey) ||
              (initialTypeCode && t.code?.toUpperCase() === initialTypeCode) ||
              (initialTypeName && t.label?.toUpperCase() === initialTypeName)
          );

          if (matchedType) {
            setForm((prev) => ({ ...prev, typeId: matchedType.id }));
          } else if (!form.typeId) {
            setForm((prev) => ({ ...prev, typeId: mappedTypes[0].id }));
          }
        }
      })
      .catch((err) => console.log('Error fetching lookups:', err));
  }, []);

  // Fetch floors for the selected building (supports both direct /floors and /properties/floors)
  useEffect(() => {
    let isActive = true;

    const loadFloors = async () => {
      if (!form.buildingId) {
        if (isActive) {
          setFloors([]);
          setForm((prev) => ({ ...prev, floorId: '' }));
        }
        return;
      }

      let mapped: { id: string; name: string }[] = [];
      try {
        const response = await apiRequest<any[]>(`/properties/buildings/${form.buildingId}/floors`);
        mapped = response.length
          ? response.map((floor: any) => ({
              id: floor.id,
              name: floor.name || `Floor ${floor.floorNumber === 0 ? 'G' : floor.floorNumber}`,
            }))
          : allFloors.filter((floor) => floor.buildingId === form.buildingId);
      } catch {
        try {
          const response = await apiRequest<any[]>(`/floors?buildingId=${form.buildingId}`);
          mapped = response.map((floor: any) => ({
            id: floor.id,
            name: floor.name || `Floor ${floor.floorNumber === 0 ? 'G' : floor.floorNumber}`,
          }));
        } catch {
          mapped = allFloors.filter((floor) => floor.buildingId === form.buildingId);
        }
      }

      if (!isActive) return;
      setFloors(mapped);
      setForm((prev) => ({
        ...prev,
        floorId: mapped.some((floor) => floor.id === prev.floorId)
          ? prev.floorId
          : mapped[0]?.id || '',
      }));
    };

    void loadFloors();
    return () => {
      isActive = false;
    };
  }, [form.buildingId, allFloors]);

  const handleChange = (key: keyof ApartmentFormData, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSelectBuilding = (buildingId: string) => {
    setFloors([]);
    setForm((prev) => ({
      ...prev,
      buildingId,
      floorId: '',
    }));
  };

  const submit = async () => {
    if (!form.buildingId) {
      setError('Please select or provide a Building');
      return;
    }
    if (!form.apartmentNumber?.trim()) {
      setError('Apartment number is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        buildingId: form.buildingId,
        floorId: form.floorId || null,
        apartmentNumber: form.apartmentNumber.trim(),
        defaultRent: Number(form.defaultRent) || 0,
        securityDeposit: Number(form.securityDeposit) || 0,
        statusId: form.statusId || undefined,
        apartmentTypeId: form.typeId || null,
      };

      if (form.bedrooms !== undefined && form.bedrooms !== '') {
        const parsedBeds = parseInt(String(form.bedrooms), 10);
        if (!isNaN(parsedBeds)) payload.bedrooms = parsedBeds;
      }
      if (form.bathrooms !== undefined && form.bathrooms !== '') {
        const parsedBaths = parseInt(String(form.bathrooms), 10);
        if (!isNaN(parsedBaths)) payload.bathrooms = parsedBaths;
      }
      if (form.block && form.block.trim()) {
        payload.block = form.block.trim();
      }
      if (form.notes && form.notes.trim()) {
        payload.notes = form.notes.trim();
      }

      if (form.id) {
        await apiRequest(`/apartments/${form.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/apartments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.headerTitle}>{form.id ? 'Edit Apartment' : 'Add Apartment'}</Text>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.label}>Building</Text>
      {buildings.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {buildings.map((b) => {
              const isSelected = form.buildingId === b.id;
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[
                    styles.pill,
                    isSelected ? styles.pillSelected : styles.pillUnselected,
                  ]}
                  onPress={() => handleSelectBuilding(b.id)}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                    {b.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <TextInput
          style={styles.input}
          placeholder="Building UUID"
          placeholderTextColor="#777"
          value={form.buildingId}
          onChangeText={(v) => handleChange('buildingId', v)}
        />
      )}

      <Text style={styles.label}>Apartment Number * {isEditing ? '(Read-only)' : ''}</Text>
      <TextInput
        style={[styles.input, isEditing && styles.inputDisabled]}
        placeholder="e.g. 101, B-202"
        placeholderTextColor="#777"
        value={form.apartmentNumber}
        editable={!isEditing}
        onChangeText={(v) => handleChange('apartmentNumber', v)}
      />

      <Text style={styles.label}>Monthly Rent (₹) *</Text>
      <TextInput
        style={styles.input}
        placeholder="15000"
        placeholderTextColor="#777"
        keyboardType="numeric"
        value={String(form.defaultRent)}
        onChangeText={(v) => handleChange('defaultRent', v)}
      />

      <Text style={styles.label}>Security Deposit (₹)</Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        placeholderTextColor="#777"
        keyboardType="numeric"
        value={String(form.securityDeposit)}
        onChangeText={(v) => handleChange('securityDeposit', v)}
      />

      {/* Floor Dropdown */}
      <Text style={styles.label}>Floor</Text>
      {floors.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {floors.map((f) => {
              const isSelected = form.floorId === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.pill,
                    isSelected ? styles.pillSelected : styles.pillUnselected,
                  ]}
                  onPress={() => handleChange('floorId', f.id)}
                >
                  <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>{f.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <Text style={styles.helperText}>No floors available for this building. The apartment can be saved without a floor.</Text>
      )}

      {/* Status Dropdown */}
      <Text style={styles.label}>Status</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {statusOptions.map((s) => {
            const isSelected = form.statusId === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.pill,
                  isSelected ? styles.pillSelected : styles.pillUnselected,
                ]}
                onPress={() => handleChange('statusId', s.id)}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Apartment Type Dropdown */}
      <Text style={styles.label}>Apartment Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {typeOptions.map((t) => {
            const isSelected = form.typeId === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.pill,
                  isSelected ? styles.pillSelected : styles.pillUnselected,
                ]}
                onPress={() => handleChange('typeId', t.id)}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Bedrooms</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 2"
            placeholderTextColor="#777"
            keyboardType="numeric"
            value={form.bedrooms !== undefined && form.bedrooms !== null ? String(form.bedrooms) : ''}
            onChangeText={(v) => handleChange('bedrooms', v)}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Bathrooms</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 2"
            placeholderTextColor="#777"
            keyboardType="numeric"
            value={form.bathrooms !== undefined && form.bathrooms !== null ? String(form.bathrooms) : ''}
            onChangeText={(v) => handleChange('bathrooms', v)}
          />
        </View>
      </View>

      <Text style={styles.label}>Block / Wing (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. A Wing"
        placeholderTextColor="#777"
        value={form.block || ''}
        onChangeText={(v) => handleChange('block', v)}
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, { flex: 1, marginTop: 0 }]}
          onPress={submit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{form.id ? 'Save Changes' : 'Create Apartment'}</Text>
          )}
        </TouchableOpacity>
      </View>
      <Modal
        visible={discardModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscardModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityRole="alert">
            <Text style={styles.modalTitle}>Discard unsaved changes?</Text>
            <Text style={styles.modalMessage}>
              Your apartment details have not been saved. Do you want to discard them and close this form?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.keepEditingButton}
                onPress={() => setDiscardModalVisible(false)}
              >
                <Text style={styles.keepEditingText}>Keep editing</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.discardButton}
                onPress={discardChanges}
              >
                <Text style={styles.discardButtonText}>Discard changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#0f172a',
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 16,
  },
  label: {
    color: '#cbd5e1',
    marginTop: 12,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
  },
  inputDisabled: {
    backgroundColor: '#0f172a',
    color: '#94a3b8',
    borderColor: '#1e293b',
    opacity: 0.8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillSelected: {
    backgroundColor: '#4f46e5',
    borderColor: '#818cf8',
  },
  pillUnselected: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  pillText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  pillTextSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    backgroundColor: '#334155',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#4f46e5',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  error: {
    color: '#ef4444',
    backgroundColor: '#450a0a',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    fontSize: 13,
  },
  helperText: {
    color: '#94a3b8',
    fontSize: 12,
    marginVertical: 6,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 6, 23, 0.76)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#151f32',
    borderColor: '#334155',
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 420,
    padding: 22,
    width: '100%',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalMessage: {
    color: '#aab7ca',
    fontSize: 14,
    lineHeight: 21,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 22,
  },
  keepEditingButton: {
    alignItems: 'center',
    borderColor: '#475569',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  keepEditingText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  discardButton: {
    alignItems: 'center',
    backgroundColor: '#b91c1c',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  discardButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
