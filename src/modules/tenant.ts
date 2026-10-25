import { apiRequest } from '../services/api';

export type TenantProfile = {
  id: string;
  fullName?: string;
  firstName?: string;
  currentApartment?: {
    id: string;
    apartmentNumber: string;
    buildingName: string;
    monthlyRent: number;
  } | null;
};

export type MaintenanceCategory = {
  id: string;
  name: string;
};

export type MaintenanceStatus = {
  id: string;
  code: MaintenanceStatusCode;
  name: string;
};

export type MaintenanceStatusCode =
  | 'SUBMITTED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_PARTS'
  | 'COMPLETED'
  | 'CANCELLED';

export type MaintenanceRequestInput = {
  apartmentId: string;
  tenantId: string;
  categoryId: string;
  priorityCode: string;
  title: string;
  description: string;
  statusCode?: MaintenanceStatusCode;
};

type MaintenanceLookups = {
  categories: MaintenanceCategory[];
  statuses: MaintenanceStatus[];
};

export async function getTenantProfile(tenantId: string): Promise<TenantProfile> {
  return apiRequest<TenantProfile>(`/tenants/${tenantId}`);
}

export async function getTenantLeases(tenantId: string): Promise<unknown[]> {
  return apiRequest<unknown[]>(`/leases?tenantId=${encodeURIComponent(tenantId)}`);
}

export async function getTenantRentCharges(tenantId: string): Promise<unknown[]> {
  const charges = await apiRequest<unknown[]>('/rent/charges');
  return charges.filter((charge) => {
    const value = (charge as { tenantId?: string } | null)?.tenantId;
    return !value || value === tenantId;
  });
}

export async function getOutstandingBalance(tenantId: string): Promise<Record<string, unknown>> {
  return apiRequest<Record<string, unknown>>(`/payments/outstanding?tenantId=${encodeURIComponent(tenantId)}`);
}

export async function getPaymentHistory(tenantId: string): Promise<unknown[]> {
  return apiRequest<unknown[]>(`/payments?tenantId=${encodeURIComponent(tenantId)}`);
}

export async function getMaintenanceCategories(): Promise<MaintenanceCategory[]> {
  const lookups = await apiRequest<MaintenanceLookups>('/maintenance/meta/lookups');
  return lookups.categories;
}

export async function submitMaintenanceRequest(input: MaintenanceRequestInput) {
  return apiRequest<unknown>('/maintenance', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateMaintenanceRequest(
  requestId: string,
  input: Omit<MaintenanceRequestInput, 'apartmentId' | 'tenantId' | 'statusCode'>,
) {
  return apiRequest<unknown>(`/maintenance/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function withdrawMaintenanceRequest(requestId: string) {
  return apiRequest<unknown>(`/maintenance/${encodeURIComponent(requestId)}`, {
    method: 'DELETE',
  });
}