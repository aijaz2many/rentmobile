import { Platform } from 'react-native';
import type { SharedUser, UserRole } from '@rentmobile/shared';

//const defaultApiUrl = Platform.OS === 'android'  ? 'http://10.0.2.2:5000/api'  : 'http://localhost:5000/api';
const defaultApiUrl = 'https://rentbackend-fyq3.onrender.com/api';
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || defaultApiUrl).replace(/\/+$/, '');

export type { UserRole };

export interface User extends SharedUser {
  id: string;
  organizationId: string;
  organizationName?: string;
  firstName: string;
  lastName?: string;
  email: string | null;
  phone: string | null;
  roles: UserRole[];
  tenantId?: string;
  status?: string;
  profileImageUrl?: string | null;
}

export interface DashboardMetrics {
  summary: {
    totalProperties: number;
    totalBuildings: number;
    totalApartments: number;
    occupiedApartments: number;
    vacantApartments: number;
    totalTenants: number;
    maintenanceRequests: number;
  };
  financials: {
    expectedRent: number;
    collectedRent: number;
    pendingRent: number;
    overdueRent: number;
    totalExpenses: number;
    currency: string;
  };
  occupancyRate: number;
}

export interface Building {
  id: string;
  name: string;
  code?: string;
  numberOfFloors?: number;
  description?: string;
  status: string;
  _count?: {
    tsmib_apartments: number;
    tsmib_floors: number;
  };
}

export interface Apartment {
  id: string;
  buildingId: string;
  buildingName: string;
  floorId?: string;
  floorNumber?: number;
  floorName?: string;
  apartmentNumber: string;
  block?: string;
  apartmentTypeId?: string;
  apartmentTypeName?: string;
  apartmentTypeCode?: string;
  bedrooms?: number;
  bathrooms?: number;
  defaultRent: string | number;
  securityDeposit?: string | number | null;
  statusId?: string;
  status: string;
  statusName: string;
  notes?: string;
  currentTenant?: {
    id: string;
    name: string;
    phone: string;
  } | null;
}

export interface GovernmentIdType {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface Tenant {
  id: string;
  firstName: string;
  lastName?: string;
  fullName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  address?: string;
  governmentIdTypeId?: string;
  governmentIdType?: string;
  governmentIdTypeCode?: string;
  governmentIdNumber?: string;
  notes?: string;
  status: string;
  currentApartment?: {
    id: string;
    apartmentNumber: string;
    buildingName: string;
    monthlyRent: number;
  } | null;
}

export interface RentCharge {
  id: string;
  apartmentNumber: string;
  buildingName: string;
  tenantName: string;
  billingYear: number;
  billingMonth: number;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: string;
}

export interface PaymentRecord {
  id: string;
  paymentReference: string;
  amount: number;
  paymentDate: string;
  methodCode: string;
  methodName: string;
  transactionId?: string | null;
  status: string;
  notes?: string | null;
  receiptNumber?: string | null;
  tenant?: {
    id: string;
    name: string;
    phone?: string;
  } | null;
  apartment?: {
    id: string;
    apartmentNumber: string;
    buildingName: string;
  } | null;
  allocations: {
    id: string;
    amount: number;
    rentChargeId: string;
    period: string;
    chargeStatus: string;
  }[];
}
export interface Receipt {
  id: string;
  receiptNumber: string;
  generatedAt: string;
  amount: number;
  paymentDate?: string;
  method?: string;
  tenantName?: string;
  apartmentNumber?: string;
  buildingName?: string;
  receiptUrl?: string;
}
