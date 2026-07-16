---
name: firefox-use
description: "Firefox browser automation via Playwright. Use when the user wants to control Firefox, scrape pages, fill forms, take screenshots, or automate web tasks in their real Firefox browser."
---

# firefox-use

Playwright Firefox automation via heredoc. Runs in your real Firefox profile (separate instance, same bookmarks/passwords).

## Quick start

```bash
firefox-use <<'PY'
ensure_tab()
new_tab("https://example.com")
wait_for_load()
print(page_info())
PY
```

## Helpers

| Helper | Description |
|--------|-------------|
| `ensure_tab()` | Get or create a tab |
| `new_tab(url)` | Open URL in new tab, return page |
| `wait_for_load()` | Wait for DOM content loaded |
| `page_info()` | `{url, title, w, h}` |
| `js(code)` | Evaluate JavaScript, return result |
| `capture_screenshot(path?)` | Save PNG, return path |
| `click_at_xy(x, y)` | Click at pixel coordinates |
| `click(selector)` | Click CSS selector |
| `type_text(selector, text)` | Fill form field |
| `navigate(url)` | Navigate current tab |

## Environment

| Var | Default | Description |
|-----|---------|-------------|
| `FF_HEADLESS` | `0` | Set to `1` for headless mode |
| `FF_SLOW_MO` | `0` | Milliseconds to slow down actions |
| `FF_PROFILE_DIR` | `~/.mozilla/firefox` | Firefox profiles directory |

## Examples

### Scrape page titles
```bash
firefox-use <<'PY'
new_tab("https://news.ycombinator.com")
wait_for_load()
titles = js("Array.from(document.querySelectorAll('.titleline > a')).map(a => a.textContent)")
for t in titles:
    print(t)
PY
```

### Fill and submit a form
```bash
firefox-use <<'PY'
new_tab("https://httpbin.org/forms/post")
wait_for_load()
js("document.querySelector('input[name=custname]').value = 'Mr Q'")
js("document.querySelector('button').click()")
wait_for_load()
print(page_info())
PY
```

### Take screenshots
```bash
FF_HEADLESS=1 firefox-use <<'PY'
new_tab("https://example.com")
wait_for_load()
path = capture_screenshot()
print(path)
PY
```

## Notes

- Uses your real Firefox profile (bookmarks, passwords, cookies)
- Separate instance — doesn't interfere with your running Firefox
- For headless mode, set `FF_HEADLESS=1`
- Script at `~/.local/bin/firefox-use` (Playwright Python, venv at `/tmp/bu-test`)
