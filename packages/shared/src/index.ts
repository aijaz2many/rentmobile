import { z } from 'zod';

export const RoleSchema = z.enum(['OWNER', 'MANAGER', 'TENANT']);
export type UserRole = z.infer<typeof RoleSchema>;

export const PermissionSchema = z.enum([
  'VIEW_DASHBOARD',
  'MANAGE_PROPERTIES',
  'MANAGE_TENANTS',
  'MANAGE_LEASES',
  'VIEW_FINANCIALS',
  'RECORD_PAYMENTS',
  'MANAGE_MAINTENANCE',
  'VIEW_REPORTS',
  'MANAGE_ORGANIZATION',
]);
export type Permission = z.infer<typeof PermissionSchema>;

export const rolePermissions: Record<UserRole, Permission[]> = {
  OWNER: [
    'VIEW_DASHBOARD',
    'MANAGE_PROPERTIES',
    'MANAGE_TENANTS',
    'MANAGE_LEASES',
    'VIEW_FINANCIALS',
    'RECORD_PAYMENTS',
    'MANAGE_MAINTENANCE',
    'VIEW_REPORTS',
    'MANAGE_ORGANIZATION',
  ],
  MANAGER: [
    'VIEW_DASHBOARD',
    'MANAGE_PROPERTIES',
    'MANAGE_TENANTS',
    'MANAGE_LEASES',
    'VIEW_FINANCIALS',
    'RECORD_PAYMENTS',
    'MANAGE_MAINTENANCE',
    'VIEW_REPORTS',
  ],
  TENANT: ['VIEW_DASHBOARD', 'VIEW_FINANCIALS', 'VIEW_REPORTS'],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export interface SharedUser {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string | null;
  roles: UserRole[];
  organizationId?: string;
  status?: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const LoginInputSchema = z.object({
  emailOrPhone: z.string().min(3),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RegisterInputSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  organizationName: z.string().min(2),
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const RentChargeSchema = z.object({
  apartmentId: z.string(),
  tenantId: z.string(),
  billingMonth: z.number().int().min(1).max(12),
  billingYear: z.number().int().min(2000),
  amountDue: z.number().nonnegative(),
  paidAmount: z.number().nonnegative().default(0),
});

export type RentCharge = z.infer<typeof RentChargeSchema>;

export const PaymentAllocationSchema = z.object({
  amount: z.number().positive(),
  rentChargeId: z.string(),
});

export type PaymentAllocation = z.infer<typeof PaymentAllocationSchema>;

export const DashboardMetricSchema = z.object({
  summary: z.object({
    totalProperties: z.number().int().nonnegative(),
    totalBuildings: z.number().int().nonnegative(),
    totalApartments: z.number().int().nonnegative(),
    occupiedApartments: z.number().int().nonnegative(),
    vacantApartments: z.number().int().nonnegative(),
    totalTenants: z.number().int().nonnegative(),
    maintenanceRequests: z.number().int().nonnegative(),
  }),
  financials: z.object({
    expectedRent: z.number().nonnegative(),
    collectedRent: z.number().nonnegative(),
    pendingRent: z.number().nonnegative(),
    overdueRent: z.number().nonnegative(),
    totalExpenses: z.number().nonnegative(),
    currency: z.string(),
  }),
  occupancyRate: z.number().nonnegative(),
});

export type DashboardMetric = z.infer<typeof DashboardMetricSchema>;
