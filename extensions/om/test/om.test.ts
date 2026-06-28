import { describe, expect, it } from 'vitest';
import { parseDateQuery } from '../lib/om';

describe('parseDateQuery', () => {
  it('parses "today"', () => {
    const { start, end } = parseDateQuery('today');
    expect(start.getTime()).toBeLessThan(end.getTime());
    expect(end.getTime() - start.getTime()).toBe(86400000);
  });

  it('parses "yesterday"', () => {
    const { start, end } = parseDateQuery('yesterday');
    expect(end.getTime() - start.getTime()).toBe(86400000);
  });

  it('parses YYYY-MM-DD', () => {
    const { start, end } = parseDateQuery('2026-06-28');
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(5); // June = 5
    expect(start.getDate()).toBe(28);
    expect(end.getTime() - start.getTime()).toBe(86400000);
  });

  it('parses "last N days"', () => {
    const { start, end } = parseDateQuery('last 3 days');
    // last 3 days = today + 3 previous days = 4 days total
    expect(end.getTime() - start.getTime()).toBe(4 * 86400000);
  });

  it('defaults to today for unknown input', () => {
    const { start, end } = parseDateQuery('garbage');
    expect(end.getTime() - start.getTime()).toBe(86400000);
  });
});
