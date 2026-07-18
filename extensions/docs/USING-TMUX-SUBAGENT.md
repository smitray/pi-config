# Using tmux as a Subagent Pane

Spawn a disposable subagent in a tmux pane for background tasks.

## One-shot (auto-close)

```bash
tmux split-window -h "cd ~/.pi/agent && pi -p 'your prompt here'"
```

| Flag | Effect |
|------|--------|
| `-h` | Horizontal split (left/right) |
| `-v` | Vertical split (top/bottom) |
| `-p 30` | Pane size: 30% of window width |

The pane closes automatically when `pi -p` finishes.

## Keep pane alive (read output after)

```bash
tmux split-window -h "cd ~/.pi/agent && pi -p 'your prompt here'; exec bash"
```

`exec bash` drops to a shell after pi exits so you can scroll through output.

## Caveats

- Only works with **`pi -p`** (non-interactive/print mode). Interactive pi won't work — it expects stdin/TTY.
- The subagent has **no access to your current session's state** — it's a fresh pi session.
- Pane inherits the tmux environment, so `cd ~/.pi/agent` is needed to pick up `.pi/` config.
- `pi -p` is a one-shot: the subagent gets the prompt and runs until done or tool-limit.

## Cleanup

- Auto-close (no `exec bash`): pane disappears on completion.
- Manual: `Ctrl+b x` kill pane, or `tmux kill-pane -t %<number>`.

## Reference

- `pi --help` → `--print, -p` for non-interactive mode
- `tmux split-window --help` for sizing/placement options
