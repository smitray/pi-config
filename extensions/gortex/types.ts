// Shared types for the Gortex extension. Kept minimal and structural so the
// extension stays dependency-free (Node built-ins only).

/** Decision returned by the `gortex hook` Go binary after a tool_call event. */
export interface PiDecision {
  block?: boolean;
  reason?: string;
  additional_context?: string;
  orientation?: string;
}

/** One public Gortex tool exposed to Pi under a `gortex_` prefix. */
export interface ToolDescriptor {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

/**
 * Structural view of the Pi extension API surface this extension uses.
 * Pi's real API is wider; we type only what we touch.
 */
export interface PiApi {
  cwd?: string;
  registerTool(def: unknown): void;
  on(event: string, handler: (...args: any[]) => any): void;
  sendMessage?(msg: unknown, opts?: unknown): void;
}
