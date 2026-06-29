# kb-enrich

Knowledge enrichment workflow — observe, review, integrate.

## When to Use

During discussion, when new information relates to an existing KB topic:

1. **Detection:** User mentions something that matches a KB page (use `kb_recall_context` to check)
2. **Observation:** Capture the new info with `kb_observe`
3. **Review:** Ask user if they want to update the existing page
4. **Integrate:** If approved, merge observation into canonical page

## Workflow

### Step 1: Detect Enrichment Opportunity

When discussing a topic that might be in the KB:

```javascript
// Check if topic exists in KB
const results = await kb_recall_context({ query: "auth strategy" });

if (results.length > 0) {
  // Topic exists — potential enrichment
  console.log("Found existing page:", results[0].title);
}
```

### Step 2: Capture Observation

```javascript
await kb_observe({
  title: "Auth Strategy Update",
  content: "New insight about JWT refresh tokens...",
  relevance: "high",
  tags: ["auth", "jwt"],
  sourceContext: "Discussed during API design review"
});
```

### Step 3: Ask User for Approval

```javascript
await ask_user_question({
  questions: [{
    question: "Update existing page 'Auth Strategy' with this new info?",
    header: "Enrichment",
    options: [
      { label: "Yes, update page", description: "Merge observation into canonical page" },
      { label: "Save as observation", description: "Keep as separate observation for now" },
      { label: "Discard", description: "This info isn't relevant" }
    ]
  }]
});
```

### Step 4: Integrate (if approved)

If user chooses "Yes, update page":

1. Read the existing page content
2. Merge observation content into appropriate section
3. Update frontmatter (`updated` date, `sources` array)
4. Write back with `kb_ensure_page`

## Relevance Levels

| Level | When to Use |
|-------|-------------|
| `low` | Nice-to-know, minor detail |
| `medium` | Useful context, moderate importance |
| `high` | Significant insight, affects decisions |
| `critical` | Breaking change, security issue, must-know |

## Best Practices

- **Don't over-observe:** Only capture info that adds value to existing KB topics
- **Tag consistently:** Use the same tags as the existing page
- **Provide context:** Always include `sourceContext` explaining when/why this was observed
- **Preserve originals:** Don't delete observations after integration — they serve as audit trail
