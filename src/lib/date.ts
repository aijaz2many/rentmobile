const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function isDateField(key: string): boolean {
  return /(?:^|_)date(?:_|$)|Date$|(?:^|_)at$/i.test(key);
}

function isoDateParts(value: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return [year, month, day];
}

export function formatDate(value: unknown): string {
  if (typeof value !== 'string' && !(value instanceof Date)) return String(value ?? '');

  const text = value instanceof Date ? value.toISOString() : value;
  const parts = isoDateParts(text);
  if (parts) {
    const [year, month, day] = parts;
    return `${String(day).padStart(2, '0')}-${monthNames[month - 1]}-${year}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return `${String(parsed.getUTCDate()).padStart(2, '0')}-${monthNames[parsed.getUTCMonth()]}-${parsed.getUTCFullYear()}`;
}

export function parseDateInput(value: string): string | null {
  const text = value.trim();
  if (!text) return '';

  const isoParts = isoDateParts(text);
  if (isoParts) {
    const [year, month, day] = isoParts;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(text);
  if (!match) return null;
  const day = Number(match[1]);
  const month = monthNames.findIndex((name) => name.toLowerCase() === match[2].toLowerCase()) + 1;
  const year = Number(match[3]);
  if (month === 0) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function hasNoEndDateOrEndsAfter(endDate: unknown, today: string): boolean {
  if (endDate === null || endDate === undefined || endDate === '') return true;
  if (typeof endDate !== 'string') return false;
  const parsedEndDate = parseDateInput(endDate.slice(0, 10));
  return parsedEndDate !== null && parsedEndDate > today;
}
