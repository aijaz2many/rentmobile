import { describe, expect, it } from 'vitest';
import { canAccess } from '../lib/permissions';
import { allocatePayment, calculateOutstandingBalance, validateLeaseWindow } from '../lib/finance';

describe('shared permission model', () => {
  it('allows owners to manage properties', () => {
    expect(canAccess('MANAGE_PROPERTIES', ['OWNER'])).toBe(true);
    expect(canAccess('MANAGE_PROPERTIES', ['TENANT'])).toBe(false);
  });

  it('denies tenants from managing financial records', () => {
    expect(canAccess('VIEW_FINANCIALS', ['TENANT'])).toBe(true);
    expect(canAccess('RECORD_PAYMENTS', ['TENANT'])).toBe(false);
  });
});

describe('finance operations', () => {
  it('calculates the outstanding balance from unpaid rent', () => {
    expect(
      calculateOutstandingBalance([
        { id: 'c1', amountDue: 1200, paidAmount: 800 },
        { id: 'c2', amountDue: 1500, paidAmount: 0 },
      ])
    ).toBe(1900);
  });

  it('allocates a payment across the oldest outstanding charges', () => {
    const result = allocatePayment(300, [
      { id: 'c1', amountDue: 200, paidAmount: 100 },
      { id: 'c2', amountDue: 500, paidAmount: 100 },
      { id: 'c3', amountDue: 300, paidAmount: 0 },
    ]);

    expect(result.remaining).toBe(0);
    expect(result.allocations).toEqual([
      { chargeId: 'c1', amount: 100 },
      { chargeId: 'c2', amount: 200 },
    ]);
  });

  it('rejects invalid lease windows', () => {
    expect(validateLeaseWindow('2026-06-01', '2026-06-01')).toBe(false);
    expect(validateLeaseWindow('2026-06-01', '2026-09-01')).toBe(true);
  });
});
