import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), "skills");

// Map file extensions → LSP server command
const LSP_SERVERS: Record<string, { cmd: string; args: string[] }> = {
  ".ts": { cmd: "typescript-language-server", args: ["--stdio"] },
  ".tsx": { cmd: "typescript-language-server", args: ["--stdio"] },
  ".js": { cmd: "typescript-language-server", args: ["--stdio"] },
  ".jsx": { cmd: "typescript-language-server", args: ["--stdio"] },
  ".vue": { cmd: "vue-language-server", args: ["--stdio"] },
  ".svelte": { cmd: "svelteserver", args: ["--stdio"] },
  ".py": { cmd: "pyright-langserver", args: ["--stdio"] },
  ".go": { cmd: "gopls", args: [] },
  ".rs": { cmd: "rust-analyzer", args: [] },
  ".lua": { cmd: "lua-language-server", args: [] },
  ".yaml": { cmd: "yaml-language-server", args: ["--stdio"] },
  ".yml": { cmd: "yaml-language-server", args: ["--stdio"] },
  ".json": { cmd: "vscode-json-language-server", args: ["--stdio"] },
  ".html": { cmd: "vscode-html-language-server", args: ["--stdio"] },
  ".css": { cmd: "vscode-css-language-server", args: ["--stdio"] },
  ".md": { cmd: "marksman", args: ["server"] },
  ".dockerfile": { cmd: "docker-langserver", args: ["--stdio"] },
};

function getServerForFile(path: string): { cmd: string; args: string[] } | null {
  const ext = path.match(/\.[^.]+$/)?.[0] ?? "";
  if (path.endsWith("Dockerfile")) return LSP_SERVERS[".dockerfile"];
  return LSP_SERVERS[ext] ?? null;
}

/**
 * lsp — LSP diagnostics and navigation via local language servers.
 * All servers are managed by mise in ~/.config/mise/config.toml.
 */
export default function lspExtension(pi: ExtensionAPI): void {
  // Lightweight diagnostics: just check if server is reachable
  pi.registerTool({
    name: "lsp_check",
    label: "LSP Check",
    description: "Check which LSP server would handle a file (and if installed).",
    parameters: Type.Object({
      path: Type.String(),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      const server = getServerForFile(params.path);
      if (!server) {
        return {
          content: [{ type: "text", text: `No LSP server configured for ${params.path}` }],
        };
      }
      const proc = spawn("which", [server.cmd]);
      let stdout = "";
      proc.stdout.on("data", (d) => (stdout += d.toString()));
      await new Promise<void>((res) => proc.on("close", () => res()));
      const installed = stdout.trim().length > 0;
      return {
        content: [{
          type: "text",
          text: `${params.path}\n  Server: ${server.cmd} ${server.args.join(" ")}\n  Installed: ${installed ? "yes" : "no"}${installed ? "" : ` — install via mise or check ~/.config/mise/config.toml`}`,
        }],
      };
    },
  });

  // List all configured LSP mappings
  pi.registerTool({
    name: "lsp_list",
    label: "LSP List",
    description: "List all configured LSP server mappings (extension → server).",
    parameters: Type.Object({}),
    async execute() {
      const lines = Object.entries(LSP_SERVERS).map(
        ([ext, s]) => `${ext.padEnd(10)} → ${s.cmd} ${s.args.join(" ")}`
      );
      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  });

  pi.on("resources_discover", () => ({ skillPaths: [skillsDir] }));
}