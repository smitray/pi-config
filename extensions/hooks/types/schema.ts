export type HookEvent =
  | 'session_start'
  | 'session_shutdown'
  | 'tool_call'
  | 'tool_result'
  | 'agent_start'
  | 'agent_end'
  | 'turn_start'
  | 'turn_end';

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
