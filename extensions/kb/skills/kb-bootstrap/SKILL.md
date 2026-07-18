---
name: kb-bootstrap
description: >
  Initialize a Knowledge Base vault for a project or personal use. Use when the user says
  "create a KB", "start knowledge base", "bootstrap KB", "setup .kb", or "initialize
  project knowledge base".
compatibility: >
  Requires the kb pi extension. Creates .kb/ at project root or ~/.kb/ for personal vaults.
  Non-destructive — won't overwrite existing vaults.
---

# kb-bootstrap

One command to start a knowledge base. Auto-detects project vs personal mode.

## Quick Start

```text
kb_bootstrap topic="My Project"
```

That's it. Detects mode automatically:
- Inside a git repo or has `.git` → `project` mode → creates `.kb/` in cwd
- Otherwise → `personal` mode → creates `~/.kb/`

## Override Mode

```text
kb_bootstrap topic="Personal Notes" mode=personal
kb_bootstrap topic="Project Docs" mode=project root="/path/to/project"
```

## What Gets Created

```
.kb/  (or ~/.kb/ for personal)
├── config.json              # topic, mode, created date
├── AGENTS.md                # personal vaults only — minimal pointer to skills
├── templates/pages/         # 7-8 page templates (personal: 7, project: 8)
│   ├── concept.md
│   ├── entity.md
│   ├── synthesis.md
│   ├── analysis.md
│   ├── source.md
│   ├── meeting.md           # personal only
│   ├── diary.md             # personal only
│   └── artifact.md          # project only (WIP, brainstorming)
├── raw/sources/             # immutable source packets
├── wiki/                    # editable wiki pages
└── meta/                    # auto-generated registry + backlinks
```

## After Bootstrap

Seed with initial content:

```text
# Capture project README
kb_capture source="README.md" title="Project README"

# Capture architecture docs
kb_capture source="docs/ARCHITECTURE.md" title="Architecture Overview"

# Process pending sources
kb_ingest vault=project  # or vault=personal for personal KB
# → read extracted.md, create pages with kb_ensure_page
```

## Post-Setup Check

```text
kb_status          # verify vault is healthy
kb_search_tags     # list all pages (empty initially)
```

## Non-Destructive

Running `kb_bootstrap` on an existing vault is safe — it detects existing `config.json` and skips creation. To re-initialize, delete `.kb/` first.
