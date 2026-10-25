export type FinanceCharge = {
  id: string;
  amountDue: number;
  paidAmount?: number;
  status?: string;
};

export type PaymentAllocation = {
  chargeId: string;
  amount: number;
};

export function calculateOutstandingBalance(charges: FinanceCharge[]): number {
  return charges.reduce((total, charge) => {
    const paid = Number(charge.paidAmount ?? 0);
    return total + Math.max(0, Number(charge.amountDue) - paid);
  }, 0);
}

export function allocatePayment(amount: number, charges: FinanceCharge[]): {
  remaining: number;
  allocations: PaymentAllocation[];
} {
  const remaining = Number(amount) || 0;
  const allocations: PaymentAllocation[] = [];
  const queue = [...charges].filter(
    (charge) => Number(charge.amountDue) > Number(charge.paidAmount ?? 0)
  );

  let balance = remaining;

  for (const charge of queue) {
    if (balance <= 0) break;
    const outstanding = Number(charge.amountDue) - Number(charge.paidAmount ?? 0);
    const applied = Math.min(balance, Math.max(0, outstanding));
    if (applied > 0) {
      allocations.push({ chargeId: charge.id, amount: applied });
      balance -= applied;
    }
  }

  return { remaining: balance, allocations };
}

export function validateLeaseWindow(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return false;
  return new Date(startDate).getTime() < new Date(endDate).getTime();
}
