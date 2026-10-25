import { describe, expect, it } from 'vitest';
import { formatDate, hasNoEndDateOrEndsAfter, isDateField, parseDateInput } from '../lib/date';

describe('date formatting', () => {
  it('formats ISO dates and timestamps as dd-MMM-YYYY', () => {
    expect(formatDate('2026-01-05')).toBe('05-Jan-2026');
    expect(formatDate('2026-10-25T14:30:00.000Z')).toBe('25-Oct-2026');
  });

  it('parses dd-MMM-YYYY and ISO date input for API requests', () => {
    expect(parseDateInput('05-Jan-2026')).toBe('2026-01-05');
    expect(parseDateInput('5-jan-2026')).toBe('2026-01-05');
    expect(parseDateInput('2026-01-05')).toBe('2026-01-05');
  });

  it('rejects invalid dates and recognizes date fields', () => {
    expect(parseDateInput('31-Feb-2026')).toBeNull();
    expect(parseDateInput('not a date')).toBeNull();
    expect(isDateField('date_of_birth')).toBe(true);
    expect(isDateField('startDate')).toBe(true);
    expect(isDateField('created_at')).toBe(true);
    expect(isDateField('amount')).toBe(false);
  });

  it('keeps leases with no end date or an end date later than today', () => {
    expect(hasNoEndDateOrEndsAfter(null, '2026-10-25')).toBe(true);
    expect(hasNoEndDateOrEndsAfter(undefined, '2026-10-25')).toBe(true);
    expect(hasNoEndDateOrEndsAfter('2026-10-26T00:00:00.000Z', '2026-10-25')).toBe(true);
    expect(hasNoEndDateOrEndsAfter('2026-10-25', '2026-10-25')).toBe(false);
    expect(hasNoEndDateOrEndsAfter('2026-10-24', '2026-10-25')).toBe(false);
    expect(hasNoEndDateOrEndsAfter('not-a-date', '2026-10-25')).toBe(false);
  });
});
