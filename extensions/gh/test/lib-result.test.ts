import { describe, expect, it } from 'vitest';
import { err, errMessage, ok } from '../lib/result';

describe('ok', () => {
  it('returns success-shaped result with isError false', () => {
    const r = ok('hello', { foo: 'bar' });
    expect(r.isError).toBe(false);
    expect(r.content[0].text).toBe('hello');
    expect(r.details).toEqual({ foo: 'bar' });
  });

  it('defaults details to empty object', () => {
    const r = ok('hi');
    expect(r.details).toEqual({});
  });
});

describe('err', () => {
  it('returns error-shaped result with isError true and structured details', () => {
    const r = err('GH_FAILED', 'gh not authenticated', { owner: 'foo' });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe('GH_FAILED: gh not authenticated');
    expect(r.details).toEqual({
      error: 'GH_FAILED',
      message: 'gh not authenticated',
      owner: 'foo',
    });
  });
});

describe('errMessage', () => {
  it('returns a free-form error result', () => {
    const r = errMessage('boom');
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe('Error: boom');
    expect(r.details).toEqual({ error: 'boom' });
  });
});
