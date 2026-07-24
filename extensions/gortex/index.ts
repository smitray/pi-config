// Gortex extension for the Pi coding agent (earendil-works/pi).
//
// Pi has no MCP support by design — the extension API's registerTool covers
// it. This extension does two things:
//
//   1. Exposes Gortex's compact public tools as native Pi tools. On every
//      session_start the daemon is brought up (ensureDaemon) and the tools
//      are (re)registered — Pi resets the session's tool registry on each
//      /new, so registration must happen per session. Each registered tool
//      shells `gortex call <name>`, relaying the exact request object to the
//      daemon. The fixed public roster (registry.ts) keeps Pi aligned with
//      every MCP host without exposing implementation aliases.
//
//   2. Re-creates the Claude-Code "prefer graph tools over raw file reads"
//      enforcement. Every relevant lifecycle event is marshalled into a
//      normalized envelope and handed to `gortex hook --agent=pi`, whose
//      decision is applied here. The Go side owns the deny / enrich /
//      consult-unlock / nudge postures, identical to every other agent.
//
// NOTE: Pi is pre-1.0. The ExtensionAPI surface, event names, and the Pi
// built-in tool names mapped in hook.ts are pinned to Pi's documented API.
// If a Pi upgrade renames an event or a built-in tool, adjust the small maps
// here — the Go side (the wire contract) stays unchanged.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ENFORCE, GORTEX_INSTRUCTIONS } from './config';
import { ensureDaemon } from './daemon';
import { callHook, evaluateToolCall } from './hook';
import { isGortexTool, registerGortexTools } from './registration';
import type { PiApi } from './types';

// Resolve this extension's own skills directory so Pi loads our SKILL.md files.
const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'skills');

export default function (pi: PiApi) {
  let orientationInjected = false;
  // Mandatory workflow + hook orientation awaiting injection into the next
  // LLM call. The `context` hook appends them as a tail user message rather
  // than mutating systemPrompt (which would invalidate prefix caching).
  // Computed once per session.
  let pendingOrientation = GORTEX_INSTRUCTIONS;

  // Pi resets the session's tool registry on every session_start, so
  // (re)register here.
  pi.on('session_start', () => {
    orientationInjected = false;
    pendingOrientation = GORTEX_INSTRUCTIONS;
    ensureDaemon();
    registerGortexTools(pi);
  });

  // Fires before the agent loop's first LLM call. It can't mutate messages
  // itself, so it just parks the orientation for the `context` hook.
  pi.on('before_agent_start', () => {
    if (orientationInjected) return;
    const decision = callHook({ event: 'session_start', cwd: pi?.cwd ?? process.cwd() });
    if (decision.orientation) {
      pendingOrientation = [GORTEX_INSTRUCTIONS, decision.orientation].filter(Boolean).join('\n\n');
    }
    orientationInjected = true;
  });

  // Fires before each LLM call with a mutable message array. Append the parked
  // orientation once, then clear it so it isn't repeated each call.
  pi.on('context', (event: any) => {
    if (!pendingOrientation) return;
    const text = pendingOrientation;
    pendingOrientation = '';
    try {
      if (event && Array.isArray(event.messages)) {
        event.messages.push({ role: 'user', content: text });
        return { messages: event.messages };
      }
    } catch {
      // best effort — never break context assembly.
    }
  });

  // Expose this extension's skills (gortex, gortex-guard) to Pi.
  pi.on('resources_discover', () => ({ skillPaths: [SKILLS_DIR] }));

  if (!ENFORCE) return;

  // Enforcement: every non-Gortex tool call is checked against the Go hook.
  pi.on('tool_call', (event: any, ctx: any) =>
    evaluateToolCall(pi, event, ctx, isGortexTool(event?.toolName ?? ''))
  );
}
