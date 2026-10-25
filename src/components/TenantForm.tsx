import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { apiRequest } from '../services/api';
import { Apartment, GovernmentIdType } from '../types';
import { formatDate } from '../lib/date';

export interface TenantFormData {
  id?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  governmentIdTypeId?: string;
  governmentIdNumber?: string;
  apartmentId?: string;
  startDate?: string;
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

type Props = {
  initialData?: any;
  apartments?: Apartment[];
  onSuccess: () => void;
  onCancel?: () => void;
};

const DEFAULT_ID_TYPES: GovernmentIdType[] = [
  { id: '326ca5f3-2869-47fb-a78a-3645310e96cf', code: 'AADHAAR', name: 'Aadhaar Card', isActive: true },
  { id: '099b87e4-5567-4702-b597-a3ba6cc68345', code: 'PAN', name: 'PAN Card', isActive: true },
  { id: 'f354d465-3828-4f48-9a7d-be731b8ebd71', code: 'PASSPORT', name: 'Passport', isActive: true },
  { id: '45d6a23a-d3da-4b49-81ad-1f45299fd4af', code: 'VOTER_ID', name: 'Voter ID', isActive: true },
  { id: '65de7e2f-07bb-47a3-9769-8e3fd458f4e5', code: 'DRIVING_LICENSE', name: 'Driving License', isActive: true },
  { id: 'e952cc41-5735-46b1-8790-2d809278b0b8', code: 'RATION_CARD', name: 'Ration Card', isActive: true },
  { id: '72b16194-5286-4767-80cd-49a1cb9024cc', code: 'OTHER', name: 'Other ID', isActive: true },
];

export default function TenantForm({ initialData = {}, apartments = [], onSuccess, onCancel }: Props) {
  const currentAptId = initialData?.currentApartment?.id || '';

  const todayStr = new Date().toISOString().split('T')[0];

  const initialFormState: TenantFormData = {
    id: initialData?.id,
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    dateOfBirth: initialData?.dateOfBirth ? String(initialData.dateOfBirth).split('T')[0] : '',
    address: initialData?.address || '',
    emergencyContactName: initialData?.emergencyContactName || '',
    emergencyContactPhone: initialData?.emergencyContactPhone || '',
    governmentIdTypeId: initialData?.governmentIdTypeId || '',
    governmentIdNumber: initialData?.governmentIdNumber || '',
    apartmentId: currentAptId,
    startDate: todayStr,
    notes: initialData?.notes || '',
    status: initialData?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  };

  const [form, setForm] = useState<TenantFormData>(initialFormState);
  const [loadedAptList, setLoadedAptList] = useState<Apartment[]>([]);
  const [idTypes, setIdTypes] = useState<GovernmentIdType[]>(DEFAULT_ID_TYPES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardModalVisible, setDiscardModalVisible] = useState(false);
  const aptList = apartments.length > 0 ? apartments : loadedAptList;
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calYear, setCalYear] = useState(() => {
    if (initialFormState.dateOfBirth) {
      const parts = initialFormState.dateOfBirth.split('-');
      if (parts[0]) return Number(parts[0]);
    }
    return 1998;
  });
  const [calMonth, setCalMonth] = useState(() => {
    if (initialFormState.dateOfBirth) {
      const parts = initialFormState.dateOfBirth.split('-');
      if (parts[1]) return Number(parts[1]) - 1;
    }
    return 0; // January
  });

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleSelectDay = (day: number) => {
    const formattedMonth = String(calMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const pickedDate = `${calYear}-${formattedMonth}-${formattedDay}`;
    handleChange('dateOfBirth', pickedDate);
    setShowDatePicker(false);
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOffset = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  useEffect(() => {
    if (apartments.length === 0) {
      apiRequest<Apartment[]>('/apartments')
        .then((res) => setLoadedAptList(res))
        .catch((err) => console.log('Error loading apartments:', err));
    }

    // Load dynamic ID types from backend if available
    apiRequest<GovernmentIdType[]>('/tenants/meta/id-types')
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setIdTypes(res);
        }
      })
      .catch((err) => console.log('Using default ID types:', err));
  }, [apartments]);

  const isDirty =
    form.firstName !== initialFormState.firstName ||
    form.lastName !== initialFormState.lastName ||
    form.email !== initialFormState.email ||
    form.phone !== initialFormState.phone ||
    form.dateOfBirth !== initialFormState.dateOfBirth ||
    form.address !== initialFormState.address ||
    form.emergencyContactName !== initialFormState.emergencyContactName ||
    form.emergencyContactPhone !== initialFormState.emergencyContactPhone ||
    form.governmentIdTypeId !== initialFormState.governmentIdTypeId ||
    form.governmentIdNumber !== initialFormState.governmentIdNumber ||
    form.notes !== initialFormState.notes ||
    form.status !== initialFormState.status ||
    form.apartmentId !== initialFormState.apartmentId;

  const handleChange = (key: keyof TenantFormData, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSelectApartment = (apt: Apartment) => {
    if (form.apartmentId === apt.id) {
      setForm((prev) => ({ ...prev, apartmentId: '' }));
    } else {
      setForm((prev) => ({
        ...prev,
        apartmentId: apt.id,
      }));
    }
  };

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

  const submit = async () => {
    if (!form.firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!form.phone.trim()) {
      setError('Phone number is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        firstName: form.firstName.trim(),
        phone: form.phone.trim(),
        status: form.status,
      };

      if (form.lastName && form.lastName.trim()) payload.lastName = form.lastName.trim();
      else payload.lastName = null;

      if (form.email && form.email.trim()) payload.email = form.email.trim();
      else payload.email = null;

      if (form.dateOfBirth && form.dateOfBirth.trim()) payload.dateOfBirth = form.dateOfBirth.trim();
      else payload.dateOfBirth = null;

      if (form.address && form.address.trim()) payload.address = form.address.trim();
      else payload.address = null;

      if (form.emergencyContactName && form.emergencyContactName.trim()) {
        payload.emergencyContactName = form.emergencyContactName.trim();
      } else payload.emergencyContactName = null;

      if (form.emergencyContactPhone && form.emergencyContactPhone.trim()) {
        payload.emergencyContactPhone = form.emergencyContactPhone.trim();
      } else payload.emergencyContactPhone = null;

      if (form.governmentIdTypeId && form.governmentIdTypeId.trim()) {
        payload.governmentIdTypeId = form.governmentIdTypeId.trim();
      } else payload.governmentIdTypeId = null;

      if (form.governmentIdNumber && form.governmentIdNumber.trim()) {
        payload.governmentIdNumber = form.governmentIdNumber.trim();
      } else payload.governmentIdNumber = null;

      if (form.notes && form.notes.trim()) payload.notes = form.notes.trim();
      else payload.notes = null;

      let tenantId = form.id;

      if (form.id) {
        await apiRequest(`/tenants/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        const createdTenant = await apiRequest<any>('/tenants', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        tenantId = createdTenant.id;
      }

      // If an apartment unit was selected and it's a new assignment, create the active lease
      if (form.apartmentId && form.apartmentId !== currentAptId && tenantId) {
        const selectedApartment = aptList.find((apt) => apt.id === form.apartmentId);
        await apiRequest('/tenants/leases', {
          method: 'POST',
          body: JSON.stringify({
            apartmentId: form.apartmentId,
            tenantId,
            startDate: form.startDate || todayStr,
            monthlyRent: Number(selectedApartment?.defaultRent) || 15000,
            securityDeposit: Number(selectedApartment?.securityDeposit) || 0,
            rentDueDay: 5,
            lateFee: 500,
          }),
        });
      }

      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Failed to save tenant information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* Form Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{form.id ? 'Edit Tenant Profile' : 'Add New Tenant'}</Text>
          <Text style={styles.headerSubtitle}>
            Complete the 7 tenant details sections below for lease and identity records.
          </Text>
        </View>
        <View style={[styles.statusBadgeTop, form.status === 'ACTIVE' ? styles.badgeActive : styles.badgeInactive]}>
          <Text style={styles.statusBadgeTopText}>{form.status}</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* SECTION 1: First Name, Last Name */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>1</Text>
          </View>
          <Text style={styles.sectionTitle}>Full Name</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.halfCol}>
            <Text style={styles.label}>First Name <Text style={styles.requiredStar}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. John"
              placeholderTextColor="#64748b"
              value={form.firstName}
              onChangeText={(v) => handleChange('firstName', v)}
            />
          </View>

          <View style={styles.halfCol}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Doe"
              placeholderTextColor="#64748b"
              value={form.lastName || ''}
              onChangeText={(v) => handleChange('lastName', v)}
            />
          </View>
        </View>
      </View>

      {/* SECTION 2: Email, Phone Number */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <Text style={styles.sectionTitle}>Contact Information</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.halfCol}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. john.doe@example.com"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email || ''}
              onChangeText={(v) => handleChange('email', v)}
            />
          </View>

          <View style={styles.halfCol}>
            <Text style={styles.label}>Phone Number <Text style={styles.requiredStar}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="+91 9876543210"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(v) => handleChange('phone', v)}
            />
          </View>
        </View>
      </View>

      {/* SECTION 3: Date of Birth, Permanent / Previous Address */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>3</Text>
          </View>
          <Text style={styles.sectionTitle}>Demographics & Address</Text>
        </View>

        <Text style={styles.label}>Date of Birth</Text>
        <TouchableOpacity
          style={styles.datePickerTrigger}
          onPress={() => {
            if (form.dateOfBirth) {
              const parts = form.dateOfBirth.split('-');
              if (parts[0]) setCalYear(Number(parts[0]));
              if (parts[1]) setCalMonth(Number(parts[1]) - 1);
            }
            setShowDatePicker(true);
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 16 }}>📅</Text>
            <Text style={{ color: form.dateOfBirth ? '#f8fafc' : '#64748b', fontSize: 14 }}>
              {form.dateOfBirth ? formatDate(form.dateOfBirth) : 'Select Date of Birth'}
            </Text>
          </View>
          {form.dateOfBirth ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                handleChange('dateOfBirth', '');
              }}
              style={styles.dateClearBtn}
            >
              <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}>✕</Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: '#818cf8', fontSize: 12, fontWeight: '600' }}>Choose</Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.label, { marginTop: 12 }]}>Permanent / Previous Address</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="Flat / House No, Street, City, State, PIN"
          placeholderTextColor="#64748b"
          multiline
          numberOfLines={3}
          value={form.address || ''}
          onChangeText={(v) => handleChange('address', v)}
        />
      </View>

      {/* SECTION 4: Emergency Contact, Emergency Phone */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>4</Text>
          </View>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.halfCol}>
            <Text style={styles.label}>Emergency Contact Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sarah Doe (Spouse)"
              placeholderTextColor="#64748b"
              value={form.emergencyContactName || ''}
              onChangeText={(v) => handleChange('emergencyContactName', v)}
            />
          </View>

          <View style={styles.halfCol}>
            <Text style={styles.label}>Emergency Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="+91 9876543211"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              value={form.emergencyContactPhone || ''}
              onChangeText={(v) => handleChange('emergencyContactPhone', v)}
            />
          </View>
        </View>
      </View>

      {/* SECTION 5: Government ID Type, Government Id Number */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>5</Text>
          </View>
          <Text style={styles.sectionTitle}>Government Identification</Text>
        </View>

        <Text style={styles.label}>Select Government ID Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
          <View style={styles.pillsRow}>
            {idTypes.map((t) => {
              const isSelected = form.governmentIdTypeId === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.typePill, isSelected && styles.typePillSelected]}
                  onPress={() => handleChange('governmentIdTypeId', isSelected ? '' : t.id)}
                >
                  <Text style={[styles.typePillText, isSelected && styles.typePillTextSelected]}>
                    {t.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <Text style={[styles.label, { marginTop: 12 }]}>Government ID Number</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 1234 5678 9012 or ABCDE1234F"
          placeholderTextColor="#64748b"
          autoCapitalize="characters"
          value={form.governmentIdNumber || ''}
          onChangeText={(v) => handleChange('governmentIdNumber', v)}
        />
      </View>

      {/* SECTION 6: Assign Apartment Unit (Optional) */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>6</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Assign Apartment Unit (Optional)</Text>
            <Text style={styles.sectionSubtitle}>
              Select a vacant unit to automatically bind this tenant to an active lease.
            </Text>
          </View>
        </View>

        {aptList.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
            <View style={styles.pillsRow}>
              {aptList.map((apt) => {
                const isSelected = form.apartmentId === apt.id;
                const isOccupied = apt.status === 'OCCUPIED' && !isSelected;
                return (
                  <TouchableOpacity
                    key={apt.id}
                    disabled={isOccupied}
                    style={[
                      styles.aptCard,
                      isSelected && styles.aptCardSelected,
                      isOccupied && styles.aptCardOccupied,
                    ]}
                    onPress={() => handleSelectApartment(apt)}
                  >
                    <View style={styles.aptHeaderRow}>
                      <Text style={[styles.aptTitle, isSelected && styles.aptTitleSelected]}>
                        Unit {apt.apartmentNumber}
                      </Text>
                      {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                    </View>
                    <Text style={[styles.aptBuilding, isSelected && styles.aptBuildingSelected]}>
                      {apt.buildingName}
                    </Text>
                    <Text style={[styles.aptPrice, isSelected && styles.aptPriceSelected]}>
                      ₹{Number(apt.defaultRent).toLocaleString()}/mo
                    </Text>
                    {isOccupied && <Text style={styles.aptOccupiedBadge}>Occupied</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <Text style={styles.emptyAptText}>
            No apartments found. You can assign units later from the Leases or Apartments section.
          </Text>
        )}

      </View>

      {/* SECTION 7: Notes, Status */}
      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>7</Text>
          </View>
          <Text style={styles.sectionTitle}>Notes & Tenant Status</Text>
        </View>

        <Text style={styles.label}>Tenant Status</Text>
        <View style={styles.statusToggleRow}>
          <TouchableOpacity
            style={[styles.statusToggleBtn, form.status === 'ACTIVE' && styles.statusToggleActive]}
            onPress={() => handleChange('status', 'ACTIVE')}
          >
            <Text
              style={[
                styles.statusToggleText,
                form.status === 'ACTIVE' && styles.statusToggleTextActive,
              ]}
            >
              ● Active Tenant
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statusToggleBtn, form.status === 'INACTIVE' && styles.statusToggleInactive]}
            onPress={() => handleChange('status', 'INACTIVE')}
          >
            <Text
              style={[
                styles.statusToggleText,
                form.status === 'INACTIVE' && styles.statusToggleTextInactive,
              ]}
            >
              ○ Inactive / Past
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { marginTop: 14 }]}>Internal Notes</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="Special preferences, references, background notes, etc."
          placeholderTextColor="#64748b"
          multiline
          numberOfLines={3}
          value={form.notes || ''}
          onChangeText={(v) => handleChange('notes', v)}
        />
      </View>

      {/* Action Footer Buttons */}
      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={loading}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitButton} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {form.id ? '💾 Save Changes' : '✨ Add Tenant'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Calendar Modal for Date of Birth */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalBox}>
            <View style={styles.calHeaderRow}>
              <Text style={styles.calModalTitle}>Select Date of Birth</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.calCloseBtn}>
                <Text style={{ color: '#94a3b8', fontSize: 16, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Year Selector */}
            <View style={styles.calNavRow}>
              <TouchableOpacity
                style={styles.calArrowBtn}
                onPress={() => setCalYear((y) => Math.max(1940, y - 1))}
              >
                <Text style={styles.calArrowText}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.calYearText}>{calYear}</Text>
              <TouchableOpacity
                style={styles.calArrowBtn}
                onPress={() => setCalYear((y) => Math.min(new Date().getFullYear(), y + 1))}
              >
                <Text style={styles.calArrowText}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Month Selector */}
            <View style={styles.calNavRow}>
              <TouchableOpacity
                style={styles.calArrowBtn}
                onPress={() => setCalMonth((m) => (m === 0 ? 11 : m - 1))}
              >
                <Text style={styles.calArrowText}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.calMonthText}>{months[calMonth]}</Text>
              <TouchableOpacity
                style={styles.calArrowBtn}
                onPress={() => setCalMonth((m) => (m === 11 ? 0 : m + 1))}
              >
                <Text style={styles.calArrowText}>▶</Text>
              </TouchableOpacity>
            </View>

            {/* Days of week */}
            <View style={styles.calWeekRow}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w, idx) => (
                <Text key={idx} style={styles.calWeekText}>{w}</Text>
              ))}
            </View>

            {/* Grid of days */}
            <View style={styles.calDaysGrid}>
              {Array.from({ length: getFirstDayOffset(calYear, calMonth) }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.calDayCell} />
              ))}
              {Array.from({ length: getDaysInMonth(calYear, calMonth) }).map((_, i) => {
                const dayNum = i + 1;
                const formattedMonth = String(calMonth + 1).padStart(2, '0');
                const formattedDay = String(dayNum).padStart(2, '0');
                const thisDateStr = `${calYear}-${formattedMonth}-${formattedDay}`;
                const isSelected = form.dateOfBirth === thisDateStr;

                return (
                  <TouchableOpacity
                    key={`day-${dayNum}`}
                    style={[styles.calDayCell, isSelected && styles.calDayCellSelected]}
                    onPress={() => handleSelectDay(dayNum)}
                  >
                    <Text
                      style={[
                        styles.calDayText,
                        isSelected && styles.calDayTextSelected,
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Quick Presets / Cancel */}
            <View style={styles.calFooter}>
              <TouchableOpacity
                style={styles.calPresetBtn}
                onPress={() => {
                  setCalYear(2000);
                  setCalMonth(0);
                }}
              >
                <Text style={styles.calPresetText}>Year 2000</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.calPresetBtn}
                onPress={() => {
                  setCalYear(1995);
                  setCalMonth(0);
                }}
              >
                <Text style={styles.calPresetText}>Year 1995</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.calPresetBtn, { backgroundColor: '#334155' }]}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={discardModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscardModalVisible(false)}
      >
        <View style={styles.discardModalOverlay}>
          <View style={styles.discardModalCard} accessibilityRole="alert">
            <Text style={styles.discardModalTitle}>Discard unsaved changes?</Text>
            <Text style={styles.discardModalMessage}>
              Your tenant details have not been saved. Do you want to discard them and close this form?
            </Text>
            <View style={styles.discardModalActions}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.discardKeepButton}
                onPress={() => setDiscardModalVisible(false)}
              >
                <Text style={styles.discardKeepText}>Keep editing</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.discardConfirmButton}
                onPress={discardChanges}
              >
                <Text style={styles.discardConfirmText}>Discard changes</Text>
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
    backgroundColor: '#090d16',
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    maxWidth: 280,
  },
  statusBadgeTop: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeTopText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeActive: {
    backgroundColor: '#064e3b',
    borderColor: '#059669',
  },
  badgeInactive: {
    backgroundColor: '#3f3f46',
    borderColor: '#71717a',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfCol: {
    flex: 1,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  requiredStar: {
    color: '#f43f5e',
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 68,
    textAlignVertical: 'top',
  },
  datePickerTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateClearBtn: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarModalBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
  },
  calHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calModalTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
  },
  calCloseBtn: {
    padding: 8,
  },
  calNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  calArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calArrowText: {
    color: '#a5b4fc',
    fontSize: 14,
    fontWeight: '700',
  },
  calYearText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
  calMonthText: {
    color: '#c7d2fe',
    fontSize: 14,
    fontWeight: '600',
  },
  calWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    marginBottom: 4,
  },
  calWeekText: {
    width: '14.2857%',
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  calDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calDayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  calDayCellSelected: {
    backgroundColor: '#4f46e5',
  },
  calDayText: {
    color: '#e2e8f0',
    fontSize: 13,
  },
  calDayTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  calFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 12,
  },
  calPresetBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  calPresetText: {
    color: '#c7d2fe',
    fontSize: 11,
    fontWeight: '600',
  },
  pillsScroll: {
    marginVertical: 4,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  typePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  typePillSelected: {
    backgroundColor: '#3730a3',
    borderColor: '#6366f1',
  },
  typePillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  typePillTextSelected: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  aptCard: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 12,
    minWidth: 130,
  },
  aptCardSelected: {
    backgroundColor: '#312e81',
    borderColor: '#6366f1',
  },
  aptCardOccupied: {
    opacity: 0.45,
  },
  aptHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aptTitle: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '700',
  },
  aptTitleSelected: {
    color: '#ffffff',
  },
  checkIcon: {
    color: '#a5b4fc',
    fontWeight: 'bold',
    fontSize: 14,
  },
  aptBuilding: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  aptBuildingSelected: {
    color: '#c7d2fe',
  },
  aptPrice: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  aptPriceSelected: {
    color: '#7dd3fc',
  },
  aptOccupiedBadge: {
    color: '#f87171',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  emptyAptText: {
    color: '#64748b',
    fontSize: 12,
    marginVertical: 8,
  },
  statusToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  statusToggleActive: {
    backgroundColor: '#064e3b',
    borderColor: '#10b981',
  },
  statusToggleInactive: {
    backgroundColor: '#27272a',
    borderColor: '#52525b',
  },
  statusToggleText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  statusToggleTextActive: {
    color: '#34d399',
  },
  statusToggleTextInactive: {
    color: '#a1a1aa',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#b91c1c',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 13,
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  discardModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  discardModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#151f32',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 22,
  },
  discardModalTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  discardModalMessage: {
    color: '#aab7ca',
    fontSize: 14,
    lineHeight: 21,
  },
  discardModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },
  discardKeepButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 14,
  },
  discardKeepText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  discardConfirmButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#b91c1c',
    paddingHorizontal: 14,
  },
  discardConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
