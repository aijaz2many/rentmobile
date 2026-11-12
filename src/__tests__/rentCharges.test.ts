import { describe, expect, it } from 'vitest';
import { filterRentCharges, summarizeRentCharges } from '../lib/rentCharges';

describe('rent charge summaries', () => {
  it('calculates totals from charge and payment allocation amounts', () => {
    expect(summarizeRentCharges([
      { status: 'PAID', totalAmount: 1200, paidAmount: 1200, pendingAmount: 0 },
      { status: 'PENDING', totalAmount: 1350, paidAmount: 0, pendingAmount: 1350 },
      { status: 'PARTIALLY_PAID', totalAmount: 1500, paidAmount: 500, pendingAmount: 1000 },
      { status: 'OVERDUE', totalAmount: 1100, paidAmount: 100, pendingAmount: 1000 },
    ])).toEqual({
      totalCount: 4,
      totalAmount: 5150,
      paidCount: 1,
      paidAmount: 1800,
      pendingCount: 2,
      pendingAmount: 2350,
      overdueCount: 1,
      overdueAmount: 1000,
    });

    describe('rent charge filters', () => {
      const charges = [
        { id: 'one', propertyId: 'smib', buildingId: 'north', status: 'PENDING', billingMonth: 1, dueDate: '2026-01-05' },
        { id: 'two', propertyId: 'smib', buildingId: 'south', status: 'PAID', billingMonth: 2, dueDate: '2026-02-05' },
        { id: 'three', propertyId: 'other', buildingId: 'east', status: 'PENDING', billingMonth: 1, dueDate: '2026-01-01' },
      ];

      it('filters a selected property by its ID and supports the All Months selection', () => {
        expect(filterRentCharges(charges, { propertyId: 'smib' }).map(({ id }) => id)).toEqual(['two', 'one']);
        expect(filterRentCharges(charges, { propertyId: 'smib', month: '' }).map(({ id }) => id)).toEqual(['two', 'one']);
      });

      it('combines building, status, and month selections', () => {
        expect(filterRentCharges(charges, {
          propertyId: 'smib',
          buildingId: 'north',
          status: 'PENDING',
          month: '1',
        }).map(({ id }) => id)).toEqual(['one']);
      });
    });
  });

  it('excludes cancelled charges from financial totals and counts', () => {
    expect(summarizeRentCharges([
      { status: 'CANCELLED', totalAmount: 2000, paidAmount: 0, pendingAmount: 2000 },
      { status: 'PAID', totalAmount: '900', paidAmount: '900', pendingAmount: '0' },
    ])).toEqual({
      totalCount: 1,
      totalAmount: 900,
      paidCount: 1,
      paidAmount: 900,
      pendingCount: 0,
      pendingAmount: 0,
      overdueCount: 0,
      overdueAmount: 0,
    });
  });

  describe('rent charge search', () => {
    const charges = [
      {
        id: 'one',
        propertyName: 'SMIB Manzil',
        buildingName: 'North Block',
        apartmentNumber: 'A-101',
        tenantName: 'Asha Patel',
        billingMonth: 10,
        billingYear: 2026,
        status: 'PENDING',
        dueDate: '2026-10-05',
      },
      {
        id: 'two',
        propertyName: 'Other Property',
        buildingName: 'South Block',
        apartmentNumber: 'B-204',
        tenantName: 'Ravi Kumar',
        billingMonth: 9,
        billingYear: 2026,
        status: 'PAID',
        dueDate: '2026-09-05',
      },
    ];

    it('matches tenant, apartment, property, month, and year case-insensitively', () => {
      expect(filterRentCharges(charges, { search: 'asha' }).map(({ id }) => id)).toEqual(['one']);
      expect(filterRentCharges(charges, { search: 'A-101' }).map(({ id }) => id)).toEqual(['one']);
      expect(filterRentCharges(charges, { search: 'smib' }).map(({ id }) => id)).toEqual(['one']);
      expect(filterRentCharges(charges, { search: '10' }).map(({ id }) => id)).toEqual(['one']);
      expect(filterRentCharges(charges, { search: '2026' }).map(({ id }) => id)).toEqual(['one', 'two']);
    });
  });
});
