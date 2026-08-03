---
title: "{{title}}"
type: sprint-plan
id: "{{id}}"
project: "{{project}}"
parent: "[[projects/{{project}}/project]]"
sprint: {{sprint}}
status: {{status}}
start_date: "{{start_date}}"
end_date: "{{end_date}}"
created: "{{created}}"
updated: "{{updated}}"
tags: [{{tags}}]
# Child specs in this sprint
children: [{{children}}]
# Auto-updated by Kanban aggregator
specs_total: {{specs_total}}
specs_done: {{specs_done}}
progress_pct: {{progress_pct}}
---

# {{title}}

**Project:** [[projects/{{project}}/project]] | **Sprint:** {{sprint}}
**Status:** {{status}} | **Dates:** {{start_date}} → {{end_date}}

## Sprint Goal

<!-- One sentence: what does "done" look like for this sprint? -->

## Scope

### In Scope

<!-- What we WILL deliver -->

### Out of Scope

<!-- What we WON'T deliver (and why) -->

## Specs

<!-- Each spec is a child page. Status tracked in spec frontmatter. -->

| Spec | Status | Tasks | Owner |
|------|--------|-------|-------|
| [[spec-{{id}}-auth]] | draft | 0/0 | |
| [[spec-{{id}}-dashboard]] | draft | 0/0 | |

## Dependencies

<!-- External blockers, other teams, infrastructure -->

| Dependency | Owner | Status | Impact |
|------------|-------|--------|--------|

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|

## Capacity

| Day | Available Hours | Focus Area |
|-----|-----------------|------------|
| Mon | | |
| Tue | | |
| Wed | | |
| Thu | | |
| Fri | | |

## Retro Notes

<!-- Fill at end of sprint -->

### Went Well

### Could Improve

### Action Items

## Child Pages

- [[spec-{{id}}-auth]] — Authentication spec
- [[spec-{{id}}-dashboard]] — Dashboard spec

## Notes
