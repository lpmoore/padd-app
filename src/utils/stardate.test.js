import { describe, expect, it } from 'vitest';

import { calculateStardate } from './stardate';

// Tests run with TZ=America/Los_Angeles (see package.json) to exercise DST.
describe('calculateStardate', () => {
  it('maps the start and end of a year', () => {
    // 2026 + 377 = 2403 → 80000 base; Jan 1 is day 1
    expect(calculateStardate(new Date(2026, 0, 1))).toBe('80002.7');
    expect(calculateStardate(new Date(2026, 11, 31))).toBe('80999.3');
  });

  it('accepts ISO strings and timestamps', () => {
    const date = new Date(2026, 9, 22, 14, 30);
    expect(calculateStardate(date.toISOString())).toBe(calculateStardate(date));
    expect(calculateStardate(date.getTime())).toBe(calculateStardate(date));
  });

  it('gives every time on the same local day the same stardate, even during DST', () => {
    // 2026-07-04 is in Pacific daylight time
    const justAfterMidnight = new Date(2026, 6, 4, 0, 30);
    const evening = new Date(2026, 6, 4, 23, 30);
    expect(calculateStardate(justAfterMidnight)).toBe(calculateStardate(evening));
  });

  it('increases day over day across DST transitions', () => {
    const days = [
      new Date(2026, 2, 7), // day before spring forward (Mar 8)
      new Date(2026, 2, 8),
      new Date(2026, 2, 9),
      new Date(2026, 9, 31), // day before fall back (Nov 1)
      new Date(2026, 10, 1),
      new Date(2026, 10, 2),
    ].map((d) => Number(calculateStardate(d)));

    for (let i = 1; i < days.length; i++) {
      expect(days[i]).toBeGreaterThan(days[i - 1]);
    }
  });

  it('continues upward across a year boundary', () => {
    expect(Number(calculateStardate(new Date(2027, 0, 1)))).toBeGreaterThan(
      Number(calculateStardate(new Date(2026, 11, 31))),
    );
  });
});
