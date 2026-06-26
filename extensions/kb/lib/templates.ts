import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VaultPaths } from './vault';
import { fmtDate } from './vault';

// ponytail: default templates shipped inline. Written to vault on bootstrap.
// kb_ensure_page reads from disk; falls back to these if missing.

export type PageType = 'concept' | 'entity' | 'synthesis' | 'analysis' | 'source';

const TEMPLATES: Record<PageType, string> = {
  concept: `---
title: "{{title}}"
type: concept
tags: [{{tags}}]
created: "{{created}}"
updated: "{{updated}}"
stage: {{stage}}
sources: []
---

# {{title}}

## Definition

## Key Points

## Related Concepts

## Open Questions
`,
  entity: `---
title: "{{title}}"
type: entity
category: tool
tags: [{{tags}}]
created: "{{created}}"
updated: "{{updated}}"
stage: {{stage}}
sources: []
---

# {{title}}

## Overview

## Details

## Related Entities
`,
  synthesis: `---
title: "{{title}}"
type: synthesis
tags: [{{tags}}]
created: "{{created}}"
updated: "{{updated}}"
stage: {{stage}}
sources: []
---

# {{title}}

## Thesis

## Evidence

## Contradictions

## Open Questions
`,
  analysis: `---
title: "{{title}}"
type: analysis
tags: [{{tags}}]
created: "{{created}}"
updated: "{{updated}}"
stage: {{stage}}
sources: []
---

# {{title}}

## Question

## Answer

## Reasoning

## Sources
`,
  source: `---
title: "{{title}}"
type: source
sourceId: "{{sourceId}}"
created: "{{created}}"
updated: "{{updated}}"
---

# {{title}}

## Summary

## Key Entities

## Key Concepts

## Notes
`,
};

export function writeDefaultTemplates(paths: VaultPaths): void {
  for (const [type, content] of Object.entries(TEMPLATES)) {
    const target = join(paths.templates, `${type}.md`);
    if (!existsSync(target)) {
      writeFileSync(target, content, 'utf-8');
    }
  }
}

export function loadTemplate(type: PageType, paths: VaultPaths): string {
  const disk = join(paths.templates, `${type}.md`);
  if (existsSync(disk)) {
    return readFileSync(disk, 'utf-8');
  }
  return TEMPLATES[type];
}

export function populateTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export function buildPage(
  type: PageType,
  title: string,
  paths: VaultPaths,
  extraVars: Record<string, string> = {}
): { content: string; filename: string } {
  const template = loadTemplate(type, paths);
  const today = fmtDate();
  const content = populateTemplate(template, {
    title,
    created: today,
    updated: today,
    tags: '',
    stage: 'brainstorm',
    ...extraVars,
  });
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const filename = `${slug}.md`;
  return { content, filename };
}
