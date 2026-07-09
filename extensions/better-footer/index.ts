/**
 * Better Footer - one-line status bar for pi's TUI.
 *
 * Config lives in the standard pi settings file under the `betterFooter` key
 * (alongside `kb`, `theme`, etc.). Each widget's color, bold, and on/off are
 * all configurable there; widgets can also be reordered via `order`.
 *
 * Config: ~/.pi/agent/settings.json -> { "betterFooter": { ... } }
 * Toggle: /footer
 */

import { existsSync, readFileSync, unlinkSync, watch, writeFileSync } from 'node:fs';
import { uptime as osUptime } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
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
  color?: string; // theme slot name, e.g. 'accent' / 'warning' / 'success'
  bold?: boolean; // apply bold to this widget's segments
  warnBelow?: number;
  warnAbove?: number;
  errorAbove?: number;
}

interface FooterConfig {
  enabled: boolean;
  promptSymbol: string;
  // ponytail: optional widget order — by widget.id. Missing ids kept
  // at the end in default order. Example: ["prompt", "thinking.level", ...].
  order?: string[];
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
  const init = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0,
    cacheHitRate: undefined as number | undefined,
  };
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
  // ponytail: undefined order = use WIDGETS declaration order. Set to a
  // list of widget ids to reorder; missing ids keep default order.
  order: undefined,
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

const SETTINGS_FILENAME = 'settings.json';
const SETTINGS_KEY = 'betterFooter';
const CONFIG_DIR = getAgentDir();
// ponytail: legacy standalone config file — migrated into settings.json on first load.
const LEGACY_CONFIG_FILENAME = 'better-footer.json';

const settingsPath = (): string => join(CONFIG_DIR, SETTINGS_FILENAME);
const legacyConfigPath = (): string => join(CONFIG_DIR, LEGACY_CONFIG_FILENAME);

// ────────────────────────────────────────────────────────────────────────────
// Config I/O — reads/writes the `betterFooter` key inside settings.json,
// preserving all other settings keys. One config file, not two.
// ────────────────────────────────────────────────────────────────────────────

function mergeFooterConfig(parsed: Partial<FooterConfig> | undefined): FooterConfig {
  if (!parsed) return DEFAULT_CONFIG;
  return {
    enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
    promptSymbol: parsed.promptSymbol ?? DEFAULT_CONFIG.promptSymbol,
    order: parsed.order ?? DEFAULT_CONFIG.order,
    metrics: { ...DEFAULT_CONFIG.metrics, ...(parsed.metrics ?? {}) },
  };
}

function readSettings(): Record<string, unknown> {
  const path = settingsPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
  } catch (err) {
    console.error(`[better-footer] failed to parse ${path}: ${err}; using defaults`);
    return {};
  }
}

function writeSettings(settings: Record<string, unknown>): void {
  const path = settingsPath();
  try {
    writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`);
  } catch (err) {
    console.error(`[better-footer] failed to write ${path}: ${err}`);
  }
}

function readConfig(): FooterConfig {
  // ponytail: one-time migration — fold the old standalone config file into settings.json.
  const legacy = legacyConfigPath();
  if (existsSync(legacy)) {
    try {
      const legacyParsed = JSON.parse(readFileSync(legacy, 'utf-8')) as Partial<FooterConfig>;
      const settings = readSettings();
      if (settings[SETTINGS_KEY] === undefined) {
        settings[SETTINGS_KEY] = mergeFooterConfig(legacyParsed);
        writeSettings(settings);
        console.error(`[better-footer] migrated ${LEGACY_CONFIG_FILENAME} into settings.json`);
      }
      // Best-effort cleanup of the old file. Keep going if unlink fails.
      try {
        unlinkSync(legacy);
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.error(`[better-footer] failed to migrate ${legacy}: ${err}`);
    }
  }

  const settings = readSettings();
  const section = settings[SETTINGS_KEY] as Partial<FooterConfig> | undefined;
  const cfg = mergeFooterConfig(section);
  if (section === undefined) writeConfig(cfg); // seed defaults on first run
  return cfg;
}

function writeConfig(cfg: FooterConfig): void {
  const settings = readSettings();
  settings[SETTINGS_KEY] = cfg;
  writeSettings(settings);
}
// ────────────────────────────────────────────────────────────────────────────
// Widgets — one class per footer segment, owns its color + rendering.
// Each widget returns { text, color } segments; the renderer applies
// theme.fg() and handles space-between distribution.
// Add a new footer piece = new class + entry in WIDGETS below.
// ────────────────────────────────────────────────────────────────────────────

type ColoredSegment = { text: string; color: string };

abstract class Widget {
  abstract readonly id: string;
  abstract render(data: RenderData, cfg: FooterConfig): ColoredSegment[];
  // ponytail: user can override this widget's color via
  // config.metrics[this.id]?.color — falls back to widget default.
  color(cfg: FooterConfig, fallback: string): string {
    return cfg.metrics[this.id]?.color ?? fallback;
  }
  bold(cfg: FooterConfig): boolean {
    return cfg.metrics[this.id]?.bold ?? false;
  }
}

class PromptWidget extends Widget {
  readonly id = 'prompt';
  render(_data: RenderData, cfg: FooterConfig): ColoredSegment[] {
    if (!cfg.promptSymbol) return [];
    return [{ text: `${cfg.promptSymbol} `, color: this.color(cfg, 'accent') }];
  }
}

class CwdWidget extends Widget {
  readonly id = 'cwd';
  render(data: RenderData, cfg: FooterConfig): ColoredSegment[] {
    if (cfg.metrics.cwd?.enabled === false) return [];
    return [{ text: `${ICON_FOLDER} ${data.cwd}`, color: this.color(cfg, 'warning') }];
  }
}

class GitBranchWidget extends Widget {
  readonly id = 'git.branch';
  render(data: RenderData, cfg: FooterConfig): ColoredSegment[] {
    if (!data.branch || cfg.metrics['git.branch']?.enabled === false) return [];
    return [{ text: `${ICON_GIT} ${data.branch}`, color: this.color(cfg, 'accent') }];
  }
}

const THINKING_COLOR_NAMES: Record<string, string> = {
  off: 'thinkingOff',
  minimal: 'thinkingMinimal',
  low: 'thinkingLow',
  medium: 'thinkingMedium',
  high: 'thinkingHigh',
  xhigh: 'thinkingXhigh',
};

class ThinkingWidget extends Widget {
  readonly id = 'thinking.level';
  render(data: RenderData, cfg: FooterConfig): ColoredSegment[] {
    const level = data.thinkingLevel;
    return [
      {
        text: `${THINKING_ICON}${THINKING_BARS[level] ?? ''} ${level}`,
        color: cfg.metrics['thinking.level']?.color ?? THINKING_COLOR_NAMES[level] ?? 'thinkingOff',
      },
    ];
  }
}

class TokensInputWidget extends Widget {
  readonly id = 'tokens.input';
  render(data: RenderData, cfg: FooterConfig): ColoredSegment[] {
    if (!data.tokens.input || cfg.metrics['tokens.input']?.enabled === false) return [];
    return [{ text: `${ICON_INPUT} ${fmt(data.tokens.input)}`, color: this.color(cfg, 'error') }];
  }
}

class TokensOutputWidget extends Widget {
  readonly id = 'tokens.output';
  render(data: RenderData, cfg: FooterConfig): ColoredSegment[] {
    if (!data.tokens.output || cfg.metrics['tokens.output']?.enabled === false) return [];
    return [
      { text: `${ICON_OUTPUT} ${fmt(data.tokens.output)}`, color: this.color(cfg, 'success') },
    ];
  }
}

class CacheWidget extends Widget {
  readonly id = 'cache';
  render(data: RenderData, cfg: FooterConfig): ColoredSegment[] {
    if (cfg.metrics.cache?.enabled === false || !data.tokens.cacheRead) return [];
    const segs: ColoredSegment[] = [
      {
        text: `${ICON_CACHE} ${fmt(data.tokens.cacheRead)}`,
        color: this.color(cfg, 'error'),
      },
    ];
    if (data.tokens.cacheHitRate !== undefined) {
      const threshold = cfg.metrics['cache.hitRate']?.warnBelow ?? 50;
      const isHit = data.tokens.cacheHitRate >= threshold;
      const hrIcon = isHit ? ICON_ACCEPT : ICON_CACHE_MISS;
      segs.push({
        text: ` ${hrIcon} ${data.tokens.cacheHitRate.toFixed(0)}%`,
        color: cfg.metrics['cache.hitRate']?.color ?? (isHit ? 'success' : 'warning'),
      });
    }
    return segs;
  }
}

class CostWidget extends Widget {
  readonly id = 'cost';
  render(data: RenderData, cfg: FooterConfig): ColoredSegment[] {
    if (!data.tokens.cost || cfg.metrics.cost?.enabled === false) return [];
    return [
      { text: `${ICON_COST}${data.tokens.cost.toFixed(3)}`, color: this.color(cfg, 'warning') },
    ];
  }
}

class CtxBarWidget extends Widget {
  readonly id = 'ctx.bar';
  render(data: RenderData, cfg: FooterConfig): ColoredSegment[] {
    if (cfg.metrics['ctx.bar']?.enabled === false) return [];
    const warnAbove = cfg.metrics['ctx.bar']?.warnAbove ?? 70;
    const errorAbove = cfg.metrics['ctx.bar']?.errorAbove ?? 90;
    const color =
      data.ctxPct > errorAbove ? 'error' : data.ctxPct > warnAbove ? 'warning' : 'success';
    const pctStr = data.ctxUnknown ? '?%' : `${data.ctxPct.toFixed(0)}%`;
    return [
      { text: progressBar(data.ctxPct), color },
      { text: ` ${pctStr}/${fmt(data.ctxWindow)}`, color },
    ];
  }
}

class SessionWidget extends Widget {
  readonly id = 'session';
  // ponytail: session parts (duration/turns/uptime) are independently
  // togglable + colorable via session.duration, session.turns, tool.uptime.
  render(data: RenderData, cfg: FooterConfig): ColoredSegment[] {
    if (cfg.metrics.session?.enabled === false) return [];
    const segs: ColoredSegment[] = [];
    if (data.sessionDuration > 0 && cfg.metrics['session.duration']?.enabled !== false) {
      const d = data.sessionDuration;
      const fmtDur =
        d >= 3600
          ? `${Math.floor(d / 3600)}h${Math.floor((d % 3600) / 60)}m`
          : d >= 60
            ? `${Math.floor(d / 60)}m`
            : `${d}s`;
      segs.push({
        text: `${ICON_SESSION_DUR} ${fmtDur}`,
        color: cfg.metrics['session.duration']?.color ?? 'accent',
      });
    }
    if (data.sessionTurnCount > 0 && cfg.metrics['session.turns']?.enabled !== false) {
      segs.push({
        text: `${ICON_SESSION_TURNS} ${data.sessionTurnCount}`,
        color: cfg.metrics['session.turns']?.color ?? 'success',
      });
    }
    if (cfg.metrics['tool.uptime']?.enabled !== false) {
      segs.push({
        text: `${ICON_SESSION_UPTIME} ${(data.toolUptime / 3600).toFixed(1)}h`,
        color: cfg.metrics['tool.uptime']?.color ?? 'text',
      });
    }
    return segs;
  }
}

class ModelWidget extends Widget {
  readonly id = 'model';
  render(data: RenderData, cfg: FooterConfig): ColoredSegment[] {
    if (!data.model || cfg.metrics['model.id']?.enabled === false) return [];
    // ponytail: icon + name share one color so they live as a single
    // gap-less segment (space-between would split otherwise). accent
    // (mauve) keeps the name's prior color and makes the chip pop.
    const segs: ColoredSegment[] = [
      { text: `${ICON_MODEL} ${data.model.id}`, color: this.color(cfg, 'accent') },
    ];
    if (data.model.provider && cfg.metrics['model.provider']?.enabled !== false) {
      segs.push({ text: ` (${data.model.provider})`, color: this.color(cfg, 'mdListBullet') });
    }
    return segs;
  }
}

const WIDGETS: Widget[] = [
  new PromptWidget(),
  new CwdWidget(),
  new GitBranchWidget(),
  new ThinkingWidget(),
  new TokensInputWidget(),
  new TokensOutputWidget(),
  new CacheWidget(),
  new CostWidget(),
  new CtxBarWidget(),
  new SessionWidget(),
  new ModelWidget(),
];

// ponytail: reorder widgets per cfg.order, missing ids kept in default order.
// Callers that want the original WIDGETS array can still use it directly.
function orderedWidgets(cfg: FooterConfig): Widget[] {
  if (!cfg.order) return WIDGETS;
  const byId = new Map(WIDGETS.map((w) => [w.id, w]));
  const out: Widget[] = [];
  const seen = new Set<string>();
  for (const id of cfg.order) {
    const w = byId.get(id);
    if (w && !seen.has(id)) {
      out.push(w);
      seen.add(id);
    }
  }
  for (const w of WIDGETS) {
    if (!seen.has(w.id)) out.push(w);
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Renderer — space-between distribution across widget-produced segments
// ────────────────────────────────────────────────────────────────────────────

function renderSingleLine(
  config: FooterConfig,
  data: RenderData,
  theme: any,
  width: number
): string {
  // ponytail: no background fill — plain text footer.
  const bgAnsi = '';

  // Horizontal padding so icons don't touch the screen edge
  const PADDING_X = 1;

  // Build colored segments by composing each widget
  const widgets = orderedWidgets(config);
  const segments: string[] = [];
  for (const w of widgets) {
    const isBold = w.bold(config);
    for (const seg of w.render(data, config)) {
      let text = theme.fg(seg.color, seg.text);
      if (isBold) text = `\x1b[1m${text}\x1b[22m`;
      segments.push(text);
    }
  }

  // Space-between distribution: spread segments across available width
  const n = segments.length;
  if (n === 0) return `${bgAnsi}${' '.repeat(width)}\x1b[0m`;
  if (n === 1) {
    const segW = visibleWidth(segments[0]);
    const pad = Math.max(0, width - segW);
    return `${bgAnsi}${segments[0]}${' '.repeat(pad)}\x1b[0m`;
  }
  let contentW = 0;
  for (const s of segments) contentW += visibleWidth(s);
  const innerWidth = Math.max(1, width - 2 * PADDING_X);
  const remaining = innerWidth - contentW;
  const totalGaps = n - 1;
  const baseGap = Math.max(0, Math.floor(remaining / totalGaps));
  const extraGap = remaining - baseGap * totalGaps;
  const leftPad = ' '.repeat(PADDING_X);
  let result = leftPad + segments[0];
  for (let i = 1; i < n; i++) {
    const gap = baseGap + (i <= extraGap ? 1 : 0);
    result += ' '.repeat(gap) + segments[i];
  }
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
  setRequestRender: (fn: () => void) => void
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
  const configFile = settingsPath();
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
    }
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

export type { ColoredSegment };
// ponytail: test-only exports — used by test/render.test.ts to verify
// per-widget behavior without going through the full extension+config flow.
// Strip these from production builds if they bloat bundle size.
export { orderedWidgets, renderSingleLine, WIDGETS };
