// ponytail: only register events that actually fire in this runtime. agent_end,
// turn_start, turn_end are valid pi events but we don't handle them — YAGNI.
// Re-add when a hook author actually needs one.

export type HookEvent =
  | 'session_start'
  | 'session_shutdown'
  | 'agent_start'
  | 'tool_call'
  | 'tool_result';

export type HookContext = 'tool_name' | 'file_name' | 'command';

export interface HookRule {
  event: HookEvent;
  context?: HookContext;
  pattern?: string;
  command: string;
  cwd?: string;
  timeout?: number;
  notify?: boolean;
}

export interface HooksGroup {
  group: string;
  pattern: string;
  hooks: HookRule[];
}

export type HooksConfig = HooksGroup[];

export interface HookInput {
  cwd: string;
  hook_event_name: HookEvent;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_call_id?: string;
  tool_response?: {
    content?: unknown[];
    details?: Record<string, unknown>;
    isError?: boolean;
  };
}

export interface HookOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: 'block';
  reason?: string;
}
