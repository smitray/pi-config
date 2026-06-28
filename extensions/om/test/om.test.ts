import { describe, expect, it } from 'vitest';
import { parseDateQuery } from '../lib/om';

describe('parseDateQuery', () => {
  it('parses "today" in UTC', () => {
    const { start, end } = parseDateQuery('today', 0);
    expect(start.getTime()).toBeLessThan(end.getTime());
    expect(end.getTime() - start.getTime()).toBe(86400000);
  });

  it('parses "yesterday" in UTC', () => {
    const { start, end } = parseDateQuery('yesterday', 0);
    expect(end.getTime() - start.getTime()).toBe(86400000);
  });

  it('parses "yesterday" with IST offset (+5.5)', () => {
    const { start, end } = parseDateQuery('yesterday', 5.5);
    // Should shift back 5.5 hours from local midnight
    expect(end.getTime() - start.getTime()).toBe(86400000);
  });

  it('parses YYYY-MM-DD with UTC offset', () => {
    const { start, end } = parseDateQuery('2026-06-28', 0);
    // With offset 0, start should be 2026-06-28T00:00:00Z
    expect(start.getUTCFullYear()).toBe(2026);
    expect(start.getUTCMonth()).toBe(5); // June = 5
    expect(start.getUTCDate()).toBe(28);
    expect(start.getUTCHours()).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(86400000);
  });

  it('parses YYYY-MM-DD with positive offset', () => {
    const { start, end } = parseDateQuery('2026-06-28', 5.5);
    // With IST (+5.5), local midnight 2026-06-28 = UTC 2026-06-27T18:30
    expect(start.getUTCFullYear()).toBe(2026);
    expect(start.getUTCMonth()).toBe(5); // June
    expect(start.getUTCDate()).toBe(27); // Day before due to offset
    expect(start.getUTCHours()).toBe(18);
    expect(start.getUTCMinutes()).toBe(30);
    expect(end.getTime() - start.getTime()).toBe(86400000);
  });

  it('parses "last N days"', () => {
    const { start, end } = parseDateQuery('last 3 days', 0);
    // last 3 days = today + 3 previous days = 4 days total
    expect(end.getTime() - start.getTime()).toBe(4 * 86400000);
  });

  it('defaults to today for unknown input', () => {
    const { start, end } = parseDateQuery('garbage', 0);
    expect(end.getTime() - start.getTime()).toBe(86400000);
  });
});
