import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve as pathResolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { MessageConnection } from 'vscode-jsonrpc/node';
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-jsonrpc/node';
import type {
  Definition,
  Diagnostic,
  Hover,
  Location,
  LocationLink,
  ReferenceParams,
} from 'vscode-languageserver-protocol';
import { ok } from '../_shared/result';

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), 'skills');

// ponytail: extension → LSP server mapping. One table, no abstractions.
const LSP_SERVERS: Record<string, { cmd: string; args: string[] }> = {
  '.ts': { cmd: 'typescript-language-server', args: ['--stdio'] },
  '.tsx': { cmd: 'typescript-language-server', args: ['--stdio'] },
  '.js': { cmd: 'typescript-language-server', args: ['--stdio'] },
  '.jsx': { cmd: 'typescript-language-server', args: ['--stdio'] },
  '.vue': { cmd: 'vue-language-server', args: ['--stdio'] },
  '.svelte': { cmd: 'svelteserver', args: ['--stdio'] },
  '.py': { cmd: 'pyright-langserver', args: ['--stdio'] },
  '.go': { cmd: 'gopls', args: [] },
  '.rs': { cmd: 'rust-analyzer', args: [] },
  '.lua': { cmd: 'lua-language-server', args: [] },
  '.yaml': { cmd: 'yaml-language-server', args: ['--stdio'] },
  '.yml': { cmd: 'yaml-language-server', args: ['--stdio'] },
  '.json': { cmd: 'vscode-json-language-server', args: ['--stdio'] },
  '.html': { cmd: 'vscode-html-language-server', args: ['--stdio'] },
  '.css': { cmd: 'vscode-css-language-server', args: ['--stdio'] },
  '.md': { cmd: 'marksman', args: ['server'] },
  '.dockerfile': { cmd: 'docker-langserver', args: ['--stdio'] },
};

function serverFor(path: string): { cmd: string; args: string[] } | null {
  if (path.endsWith('Dockerfile') || path.endsWith('.dockerfile')) {
    return LSP_SERVERS['.dockerfile'];
  }
  const ext = path.match(/\.[^.]+$/)?.[0] ?? '';
  return LSP_SERVERS[ext] ?? null;
}

// ponytail: typescript-language-server needs a TS install with tsserver.js.
// Walk up from cwd looking for node_modules/typescript/lib/tsserver.js.
function findTsserverPath(cwd: string): string | null {
  let dir = pathResolve(cwd);
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'node_modules', 'typescript', 'lib', 'tsserver.js');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function buildServerEnv(cmd: string): Record<string, string> {
  // Only TS needs extra env. Other servers are self-contained.
  if (cmd === 'typescript-language-server') {
    const here = dirname(fileURLToPath(import.meta.url));
    const localTs = join(here, 'node_modules', 'typescript', 'lib', 'tsserver.js');
    if (existsSync(localTs)) return { TSSERVER_PATH: localTs };
  }
  return {};
}

function buildInitOptions(cmd: string, cwd: string): Record<string, unknown> {
  if (cmd === 'typescript-language-server') {
    const here = dirname(fileURLToPath(import.meta.url));
    const localTs = join(here, 'node_modules', 'typescript', 'lib', 'tsserver.js');
    if (existsSync(localTs)) return { tsserver: { path: localTs } };
    const walked = findTsserverPath(cwd);
    if (walked) return { tsserver: { path: walked } };
  }
  return {};
}

// ponytail: per-call LSP session. Spawn → initialize → didOpen → request → kill.
// No persistent connection state — each tool call is self-contained.
// Trade-off: ~200ms spawn cost per call. Acceptable for agent use.
type LspSession = {
  proc: ChildProcessWithoutNullStreams;
  conn: MessageConnection;
  rootUri: string;
  fileUri: string;
  text: string;
  languageId: string;
};

async function withLsp<T>(
  filePath: string,
  cwd: string,
  fn: (s: LspSession) => Promise<T>,
  timeoutMs = 15000
): Promise<T> {
  const srv = serverFor(filePath);
  if (!srv) throw new Error(`No LSP server for ${filePath}`);
  if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const proc = spawn(srv.cmd, srv.args, {
    cwd,
    env: { ...process.env, ...buildServerEnv(srv.cmd) },
  });
  const conn = createMessageConnection(
    new StreamMessageReader(proc.stdout),
    new StreamMessageWriter(proc.stdin)
  );
  conn.listen();

  // Set up a diagnostics collector
  const diagnostics: Diagnostic[] = [];
  conn.onNotification(
    'textDocument/publishDiagnostics',
    (params: { uri: string; diagnostics: Diagnostic[] }) => {
      if (params.uri.endsWith(filePath)) diagnostics.push(...params.diagnostics);
    }
  );

  try {
    await Promise.race([
      conn.sendRequest('initialize', {
        processId: proc.pid ?? null,
        rootUri: `file://${cwd}`,
        capabilities: {
          textDocument: {
            synchronization: { didSave: true },
            hover: { contentFormat: ['markdown', 'plaintext'] },
            definition: { linkSupport: true },
            references: {},
            publishDiagnostics: { relatedInformation: true },
          },
          workspace: { workspaceFolders: true },
        },
        initializationOptions: buildInitOptions(srv.cmd, cwd),
        workspaceFolders: [{ uri: `file://${cwd}`, name: 'workspace' }],
      }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('initialize timeout')), timeoutMs)
      ),
    ]);

    conn.sendNotification('initialized', {});

    const text = readFileSync(filePath, 'utf8');
    const fileUri = `file://${filePath}`;
    const ext = filePath.match(/\.[^.]+$/)?.[0] ?? '';
    const languageId =
      ext === '.ts' || ext === '.tsx'
        ? 'typescript'
        : ext === '.js' || ext === '.jsx'
          ? 'javascript'
          : ext === '.vue'
            ? 'vue'
            : ext === '.svelte'
              ? 'svelte'
              : ext === '.py'
                ? 'python'
                : ext === '.go'
                  ? 'go'
                  : ext === '.rs'
                    ? 'rust'
                    : ext === '.lua'
                      ? 'lua'
                      : ext === '.yaml' || ext === '.yml'
                        ? 'yaml'
                        : ext === '.json'
                          ? 'json'
                          : ext === '.html'
                            ? 'html'
                            : ext === '.css'
                              ? 'css'
                              : ext === '.md'
                                ? 'markdown'
                                : 'plaintext';

    conn.sendNotification('textDocument/didOpen', {
      textDocument: { uri: fileUri, languageId, version: 1, text },
    });

    // Wait briefly for diagnostics to arrive
    await new Promise((r) => setTimeout(r, 300));

    const session: LspSession = {
      proc,
      conn,
      rootUri: `file://${cwd}`,
      fileUri,
      text,
      languageId,
    };

    return await fn(session);
  } finally {
    diagnostics.length = 0;
    conn.dispose();
    proc.kill();
  }
}

function fmtLocation(loc: Location | LocationLink): string {
  if ('targetUri' in loc) {
    return `${loc.targetUri.replace('file://', '')}:${loc.targetRange.start.line + 1}:${loc.targetRange.start.character + 1}`;
  }
  return `${loc.uri.replace('file://', '')}:${loc.range.start.line + 1}:${loc.range.start.character + 1}`;
}

/**
 * lsp — Full LSP client: definition, references, hover, diagnostics.
 * Spawns language servers on demand (mise-managed). No persistent state.
 */
export default function lspExtension(pi: ExtensionAPI): void {
  // ── definition ────────────────────────────────────────────────────────
  pi.registerTool({
    name: 'lsp_definition',
    label: 'LSP Definition',
    description: 'Go to definition of the symbol at line:character.',
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number({ description: '0-indexed line' }),
      character: Type.Number({ description: '0-indexed character' }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const result = await withLsp(params.path, ctx.cwd, async (s) => {
        return s.conn.sendRequest<Definition | Definition[] | null>('textDocument/definition', {
          textDocument: { uri: s.fileUri },
          position: { line: params.line, character: params.character },
        });
      });
      if (!result || (Array.isArray(result) && result.length === 0)) {
        return ok('No definition found');
      }
      const locs = (Array.isArray(result) ? result : [result]) as Array<Location | LocationLink>;
      return ok(locs.map(fmtLocation).join('\n'));
    },
  });

  // ── references ────────────────────────────────────────────────────────
  pi.registerTool({
    name: 'lsp_references',
    label: 'LSP References',
    description: 'Find all references to the symbol at line:character.',
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number(),
      character: Type.Number(),
      includeDeclaration: Type.Optional(Type.Boolean()),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const result = await withLsp(params.path, ctx.cwd, async (s) => {
        const args: ReferenceParams = {
          textDocument: { uri: s.fileUri },
          position: { line: params.line, character: params.character },
          context: { includeDeclaration: params.includeDeclaration ?? true },
        };
        return s.conn.sendRequest<Location[] | null>('textDocument/references', args);
      });
      if (!result || result.length === 0) {
        return ok('No references found');
      }
      return ok(result.map(fmtLocation).join('\n'));
    },
  });

  // ── hover ─────────────────────────────────────────────────────────────
  pi.registerTool({
    name: 'lsp_hover',
    label: 'LSP Hover',
    description: 'Get hover information (type, docs) for the symbol at line:character.',
    parameters: Type.Object({
      path: Type.String(),
      line: Type.Number(),
      character: Type.Number(),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const result = await withLsp(params.path, ctx.cwd, async (s) => {
        return s.conn.sendRequest<Hover | null>('textDocument/hover', {
          textDocument: { uri: s.fileUri },
          position: { line: params.line, character: params.character },
        });
      });
      const contents = result?.contents;
      let text = 'No hover info';
      if (typeof contents === 'string') text = contents;
      else if (Array.isArray(contents))
        text = contents.map((c) => (typeof c === 'string' ? c : c.value)).join('\n\n');
      else if (contents && typeof contents === 'object' && 'value' in contents)
        text = contents.value;
      return ok(text);
    },
  });

  // ── diagnostics ───────────────────────────────────────────────────────
  pi.registerTool({
    name: 'lsp_diagnostics',
    label: 'LSP Diagnostics',
    description: 'Get diagnostics (errors/warnings) for a file from its language server.',
    parameters: Type.Object({ path: Type.String() }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      let diags: Diagnostic[] = [];
      await withLsp(params.path, ctx.cwd, async (s) => {
        // Already collecting diagnostics in withLsp; re-run the didOpen to get fresh ones
        const collected: Diagnostic[] = [];
        const handler = (p: { uri: string; diagnostics: Diagnostic[] }) => {
          if (p.uri === s.fileUri) collected.push(...p.diagnostics);
        };
        s.conn.onNotification('textDocument/publishDiagnostics', handler);
        await new Promise((r) => setTimeout(r, 800));
        s.conn.onNotification('textDocument/publishDiagnostics', () => {});
        diags = collected;
      });
      if (diags.length === 0) {
        return ok('No diagnostics');
      }
      const out = diags.map((d) => {
        const line = d.range.start.line + 1;
        const col = d.range.start.character + 1;
        const sev = ['error', 'warning', 'info', 'hint'][d.severity ?? 1];
        return `${line}:${col} [${sev}] ${d.message}${d.source ? ` (${d.source})` : ''}${d.code ? ` [${d.code}]` : ''}`;
      });
      return ok(out.join('\n'));
    },
  });

  // ── list / check (kept from v1) ────────────────────────────────────────
  pi.registerTool({
    name: 'lsp_list',
    label: 'LSP List',
    description: 'List all configured LSP server mappings (extension → server).',
    parameters: Type.Object({}),
    async execute() {
      const lines = Object.entries(LSP_SERVERS).map(
        ([ext, s]) => `${ext.padEnd(10)} → ${s.cmd} ${s.args.join(' ')}`
      );
      return ok(lines.join('\n'));
    },
  });

  pi.registerTool({
    name: 'lsp_check',
    label: 'LSP Check',
    description: 'Check which LSP server would handle a file (and if installed).',
    parameters: Type.Object({ path: Type.String() }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      const server = serverFor(params.path);
      if (!server) {
        return ok(`No LSP server for ${params.path}`);
      }
      // ponytail: `which` via spawn — same pattern as _shared/spawn but one-shot.
      const proc = spawn('which', [server.cmd], { stdio: ['ignore', 'pipe', 'ignore'] });
      let stdout = '';
      proc.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));
      await new Promise<void>((res) => proc.on('close', () => res()));
      const installed = stdout.trim().length > 0;
      return ok(
        `${params.path}\n  Server: ${server.cmd} ${server.args.join(' ')}\n  Installed: ${installed ? 'yes' : 'no'}`
      );
    },
  });

  pi.on('resources_discover', () => ({ skillPaths: [skillsDir] }));
}
