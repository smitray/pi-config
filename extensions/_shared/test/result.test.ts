import { describe, expect, it } from 'vitest';
import { err, ok } from '../result';

describe('shared result helpers', () => {
  describe('ok()', () => {
    it('returns success result with text', () => {
      const result = ok('Success!');
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Success!' }],
        details: {},
        isError: false,
      });
    });

    it('returns success result with details', () => {
      const result = ok('Done', { id: '123', count: 5 });
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Done' }],
        details: { id: '123', count: 5 },
        isError: false,
      });
    });

    it('defaults details to empty object', () => {
      const result = ok('test');
      expect(result.details).toEqual({});
    });
  });

  describe('err()', () => {
    it('returns error result with code and message', () => {
      const result = err('NOT_FOUND', 'Item not found');
      expect(result).toEqual({
        content: [{ type: 'text', text: '❌ NOT_FOUND: Item not found' }],
        details: { error: 'NOT_FOUND' },
        isError: true,
      });
    });

    it('includes additional details', () => {
      const result = err('VALIDATION', 'Invalid input', { field: 'email' });
      expect(result.details).toEqual({ error: 'VALIDATION', field: 'email' });
    });

    it('defaults details to error code only', () => {
      const result = err('ERR', 'msg');
      expect(result.details).toEqual({ error: 'ERR' });
    });
  });
});
