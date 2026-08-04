# Git Commit Patterns — Common Scenarios

## Pattern: small bugfix

```text
git status        # see what's changed
git diff --stat   # confirm scope
→ User says: "fix the bug"
git add <paths>   # user specifies paths
→ Compose: 🐛 fix(auth): handle expired refresh tokens
git commit -m "🐛 fix(auth): handle expired refresh tokens"
```

## Pattern: feature with body

```text
→ Compose:
   🎉 feat(api): add /v2/search endpoint

   Adds the new search endpoint backed by the indexed cache.
   Supports q, limit, and offset query params.

git commit -m "🎉 feat(api): add /v2/search endpoint" \
           -m "Adds the new search endpoint backed by the indexed cache." \
           -m "Supports q, limit, and offset query params."
```

## Pattern: breaking change

```text
→ Compose:
   ♻️ refactor(config)!: require explicit env loading

   BREAKING CHANGE: implicit .env loading removed; call loadEnv() at startup.

git commit -m "♻️ refactor(config)!: require explicit env loading" \
           -m "BREAKING CHANGE: implicit .env loading removed; call loadEnv() at startup instead."
```

## Pattern: amend a recent commit

```text
git log --oneline -1              # confirm the commit
→ User: "amend with a better message"
git commit --amend -m "🎉 feat(api): add rate limiter with exponential backoff"
```

## Pattern: no emoji (detect from history)

```bash
git log --oneline -5              # inspect recent commits for emoji usage
```

If most recent commits lack emoji → drop emoji prefix but keep the rest of the format:
```bash
git commit -m "feat(api): add rate limiter"
```

## Pattern: multiple types in one commit

When staged changes touch different semantic areas:
- Ask user if they want to split into separate commits
- If user insists on single commit, use `chore` as type (catch-all):
```
🔧 chore: update auth deps and fix login test
```

Best practice is one logical change per commit. Suggest splitting.
