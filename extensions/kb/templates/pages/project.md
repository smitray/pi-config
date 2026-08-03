---
title: "{{title}}"
type: project
id: "{{id}}"
status: {{status}}
priority: {{priority}}
owner: "{{owner}}"
created: "{{created}}"
updated: "{{updated}}"
tags: [{{tags}}]
# Pipeline progress — auto-updated by Kanban aggregator
pipeline:
  brainstorm: {{brainstorm_status}}
  planning: {{planning_status}}
  specs_total: {{specs_total}}
  specs_done: {{specs_done}}
  tasks_total: {{tasks_total}}
  tasks_done: {{tasks_done}}
  prs_total: {{prs_total}}
  prs_merged: {{prs_merged}}
  progress_pct: {{progress_pct}}
---

# {{title}}

**Status:** {{status}} | **Priority:** {{priority}} | **Owner:** {{owner}}

## Vision

<!-- One-paragraph project goal. What problem does this solve? -->

## Constraints

<!-- Technical, time, resource constraints -->

## Pipeline Overview

| Stage | Status | Count | Link |
|-------|--------|-------|------|
| Brainstorm | {{brainstorm_status}} | — | [[brainstorms/brainstorm-{{id}}]] |
| Planning | {{planning_status}} | — | [[plans/sprint-{{id}}]] |
| Specs | {{specs_done}}/{{specs_total}} | — | [[specs/]] |
| Tasks | {{tasks_done}}/{{tasks_total}} | — | [[tasks/]] |
| PRs | {{prs_merged}}/{{prs_total}} | — | [[prs/]] |

## Brainstorms

<!-- Auto-populated: wikilinks to child brainstorm pages -->
- [[brainstorms/]]

## Active Sprint

<!-- Current sprint plan wikilink -->
- [[plans/]]

## Specs

<!-- Auto-populated: wikilinks to child spec pages -->
- [[specs/]]

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|

## Notes
