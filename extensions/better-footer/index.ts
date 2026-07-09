/**
 * Better Footer - one-line status bar for pi's TUI.
 *
 * Hardcoded layout + hardcoded Catppuccin accents. Per-segment colors are NOT
 * configurable yet; only `enabled`, `promptSymbol`, and metric-level `enabled`
 * / `warn*` / `errorAbove` thresholds are honored.
 *
 * Config: ~/.pi/agent/better-footer.json (auto-created with defaults on first run)
 *
 * Toggle: /footer
 */

import { existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { uptime as osUptime } from 'node:os';
import type { AssistantMessage, Model } from '@earendil-works/pi-ai';
import type { ExtensionAPI, ThinkingLevelSelectEvent } from '@earendil-works/pi-coding-agent';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import { visibleWidth } from '@earendil-works/pi-tui';

// ────────────────────────────────────────────────────────────────────────────
// Nerd Font codepoints (verified against MesloLGS NF Mono + JetBrainsMono NF)
// ────────────────────────────────────────────────────────────────────────────
const ICON_GIT = '\ue0a0'; // nf-md-git
const ICON_PROMPT = '\u25c9'; // ● filled circle (unicode, no font dep)
const ICON_MODEL = '\uf544'; // fa-microchip
const ICON_COST = '\uf155'; // fa-dollar-sign
const ICON_CACHE_MISS = '\uf00d'; // fa-times
const ICON_CACHE = '\uf49b'; // combined cache icon
const ICON_ACCEPT = '\uf42e'; // accept/check
const ICON_FOLDER = '\uf07c'; // fa-folder
const ICON_INPUT = '\uf102'; // fa-angle-double-up
const ICON_OUTPUT = '\uf103'; // fa-angle-double-down
const ICON_SESSION_DUR = '\uf0995'; // minutes
const ICON_SESSION_TURNS = '\uf0997'; // turns
const ICON_SESSION_UPTIME = '\uf43a'; // total hours

const THINKING_ICON = '\u26a1'; // ⚡ fa-bolt

const THINKING_BARS: Record<string, string> = {
  off: '',
  minimal: '\u2581', // ▁
  low: '\u2582', // ▂
  medium: '\u2584', // ▄
  high: '\u2586', // ▆
  xhigh: '\u2588', // █
};

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface MetricConfig {
  enabled?: boolean;
  warnBelow?: number;
  warnAbove?: number;
  errorAbove?: number;
}

interface FooterConfig {
  enabled: boolean;
  promptSymbol: string;
  metrics: Record<string, MetricConfig>;
}

interface RenderData {
  cwd: string;
  branch: string | null;
  sessionName: string | undefined;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    cost: number;
    cacheHitRate?: number;
  };
  model: Model<any> | undefined;
  provider: string | null;
  thinkingLevel: string;
  ctxPct: number;
  ctxWindow: number;
  ctxUnknown: boolean;
  sessionDuration: number; // seconds since session start
  sessionTurnCount: number;
  toolUptime: number; // seconds since system boot
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const fmt = (n: number): string => {
  if (n < 1000) return `${n}`;
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  if (n < 10_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${Math.round(n / 1_000_000)}M`;
};

const fmtCwd = (cwd: string, home?: string): string => {
  if (!home) return cwd;
  const r = relative(resolve(home), resolve(cwd));
  if (r === '.' || r === '') return '~';
  if (r.startsWith(`..${sep}`) || r === '..' || isAbsolute(r)) return cwd;
  return `~${sep}${r}`;
};

const computeTokens = (sm: { getBranch(): any[] }) => {
  const init = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, cacheHitRate: undefined as number | undefined };
  return sm.getBranch().reduce((acc, e) => {
    if (e.type !== 'message' || e.message?.role !== 'assistant') return acc;
    const m = e.message as AssistantMessage;
    const prompt = m.usage.input + m.usage.cacheRead + m.usage.cacheWrite;
    return {
      input: acc.input + m.usage.input,
      output: acc.output + m.usage.output,
      cacheRead: acc.cacheRead + m.usage.cacheRead,
      cacheWrite: acc.cacheWrite + m.usage.cacheWrite,
      cost: acc.cost + m.usage.cost.total,
      cacheHitRate: prompt > 0 ? (m.usage.cacheRead / prompt) * 100 : acc.cacheHitRate,
    };
  }, init);
};

const progressBar = (pct: number, width = 10): string => {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
};

// ────────────────────────────────────────────────────────────────────────────
// Default config
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: FooterConfig = {
  enabled: true,
  promptSymbol: ICON_PROMPT,
  metrics: {
    cwd: {},
    'git.branch': {},
    'session.name': {},
    'tokens.input': {},
    'tokens.output': {},
    cache: {},
    'cache.read': {},
    'cache.write': { enabled: false },
    'cache.hitRate': { warnBelow: 50 },
    cost: {},
    'ctx.bar': { warnAbove: 70, errorAbove: 90 },
    'model.id': {},
    'model.provider': {},
    'thinking.level': {},
    session: { enabled: true },
    'session.duration': { enabled: true },
    'session.turns': { enabled: true },
    'tool.uptime': { enabled: true },
  },
};

const CONFIG_FILENAME = 'better-footer.json';
const CONFIG_DIR = getAgentDir();

const configPath = (): string => join(CONFIG_DIR, CONFIG_FILENAME);

// ────────────────────────────────────────────────────────────────────────────
// Config I/O
// ────────────────────────────────────────────────────────────────────────────

function readConfig(): FooterConfig {
  const path = configPath();
  if (!existsSync(path)) {
    writeConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<FooterConfig>;
    // Shallow merge with defaults so new fields don't break old configs
    return {
      enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
      promptSymbol: parsed.promptSymbol ?? DEFAULT_CONFIG.promptSymbol,
      metrics: { ...DEFAULT_CONFIG.metrics, ...(parsed.metrics ?? {}) },
    };
  } catch (err) {
    console.error(`[better-footer] failed to parse ${path}: ${err}; using defaults`);
    return DEFAULT_CONFIG;
  }
}

function writeConfig(cfg: FooterConfig): void {
  const path = configPath();
  const json = `${JSON.stringify(cfg, null, 2)}\n`;
  try {
    writeFileSync(path, json);
  } catch (err) {
    console.error(`[better-footer] failed to write ${path}: ${err}`);
  }
}
// Single-line renderer with background box + flexbox-style space-between
function renderSingleLine(
  config: FooterConfig,
  data: RenderData,
  theme: any,
  width: number
): string {
  // ponytail: no background fill — plain text footer.
  const bgAnsi = '';

  const mc = (id: string) => config.metrics[id] ?? {};

  // Horizontal padding so icons don't touch the screen edge
  const PADDING_X = 1;

  // Build segments (without pipe separators — we add gaps at the end)
  const segments: string[] = [];

  // Prompt symbol
  if (config.promptSymbol) {
    segments.push(theme.fg('accent', `${config.promptSymbol} `));
  }

  // CWD
  if (mc('cwd').enabled !== false) {
    segments.push(theme.fg('warning', `${ICON_FOLDER} ${data.cwd}`));
  }

  // Git branch
  if (data.branch && mc('git.branch').enabled !== false) {
    segments.push(theme.fg('accent', `${ICON_GIT} ${data.branch}`));
  }

  // Thinking level — same ⚡ icon, color from theme's thinking* slot
  segments.push(
    theme.getThinkingBorderColor(data.thinkingLevel)(
      `${THINKING_ICON}${THINKING_BARS[data.thinkingLevel] ?? ''} ${data.thinkingLevel}`
    )
  );

  // Token stats (compact)
  if (data.tokens.input && mc('tokens.input').enabled !== false) {
    segments.push(theme.fg('error', `${ICON_INPUT} ${fmt(data.tokens.input)}`));
  }
  if (data.tokens.output && mc('tokens.output').enabled !== false) {
    segments.push(theme.fg('success', `${ICON_OUTPUT} ${fmt(data.tokens.output)}`));
  }

  // Cache (combined: read tokens + hit rate)
  if (mc('cache').enabled !== false && data.tokens.cacheRead) {
    let combined = theme.fg('error', `${ICON_CACHE} ${fmt(data.tokens.cacheRead)}`);
    if (data.tokens.cacheHitRate !== undefined) {
      const isHit = data.tokens.cacheHitRate >= (mc('cache.hitRate').warnBelow ?? 50);
      const hrIcon = isHit ? ICON_ACCEPT : ICON_CACHE_MISS;
      combined += theme.fg(isHit ? 'success' : 'warning', ` ${hrIcon} ${data.tokens.cacheHitRate.toFixed(0)}%`);
    }
    segments.push(combined);
  }

  // Cost
  if (data.tokens.cost && mc('cost').enabled !== false) {
    segments.push(theme.fg('warning', `${ICON_COST}${data.tokens.cost.toFixed(3)}`));
  }

  // Context bar
  if (mc('ctx.bar').enabled !== false) {
    const barColor = data.ctxPct > (mc('ctx.bar').errorAbove ?? 90)
      ? 'error'
      : data.ctxPct > (mc('ctx.bar').warnAbove ?? 70)
        ? 'warning'
        : 'success';
    const bar = theme.fg(barColor, progressBar(data.ctxPct));
    const pctStr = data.ctxUnknown ? '?%' : `${data.ctxPct.toFixed(0)}%`;
    segments.push(bar + theme.fg('dim', ` ${pctStr}/${fmt(data.ctxWindow)}`));
  }

  // Session (combined: duration, turns, uptime)
  if (mc('session').enabled !== false) {
    const parts: string[] = [];
    // Duration
    if (data.sessionDuration > 0) {
      const d = data.sessionDuration;
      const fmtDur = d >= 3600
        ? `${Math.floor(d / 3600)}h${Math.floor((d % 3600) / 60)}m`
        : d >= 60
          ? `${Math.floor(d / 60)}m`
          : `${d}s`;
      parts.push(theme.fg('accent', `${ICON_SESSION_DUR} ${fmtDur}`));
    }
    // Turns
    if (data.sessionTurnCount > 0) {
      parts.push(theme.fg('success', `${ICON_SESSION_TURNS} ${data.sessionTurnCount}`));
    }
    // Uptime
    parts.push(theme.fg('text', `${ICON_SESSION_UPTIME} ${(data.toolUptime / 3600).toFixed(1)}h`));
    if (parts.length) segments.push(parts.join('  '));
  }

  // Model
  if (data.model && mc('model.id').enabled !== false) {
    segments.push(theme.fg('dim', ICON_MODEL) + theme.fg('accent', ` ${data.model.id}`));
  }

  // Provider
  if (data.model?.provider && mc('model.provider').enabled !== false) {
    segments.push(theme.fg('dim', ` (${data.model.provider})`));
  }

  // Space-between distribution: spread segments across available width
  const n = segments.length;
  if (n === 0) return `${bgAnsi}${' '.repeat(width)}\x1b[0m`;
  if (n === 1) {
    const segW = visibleWidth(segments[0]);
    const pad = Math.max(0, width - segW);
    return `${bgAnsi}${segments[0]}${' '.repeat(pad)}\x1b[0m`;
  }
  // Measure total content width
  let contentW = 0;
  for (const s of segments) contentW += visibleWidth(s);
  // Reserve PADDING_X on each side
  const innerWidth = Math.max(1, width - 2 * PADDING_X);
  const remaining = innerWidth - contentW;
  const totalGaps = n - 1;
  // Distribute remaining space across gaps (space-between).
  // baseGap = floor(remaining/totalGaps) — but never less than 0 (clamp when overflowing).
  const baseGap = Math.max(0, Math.floor(remaining / totalGaps));
  const extraGap = remaining - baseGap * totalGaps;
  const leftPad = ' '.repeat(PADDING_X);
  let result = leftPad + segments[0];
  for (let i = 1; i < n; i++) {
    const gap = baseGap + (i <= extraGap ? 1 : 0);
    result += ' '.repeat(gap) + segments[i];
  }
  // Pad to full width to fill the background box (right padding)
  const finalW = visibleWidth(result);
  if (finalW < width) {
    result += ' '.repeat(width - finalW);
  }
  return `${bgAnsi}${result}\x1b[0m`;
}

// ────────────────────────────────────────────────────────────────────────────
// Extension
// ────────────────────────────────────────────────────────────────────────────

// Factory for setFooter - reused by both session_start auto-install and /footer toggle.
// Outer state (config, thinkingLevel, requestRender) is captured via closure.
function makeFooterFactory(
  getConfig: () => FooterConfig,
  getThinkingLevel: () => string,
  getSessionStartTime: () => number,
  setRequestRender: (fn: () => void) => void,
) {
  return (ctx: any) => {
    ctx.ui.setFooter((tui: any, theme: any, footerData: any) => {
      // Surface tui.requestRender so /think and /model updates redraw
      // immediately rather than waiting for a branch change.
      const requestRender = () => tui.requestRender?.();
      setRequestRender(requestRender);
      const unsubBranch = footerData.onBranchChange(() => requestRender());
      return {
        dispose: () => unsubBranch(),
        invalidate() {},
        render(width: number): string[] {
          const now = Date.now();
          const cfg = getConfig();
          if (!cfg.enabled) return [];
          const startSec = (t: number) => (t ? Math.floor((now - t) / 1000) : 0);
          const ctxUse = ctx.getContextUsage();
          const data: RenderData = {
            cwd: fmtCwd(ctx.sessionManager.getCwd(), process.env.HOME || process.env.USERPROFILE),
            branch: footerData.getGitBranch(),
            sessionName: ctx.sessionManager.getSessionName(),
            tokens: computeTokens(ctx.sessionManager),
            model: ctx.model,
            provider: ctx.model?.provider ?? null,
            thinkingLevel: getThinkingLevel(),
            sessionDuration: startSec(getSessionStartTime()),
            sessionTurnCount: ctx.sessionManager.getBranch().length,
            toolUptime: osUptime(),
            ctxPct: ctxUse?.percent ?? 0,
            ctxWindow: ctxUse?.contextWindow ?? ctx.model?.contextWindow ?? 0,
            ctxUnknown: ctxUse === undefined || ctxUse?.percent === null,
          };

          // Single-line with background box
          const line = renderSingleLine(cfg, data, theme, width);
          return [line];
        },
      };
    });
  };
}

export default function (pi: ExtensionAPI) {
  // Use a ref-object so the render closure (registered once per session) sees
  // live config + thinking-level updates without re-registration.
  const state = {
    config: readConfig(),
    thinkingLevel: 'off' as string, // synced from pi on session_start (can't call getThinkingLevel during load)
    sessionStartTime: 0,
    requestRender: () => {}, // populated by the footer renderer on mount
  };

  pi.on('thinking_level_select', (event: ThinkingLevelSelectEvent) => {
    state.thinkingLevel = event.level;
    state.requestRender();
  });

  pi.on('model_select', () => {
    state.requestRender();
  });

  // Watch config file for changes; debounce 200ms
  const configFile = configPath();
  let watchTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    watch(configFile, { persistent: false }, () => {
      if (watchTimer) clearTimeout(watchTimer);
      watchTimer = setTimeout(() => {
        state.config = readConfig();
      }, 200);
    });
  } catch {
    // File doesn't exist yet or watch unsupported — ignore
  }

  const installFooter = makeFooterFactory(
    () => state.config,
    () => state.thinkingLevel,
    () => state.sessionStartTime,
    (fn) => {
      state.requestRender = fn;
    },
  );

  // Auto-install on session start if config says enabled.
  pi.on('session_start', async (_event, ctx) => {
    state.sessionStartTime = Date.now();
    // Sync thinking level from pi (handles /think command before extension loaded)
    if (typeof pi.getThinkingLevel === 'function') {
      state.thinkingLevel = pi.getThinkingLevel();
    }
    if (state.config.enabled) installFooter(ctx);
  });

  pi.registerCommand('footer', {
    description: 'Toggle better footer',
    handler: async (_args, ctx) => {
      state.config = { ...state.config, enabled: !state.config.enabled };
      writeConfig(state.config);
      if (state.config.enabled) {
        installFooter(ctx);
        ctx.ui.notify('Better footer enabled', 'info');
      } else {
        ctx.ui.setFooter(undefined);
        ctx.ui.notify('Default footer restored', 'info');
      }
    },
  });
}
