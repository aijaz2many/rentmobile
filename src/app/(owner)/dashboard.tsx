import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { DashboardMetrics } from '../../types';
import { getDashboardMetrics } from '../../modules/dashboard';
import { invalidateApiCache } from '../../services/api';
import { Card, ErrorMessage, Loading, Page, styles } from '../../components/AppUi';

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card style={{ flex: 1, minWidth: '45%' }}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </Card>
  );
}

export default function OwnerDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getDashboardMetrics()
      .then((result) => {
        if (active) {
          setMetrics(result as unknown as DashboardMetrics);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load the dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const refresh = async () => {
    invalidateApiCache();
    setLoading(true);
    setError(null);
    try {
      setMetrics((await getDashboardMetrics()) as unknown as DashboardMetrics);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the dashboard.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page title="Dashboard" subtitle="Your portfolio at a glance." refreshing={loading} onRefresh={() => void refresh()}>
      {loading ? <Loading /> : null}
      {error ? <ErrorMessage message={error} onRetry={() => void refresh()} /> : null}
      {metrics ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Metric label="Properties" value={metrics.summary.totalProperties} />
            <Metric label="Apartments" value={metrics.summary.totalApartments} />
            <Metric label="Occupied" value={metrics.summary.occupiedApartments} />
            <Metric label="Tenants" value={metrics.summary.totalTenants} />
          </View>
          <Text style={styles.sectionTitle}>This month</Text>
          <Card>
            <View style={styles.row}><Text style={styles.label}>Expected rent</Text><Text style={styles.value}>{metrics.financials.currency} {metrics.financials.expectedRent.toLocaleString()}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Collected</Text><Text style={styles.value}>{metrics.financials.currency} {metrics.financials.collectedRent.toLocaleString()}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Pending</Text><Text style={styles.value}>{metrics.financials.currency} {metrics.financials.pendingRent.toLocaleString()}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Occupancy</Text><Text style={styles.value}>{metrics.occupancyRate.toFixed(1)}%</Text></View>
          </Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <Metric label="Maintenance requests" value={metrics.summary.maintenanceRequests} />
            <Metric label="Vacant apartments" value={metrics.summary.vacantApartments} />
          </View>
        </>
      ) : null}
    </Page>
  );
}
