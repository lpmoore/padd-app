import { describe, expect, it } from 'vitest';

import {
  formatDateForDisplay,
  formatDateForInput,
  formatDateForStorage,
  formatLogDate,
} from './dateUtils';
import { calculateStardate } from './stardate';

describe('formatDateForInput / formatDateForStorage', () => {
  it('round-trips a local datetime-local value through UTC storage', () => {
    for (const local of ['2026-10-22T14:30', '2026-03-08T03:15', '2026-12-31T23:59']) {
      expect(formatDateForInput(formatDateForStorage(local))).toBe(local);
    }
  });

  it('stores as a UTC ISO string', () => {
    expect(formatDateForStorage('2026-10-22T14:30')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it('returns empty values for missing input', () => {
    expect(formatDateForInput(null)).toBe('');
    expect(formatDateForInput('')).toBe('');
    expect(formatDateForStorage('')).toBeNull();
  });
});

describe('formatDateForDisplay', () => {
  const value = '2026-10-22T14:30';

  it('formats Stardates with a STARDATE prefix', () => {
    expect(formatDateForDisplay(value, true)).toBe(
      `STARDATE ${calculateStardate(new Date(value))}`,
    );
  });

  it('includes the time by default and omits it on request', () => {
    expect(formatDateForDisplay(value)).toMatch(/2026.*\d{1,2}:30/);
    const dateOnly = formatDateForDisplay(value, false, { includeTime: false });
    expect(dateOnly).toContain('2026');
    expect(dateOnly).not.toMatch(/:\d{2}/);
  });

  it('accepts Date objects', () => {
    expect(formatDateForDisplay(new Date(value), true)).toBe(
      formatDateForDisplay(value, true),
    );
  });

  it('returns an empty string for missing or invalid input', () => {
    expect(formatDateForDisplay('')).toBe('');
    expect(formatDateForDisplay(null, true)).toBe('');
    expect(formatDateForDisplay('not a date')).toBe('');
    expect(formatDateForDisplay('not a date', true)).toBe('');
  });
});

describe('formatLogDate', () => {
  it('returns a bare stardate when enabled', () => {
    expect(formatLogDate('2026-10-22T14:30', true)).toBe(
      calculateStardate(new Date('2026-10-22T14:30')),
    );
  });

  it('returns an uppercase Earth date otherwise', () => {
    const result = formatLogDate('2026-10-22T14:30');
    expect(result).toBe(result.toUpperCase());
    expect(result).toContain('2026');
  });

  it('labels missing dates', () => {
    expect(formatLogDate(null)).toBe('UNKNOWN DATE');
  });
});
