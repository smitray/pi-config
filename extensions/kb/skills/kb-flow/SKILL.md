---
name: kb-flow
description: Local flow router — walk the 12 named kb flows via kb_flow. Each stage emits a handoff; the chain is the audit trail.
---

# KB Flow

The 12 flows: `build`, `research`, `design`, `diff-review`, `architecture-review`,
`pr-triage`, `greenfield`, `retry-after-failure`, `onboarding`, `maintenance`,
`decision-logging`, `session-handoff`.

## Usage

- `kb_flow action=start flow=<name> project=<PROJ-ID> [task=<TASK-ID>]` — begin a run
- `kb_flow action=advance run=<RUN-ID> summary="..."` — move to the next stage, emit a handoff
- `kb_flow action=loop_back run=<RUN-ID> target_stage=<stage> reason="..."` — rewind on failure
- `kb_flow action=status run=<RUN-ID>` — current stage + chain
- `kb_flow action=complete run=<RUN-ID>` — close the run

Every stage creates a handoff page (`wiki/handoffs/`). The from/to pointers stitch
the per-task chain. Review it with `kb_get_handoff_chain task=<TASK-ID>`.

## Rules

- One active run per project/task. Complete it before starting another.
- Loop-back is a transition, not a restart: record the failure, re-enter the stage.
- When a stage maps to a mattpocock skill (`/code-review`, `/tdd`, `/diagnose`), run the skill, then record the handoff.
