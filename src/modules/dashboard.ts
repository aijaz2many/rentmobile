import { DashboardMetricSchema, type DashboardMetric } from '@rentmobile/shared';
import { apiRequest } from '../services/api';

export type DashboardSummary = DashboardMetric;

export async function getDashboardMetrics(): Promise<DashboardSummary> {
  const payload = await apiRequest<unknown>('/dashboard/metrics');
  const parsed = DashboardMetricSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error('Dashboard payload is invalid.');
  }

  return parsed.data;
}