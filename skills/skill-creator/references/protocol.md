# Skill Creation Protocol — Full Spec

## Anatomy of a Well-Written SKILL.md

### Frontmatter

```yaml
---
name: <lowercase-hyphens>        # 1-64 chars, no leading/trailing hyphens
description: >                    # Max 1024 chars
  Concise summary + trigger conditions.
compatibility: >                  # Optional
  Extension/tools required, env vars.
---
```

### Body Sections (Recommended Order)

#### 1. Header
`# Skill Name` — One-liner purpose statement below.

#### 2. When to Use
Scenario → Tool/Pattern table. This is the primary mapping that tells the model how to apply the skill.

```markdown
| Need | Tool / Pattern |
|---|---|
| Find symbol definition | ctags |
| Find all call sites | ast-grep |
```

#### 3. Quick Start
1-3 most common invocations. Show, don't explain.

```text
my-tool param="value"
another-tool --flag arg1 arg2
```

#### 4. Parameters / Config
Only non-obvious parameters. Skip things with obvious defaults or well-known CLI semantics.

```markdown
| Param | Default | Notes |
|---|---|---|
| `depth` | `3` | 1–5, controls crawl depth |
```

#### 5. Patterns / Workflows
Real workflows showing tool composition. Group by use case, not tool.

```markdown
### Pattern: multi-step workflow
```text
step 1 → tool-a
step 2 → tool-b  # only if step 1 succeeds
step 3 → verify
```
```

#### 6. Error Handling
Every tool call should map to possible errors.

```markdown
| Error code | Response |
|---|---|
| `ERR_X` | What to do / next step |
```

#### 7. Scope Boundaries
Explicitly state what the skill does NOT do. Prevents confusion with related skills.

```markdown
## What this skill does NOT do
Not for X (use Y instead). Not for Z (drop to bash).
```

### Organizing Complexity

When SKILL.md approaches 200+ lines, extract details to `references/`:

```markdown
# In SKILL.md:
For full parameter list, see [complete reference](references/api-reference.md).
For setup instructions, see [setup guide](references/setup.md).
```

Reference files are loaded lazily when the model needs them. Use relative paths from SKILL.md's directory.

### Writing Style Rules

1. **Imperative mood**: "Run the migration." not "You should run the migration."
2. **Explain why**: "Set timeout high because the API has rate limiting" beats "Set timeout = 30000".
3. **Avoid ALL CAPS constraints**: LLMs respond better to reasoning than rigid rules.
4. **Prefer tables over prose**: Scannable mappings beat paragraphs.
5. **Include edge cases**: Real-world usage differs from happy-path documentation.
6. **One paragraph per idea**: Chunk information for efficient loading.

## Workflow vs Reference Skills

Two patterns exist:

| Type | Purpose | Size | Examples |
|---|---|---|---|
| Reference | Full tool docs, all modes | Up to 500 lines | gh, kb, access-web |
| Workflow | Thin orchestration | ≤50 lines | kb-research (deleted), old capture-url |

**Decision rule**: If it composes ≥3 other tools in a specific sequence, make it thin. Put each tool's full docs in its own reference skill.

## Testing a New Skill

Before committing:

1. **Describe test prompts** — 2-3 realistic user inputs that would trigger this skill
2. **Verify descriptions load** — check frontmatter is parseable YAML
3. **Check links** — any `[reference name](path/to/ref)` must exist
4. **No dead scripts** — every `./scripts/foo.sh` referenced must exist
