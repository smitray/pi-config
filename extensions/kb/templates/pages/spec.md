---
title: "{{title}}"
type: spec
id: "{{id}}"
project: "{{project}}"
parent: "[[plans/{{sprint_plan}}]]"
feature: "{{feature}}"
status: {{status}}
priority: {{priority}}
owner: "{{owner}}"
created: "{{created}}"
updated: "{{updated}}"
tags: [{{tags}}]
# Child tasks implementing this spec
children: [{{children}}]
# Auto-updated by Kanban aggregator
tasks_total: {{tasks_total}}
tasks_done: {{tasks_done}}
progress_pct: {{progress_pct}}
review_checklist_passed: {{review_checklist_passed}}
---

# {{title}}

**Sprint:** [[plans/{{sprint_plan}}]] | **Feature:** {{feature}}
**Status:** {{status}} | **Priority:** {{priority}} | **Owner:** {{owner}}

## Problem Statement

<!-- What user problem does this spec solve? Who is affected? -->

## Proposed Solution

<!-- High-level approach. Architecture decisions, trade-offs. -->

## User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-1 | As a [user], I want [goal] so that [benefit] | Given/When/Then |

## Technical Design

### Architecture

<!-- Component diagram, data flow, integration points -->

### API Contract

```yaml
# OpenAPI, GraphQL schema, or interface definition
```

### Data Model

```yaml
# Database schema, types, interfaces
```

### Error Handling

| Error | Condition | Response | Recovery |
|-------|-----------|----------|----------|

## Tasks Breakdown

<!-- Each task is a child page. Status tracked in task frontmatter. -->

| Task | Status | Owner | Estimate |
|------|--------|-------|----------|
| [[task-{{id}}-impl]] | backlog | | |
| [[task-{{id}}-tests]] | backlog | | |
| [[task-{{id}}-docs]] | backlog | | |

## Review Checklist

<!-- Must pass before spec moves to "approved" -->

- [ ] Technical design reviewed by peer
- [ ] API contract approved
- [ ] Security review completed
- [ ] Performance impact assessed
- [ ] Test strategy defined
- [ ] Documentation plan created

## Testing Strategy

### Unit Tests

<!-- What units need testing? Coverage targets. -->

### Integration Tests

<!-- What integrations need testing? -->

### E2E Tests

<!-- What user flows need testing? -->

## Rollback Plan

<!-- How to revert if this goes wrong -->

## Child Pages

- [[task-{{id}}-impl]] — Implementation tasks
- [[task-{{id}}-tests]] — Test implementation
- [[task-{{id}}-docs]] — Documentation

## Notes
