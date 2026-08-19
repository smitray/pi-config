# KB Extension v2: A Three-Layer Knowledge Book with Role-Scoped Skills

## 1. Core thesis

The current `smitray/pi-config/extensions/kb` ships 24 tools and 14 page types, but the operational discipline it relies on — "the agent should only write to `wiki/` via the typed tools" — has not held. The attached working vault shows the failure mode clearly: 165 of 192 wiki files (86%) lack the ID prefix that the typed tools enforce. The agent writes directly to `wiki/concepts/`, `wiki/artifacts/`, `wiki/sources/`, and `wiki/dailies/` whenever it has a thought, and the resulting wiki is a scratch pad rather than compiled output. The 222 source packets in `raw/sources/` are doing their job (immutable, byte-stable), but the layer above them is not.

The redesign treats the kb extension as three collaborating layers that the agent cannot bypass:

1. **Knowledge book** — a strict three-file-system vault (raw / wiki / meta) where the wiki is write-restricted to typed tools, the meta is write-restricted to the extension itself, and raw is immutable.
2. **Flow engine** — a state machine (`lib/flow.ts`) that walks 12 named flows, each emitting a handoff page into a per-task chain. Handoffs are the audit trail; the chain is the work history.
3. **Role packages** — a curated subset of `mattpocock/skills` (and the local `kb-*` flow skill) installed once and re-injected per subagent at spawn time. The orchestrator does not carry 53 skill descriptions; the subagent for "code review" only carries `code-review`, `review`, and the kb primitives it needs.

The redesign also brings two new page types (`context` and `adr`) that absorb the `CONTEXT.md` and `docs/adr/` patterns from `mattpocock/skills`, and a scaffolding operation (`kb_scaffold`) that produces a complete project — vault, templates, role pages, `AGENTS.md`, settings, and the local flow skill — in one idempotent pass.

The result is a kb extension that is both the **persistent knowledge book** the agent maintains and the **process substrate** the agent follows, without re-implementing the orchestrators that `rpiv-pi` and `mattpocock/skills` already provide. The 24 existing tools split into 15 retained (with discipline tightened), 5 deprecated (replaced by typed equivalents), and 9 new (5 flow, 2 role, 2 bootstrap).

## 2. Pattern synthesis: three prior works, one extension

Three prior works already cover most of this design space. The kb extension is best understood as the **integration layer** that composes them, not as a fourth parallel system.

**Karpathy's LLM Wiki** [1] is the substrate. Three layers (raw sources, compiled wiki, schema) and three operations (ingest, query, lint) define the contract between agent and knowledge. The schema file (`CLAUDE.md` or `AGENTS.md`) is the configuration that turns a generic agent into a disciplined wiki maintainer. This is canonical and unchanged; the redesign treats it as ground truth for the storage model.

**rpiv-pi** [2][3] is the pipeline vocabulary. Four named pipelines (`build`, `vet`, `polish`, `ship`), 27 skills, 15 specialist subagents, three quality gates (`ask`, `pause`, `fix-loop`), and 30 stages in the build pipeline. The `build` pipeline's act structure — capture → slice → design (×N parallel) → design-review (◉ pause) → plan (gate + panel + fix) → code (gate + fix) → land — is the most carefully designed agentic workflow in the open-source ecosystem. The redesign borrows the **flow grammar** (named stages, gates, parallel fan-out, audit trail) and the **driver-in-the-loop** philosophy, without reimplementing the pipeline engine.

**mattpocock/skills** [4] is the orchestrator layer. 53 skills, user-invoked vs. model-invoked taxonomy, `SKILL.md` with progressive-disclosure frontmatter, and a per-repo scaffold (`/setup-matt-pocock-skills`) that writes `docs/agents/issue-tracker.md`, `triage-labels.md`, and `domain.md`. The redesign adopts mp's **skill format** (it's now an open standard via Anthropic Skills, Dec 2025 [5]) and uses mp's **triage / code-review / tdd / diagnose** skills as the discipline layer inside the kb flow. The 14 kept / 8 discarded split already documented in the user's `mattpocock-rpiv-hybrid-workflow.md` is the curated subset; the redesign does not re-litigate it.

**Composability over completeness.** The kb extension is the bridge. It does not implement its own pipeline engine (rpiv provides one), its own TDD discipline (mp provides `/tdd`), its own hybrid search (the existing `lib/embeddings.ts` already does BM25 + vectors), or its own scaffolding (mp provides `/setup-matt-pocock-skills` which `kb_scaffold` composes with). The kb extension's job is the **knowledge book + flow router + role binder** that holds the three together.

## 3. Layer 1 — Knowledge Book

### 3.1 Three file systems, three ownership rules

| Path | Owner | Allowed writers | Purpose |
|---|---|---|---|
| `raw/` | User + `kb_capture` | None from agent, except via `kb_capture` | Immutable source packets. `SRC-YYYY-MM-DD-NNN/<original>.<ext>` + `extracted.md` + `meta.json` |
| `wiki/` | LLM, via typed tools only | `kb_ensure_page`, `kb_create_*`, `kb_flow` (which calls them) | Compiled, cross-linked, frontmatter-enforced. No direct file writes. |
| `meta/` | Extension | Extension code only, never the agent | `registry.json`, `backlinks.json`, `events.jsonl` |

The `guardrails.ts` rule set already in the existing extension is the right starting point; the redesign tightens it. Direct writes to `wiki/` are blocked at the extension level regardless of which tool the agent tries (`write`, `edit`, `cat > file`). The only path in is a typed tool, and the typed tool is the only thing that knows the page type's frontmatter schema, the ID prefix, and the registry update. An LLM that bypasses the typed tools is not just breaking a convention — it is failing an architectural check.

### 3.2 Sixteen page types (14 retained + 2 new)

The existing 14 templates are kept verbatim; two new types are added to absorb patterns from `mattpocock/skills`. Every page has a typed frontmatter, an ID where applicable, and a registry entry on creation.

| Type | Directory | ID prefix | New in v2? | Notes |
|---|---|---|---|---|
| `concept` | `wiki/concepts/` | — | — | Abstract ideas, patterns, techniques |
| `entity` | `wiki/entities/` | — | — | People, tools, projects, libraries |
| `synthesis` | `wiki/syntheses/` | — | — | Multi-source consolidated knowledge |
| `analysis` | `wiki/analyses/` | — | — | Comparison, evaluation, trade-offs |
| `source` | `wiki/sources/` | — | — | Summary of a captured source (not the source itself) |
| `research` | `wiki/research/` | `RES-` | — | Research investigations |
| `handoff` | `wiki/handoffs/` | `HOFF-` | — | Per-stage state transfer between agents |
| `project` | `wiki/projects/` | `PROJ-` | — | Project root page |
| `library-doc` | `wiki/libraries/` | `LIB-` | — | Saved web resources |
| `daily-log` | `wiki/dailies/` | `DAY-` | — | Daily diaries / EOD summaries |
| `brainstorm` | `wiki/brainstorms/` | `BR-` | — | Brainstorm sessions |
| `sprint-plan` | `wiki/plans/` | `SP-` | — | Sprint scope + spec links |
| `spec` | `wiki/specs/` | `SPEC-` | — | Feature specs (linked to sprint) |
| `task` | `wiki/tasks/` | `TASK-` | — | Atomic work units (linked to spec) |
| **`context`** | `wiki/context/` | — | **Yes** | Project-level `CONTEXT.md` equivalent — DDD ubiquitous language |
| **`adr`** | `wiki/adrs/` | `ADR-` | **Yes** | Architecture Decision Records, mirror to `docs/adr/` if user prefers files |

The new `context` page is the canonical project-level "what do we mean when we say X" page; the existing `wiki/concepts/` covers individual concepts but not the project's running glossary. Mattpocock's `CONTEXT.md` lives at the repo root and the agent loads it on every session; the kb version lives in the vault and is queryable like any other page. The two are mirror images: the kb page is the source of truth, the repo file (if generated) is the import-export side.

The new `adr` page type replaces the free-form "decision" notes currently scattered in `wiki/artifacts/` (e.g., `kb-extension-optimization-plan.md`, `kb-prd.md`). Each ADR is a single decision with a status, alternatives considered, consequences, and a link back to the source material that informed it. ADRs accumulate forever; once written, they are never edited in place. If a decision changes, write a new ADR that supersedes the old one — the old one gets a `superseded_by: ADR-NNN` frontmatter field. This is the one place where the kb extension borrows from the `agentmemory` supersession pattern [6], but the borrowed piece is small (an `ADR-NNN` → `ADR-MMM` pointer) rather than the full confidence-scoring system.

### 3.3 Frontmatter discipline

Standard fields on every page:

```yaml
---
id: <type-prefix>-<NNN>      # when type has a prefix
title: "..."
type: <one of 16>
tags: [yaml array]
stage: brainstorm|draft|review|production
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

Run-tracking fields (only on pipeline types — `project`, `brainstorm`, `sprint-plan`, `spec`, `task`, `handoff`):

```yaml
run: RUN-YYYY-MM-DD-NNN
status: exploring|draft|decided|in_progress|done|blocked|superseded
started_at: ISO timestamp
completed_at: ISO timestamp
execution_time: human-readable (e.g., 35m)
todos: yaml list of - [x] / - [ ] items
related_pages: [wikilinks]
depends_on: [wikilinks]
```

Knowledge-tracking fields (only on knowledge types — `concept`, `entity`, `synthesis`, `analysis`, `source`, `research`):

```yaml
derived_from: [<SRC-IDs>, <HOFF-IDs>]    # sources that produced this knowledge
confidence: high|medium|low              # optional; default medium
last_verified: YYYY-MM-DD                # optional
```

The `derived_from` field is the audit trail for compilation. If a concept page has `derived_from: [SRC-2026-07-21-019, HOFF-2026-07-21-005]`, the LLM (or a human) can trace that page back to the two sources that contributed to it. This is lighter than agentmemory's full confidence model but covers the user's stated need: "raw ingests the information and process the wiki without polluting." Pollution is auditable; derivation is recorded.

### 3.4 Dual-vault routing (unchanged, tightened)

| Content | Target | When to use |
|---|---|---|
| Library docs, notes, personal research | Personal (`~/.kb/`) | Library/reference material, not project-specific |
| Project artifacts, WIP, plans | Project (`.kb/`) | Anything tied to a project the user is working in |
| Ambiguous | Ask user | One `ask_user_question` call, not a guess |

The `kb_capture` tool's `vault` parameter keeps the current behavior: `vault=auto` (default) reads from `KB_VAULT` env or cwd detection, `vault=personal` and `vault=project` are explicit. The `kb_recall_context` and `kb_recall_docs` tools retain the project-first / personal-first routing, since "the project context is what you're working on; the personal vault is fallback."

## 4. Layer 2 — Flow Engine

### 4.1 The twelve flows

The 12 flows decompose into four archetypes based on what they produce:

| Archetype | Flows | What they produce |
|---|---|---|
| **Knowledge acquisition** | 7. Greenfield, 9. Onboarding, 11. Decision logging | Wiki pages, no code |
| **Knowledge application** | 1. Build, 2. Research, 3. Design | Code changes, validated |
| **Knowledge audit** | 4. Diff-review, 5. Architecture-review, 6. PR-triage, 10. Maintenance | Findings, recommendations, health |
| **Knowledge transfer** | 8. Retry-after-failure, 12. Session handoff | Handoff pages, continuity |

Each flow is a fixed graph of stages. The pre-stage varies (what risk are you mitigating before doing the work); the tail is always the same shape — record handoff, update wiki, log event. The state machine in `lib/flow.ts` encodes each flow as a list of allowed transitions, an entry condition, and an exit condition. The agent calls `kb_flow` with `action=start flow=<name>` and the state machine walks the stages.

### 4.2 Handoff chains: the audit trail

Handoffs are thin bridges, not duplicate content. A handoff page has the following frontmatter:

```yaml
---
id: HOFF-YYYY-MM-DD-NNN
stage: brainstorm|design|spec|understand|execute|test|check|loop-back
task: TASK-NNN          # null for project-level handoffs
project: PROJ-NNN       # the project this handoff belongs to
status: pending|in-progress|done|failed|skipped
created: YYYY-MM-DD
updated: YYYY-MM-DD
from_handoff: HOFF-MMM  # previous in chain (null for the first)
to_handoff: HOFF-PPP    # next (filled when this one closes)
summary: "one-line description of what was decided/done"
---
```

The `from_handoff` / `to_handoff` pointers stitch a linked list per task. A task's full lifecycle is the chain of handoffs from `HOFF-001` (first brainstorm or spec stage) to `HOFF-NNN` (final commit or finalize). Three tools operate on the chain:

- `kb_list_handoffs` — filter by stage, task, project, status. Returns a table.
- `kb_get_handoff_chain task=TASK-001` — returns the ordered chain with summaries.
- `kb_get_project_state project=PROJ-001` — current pipeline: which tasks are at which stage, what's blocked, what's done.

**Skipped stages** are not invisible. A handoff with `status: skipped` and a `skip_reason` field is the recorded decision. "We considered brainstorming, decided against it because the codebase already has the relevant entity pages" is itself knowledge worth capturing. A missing handoff means the stage was never considered; a `skipped` handoff means it was considered and rejected. The `kb_lint` rule distinguishes these.

**Loop-back is a transition, not a workflow restart.** When a test fails the requirements check, the state machine emits a new handoff with `stage: loop-back` pointing to the stage that produced the failure. The next handoff in the chain re-enters that stage with the failure notes in its body. The chain is the history; the current state is the latest `to_handoff: null` handoff. The `kb_flow` action `advance` walks one step; `loop_back` rewinds the chain pointer.

### 4.3 Parallel execution per task

Tasks are parallel, not stages within a task. The build flow for one task is sequential: spec → execute → test. The flow for N tasks is N parallel sequential chains. The orchestrator (the agent running `kb_flow`) spawns one subagent per task; each subagent walks its own chain. Handoffs interleave across chains but do not block each other; the registry records per-chain status independently.

This is the architecture pattern that closes the user's "concentrated and specific" requirement: a single task file holds everything (spec, requirements, todos, dependencies), the chain of handoffs is the work history, and parallel tasks don't share context. Each subagent reads its task file + the linked handoffs + the relevant wiki pages (entities, concepts, design) and emits a single handoff at the end of its stage.

### 4.4 Mapping the 12 flows to rpiv-pi and mattpocock/skills

| Flow | Pre-stage | Tail | Subagent role packages | mp skill mapping |
|---|---|---|---|---|
| 1. Build | brief → design | execute → test → commit | orchestrator + designer + implementer + reviewer | `/build` (mp) orchestrator; `/tdd` at seams; `/code-review` at end |
| 2. Research | research | execute → test → commit | orchestrator + researcher | `/research` (mp); `/domain-modeling` for new entities |
| 3. Design | design | execute → test → commit | orchestrator + designer | `/codebase-design` (mp); `/design-an-interface` for APIs |
| 4. Diff-review | code-review | optional blueprint → commit | orchestrator + reviewer | `/code-review` (mp Standards + Spec axes) + rpiv's `diff-auditor` |
| 5. Architecture-review | architecture-review | optional blueprint → commit | orchestrator + architect | `/improve-codebase-architecture` (mp) |
| 6. PR-triage | security-gate | merge or full review | orchestrator + reviewer | `/triage` (mp) state machine |
| 7. Greenfield | brainstorm → research | acquire knowledge → update KB | orchestrator + onboarder + designer + researcher | `/setup-matt-pocock-skills` (mp) for the bootstrap; `/grill-with-docs` for the FRD |
| 8. Retry-after-failure | diagnose → research | re-execute → re-test | orchestrator + diagnoser + researcher + implementer | `/diagnose` (mp); `/research` (mp) for failure acquisition |
| 9. Onboarding | read CONTEXT.md → identify gaps | research gaps → update KB | orchestrator + onboarder | `/zoom-out` (mp); `/ubiquitous-language` to maintain the glossary |
| 10. Maintenance | lint | resolve findings → archive stale | orchestrator + architect | `/improve-codebase-architecture` (mp, periodic); auto-triggered |
| 11. Decision logging | capture decision | acquire knowledge → link sources | orchestrator only | `/decision-mapping` (mp) for the decision space; `kb_record_decision` for the ADR |
| 12. Session handoff | summarize state | write handoff → log | orchestrator only | `/handoff` (mp) for the conversation compaction; `kb_record_handoff` for the wiki persistence |

The kb flow router does not reimplement the mp skills. When mp is installed and a flow's stage corresponds to an mp skill, `kb_flow` calls the mp skill and records the resulting handoff. When mp is not installed, `kb_flow` falls back to the kb primitives (`kb_capture`, `kb_ensure_page`, `kb_create_*`) and the agent walks the stage directly.

## 5. Layer 3 — Role Packages

### 5.1 Roles over global installs

`mattpocock/skills` ships 53 skills. The default install (`npx skills@latest add mattpocock/skills`) puts all 53 into the agent's catalog, each skill's `name` + `description` taking ~100 tokens of system prompt at session start [5]. 53 skills × 100 tokens = 5,300 tokens before the agent does any work. The orchestrator (the agent running `kb_flow`) uses 5–7 of them. The subagents it spawns use different subsets. The unused skills cost real context without earning it.

The 2026 industry consensus is **subagent-scoped skill loading**: each subagent has its own context window, and skills are pre-loaded into that window at spawn time, not globally [7][8][9]. The Claude Agent SDK does this with a `skills:` array on the subagent definition; LangChain's Deep Agents does it with the `skills` argument to `create_deep_agent`. The pi coding agent ecosystem doesn't have first-class subagent support yet, but the kb extension can implement the same pattern by injecting role-scoped skills into the subagent's system prompt when `kb_flow` spawns it.

The role is the unit of skill distribution. A role is a named bundle — `role-orchestrator`, `role-designer`, `role-implementer`, `role-reviewer`, `role-researcher`, `role-diagnoser`, `role-onboarder`, `role-architect`, `role-writer` (optional) — and each role lists the skills it uses.

### 5.2 The nine role packages

```
wiki/agents/
├── role-orchestrator.md    # kb-flow, grill-me, handoff, decision-mapping, ask-matt
├── role-designer.md         # codebase-design, design-an-interface, ubiquitous-language, domain-modeling
├── role-implementer.md      # tdd, prototype, implement
├── role-reviewer.md         # code-review, review, qa
├── role-researcher.md       # research, zoom-out
├── role-diagnoser.md        # diagnose, diagnosing-bugs
├── role-onboarder.md        # setup-matt-pocock-skills, zoom-out, ubiquitous-language
├── role-architect.md        # improve-codebase-architecture, decision-mapping
└── role-writer.md           # writing-shape, writing-fragments, writing-beats (optional)
```

Each role page is a KB entity page (type: `entity`) with three sections: **scope** (what the role does and does not do), **skills** (the exact skills loaded when this role is spawned), and **inputs/outputs** (the handoff types the role consumes and produces). A `wiki/agents/registry.json` indexes the roles, the skills they list, and the install status.

When `kb_flow` spawns a subagent, it reads the role page, looks up the listed skills in the registry, and injects only those into the subagent's context. The subagent never sees skills outside its role. Adding a new role does not bloat the orchestrator; the role is just another KB page.

### 5.3 Install footprint

By default, only the **orchestrator role** is installed globally. Subagent skills are referenced in role pages and loaded on demand at spawn time. The token economics:

| Approach | Orchestrator catalog | Subagent catalog | Total at idle | Total in a build flow |
|---|---|---|---|---|
| Install all 53 mp skills globally | 5,300 tokens | Same | 5,300 | 5,300 + N subagent contexts |
| Install curated subset (~14) | ~1,400 tokens | Same | 1,400 | 1,400 + N |
| **Role packages (this redesign)** | **~500 tokens** | Per-agent, just the role's skills | 500 | 500 + N × role's skills |

The role-scoped model is the only one that doesn't bloat the orchestrator as the skill library grows. New mp skills get added; orchestrator cost stays flat.

### 5.4 The `kb_role_install` tool

A new lightweight tool for role management:

- `kb_role_install role=designer` — installs the skills listed in `role-designer.md`. The designer subagent can now be spawned.
- `kb_role_install role=designer skill=foo` — adds `foo` to the designer's role page and installs it.
- `kb_role_uninstall role=designer` — removes the role's skills from the global install. The role page stays; the subagent can't be spawned until reinstalled.
- `kb_role_list` — shows all roles, their skills, and install status.

The `kb_role_install` tool reads the role page, resolves the skills against the registry, and calls the underlying package manager (`pi install` for pi-native skills, `npx skills@latest add` for Anthropic-format skills). Idempotent; running it on a fully-installed role is a no-op.

### 5.5 Source priority

When the kb scaffold and mattpocock both have a "best practice" for a skill (e.g., `code-review`), mp wins. Skills stay pure; the kb scaffold just decides which role gets which skill. The kb extension does not override mp's `code-review` — it says "the reviewer role uses `code-review` from mp, and the kb flow routes the review stage through `/code-review`." This is the composability principle: don't fork, route.

## 6. Scaffolding: `kb_scaffold`

### 6.1 Generated artifacts

`kb_scaffold` is the one-time bootstrap that creates a complete project. It is idempotent — running it on an existing project updates only what's missing or drifted. The generated artifacts:

| Path | Content | Source |
|---|---|---|
| `.kb/config.json` | Vault mode, topic, page-type list, role list | kb_scaffold |
| `.kb/AGENTS.md` | Agent-facing quick reference (project name, vault path, page types, role list, lint rules) | kb_scaffold |
| `.kb/templates/pages/*.md` | The 16 page templates | kb extension's `templates/pages/` |
| `.kb/templates/handoff.md` | Handoff page template with the chain-schema frontmatter | kb_scaffold |
| `.kb/wiki/context/context.md` | The project's canonical `CONTEXT.md` page (type: context) | kb_scaffold (with `kb_ensure_context`) |
| `wiki/agents/role-*.md` | The 9 role pages (entity type) | kb_scaffold |
| `wiki/agents/registry.json` | Role → skill → install-status index | kb_scaffold |
| `skills/kb-flow/SKILL.md` | The local flow router skill | kb extension's `skills/kb-flow/` |
| `.agents/` (optional) | Per-tool adapters (CLAUDE.md, etc.) | Composes with mp's `/setup-matt-pocock-skills` |
| `docs/adr/0001-use-kb-extension.md` | First ADR recording the choice | kb_scaffold (with `kb_record_decision`) |
| `AGENTS.md` (repo root) | The cross-tool config file the user invokes the agent through | Generated from kb config; can include `@.kb/AGENTS.md` import |

The user runs `kb_scaffold topic="My Project" mode=project root=.`. The tool asks 4 questions if answers aren't pre-supplied:

1. **Issue tracker** — `github`, `linear`, `local`, or `none` (composes with mp's setup)
2. **Dual-vault preference** — `personal+project` (default), `project only`, or `personal only`
3. **Mattpocock install** — `install now`, `install later`, `skip` (default: `install now` if `npx skills@latest` is on PATH)
4. **First ADR title** — generates a seed ADR recording the kb-scaffold decision itself

### 6.2 Composing with mp's setup

When mattpocock is detected (via the `npx skills@latest` binary on PATH or by checking `~/.pi/agent/skills/`), `kb_scaffold` delegates the issue-tracker and triage-labels questions to `/setup-matt-pocock-skills` and uses the answers to populate the kb registry. The kb scaffold doesn't reimplement mp's setup; it composes with it.

When mp is not installed, the scaffold prompts the user: "Want to install mattpocock's skills? They handle scaffolding, triage, TDD, code review. Recommended." If yes, runs `npx skills@latest add mattpocock/skills` and re-runs the questions. If no, writes equivalent inline config (the same 4 questions, the same answers, but stored as `.kb/config.json` keys instead of `docs/agents/*.md`).

The `AGENTS.md` generation is the same pattern. The kb scaffold produces an `AGENTS.md` that imports from the kb's `.kb/AGENTS.md` via `@.kb/AGENTS.md` (Claude Code's import syntax). It does not duplicate content; it composes.

### 6.3 Idempotency

Re-running `kb_scaffold` on an existing project:
- Skips files that exist and have the same content
- Updates files that exist but have drifted (e.g., a new kb version added a new page type)
- Creates files that don't exist
- Never deletes user-modified files (the scaffold compares hashes, not just presence)

This is the same pattern as mp's bootstrap and Anthropic's Skills spec: scaffolding is project configuration, not state. The user's edits are the source of truth; the scaffold is the initial render.

## 7. Tool surface (29 tools)

The 24 existing tools split into 15 retained, 5 deprecated, and 9 new. The deprecations are not removals; they are supersession. The deprecated tools still work for one release with a console warning pointing at the new typed equivalent.

### 7.1 Retained (15)

| Tool | Status | Notes |
|---|---|---|
| `kb_bootstrap` | Retained (lightweight) | The minimal "create the vault" alternative to `kb_scaffold` |
| `kb_status` | Retained | Now also shows role-install status |
| `kb_capture` | Retained | URL detection added (delegates to web-access / gh) |
| `kb_ingest` | Retained | Now also emits a stage handoff to mark ingest as a kb-flow stage |
| `kb_mark_ingested` | Retained | |
| `kb_ensure_page` | Retained, schema-tightened | Now rejects pages whose `type` doesn't match a known type, missing required frontmatter |
| `kb_recall_context` | Retained | |
| `kb_recall_docs` | Retained | |
| `kb_search_tags` | Retained, extended | `run` and `status` filters added; role and stage filters added |
| `kb_rebuild_meta` | Retained | |
| `kb_lint` | Retained, extended | New rules: wiki files without matching frontmatter type, role pages referencing uninstalled skills, handoffs with broken chain pointers |
| `kb_observe` | Retained | |
| `kb_enrich` | Retained | |
| `kb_retro` | Retained | |
| `kb_log_event` | Retained | |

### 7.2 Deprecated (5)

| Old tool | Replacement | Why |
|---|---|---|
| `kb_create_research` | `kb_ensure_page type=research` | All `kb_create_*` tools collapse into `kb_ensure_page` with `type=<name>` |
| `kb_create_project` | `kb_scaffold` | Project creation is now a scaffold operation |
| `kb_list_projects` | `kb_status` | `kb_status` now reports project list |
| `kb_create_project_page` | `kb_ensure_page type=project` | Same collapse as `kb_create_research` |
| `kb_create_brainstorm` | `kb_ensure_page type=brainstorm` | Same |

The collapse of `kb_create_*` into `kb_ensure_page` is the main cleanup. `kb_ensure_page` becomes the **only** typed page-creation tool, and it dispatches on `type=<name>` to the right template + ID prefix. This is the pattern Anthropic's Skills spec implies: one format (SKILL.md) that dispatches on metadata. Here, one tool (`kb_ensure_page`) that dispatches on type.

### 7.3 New (9)

| Tool | Purpose | Archetype |
|---|---|---|
| `kb_scaffold` | Full project bootstrap; composes with mp's setup | Bootstrap |
| `kb_flow` | State machine over the 12 flows. `action=start\|advance\|loop_back\|status\|complete` | Flow engine |
| `kb_create_handoff` | Records a handoff page with chain pointers | Flow engine |
| `kb_list_handoffs` | Query handoffs by stage / task / project / status | Flow engine |
| `kb_get_handoff_chain` | Returns the ordered chain for a task | Flow engine |
| `kb_get_project_state` | Returns current pipeline state for a project | Flow engine |
| `kb_ensure_context` | Creates/updates the project's `context` page | Knowledge |
| `kb_record_decision` | Creates an ADR (`adr` page type) | Knowledge |
| `kb_role_install` | Installs/uninstalls a role's skills; updates the role registry | Role |

### 7.4 URL capture across extensions

`kb_capture` already supports local files and text. The redesign adds URL detection:

| Input | Dispatch |
|---|---|
| Local file path | Capture as `original.<ext>` |
| Raw text | Capture as `original.md` (text) |
| `https://github.com/...` | Call `gh` extension's GitHub fetcher, capture the result |
| `https://...` (other) | Call `web-access` extension's `web-fetch`, capture the result |

The kb extension does not reimplement the fetchers. It calls out to `web-access` and `gh` via the pi extension API, gets the content back, and stores it as a source packet. The source packet's `meta.json` records `source_type: file | text | url | github` and `source_url` for URL types, so later queries can ask "show me everything we captured from GitHub this week."

## 8. Discipline mechanisms

The kb extension's discipline lives in three places, in increasing order of strictness:

### 8.1 The SKILL.md and AGENTS.md convention

The scaffolded `skills/kb-flow/SKILL.md` and `AGENTS.md` tell the agent the rules. This is the weakest layer — prose can be ignored — but it's where the project's intent lives. The flow skill describes the 12 flows, the role pages, the page types, the handoff schema. The `AGENTS.md` is the entry point.

### 8.2 Lint: `kb_lint`

The `kb_lint` tool is the second layer. It runs over the vault and reports:
- Any file in `wiki/` with no matching frontmatter `type` (orphaned, agent wrote directly)
- Any file in `wiki/` not in `meta/registry.json`
- Any `kb_create_*` or `kb_ensure_page` invocation that would create a duplicate concept/entity
- Any handoff with broken `from_handoff` or `to_handoff` pointers
- Any role page referencing a skill that isn't installed
- Any page where `derived_from` lists a `SRC-ID` that doesn't exist
- Any wiki file with `last_verified` more than 90 days ago and `stage: production`

By default, `kb_lint` reports but doesn't fail. The user can opt into strict mode (`kb_lint strict=true`) which returns a non-zero exit code on any error. The CI / pre-commit hook can use strict mode to enforce.

### 8.3 Guardrails: `lib/guardrails.ts`

The `guardrails.ts` module is the strictest layer. It blocks at the tool-registration level:
- Direct file writes to `wiki/` are blocked regardless of which tool the agent uses (the `write` tool, `edit` tool, `cat > file` via bash — all blocked for paths matching `wiki/**`)
- Writes to `meta/` are blocked except for the extension's own internal tools
- Writes to `raw/` are blocked except for `kb_capture`

This is the **code-level enforcement** that the user's intuition about "guardrails" is pointing at. The current extension's `guardrails.ts` protects `raw/` and `meta/`; the redesign extends the rule set to `wiki/`. An agent that bypasses `kb_ensure_page` to write a markdown file directly to `wiki/concepts/foo.md` is blocked at the system level, not just by convention.

The pattern is the same one the user's hybrid-workflow synthesis already adopted: "enforcement in code, not in instructions." The Anthropic Skills ecosystem, Parallax [10], NemoClaw OpenShell [11], and the `agent-guardrails` pre-commit hooks all converge on the same principle: agent discipline is a code-level property, not a prompt-level one.

## 9. Cross-extension integration

| Extension | What kb uses | What kb provides |
|---|---|---|
| `web-access` | `web-fetch` and `web-fetch-docs` for URL capture | (none) |
| `gh` | GitHub URL fetch for repos, issues, PRs, code files | (none) |
| `guardrails` | `registerRules()` API to install the wiki/raw/meta protection rules | (none) |
| `mattpocock/skills` | `setup-matt-pocock-skills` for the bootstrap Q&A, `/tdd` for TDD discipline, `/code-review` for review axes, `/diagnose` for failure diagnosis, `/handoff` for session compaction | The role pages, the flow skill, the kb primitives |
| `rpiv-pi` | `/wf` JSONL state pattern (inspiration for handoff chain), `/discover` for the FRD, `/research` for parallel investigation | The handoff pages, the flow router, the persistence layer |
| `claude-handoff` (mp) | Session-to-session compaction (when used) | A wiki where the compaction can be filed |

The kb extension is the **integration point** — the layer that holds the other extensions together with a persistent knowledge book and a flow router. It does not replace them; it sits beside them and gives them a home.

## 10. Migration from the current extension

### 10.1 Migration matrix

| Layer | Current | Redesign | Migration cost |
|---|---|---|---|
| Storage layers (raw / wiki / meta) | Present | Tightened (wiki also protected) | Low — update `guardrails.ts` rule set |
| Page types | 14 | 16 (+ context, + adr) | Low — add 2 templates, update `kb_ensure_page` schema |
| Dual-vault routing | Present | Unchanged | None |
| Hybrid search (BM25 + embeddings) | Present | Unchanged | None |
| 24 tools → 29 tools | 24 | 24 retained - 5 deprecated + 9 new + 1 = 28, plus 1 light kb_bootstrap = 29 | Medium — add new tools, deprecate old |
| Registry / backlinks / events | Present | Extended (handoff chain, role registry) | Medium — extend `meta.ts` |
| Frontmatter | Present | Extended (`derived_from`, `confidence`, `last_verified`) | Low — additive |
| Lint rules | Present | Extended (chain integrity, role integrity, derived_from integrity) | Low |
| Scaffold | None | `kb_scaffold` | New |
| Flow engine | None | `kb_flow` + 12 flows + handoff chain | New |
| Role packages | None | 9 role pages + `kb_role_install` | New |
| Wiki page id prefixes (existing) | Mixed (12 of 14 page types use prefixes; `concept`/`entity`/`synthesis`/`analysis`/`source` don't) | Add prefixes to all knowledge types, OR formalize that knowledge types are non-IDed and only pipeline types carry IDs | Decision call |
| Working vault cleanup | 165 of 192 wiki files lack ID prefix | One-time audit + re-categorization pass | Out-of-band, manual |

### 10.2 ID prefixes for knowledge vs. pipeline types

The current templates for `concept`, `entity`, `synthesis`, `analysis`, and `source` have no ID prefix. The `handoff` template does. The pipeline types (`project`, `brainstorm`, `spec`, `task`, `sprint-plan`, etc.) all have prefixes. There are two reasonable resolutions:

**Option A.** Add prefixes to all 16 page types. `concept-001`, `entity-001`, `synthesis-001`, etc. This makes the registry uniform and the `kb_recall_context` queries simpler (`type=concept` returns all `concept-*` pages). Cost: every existing concept/entity/synthesis/analysis/source page in the working vault needs to be renamed or aliased.

**Option B.** Formalize that knowledge types are non-IDed (they're uniquely identified by their title or by their `derived_from` chain), and only pipeline types carry IDs. This matches how Obsidian wikis typically work — pages are titled, not numbered, and backlinks are the graph. The kb extension's `kb_recall_context` already uses title-based search via the registry, so the missing IDs don't break lookups.

The redesign's recommendation is **Option B**. The user's hybrid-workflow synthesis already says "the human's job is to curate sources, direct the analysis, ask good questions" — pages are concepts, not tickets. Numbering tickets makes sense; numbering concepts doesn't. The current 165 polluted files are the cost of conflating the two. Making the distinction explicit in the schema prevents future pollution.

### 10.3 The working vault cleanup

The 165 non-IDed files in the user's working vault need to be re-categorized once. The audit is mechanical:

| Pattern in current vault | Likely correct type | Action |
|---|---|---|
| `wiki/concepts/*.md` with type: concept | `concept` | Keep, retitle to remove ID prefix concerns |
| `wiki/sources/*.md` with type: source | `source` | Keep, but distinguish "summary of a captured source" (correct usage) from "raw captured source" (should be in `raw/sources/`) |
| `wiki/entities/*.md` with type: entity | `entity` | Keep |
| `wiki/analyses/*.md` with type: analysis | `analysis` | Keep |
| `wiki/syntheses/*.md` with type: synthesis | `synthesis` | Keep |
| `wiki/artifacts/*.md` with free-form titles | Likely `adr`, `brainstorm`, `spec`, or `analysis` | Classify per content; promote to typed pages |
| `wiki/diaries/*.md` with date-based titles | `daily-log` | Rename to `DAY-YYYY-MM-DD-*` for consistency |
| `wiki/tickets/*.md` | Likely `task` or `sprint-plan` | Promote to typed pages |
| `wiki/todos/*.md` | Likely `task` with status: exploring | Promote |
| `wiki/schedules/*.md` | Likely `daily-log` or `sprint-plan` | Classify |

The audit tool (`kb_lint strict=true`) reports the non-conforming files; the cleanup is one bulk pass with `kb_ensure_page type=<correct> title=<original title> body=<content>`. The old file gets archived to `raw/sources/` as a text capture, preserving the audit trail. After the pass, `kb_lint` returns zero.

## 11. Implementation phases

The redesign is large; the rollout is small. Five phases, each independently shippable.

**Phase 1 — Knowledge book tightening (1-2 weeks).** Update `guardrails.ts` to block direct writes to `wiki/`. Extend the page-type schema to 16 types. Add the `context` and `adr` templates. Tighten `kb_lint` rules. Deprecate the 5 redundant `kb_create_*` tools. *Outcome: wiki pollution becomes architecturally impossible.*

**Phase 2 — Handoff chain mechanics (2-3 weeks).** Add `kb_create_handoff`, `kb_list_handoffs`, `kb_get_handoff_chain`, `kb_get_project_state`. Extend the registry to track handoff chains. Add the `wiki/handoffs/` directory to the scaffold. Update `kb_ensure_page` to allow `type=handoff` with the chain schema. *Outcome: the agent has a tool for the audit trail.*

**Phase 3 — Flow engine (3-4 weeks).** Implement `lib/flow.ts` with the 12 flows as state machines. Add `kb_flow` tool with the 5 actions. Generate `skills/kb-flow/SKILL.md` (the local flow router). Wire mp skill calls where the flow's stage corresponds to an mp skill. *Outcome: the agent has a tool for the process.*

**Phase 4 — Role packages (1-2 weeks).** Add the 9 role pages, the role registry, and `kb_role_install`. Wire `kb_flow` to inject role-scoped skills when spawning subagents. *Outcome: skills are scoped to the agent that needs them.*

**Phase 5 — Scaffolding (1-2 weeks).** Implement `kb_scaffold` with the full project generation. Compose with mp's `/setup-matt-pocock-skills`. Generate the role pages, the flow skill, the templates, the AGENTS.md. Idempotency tests. *Outcome: a new project gets the full kb setup in one command.*

Total: 8-13 weeks of focused work. Each phase is independently usable; the user can stop after any phase and still have a working extension. The phases are ordered by leverage — phase 1 alone fixes the user's stated problem (wiki pollution) at the architectural level.

## 12. Open questions

**Q1. Where do ADRs live — repo (`docs/adr/`) or vault (`wiki/adrs/`)?** Mattpocock stores them in the repo. The kb extension stores them in the vault. Both are reasonable. The cleanest answer is **the vault is canonical, the repo is a mirror**, and `kb_record_decision` writes the vault page and optionally generates a `docs/adr/NNNN-*.md` mirror in the repo. The user's hybrid-workflow decision (PLAN-002) leans toward dual-store; the scaffold should ask which side is canonical per project.

**Q2. Should the kb extension ship its own MCP server?** Three pi ecosystem implementations do (`zosmaai/pi-llm-wiki`, `0xkobold/pi-codebase-wiki`, `pi-knowledge`). The kb extension's existing tool surface is accessible via the pi extension API; an MCP server would make it accessible to non-pi agents. Worth doing in a later release; not in scope for v2.

**Q3. Should `kb_flow` integrate with rpiv-pi's `/wf` JSONL state, or be independent?** rpiv's JSONL state is a process-state log; the kb handoff chain is a knowledge-state log. They serve different purposes but overlap. The cleanest integration is: `kb_flow` records its state into the handoff chain (knowledge), and optionally mirrors into a `.rpiv/runs/<id>.jsonl` file (process) if rpiv is installed. The user already decided dual-store (PLAN-002); the kb flow respects that.

**Q4. Does the kb extension ship its own pi-installable package, or stay inside `pi-config`?** The user's `pi-config` is a personal config repo. The kb extension is feature-complete enough to ship as its own package (`@smitray/pi-kb` or similar) and be installable via `pi install npm:@smitray/pi-kb`. The hybrid-workflow synthesis already documents the right boundary: the kb extension is a tool package, not a config package. Ship it.

## References

[1] Karpathy, A. "LLM Wiki." GitHub Gist, 4 April 2026. https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

[2] juicesharp. "rpiv-pi: A driver-in-the-loop pipeline for Pi." https://rpiv-pi.com/

[3] juicesharp. "rpiv-mono: Nine npm packages — the pipeline and the siblings it composes." GitHub. https://github.com/juicesharp/rpiv-mono

[4] Pocock, M. "mattpocock/skills: Skills for Real Engineers." GitHub. https://github.com/mattpocock/skills

[5] Anthropic. "Equipping agents for the real world with Agent Skills." Anthropic Engineering, October 2025; published as open standard 18 December 2025. https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills

[6] Ghumare, R. "LLM Wiki v2 — extending Karpathy's pattern with confidence scoring, supersession, and lifecycle." GitHub Gist. https://gist.github.com/rohitg00/2067ab416f7bbe447c1977edaaa681e2

[7] "AI Agent Workflow Composition and Skill Reuse: From Monoliths to Compositions." zylos.ai Research, 4 May 2026. https://zylos.ai/research/2026-05-04-agent-workflow-composition-skill-reuse/

[8] "Building Multi-Agent Applications with Deep Agents." LangChain Blog. https://www.langchain.com/blog/building-multi-agent-applications-with-deep-agents

[9] "Subagents in AI Agents: Context Isolation and Delegation." corecocept.com. https://corecocept.com/blog/subagents-explained

[10] "Parallax: Why AI Agents That Think Must Never Act." arXiv:2604.12986. https://arxiv.org/html/2604.12986v1

[11] NemoClaw Blueprint and OpenShell Guardrails. NVIDIA NemoClaw Documentation. https://docs.nvidia.com/nemoclaw/latest/user-guide/openclaw/security/security-controls/filesystem-controls.md

[12] "Build customer support with handoffs." LangChain Multi-Agent Orchestration Documentation. https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs
