import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { apiRequest, setToken } from './src/services/api';
import { User, DashboardMetrics, Apartment, Tenant, RentCharge, PaymentRecord, API_BASE_URL, Receipt } from './src/types';
import ApartmentForm from './src/components/ApartmentForm';
import TenantForm from './src/components/TenantForm';

type AppProps = {
  initialUser?: User | null;
  onLogout?: () => void | Promise<void>;
  onBack?: () => void;
};

export default function App({ initialUser = null, onLogout, onBack }: AppProps = {}) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'apartments' | 'tenants' | 'rent'>('dashboard');

  // Auth form states
  const [emailOrPhone, setEmailOrPhone] = useState('aijazmshaik@gmail.com');
  const [password, setPassword] = useState('admin123');
  const [isRegistering, setIsRegistering] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [orgName, setOrgName] = useState('My Properties');

  // Data states
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rentCharges, setRentCharges] = useState<RentCharge[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  // Apartment form modal state
  const [showApartmentForm, setShowApartmentForm] = useState(false);
  const [editingApartment, setEditingApartment] = useState<Partial<Apartment> | null>(null);

  // Tenant form modal state
  const [showTenantForm, setShowTenantForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Partial<Tenant> | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);

  // Bulk Generator Modal State
  const [showBulkGen, setShowBulkGen] = useState(false);
  const [floorsCount, setFloorsCount] = useState('5');
  const [unitsPerFloor, setUnitsPerFloor] = useState('6');
  const [bulkRent, setBulkRent] = useState('15000');

  // Rent Engine State
  const [showRentEngine, setShowRentEngine] = useState(false);
  const [rentGenYear, setRentGenYear] = useState('2026');
  const [rentGenMonth, setRentGenMonth] = useState('10');
  const [isDryRun, setIsDryRun] = useState(false);
  const [prorateLeases, setProrateLeases] = useState(true);

  // Payment Management State
  const [activeRentSubTab, setActiveRentSubTab] = useState<'charges' | 'payments'>('charges');
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [payAptId, setPayAptId] = useState('');
  const [payTenantId, setPayTenantId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'UPI' | 'CASH' | 'BANK_TRANSFER' | 'CARD'>('UPI');
  const [payTxnId, setPayTxnId] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // Load dashboard / tab data
  useEffect(() => {
    if (user) {
      loadTabData(activeTab);
    }
  }, [user, activeTab]);

  async function loadTabData(tab: string) {
    setLoading(true);
    try {
      if (tab === 'dashboard') {
        const data = await apiRequest<DashboardMetrics>('/dashboard/metrics');
        setMetrics(data);
      } else if (tab === 'apartments') {
        const data = await apiRequest<Apartment[]>('/apartments');
        setApartments(data);
      } else if (tab === 'tenants') {
        const data = await apiRequest<Tenant[]>('/tenants');
        setTenants(data);
      } else if (tab === 'rent') {
        const [charges, paymentRes, apts] = await Promise.all([
          apiRequest<RentCharge[]>('/rent/charges'),
          apiRequest<{ payments: PaymentRecord[] }>('/payments'),
          apartments.length === 0 ? apiRequest<Apartment[]>('/apartments') : Promise.resolve(apartments),
        ]);
        setRentCharges(charges);
        setPayments(paymentRes.payments || []);
        if (apartments.length === 0 && apts) setApartments(apts);
      }
    } catch (err: any) {
      console.log('Error loading data:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!emailOrPhone || !password) {
      Alert.alert('Required', 'Please enter email/phone and password');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrPhone, password }),
      });
      setToken(res.token);
      setUser(res.user);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!firstName || !emailOrPhone || !password) {
      Alert.alert('Required', 'Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          email: emailOrPhone,
          password,
          organizationName: orgName,
        }),
      });
      setToken(res.token);
      setUser(res.user);
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkGenerate() {
    setLoading(true);
    try {
      // First get active properties/buildings
      const properties = await apiRequest<any[]>('/properties');
      if (!properties.length || !properties[0].tsmib_buildings.length) {
        Alert.alert('Notice', 'Please create at least 1 property & building first.');
        return;
      }
      const buildingId = properties[0].tsmib_buildings[0].id;

      const res = await apiRequest<{ message: string }>('/apartments/bulk-generate', {
        method: 'POST',
        body: JSON.stringify({
          buildingId,
          floorsCount: Number(floorsCount),
          apartmentsPerFloor: Number(unitsPerFloor),
          defaultRent: Number(bulkRent),
          securityDeposit: Number(bulkRent) * 2,
        }),
      });

      Alert.alert('Success', res.message);
      setShowBulkGen(false);
      loadTabData('apartments');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Open form for creating or editing apartment
  const openApartmentForm = (apt?: Apartment) => {
    if (apt) {
      setEditingApartment(apt);
    } else {
      setEditingApartment(null);
    }
    setShowApartmentForm(true);
  };

  // State for confirming deletion to avoid Alert/window.confirm blocking on mobile or web
  const [apartmentToDelete, setApartmentToDelete] = useState<Apartment | null>(null);

  const executeDelete = async (aptId: string) => {
    setLoading(true);
    setApartmentToDelete(null);
    try {
      await apiRequest<void>(`/apartments/${aptId}`, { method: 'DELETE' });
      Alert.alert('Deleted', 'Apartment removed successfully');
      loadTabData('apartments');
    } catch (e: any) {
      Alert.alert('Delete Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApartment = (apt: Apartment) => {
    setApartmentToDelete(apt);
  };

  // Tenant handlers
  const openTenantForm = (tenant?: Tenant) => {
    if (tenant) {
      setEditingTenant(tenant);
    } else {
      setEditingTenant(null);
    }
    setShowTenantForm(true);
  };

  const executeDeleteTenant = async (tenantId: string) => {
    setLoading(true);
    setTenantToDelete(null);
    try {
      await apiRequest<void>(`/tenants/${tenantId}`, { method: 'DELETE' });
      Alert.alert('Deleted', 'Tenant removed successfully');
      loadTabData('tenants');
    } catch (e: any) {
      Alert.alert('Delete Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTenant = (tenant: Tenant) => {
    setTenantToDelete(tenant);
  };

  async function handleLogout() {
    setToken(null);
    setUser(null);
    try {
      await onLogout?.();
    } catch (error) {
      Alert.alert('Signed out', error instanceof Error ? error.message : 'The saved session could not be removed.');
    }
  }

  async function handleRunRentEngine() {
    const year = parseInt(rentGenYear, 10);
    const month = parseInt(rentGenMonth, 10);
    if (!year || !month || month < 1 || month > 12) {
      Alert.alert('Invalid Input', 'Please enter a valid year (e.g. 2026) and month (1-12).');
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<any>('/rent/generate-charges', {
        method: 'POST',
        body: JSON.stringify({
          billingYear: year,
          billingMonth: month,
          dryRun: isDryRun,
          prorate: prorateLeases,
        }),
      });

      Alert.alert(
        isDryRun ? '🔍 Rent Engine Preview' : '✅ Rent Generation Completed',
        `Period: ${res.billingPeriod}\nActive Leases: ${res.activeLeasesFound}\nCharges Created: ${res.chargesCreated}\nAlready Existed: ${res.chargesSkipped}\nTotal Rent: ₹${Number(res.totalRentAmount).toLocaleString()}`
      );

      if (!isDryRun) {
        setShowRentEngine(false);
        loadTabData('rent');
      }
    } catch (err: any) {
      Alert.alert('Rent Engine Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleProcessOverdue() {
    setLoading(true);
    try {
      const res = await apiRequest<any>('/rent/process-overdue', {
        method: 'POST',
      });
      Alert.alert(
        '⏰ Overdue Evaluation Complete',
        `${res.overdueChargesCount} charges marked OVERDUE.\n${res.lateFeesAppliedCount} late fees applied totaling ₹${Number(res.totalLateFeeAmount).toLocaleString()}.`
      );
      loadTabData('rent');
    } catch (err: any) {
      Alert.alert('Overdue Processor Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordPayment() {
    if (!payAptId || !payTenantId || !payAmount) {
      Alert.alert('Required Fields', 'Please select a unit/tenant and enter payment amount.');
      return;
    }
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive payment amount.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<any>('/payments', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: payTenantId,
          apartmentId: payAptId,
          amount: amt,
          paymentMethodCode: payMethod,
          transactionId: payTxnId || undefined,
          notes: payNotes || undefined,
          autoAllocate: true,
        }),
      });

      const allocCount = res.allocations?.length || 0;
      const allocSummary = res.allocations?.map((a: any) => `• ${a.billingPeriod}: ₹${a.allocatedAmount} [${a.newStatus}]`).join('\n') || '';
      const statusNote = res.isPartial
        ? '(Partial Payment recorded)'
        : res.isAdvance
          ? `(Advance remaining: ₹${res.unallocatedAmount})`
          : '(Full Settlement)';

      Alert.alert(
        '✅ Payment Recorded & Receipt Issued!',
        `Receipt #: ${res.receipt?.receiptNumber}\nAmount: ₹${amt.toLocaleString()} via ${res.payment?.paymentMethod}\nStatus: ${statusNote}\n\nAllocated:\n${allocSummary}`
      );

      setShowRecordPayment(false);
      setPayAmount('');
      setPayTxnId('');
      setPayNotes('');
      loadTabData('rent');
    } catch (err: any) {
      Alert.alert('Payment Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  // 1. AUTH SCREEN
  if (!user) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <StatusBar style="light" />
        <View style={styles.authCard}>
          <Text style={styles.authLogo}>🏢 PropertyHub</Text>
          <Text style={styles.authSubtitle}>Smart Apartment & Rent Management</Text>

          <View style={styles.tabToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, !isRegistering && styles.toggleBtnActive]}
              onPress={() => setIsRegistering(false)}
            >
              <Text style={[styles.toggleText, !isRegistering && styles.toggleTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, isRegistering && styles.toggleBtnActive]}
              onPress={() => setIsRegistering(true)}
            >
              <Text style={[styles.toggleText, isRegistering && styles.toggleTextActive]}>Register Owner</Text>
            </TouchableOpacity>
          </View>

          {isRegistering && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Full Name (e.g. Aijaz)"
                placeholderTextColor="#888"
                value={firstName}
                onChangeText={setFirstName}
              />
              <TextInput
                style={styles.input}
                placeholder="Organization / Company Name"
                placeholderTextColor="#888"
                value={orgName}
                onChangeText={setOrgName}
              />
            </>
          )}

          <TextInput
            style={styles.input}
            placeholder="Email or Phone Number"
            placeholderTextColor="#888"
            keyboardType="email-address"
            autoCapitalize="none"
            value={emailOrPhone}
            onChangeText={setEmailOrPhone}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={isRegistering ? handleRegister : handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{isRegistering ? 'Create Account' : 'Sign In'}</Text>
            )}
          </TouchableOpacity>

          <Text style={{ color: '#64748b', fontSize: 11, textAlign: 'center', marginTop: 14 }}>
            API Server: {API_BASE_URL}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // 2. MAIN APP SCREEN
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🏢 {user.organizationName || 'SMIB Properties'}</Text>
          <Text style={styles.headerSubtitle}>Welcome back, {user.firstName} ({user.roles.join(', ')})</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onBack ? (
            <TouchableOpacity style={styles.backBtn} onPress={onBack}>
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.logoutBtn} onPress={() => void handleLogout()}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Top Nav Tabs */}
      <View style={styles.navBar}>
        {(['dashboard', 'apartments', 'tenants', 'rent'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.navItem, activeTab === tab && styles.navItemActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.navText, activeTab === tab && styles.navTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Body Content */}
      <ScrollView style={styles.content}>
        {loading && <ActivityIndicator size="large" color="#4f46e5" style={{ marginVertical: 20 }} />}

        {/* 1. DASHBOARD TAB */}
        {activeTab === 'dashboard' && metrics && (
          <View>
            <Text style={styles.sectionTitle}>Overview & Metrics</Text>
            <View style={styles.grid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricNumber}>{metrics.summary.totalApartments}</Text>
                <Text style={styles.metricLabel}>Total Apartments</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={[styles.metricNumber, { color: '#10b981' }]}>
                  {metrics.summary.occupiedApartments}
                </Text>
                <Text style={styles.metricLabel}>Occupied</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={[styles.metricNumber, { color: '#f59e0b' }]}>
                  {metrics.summary.vacantApartments}
                </Text>
                <Text style={styles.metricLabel}>Vacant</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricNumber}>{metrics.occupancyRate}%</Text>
                <Text style={styles.metricLabel}>Occupancy Rate</Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Financial Summary</Text>
            <View style={styles.financeCard}>
              <View style={styles.financeRow}>
                <Text style={styles.financeLabel}>Expected Rent:</Text>
                <Text style={styles.financeValue}>₹{metrics.financials.expectedRent.toLocaleString()}</Text>
              </View>
              <View style={styles.financeRow}>
                <Text style={styles.financeLabel}>Collected Rent:</Text>
                <Text style={[styles.financeValue, { color: '#10b981' }]}>
                  ₹{metrics.financials.collectedRent.toLocaleString()}
                </Text>
              </View>
              <View style={styles.financeRow}>
                <Text style={styles.financeLabel}>Pending Rent:</Text>
                <Text style={[styles.financeValue, { color: '#ef4444' }]}>
                  ₹{metrics.financials.pendingRent.toLocaleString()}
                </Text>
              </View>
              <View style={styles.financeRow}>
                <Text style={styles.financeLabel}>Overdue Rent:</Text>
                <Text style={[styles.financeValue, { color: '#b91c1c' }]}>
                  ₹{metrics.financials.overdueRent.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* DASHBOARD RETRY FALLBACK */}
        {activeTab === 'dashboard' && !metrics && !loading && (
          <View style={{ alignItems: 'center', marginTop: 40, padding: 20 }}>
            <Text style={{ color: '#94a3b8', fontSize: 15, marginBottom: 16 }}>
              Unable to load dashboard metrics
            </Text>
            <TouchableOpacity style={styles.actionButton} onPress={() => loadTabData('dashboard')}>
              <Text style={styles.actionBtnText}>🔄 Retry Loading</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 2. APARTMENTS TAB */}
        {activeTab === 'apartments' && (
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.sectionTitle}>Apartments ({apartments.length})</Text>
              <TouchableOpacity style={styles.actionButton} onPress={() => openApartmentForm()}>
                <Text style={styles.actionBtnText}>➕ Add Apartment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => setShowBulkGen(!showBulkGen)}>
                <Text style={styles.actionBtnText}>⚡ Bulk Generator</Text>
              </TouchableOpacity>
            </View>

            {showBulkGen && (
              <View style={styles.bulkBox}>
                <Text style={styles.bulkTitle}>Bulk Create Units (e.g. 50-100 units)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Number of Floors (e.g. 10)"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                  value={floorsCount}
                  onChangeText={setFloorsCount}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Units per Floor (e.g. 10)"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                  value={unitsPerFloor}
                  onChangeText={setUnitsPerFloor}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Default Rent (₹)"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                  value={bulkRent}
                  onChangeText={setBulkRent}
                />
                <TouchableOpacity style={styles.primaryButton} onPress={handleBulkGenerate}>
                  <Text style={styles.buttonText}>Generate All Apartments</Text>
                </TouchableOpacity>
              </View>
            )}

            {apartments.map((apt) => (
              <View key={apt.id} style={styles.listItem}>
                <View>
                  <Text style={styles.itemTitle}>{apt.apartmentNumber}</Text>
                  <Text style={styles.itemSubtitle}>
                    {apt.buildingName} • Floor {apt.floorNumber ?? 'G'}
                  </Text>
                  <Text style={styles.itemTenant}>
                    {apt.currentTenant ? `Tenant: ${apt.currentTenant.name}` : 'Vacant'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.itemPrice}>₹{Number(apt.defaultRent).toLocaleString()}</Text>
                  <Text
                    style={[
                      styles.statusBadge,
                      apt.status === 'OCCUPIED' ? styles.badgeOccupied : styles.badgeVacant,
                    ]}
                  >
                    {apt.status}
                  </Text>
                    <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                      <TouchableOpacity
                        style={styles.btnEdit}
                        onPress={() => openApartmentForm(apt)}
                      >
                        <Text style={styles.btnActionText}>✏️ Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.btnDelete}
                        onPress={() => handleDeleteApartment(apt)}
                      >
                        <Text style={styles.btnActionText}>🗑️ Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

        {/* Delete Confirmation Modal */}
        <Modal
          visible={!!apartmentToDelete}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setApartmentToDelete(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>🗑️ Delete Apartment</Text>
              <Text style={styles.confirmSubtitle}>
                Are you sure you want to delete Unit{' '}
                <Text style={{ fontWeight: 'bold', color: '#fff' }}>
                  {apartmentToDelete?.apartmentNumber}
                </Text>
                ? This action cannot be undone.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#334155' }]}
                  onPress={() => setApartmentToDelete(null)}
                >
                  <Text style={styles.confirmBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#dc2626' }]}
                  onPress={() => apartmentToDelete && executeDelete(apartmentToDelete.id)}
                >
                  <Text style={styles.confirmBtnText}>Delete Unit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Apartment Form Modal */}
        <Modal visible={showApartmentForm} animationType="slide" transparent={false} onRequestClose={() => setShowApartmentForm(false)}>
          <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <ApartmentForm
              initialData={editingApartment || {}}
              onSuccess={() => {
                setShowApartmentForm(false);
                loadTabData('apartments');
              }}
              onCancel={() => setShowApartmentForm(false)}
            />
          </View>
        </Modal>
        {/* 3. TENANTS TAB */}
        {activeTab === 'tenants' && (
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.sectionTitle}>Tenants ({tenants.length})</Text>
              <TouchableOpacity style={styles.actionButton} onPress={() => openTenantForm()}>
                <Text style={styles.actionBtnText}>➕ Add Tenant</Text>
              </TouchableOpacity>
            </View>

            {tenants.map((t) => (
              <View key={t.id} style={styles.listItem}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.itemTitle}>{t.fullName}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        t.status === 'ACTIVE' ? styles.badgeOccupied : styles.badgeVacant,
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: 'bold',
                          color: t.status === 'ACTIVE' ? '#22c55e' : '#94a3b8',
                        }}
                      >
                        {t.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.itemSubtitle}>📞 {t.phone || 'No phone'}</Text>
                  {t.email ? <Text style={[styles.itemSubtitle, { fontSize: 11 }]}>✉️ {t.email}</Text> : null}
                  {t.governmentIdType || t.governmentIdNumber ? (
                    <Text style={[styles.itemSubtitle, { fontSize: 11, color: '#38bdf8' }]}>
                      🪪 {t.governmentIdType || 'ID'}: {t.governmentIdNumber || 'Recorded'}
                    </Text>
                  ) : null}
                  {t.emergencyContactPhone ? (
                    <Text style={[styles.itemSubtitle, { fontSize: 11, color: '#a78bfa' }]}>
                      🚨 Emergency: {t.emergencyContactName ? `${t.emergencyContactName} • ` : ''}{t.emergencyContactPhone}
                    </Text>
                  ) : null}
                  <Text style={styles.itemTenant}>
                    {t.currentApartment
                      ? `Unit: ${t.currentApartment.apartmentNumber} (${t.currentApartment.buildingName})`
                      : 'No Active Lease'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                    <TouchableOpacity
                      style={styles.btnEdit}
                      onPress={() => openTenantForm(t)}
                    >
                      <Text style={styles.btnActionText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnDelete}
                      onPress={() => handleDeleteTenant(t)}
                    >
                      <Text style={styles.btnActionText}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Delete Tenant Confirmation Modal */}
        <Modal
          visible={!!tenantToDelete}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setTenantToDelete(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>🗑️ Delete Tenant</Text>
              <Text style={styles.confirmSubtitle}>
                Are you sure you want to remove tenant{' '}
                <Text style={{ fontWeight: 'bold', color: '#fff' }}>
                  {tenantToDelete?.fullName}
                </Text>
                ? This action cannot be undone.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#334155' }]}
                  onPress={() => setTenantToDelete(null)}
                >
                  <Text style={styles.confirmBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#dc2626' }]}
                  onPress={() => tenantToDelete && executeDeleteTenant(tenantToDelete.id)}
                >
                  <Text style={styles.confirmBtnText}>Delete Tenant</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Tenant Form Modal */}
        <Modal
          visible={showTenantForm}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowTenantForm(false)}
        >
          <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <TenantForm
              initialData={editingTenant || {}}
              apartments={apartments}
              onSuccess={() => {
                setShowTenantForm(false);
                loadTabData('tenants');
                loadTabData('apartments');
              }}
              onCancel={() => setShowTenantForm(false)}
            />
          </View>
        </Modal>

        {/* 4. RENT TAB */}
        {activeTab === 'rent' && (
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.sectionTitle}>Rent & Payments</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#6366f1' }]}
                  onPress={() => {
                    setShowRecordPayment(!showRecordPayment);
                    setShowRentEngine(false);
                  }}
                >
                  <Text style={styles.actionBtnText}>💰 Pay</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#10b981' }]}
                  onPress={() => {
                    setShowRentEngine(!showRentEngine);
                    setShowRecordPayment(false);
                  }}
                >
                  <Text style={styles.actionBtnText}>⚡ Engine</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#f59e0b' }]}
                  onPress={handleProcessOverdue}
                >
                  <Text style={styles.actionBtnText}>⏰ Overdue</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sub-tab Switcher: Charges vs Payments */}
            <View style={{ flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 8, padding: 3, marginBottom: 14 }}>
              <TouchableOpacity
                style={[styles.toggleBtn, activeRentSubTab === 'charges' && styles.toggleBtnActive]}
                onPress={() => setActiveRentSubTab('charges')}
              >
                <Text style={[styles.toggleText, activeRentSubTab === 'charges' && styles.toggleTextActive, { fontSize: 13 }]}>
                  Monthly Charges ({rentCharges.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, activeRentSubTab === 'payments' && styles.toggleBtnActive]}
                onPress={() => setActiveRentSubTab('payments')}
              >
                <Text style={[styles.toggleText, activeRentSubTab === 'payments' && styles.toggleTextActive, { fontSize: 13 }]}>
                  Payment History ({payments.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* RECORD PAYMENT CARD */}
            {showRecordPayment && (
              <View style={styles.bulkBox}>
                <Text style={styles.bulkTitle}>💰 Record Tenant Payment</Text>
                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>
                  Intelligent allocation automatically clears oldest unpaid rent charges.
                </Text>

                {/* Unit Selector */}
                <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>Select Unit & Tenant</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {apartments
                      .filter((a) => a.currentTenant || a.status === 'OCCUPIED')
                      .map((apt) => {
                        const isSelected = payAptId === apt.id;
                        return (
                          <TouchableOpacity
                            key={apt.id}
                            style={[
                              styles.actionButton,
                              {
                                backgroundColor: isSelected ? '#4f46e5' : '#0f172a',
                                borderWidth: 1,
                                borderColor: isSelected ? '#818cf8' : '#334155',
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                              },
                            ]}
                            onPress={() => {
                              setPayAptId(apt.id);
                              if (apt.currentTenant) {
                                setPayTenantId(apt.currentTenant.id);
                              }
                              setPayAmount(String(apt.defaultRent));
                            }}
                          >
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                              Unit {apt.apartmentNumber}
                            </Text>
                            <Text style={{ color: '#94a3b8', fontSize: 11 }}>
                              {apt.currentTenant?.name || 'Tenant'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                </ScrollView>

                {/* Amount input */}
                <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>Payment Amount (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Amount (e.g. 15000)"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                  value={payAmount}
                  onChangeText={setPayAmount}
                />

                {/* Payment Method Selector */}
                <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>Payment Method</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                  {(['UPI', 'CASH', 'BANK_TRANSFER', 'CARD'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.toggleBtn,
                        payMethod === m && styles.toggleBtnActive,
                        { backgroundColor: payMethod === m ? '#4f46e5' : '#0f172a', paddingVertical: 6 },
                      ]}
                      onPress={() => setPayMethod(m)}
                    >
                      <Text style={[styles.toggleText, payMethod === m && styles.toggleTextActive, { fontSize: 11 }]}>
                        {m === 'BANK_TRANSFER' ? 'Bank' : m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Transaction Ref & Notes */}
                <TextInput
                  style={styles.input}
                  placeholder="Transaction / UTR / Reference (Optional)"
                  placeholderTextColor="#888"
                  value={payTxnId}
                  onChangeText={setPayTxnId}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Notes (e.g. October Rent + Partial)"
                  placeholderTextColor="#888"
                  value={payNotes}
                  onChangeText={setPayNotes}
                />

                <TouchableOpacity style={styles.primaryButton} onPress={handleRecordPayment}>
                  <Text style={styles.buttonText}>Confirm & Generate Receipt</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* RENT ENGINE GENERATOR CARD */}
            {showRentEngine && (
              <View style={styles.bulkBox}>
                <Text style={styles.bulkTitle}>⚡ Rent Engine (Monthly Generator)</Text>
                <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>
                  Idempotent generator creates charges for active leases without duplicate bills.
                </Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>Billing Year</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Year (e.g. 2026)"
                      placeholderTextColor="#888"
                      keyboardType="numeric"
                      value={rentGenYear}
                      onChangeText={setRentGenYear}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>Billing Month (1-12)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Month (e.g. 10)"
                      placeholderTextColor="#888"
                      keyboardType="numeric"
                      value={rentGenMonth}
                      onChangeText={setRentGenMonth}
                    />
                  </View>
                </View>

                {/* Option Toggles */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, isDryRun && styles.toggleBtnActive, { backgroundColor: isDryRun ? '#4f46e5' : '#0f172a' }]}
                    onPress={() => setIsDryRun(!isDryRun)}
                  >
                    <Text style={[styles.toggleText, isDryRun && styles.toggleTextActive, { fontSize: 12 }]}>
                      {isDryRun ? '🔍 Preview Mode ON' : '⚙️ Direct Create'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, prorateLeases && styles.toggleBtnActive, { backgroundColor: prorateLeases ? '#10b981' : '#0f172a' }]}
                    onPress={() => setProrateLeases(!prorateLeases)}
                  >
                    <Text style={[styles.toggleText, prorateLeases && styles.toggleTextActive, { fontSize: 12 }]}>
                      {prorateLeases ? '✂️ Prorate Active' : 'No Proration'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.primaryButton} onPress={handleRunRentEngine}>
                  <Text style={styles.buttonText}>
                    {isDryRun ? 'Preview Rent Charges' : 'Generate Monthly Rent'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* TAB 1: MONTHLY CHARGES */}
            {activeRentSubTab === 'charges' &&
              rentCharges.map((rc) => (
                <View key={rc.id} style={styles.listItem}>
                  <View>
                    <Text style={styles.itemTitle}>Unit {rc.apartmentNumber}</Text>
                    <Text style={styles.itemSubtitle}>Tenant: {rc.tenantName}</Text>
                    <Text style={styles.itemTenant}>Period: {rc.billingMonth}/{rc.billingYear}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.itemPrice}>₹{rc.totalAmount.toLocaleString()}</Text>
                    <Text
                      style={[
                        styles.statusBadge,
                        rc.status === 'PAID'
                          ? styles.badgeOccupied
                          : rc.status === 'OVERDUE'
                            ? { backgroundColor: '#7f1d1d', color: '#fca5a5' }
                            : styles.badgeVacant,
                      ]}
                    >
                      {rc.status}
                    </Text>
                  </View>
                </View>
              ))}

            {/* TAB 2: PAYMENT HISTORY & RECEIPTS */}
            {activeRentSubTab === 'payments' && (
              <View>
                {payments.length === 0 ? (
                  <View style={{ alignItems: 'center', padding: 30 }}>
                    <Text style={{ color: '#94a3b8', fontSize: 14 }}>No payments recorded yet.</Text>
                  </View>
                ) : (
                  payments.map((p) => (
                    <View key={p.id} style={styles.listItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>
                          {p.apartment ? `Unit ${p.apartment.apartmentNumber}` : 'Apartment'} • {p.tenant?.name || 'Tenant'}
                        </Text>
                        <Text style={styles.itemSubtitle}>
                          {p.methodName} {p.transactionId ? `(${p.transactionId})` : ''} • {new Date(p.paymentDate).toLocaleDateString()}
                        </Text>
                        {p.receiptNumber && (
                          <Text style={{ color: '#818cf8', fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                            🧾 {p.receiptNumber}
                          </Text>
                        )}
                        {p.allocations.length > 0 && (
                          <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                            Allocated: {p.allocations.map((a) => `${a.period} (₹${a.amount.toLocaleString()})`).join(', ')}
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                        <Text style={[styles.itemPrice, { color: '#10b981' }]}>
                          +₹{p.amount.toLocaleString()}
                        </Text>
                        <Text style={[styles.statusBadge, styles.badgeOccupied, { fontSize: 10, marginTop: 4 }]}>
                          {p.status}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#0b1329',
    justifyContent: 'center',
    padding: 20,
  },
  authCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  authLogo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    marginBottom: 16,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#4f46e5',
  },
  toggleText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  primaryButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  backBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  backText: {
    color: '#cbd5e1',
    fontWeight: '600',
    fontSize: 12,
  },
  logoutText: {
    color: '#f87171',
    fontWeight: '600',
    fontSize: 12,
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  navItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  navItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
  },
  navText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 13,
  },
  navTextActive: {
    color: '#6366f1',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  metricLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  financeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  financeLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  financeValue: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  bulkBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  bulkTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 12,
  },
  listItem: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  itemSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  itemTenant: {
    fontSize: 12,
    color: '#38bdf8',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94a3b8',
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  badgeOccupied: {
    color: '#10b981',
    backgroundColor: '#064e3b',
  },
  badgeVacant: {
    color: '#f59e0b',
    backgroundColor: '#78350f',
  },
  btnEdit: {
    backgroundColor: '#3b82f6',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  btnDelete: {
    backgroundColor: '#dc2626',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  btnActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmBox: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#334155',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  confirmSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
