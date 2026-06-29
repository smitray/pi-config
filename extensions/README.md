# Pi Extensions

Custom extensions for [pi coding agent](https://github.com/earendil-works/pi).

## Extensions

| Extension | Description | Docs |
|-----------|-------------|------|
| [gh](./gh/) | GitHub integration via `gh` CLI | [README](./gh/README.md) |
| [guardrails](./guardrails/) | Security rules blocking risky tool calls | [README](./guardrails/README.md) |
| [hooks](./hooks/) | Shell hooks on lifecycle events | [README](./hooks/README.md) |
| [kb](./kb/) | Knowledge base vaults with wiki pages, source capture, enrichment | [README](./kb/README.md) |
| [web-access](./web-access/) | Web search, fetch/crawl, persisted docs, media download | [README](./web-access/README.md) |

Internal helpers shared between extensions live in [`_shared/`](./_shared/) — not a pi extension itself.

## Setup

Extensions auto-discovered from `~/.pi/agent/extensions/*/index.ts` (anything not starting with `_`). No settings.json config needed.

```bash
# Install dependencies
npm install

# Restart pi or reload extensions
/reload
```

## Development

### Prerequisites

- Node.js 24+ (via mise)
- npm

### Structure

```
extensions/
├── AGENTS.md            # agent-facing docs
├── biome.json           # lint/format config
├── tsconfig.json        # TypeScript config
├── package.json         # shared dependencies + scripts
├── _shared/             # internal helpers (spawn wrapper, etc.) — not a pi extension
├── guardrails/          # security rules extension
├── gh/                  # GitHub CLI wrapper extension
├── hooks/               # lifecycle shell hooks extension
├── kb/                  # knowledge base extension (wiki + source capture)
├── web-access/          # web search / docs / media extension
└── README.md            # you are here
```

### Commands

```bash
# Tests
npm test                    # all tests
npm run test:watch          # watch mode
vitest run <ext>            # single extension (gh, hooks, guardrails)

# Lint & Format
npm run lint                # biome check
npm run lint:fix            # biome auto-fix

# Typecheck
npm run typecheck           # tsc --noEmit
```

### Creating a New Extension

```bash
mkdir -p my-extension/test

# Create index.ts with default export
cat > my-extension/index.ts << 'EOF'
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function myExtension(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("My extension loaded!", "info");
  });
}
EOF

# Create test
cat > my-extension/test/extension.test.ts << 'EOF'
import { describe, expect, it } from "vitest";

describe("my extension", () => {
  it("should export default function", async () => {
    const mod = await import("../index.ts");
    expect(typeof mod.default).toBe("function");
  });
});
EOF

# Verify
vitest run my-extension
```
