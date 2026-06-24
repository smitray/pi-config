/**
 * Shared tool-result helpers. Mirrors web-access/lib/result.ts so both
 * extensions return the same shape — { content, details, isError }.
 */

export interface ToolOk {
  content: [{ type: 'text'; text: string }];
  details: Record<string, unknown>;
  isError: false;
}

export interface ToolErr {
  content: [{ type: 'text'; text: string }];
  details: Record<string, unknown>;
  isError: true;
}

export type ToolResult = ToolOk | ToolErr;

export function ok(text: string, details: Record<string, unknown> = {}): ToolOk {
  return { content: [{ type: 'text', text }], details, isError: false };
}

export function err(code: string, message: string, details: Record<string, unknown> = {}): ToolErr {
  return {
    content: [{ type: 'text', text: `${code}: ${message}` }],
    details: { error: code, message, ...details },
    isError: true,
  };
}

/**
 * Convenience: same as `err` but with no structured code — just a free-form message.
 * Prefer `err(code, message)` for any new failure paths.
 */
export function errMessage(message: string): ToolErr {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    details: { error: message },
    isError: true,
  };
}
