export type RentChargeSummaryInput = {
  status?: unknown;
  totalAmount?: unknown;
  paidAmount?: unknown;
  pendingAmount?: unknown;
};

export type RentChargeFilterInput = {
  propertyId?: string;
  propertyName?: string;
  buildingId?: string;
  buildingName?: string;
  apartmentNumber?: string;
  tenantName?: string;
  status?: string;
  statusName?: string;
  billingYear?: unknown;
  billingMonth?: unknown;
  dueDate?: unknown;
};

export type RentChargeFilters = {
  propertyId?: string;
  buildingId?: string;
  status?: string;
  month?: string;
  search?: string;
};

export type RentChargeSummary = {
  totalCount: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  pendingCount: number;
  pendingAmount: number;
  overdueCount: number;
  overdueAmount: number;
};

function amountOf(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function summarizeRentCharges(charges: RentChargeSummaryInput[]): RentChargeSummary {
  return charges.reduce<RentChargeSummary>((totals, charge) => {
    const status = String(charge.status ?? '').toUpperCase();
    if (status === 'CANCELLED') return totals;

    totals.totalCount += 1;
    totals.totalAmount += amountOf(charge.totalAmount);
    totals.paidAmount += amountOf(charge.paidAmount);
    if (status === 'PAID') totals.paidCount += 1;
    if (status === 'PENDING' || status === 'PARTIALLY_PAID') {
      totals.pendingCount += 1;
      totals.pendingAmount += amountOf(charge.pendingAmount);
    }
    if (status === 'OVERDUE') {
      totals.overdueCount += 1;
      totals.overdueAmount += amountOf(charge.pendingAmount);
    }
    return totals;
  }, {
    totalCount: 0,
    totalAmount: 0,
    paidCount: 0,
    paidAmount: 0,
    pendingCount: 0,
    pendingAmount: 0,
    overdueCount: 0,
    overdueAmount: 0,
  });
}

export function filterRentCharges<T extends RentChargeFilterInput>(
  charges: T[],
  filters: RentChargeFilters,
): T[] {
  return charges
    .filter((charge) => !filters.propertyId || charge.propertyId === filters.propertyId)
    .filter((charge) => !filters.buildingId || charge.buildingId === filters.buildingId)
    .filter((charge) => !filters.status || charge.status === filters.status)
    .filter((charge) => !filters.month || String(charge.billingMonth) === filters.month)
    .filter((charge) => {
      const query = filters.search?.trim().toLowerCase();
      if (!query) return true;
      return [
        charge.propertyName,
        charge.buildingName,
        charge.apartmentNumber,
        charge.tenantName,
        charge.status,
        charge.statusName,
        charge.billingMonth === undefined ? undefined : String(charge.billingMonth),
        charge.billingYear === undefined ? undefined : String(charge.billingYear),
        charge.dueDate === undefined ? undefined : String(charge.dueDate),
      ].some((value) => value?.toLowerCase().includes(query));
    })
    .sort((left, right) => String(right.dueDate ?? '').localeCompare(String(left.dueDate ?? '')));
}
