import type { ToolResult } from './types';

export function ok(text: string, details?: Record<string, unknown>): ToolResult {
  return { content: [{ type: 'text', text }], details: details ?? {}, isError: false };
}

export function err(code: string, message: string, details?: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${code} — ${message}` }],
    details: { error: code, ...(details ?? {}) },
    isError: true,
  };
}
