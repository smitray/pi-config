---
title: "{{title}}"
type: task
id: "{{id}}"
project: "{{project}}"
parent: "[[specs/{{spec}}]]"
spec: "{{spec}}"
sprint: "{{sprint}}"
status: {{status}}
priority: {{priority}}
owner: "{{owner}}"
estimate: "{{estimate}}"
actual: "{{actual}}"
created: "{{created}}"
updated: "{{updated}}"
tags: [{{tags}}]
# Completion gate — all must pass before status=done
tests_passing: {{tests_passing}}
review_approved: {{review_approved}}
pr_linked: "{{pr_linked}}"
---

# {{title}}

**Spec:** [[specs/{{spec}}]] | **Sprint:** {{sprint}}
**Status:** {{status}} | **Priority:** {{priority}} | **Owner:** {{owner}}
**Estimate:** {{estimate}} | **Actual:** {{actual}}

## Objective

<!-- What does this task deliver? One sentence. -->

## Implementation Details

### Approach

<!-- Step-by-step implementation plan -->

1. 
2. 
3. 

### Code Changes

<!-- Files to modify, functions to add/change -->

| File | Change | Reason |
|------|--------|--------|

### Dependencies

<!-- Other tasks that must complete first, libraries needed -->

- Blocked by: [[task-{{id}}-prereq]]
- Uses: library-name

## Testing Instructions

### Unit Tests

```bash
# Commands to run unit tests
```

### Integration Tests

```bash
# Commands to run integration tests
```

### Manual Verification

<!-- Steps to manually verify the change works -->

1. 
2. 
3. 

## Completion Criteria

<!-- ALL must be checked before status can move to "done" -->

- [ ] Implementation complete
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Code review approved
- [ ] PR created and linked
- [ ] Documentation updated

## PR Link

<!-- Link to pull request when created -->
- PR: {{pr_linked}}

## Blockers

<!-- Current blockers preventing progress -->

## Notes

<!-- Implementation notes, gotchas, decisions made during implementation -->
