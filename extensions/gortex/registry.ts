import type { ToolDescriptor } from './types';

// Closed, agent-neutral roster of Gortex's public tools. The bare names are
// the exact public CLI/MCP names; Pi adds only the collision-avoidance prefix
// at the registration boundary (see registration.ts).
export const PUBLIC_TOOLS: ToolDescriptor[] = [
  {
    name: 'explore',
    description: 'Localize a task and return ranked source plus call paths. Call first.',
    parameters: {
      type: 'object',
      properties: { task: { type: 'string', description: 'What to do, e.g. "find models.json" or "remove hy3:free block"' } },
      required: ['task'],
    },
  },
  {
    name: 'search',
    description: 'Search indexed symbols, text, files, or AST shapes.',
    parameters: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['symbols', 'text', 'files'], description: 'Search type' },
        query: { type: 'string', description: 'Search query' },
      },
      required: ['operation', 'query'],
    },
  },
  {
    name: 'read',
    description: 'Read indexed files, symbols, summaries, or editing context.',
    parameters: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['file', 'source', 'summary', 'editing_context'], description: 'Read type' },
        target: { type: 'object', description: 'Target: {file:"path"} or {symbol:"id"}' },
      },
      required: ['operation', 'target'],
    },
  },
  {
    name: 'relations',
    description: 'Find usages, callers, dependencies, dependents, or implementations.',
  },
  { name: 'trace', description: 'Trace call chains, value flow, or taint paths.' },
  { name: 'analyze', description: 'Run a graph analysis; use kind help to list analyses.' },
  { name: 'ask', description: 'Answer a codebase question from graph evidence.' },
  {
    name: 'change',
    description: 'Plan and check mutations: impact, verify, detect, tests, guards, or contract.',
  },
  { name: 'edit', description: 'Apply file, symbol, batch, or new-file edits.' },
  { name: 'refactor', description: 'Rename, move, inline, delete, or apply code actions.' },
  { name: 'review', description: 'Review changes with graph context.' },
  { name: 'publish_review', description: 'Publish prepared review feedback.' },
  { name: 'pr', description: 'Inspect pull-request changes, context, or risk.' },
  { name: 'recall', description: 'Retrieve notes or memories relevant to the work.' },
  { name: 'remember', description: 'Store durable decisions, invariants, or gotchas.' },
  { name: 'workspace', description: 'Inspect workspace and repository state.' },
  { name: 'workspace_admin', description: 'Perform explicit workspace administration.' },
  { name: 'overlay', description: 'Compare or manage session overlay state.' },
  { name: 'session', description: 'Manage session state or subscriptions.' },
  { name: 'response', description: 'Control response encoding or pagination.' },
  {
    name: 'capabilities',
    description: 'Get exact operations and request schemas only when needed.',
  },
];
