# notify

Desktop notifications via `notify-send`. Skips when user is active.

## Tool

### `notify`

Send a desktop notification.

| Param | Required | Description |
|-------|----------|-------------|
| `message` | yes | Notification text |
| `category` | no | `pi.task` (default), `pi.error`, `pi.info`, `pi.milestone` |

## Auto-notify

Fires on `agent_settled` only when:
- User hasn't typed in last 5 seconds
- Terminal window is not focused (hyprland: matches by PID or title containing `π`)

## Requirements

- `notify-send` in PATH
- `hyprctl` for focus detection (hyprland IPC — graceful fallback if missing)
