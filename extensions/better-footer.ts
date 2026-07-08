/**
 * Better Footer - themed, semantically colored footer for pi's TUI.
 *
 * Starship-inspired: each piece of info is a "module" with a Nerd Font icon
 * and a semantic fg color from the active theme. Layout + per-metric display
 * options are driven by a JSON config file that is hot-reloaded on change.
 *
 * Config: ~/.pi/agent/better-footer.json (auto-created with defaults on first run)
 *
 * Toggle: /footer
 */

import { existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { AssistantMessage, Model } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';

// ────────────────────────────────────────────────────────────────────────────
// Nerd Font codepoints (verified against MesloLGS NF Mono + JetBrainsMono NF)
// ────────────────────────────────────────────────────────────────────────────
const ICON_GIT = '\ue0a0'; // nf-md-git
const ICON_PROMPT = '\u25c9'; // ● filled circle (unicode, no font dep)
const ICON_MODEL = '\uf544'; // fa-microchip
const ICON_THINK = '\u26a1'; // ⚡ lightning (unicode)
const ICON_COST = '\uf155'; // fa-dollar-sign

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type ThemeColor = import('@earendil-works/pi-coding-agent').ThemeColor;

interface MetricConfig {
  enabled?: boolean;
  color?: ThemeColor;
  bold?: boolean;
  warnBelow?: number;
  warnAbove?: number;
  errorAbove?: number;
}

interface FooterConfig {
  enabled: boolean;
  separator: string;
  promptSymbol: string;
  lines: string[][];
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
  usingOAuth: boolean;
  thinkingLevel: string;
  ctxPct: number;
  ctxWindow: number;
  ctxUnknown: boolean;
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
  if (r === '' || r === '.') return '~';
  if (r.startsWith(`..${sep}`) || r === '..' || isAbsolute(r)) return cwd;
  return r === '' ? '~' : `~${sep}${r}`;
};

const computeTokens = (sm: { getBranch(): any[] }) => {
  let input = 0,
    output = 0,
    cacheRead = 0,
    cacheWrite = 0,
    cost = 0;
  let latestHitRate: number | undefined;
  for (const e of sm.getBranch()) {
    if (e.type === 'message' && e.message?.role === 'assistant') {
      const m = e.message as AssistantMessage;
      input += m.usage.input;
      output += m.usage.output;
      cacheRead += m.usage.cacheRead;
      cacheWrite += m.usage.cacheWrite;
      cost += m.usage.cost.total;
      const prompt = m.usage.input + m.usage.cacheRead + m.usage.cacheWrite;
      if (prompt > 0) latestHitRate = (m.usage.cacheRead / prompt) * 100;
    }
  }
  return { input, output, cacheRead, cacheWrite, cost, cacheHitRate: latestHitRate };
};

const progressBar = (pct: number, width = 10): string => {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
};

const thinkingColorToken = (level: string): ThemeColor => {
  switch (level) {
    case 'xhigh':
      return 'thinkingXhigh';
    case 'high':
      return 'thinkingHigh';
    case 'medium':
      return 'thinkingMedium';
    case 'low':
      return 'thinkingLow';
    case 'minimal':
      return 'thinkingMinimal';
    default:
      return 'thinkingOff';
  }
};

const clip = (line: string, width: number): string => truncateToWidth(line, width, '');

// ────────────────────────────────────────────────────────────────────────────
// Default config
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: FooterConfig = {
  enabled: true,
  separator: '  ',
  promptSymbol: ICON_PROMPT,
  lines: [
    ['cwd', 'git.branch', 'session.name', '|', 'thinking.level'],
    [
      'tokens.input',
      'tokens.output',
      'cache.read',
      'cache.hitRate',
      'cost',
      'ctx.bar',
      '|',
      'model.id',
      'model.provider',
    ],
  ],
  metrics: {
    cwd: { color: 'muted' },
    'git.branch': { color: 'accent', bold: true },
    'session.name': { color: 'mdLink' },
    'tokens.input': { color: 'muted' },
    'tokens.output': { color: 'muted' },
    'cache.read': { color: 'muted' },
    'cache.write': { color: 'muted', enabled: false },
    'cache.hitRate': { color: 'success', warnBelow: 50 },
    cost: { color: 'muted', warnAbove: 1.0 },
    'ctx.bar': { warnAbove: 70, errorAbove: 90 },
    'model.id': { color: 'accent' },
    'model.provider': { color: 'dim' },
    'thinking.level': { bold: true },
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
      separator: parsed.separator ?? DEFAULT_CONFIG.separator,
      promptSymbol: parsed.promptSymbol ?? DEFAULT_CONFIG.promptSymbol,
      lines: parsed.lines ?? DEFAULT_CONFIG.lines,
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

// ────────────────────────────────────────────────────────────────────────────
// Metric registry — closed set of built-in metric IDs
// ────────────────────────────────────────────────────────────────────────────

type MetricRender = (data: RenderData, mc: MetricConfig, theme: any) => string | null;

const METRICS: Record<string, MetricRender> = {
  cwd: (d, mc, t) => t.fg(mc.color ?? 'muted', d.cwd),
  'git.branch': (d, mc, t) => {
    if (!d.branch) return null;
    const text = t.fg(mc.color ?? 'accent', `${ICON_GIT} ${d.branch}`);
    return mc.bold ? t.bold(text) : text;
  },
  'session.name': (d, mc, t) => (d.sessionName ? t.fg(mc.color ?? 'mdLink', d.sessionName) : null),
  'tokens.input': (d, mc, t) =>
    d.tokens.input ? t.fg(mc.color ?? 'muted', `\u2191${fmt(d.tokens.input)}`) : null,
  'tokens.output': (d, mc, t) =>
    d.tokens.output ? t.fg(mc.color ?? 'muted', `\u2193${fmt(d.tokens.output)}`) : null,
  'cache.read': (d, mc, t) =>
    d.tokens.cacheRead ? t.fg(mc.color ?? 'muted', `R${fmt(d.tokens.cacheRead)}`) : null,
  'cache.write': (d, mc, t) =>
    d.tokens.cacheWrite ? t.fg(mc.color ?? 'muted', `W${fmt(d.tokens.cacheWrite)}`) : null,
  'cache.hitRate': (d, mc, t) => {
    if (!d.tokens.cacheRead && !d.tokens.cacheWrite) return null;
    if (d.tokens.cacheHitRate === undefined) return null;
    const hr = d.tokens.cacheHitRate.toFixed(0);
    const threshold = mc.warnBelow ?? 50;
    const color = d.tokens.cacheHitRate >= threshold ? (mc.color ?? 'success') : 'warning';
    return t.fg(color, `CH${hr}%`);
  },
  cost: (d, mc, t) => {
    if (!d.tokens.cost && !d.usingOAuth) return null;
    const costStr = `${ICON_COST}${d.tokens.cost.toFixed(3)}${d.usingOAuth ? ' sub' : ''}`;
    const color = d.tokens.cost > (mc.warnAbove ?? Infinity) ? 'warning' : (mc.color ?? 'muted');
    return t.fg(color, costStr);
  },
  'ctx.bar': (d, mc, t) => {
    const bar = d.ctxUnknown
      ? t.fg('dim', progressBar(0))
      : colorCtx(t, d.ctxPct, progressBar(d.ctxPct), mc);
    const pctStr = d.ctxUnknown ? '?%' : `${d.ctxPct.toFixed(0)}%`;
    const label = `${bar} ${pctStr}/${fmt(d.ctxWindow)}`;
    return d.ctxUnknown ? t.fg('muted', label) : colorCtx(t, d.ctxPct, label, mc);
  },
  'model.id': (d, mc, t) => {
    if (!d.model) return null;
    const icon = t.fg('dim', ICON_MODEL);
    const name = t.fg(mc.color ?? 'accent', d.model.id);
    return `${icon} ${name}`;
  },
  'model.provider': (d, mc, t) =>
    d.model?.provider ? t.fg(mc.color ?? 'dim', `(${d.model.provider})`) : null,
  'thinking.level': (d, mc, t) => {
    const color = thinkingColorToken(d.thinkingLevel);
    const text = `${ICON_THINK} ${d.thinkingLevel}`;
    const styled = t.fg(color, text);
    return mc.bold ? t.bold(styled) : styled;
  },
};

function colorCtx(theme: any, pct: number, text: string, mc: MetricConfig): string {
  if (pct > (mc.errorAbove ?? 90)) return theme.fg('error', text);
  if (pct > (mc.warnAbove ?? 70)) return theme.fg('warning', text);
  return theme.fg(mc.color ?? 'success', text);
}

// ────────────────────────────────────────────────────────────────────────────
// Render
// ────────────────────────────────────────────────────────────────────────────

function renderLine(
  line: string[],
  config: FooterConfig,
  data: RenderData,
  theme: any,
  width: number
): string {
  const sep = theme.fg('dim', config.separator);
  const splitIdx = line.indexOf('|');
  const leftIds = splitIdx === -1 ? line : line.slice(0, splitIdx);
  const rightIds = splitIdx === -1 ? [] : line.slice(splitIdx + 1);

  const knownIds = new Set(Object.keys(METRICS));
  const renderIds = (ids: string[]): string[] =>
    ids
      .map((id) => {
        if (id === '|') return null;
        if (!knownIds.has(id)) return null;
        const mc = config.metrics[id] ?? {};
        if (mc.enabled === false) return null;
        const mod = METRICS[id](data, mc, theme);
        return mod ?? null;
      })
      .filter((s): s is string => s !== null);

  const leftModules = renderIds(leftIds).join(sep);
  const rightModules = renderIds(rightIds).join(sep);

  const leftW = visibleWidth(leftModules);
  const rightW = visibleWidth(rightModules);
  if (!rightModules) return clip(leftModules, width);
  if (leftW + 2 + rightW <= width) {
    return clip(leftModules + ' '.repeat(width - leftW - rightW) + rightModules, width);
  }
  const avail = width - leftW - 2;
  if (avail > 4) {
    const trunc = truncateToWidth(rightModules, avail, '');
    return clip(
      leftModules + ' '.repeat(Math.max(0, width - leftW - visibleWidth(trunc))) + trunc,
      width
    );
  }
  return clip(leftModules, width);
}

// ────────────────────────────────────────────────────────────────────────────
// Extension
// ────────────────────────────────────────────────────────────────────────────

// Factory for setFooter - reused by both session_start auto-install and /footer toggle.
// Outer state (config, thinkingLevel) is captured via closure.
function makeFooterFactory(getConfig: () => FooterConfig, getThinkingLevel: () => string) {
  return (ctx: any) => {
    ctx.ui.setFooter((tui: any, theme: any, footerData: any) => {
      const unsubBranch = footerData.onBranchChange(() => tui.requestRender());
      return {
        dispose: () => unsubBranch(),
        invalidate() {},
        render(width: number): string[] {
          const cfg = getConfig();
          if (!cfg.enabled) return [];
          const data: RenderData = {
            cwd: fmtCwd(ctx.sessionManager.getCwd(), process.env.HOME || process.env.USERPROFILE),
            branch: footerData.getGitBranch(),
            sessionName: ctx.sessionManager.getSessionName(),
            tokens: computeTokens(ctx.sessionManager),
            model: ctx.model,
            provider: ctx.model?.provider ?? null,
            usingOAuth: ctx.model ? ctx.modelRegistry.isUsingOAuth(ctx.model) : false,
            thinkingLevel: getThinkingLevel(),
            ...(() => {
              const u = ctx.getContextUsage();
              return {
                ctxPct: u?.percent ?? 0,
                ctxWindow: u?.contextWindow ?? ctx.model?.contextWindow ?? 0,
                ctxUnknown: u === undefined || u?.percent === null,
              };
            })(),
          };

          const lines = cfg.lines.map((line) => renderLine(line, cfg, data, theme, width));

          // Extension statuses (always shown if present, palette-cycled)
          const statuses = footerData.getExtensionStatuses();
          if (statuses.size > 0) {
            const sorted = Array.from(statuses.entries() as Iterable<[string, string]>).sort(
              (a, b) => a[0].localeCompare(b[0])
            );
            const palette: ThemeColor[] = [
              'muted',
              'mdLink',
              'syntaxFunction',
              'mdListBullet',
              'mdCode',
              'thinkingMinimal',
            ];
            let i = 0;
            const dimSep = theme.fg('dim', cfg.separator);
            const colored = sorted.map((entry) => {
              const tok = palette[i++ % palette.length];
              const clean = entry[1]
                .replace(/[\r\n\t]+/g, ' ')
                .replace(/ +/g, ' ')
                .trim();
              return theme.fg(tok, clean);
            });
            lines.push(clip(colored.join(dimSep), width));
          }

          if (lines[0] && cfg.promptSymbol) {
            lines[0] = `${theme.fg('accent', cfg.promptSymbol)} ${lines[0]}`;
          }

          return lines;
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
    thinkingLevel: 'off',
  };

  pi.on('thinking_level_select', (event) => {
    state.thinkingLevel = event.level;
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
    () => state.thinkingLevel
  );

  // Auto-install on session start if config says enabled.
  pi.on('session_start', async (_event, ctx) => {
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
