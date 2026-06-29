# `_shared/`

Internal utilities shared across extensions in this workspace. **Not** a pi
extension itself — no `index.ts` at the root means pi won't try to load it.

## Why underscore-prefixed

The leading underscore is a convention, not a hard rule: it signals "this is
for *our* dev workflow, don't import it from outside the workspace."

## Why not a published package

Three extensions sharing ~80 lines of code is below the threshold where a
proper package (npm, version, changelog, build) pays for itself. Move to a
package if:
- A 4th extension needs `spawn.ts`, **or**
- A consumer outside this workspace needs the helpers, **or**
- The shared code grows past ~300 lines.

## Files

| File | Purpose | Used by |
|------|---------|---------|
| `spawn.ts` | Async child-process wrapper with timeout + SIGKILL escalation | `gh`, `hooks`, `web-access` |
| `result.ts` | `ok()/err()` tool-result formatting helpers | `gh`, `web-access`, `kb` |

## Examples

### spawn.ts

```typescript
import { runCommand } from "../_shared/spawn";

const result = await runCommand("gh", ["api", "repos/owner/repo"], {
  timeout: 10000,
});

if (result.ok) {
  console.log(result.stdout);
} else {
  console.error(result.stderr);
}
```

### result.ts

```typescript
import { ok, err } from "../_shared/result";

// Success
return ok({ data: "some result" });
// Returns: { content: [{ type: "text", text: "✅ Success" }], details: { data: "some result" } }

// Error
return err("NOT_FOUND", "Resource not found");
// Returns: { content: [{ type: "text", text: "❌ NOT_FOUND: Resource not found" }], details: { error: "NOT_FOUND" }, isError: true }
```

## Adding a new shared file

1. Drop the file in `_shared/` with a top-level doc comment explaining what it is.
2. Update this table.
3. Import from consumers using a relative path: `from '../../../_shared/spawn'`.
4. Don't add tests here — test through the consumer that uses it. A test for
   `spawn.ts` belongs with whoever depends on it most heavily (currently
   `gh/test/`).
