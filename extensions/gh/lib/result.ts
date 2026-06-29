/**
 * Shared tool-result helpers for all extensions.
 *
 * ponytail: three extensions (kb, web-access, gh) all return the same shape.
 * One source of truth — but inlined to avoid cross-extension dependency issues.
 */

export interface ToolContent {
  type: 'text';
  text: string;
}

export interface ToolResult {
  content: ToolContent[];
  details: Record<string, unknown>;
  isError?: boolean;
}

export function ok(text: string, details?: Record<string, unknown>): ToolResult {
  return { content: [{ type: 'text', text }], details: details ?? {}, isError: false };
}

export function err(code: string, message: string, details?: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text: `❌ ${code}: ${message}` }],
    details: { error: code, ...(details ?? {}) },
    isError: true,
  };
}
