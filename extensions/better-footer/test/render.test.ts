import { describe, expect, it, vi } from 'vitest';

vi.mock('@earendil-works/pi-coding-agent', () => ({
  getAgentDir: () => '/tmp',
}));
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    watch: () => ({ close: () => {} }),
    writeFileSync: () => {},
    existsSync: () => false,
    readFileSync: () => '{}',
  };
});

import { visibleWidth } from '@earendil-works/pi-tui';
import betterFooter from '../index.ts';

// Catppuccin Mocha colors used by the footer (subset of themes/catppuccin-mocha.json)
const FG_RGB: Record<string, [number, number, number]> = {
  accent: [203, 166, 247],        // mauve
  success: [166, 227, 161],       // green
  warning: [249, 226, 175],       // yellow
  error: [243, 139, 168],         // red
  dim: [108, 112, 134],           // overlay0
  muted: [127, 132, 156],         // overlay1
  thinkingOff: [108, 112, 134],   // overlay0
  thinkingMinimal: [88, 91, 112], // overlay2
  thinkingLow: [137, 180, 250],   // blue
  thinkingMedium: [116, 199, 236], // sapphire
  thinkingHigh: [203, 166, 247],  // mauve
  thinkingXhigh: [245, 194, 231], // pink
};

function makeTheme(bgHex = '#313244') {
  const [r, g, b] = [
    parseInt(bgHex.slice(1, 3), 16),
    parseInt(bgHex.slice(3, 5), 16),
    parseInt(bgHex.slice(5, 7), 16),
  ];
  // Mirror Theme.fg(): wrap text in fg ANSI + reset-only-fg, never throw for unknown colors in tests.
  const fg = (color: string, text: string): string => {
    const rgb = FG_RGB[color];
    if (!rgb) throw new Error(`Unknown fg color: ${color}`);
    return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${text}\x1b[39m`;
  };
  const titleCase = (s: string) => s[0].toUpperCase() + s.slice(1);
  return {
    getBgAnsi: (name: string) => {
      if (name === 'userMessageBg') return `\x1b[48;2;${r};${g};${b}m`;
      throw new Error(`Unknown bg: ${name}`);
    },
    fg,
    getThinkingColor: (level: string) => (text: string) =>
      fg(`thinking${titleCase(level)}`, text),
  };
}

function makeCtx() {
  const setFooterMock = vi.fn();
  return {
    ctx: {
      sessionManager: {
        getCwd: () => '/home/debasmitr/.pi/agent',
        getSessionName: () => 'test-session',
        getCompactionCount: () => 0,
        getBranch: () => [],
      },
      model: { id: 'mimo-v2.5', provider: 'xiaomi-token-plan-sgp', contextWindow: 128000 },
      getContextUsage: () => ({ percent: 23, contextWindow: 128000 }),
      ui: {
        setFooter: setFooterMock,
        notify: vi.fn(),
      },
    },
    setFooterMock,
  };
}

function makeFooterData() {
  return {
    getGitBranch: () => 'feat/better-footer',
    onBranchChange: (_cb: any) => () => {},
  };
}

async function setupFooter(ctxObj: any, thinkingLevel: string) {
  const handlers: Record<string, Array<(...a: any[]) => any>> = {};
  const fakePi = {
    on: (e: string, h: any) => {
      if (!handlers[e]) handlers[e] = [];
      handlers[e].push(h);
    },
    registerCommand: () => {},
    registerShortcut: () => {},
  };
  betterFooter(fakePi as any);
  for (const h of handlers.thinking_level_select ?? []) h({ level: thinkingLevel });
  // Simulate session_start so sessionStartTime and footer are set
  for (const h of handlers.session_start ?? []) await h({}, ctxObj);
  expect(ctxObj.ui.setFooter).toHaveBeenCalled();
  return ctxObj.ui.setFooter.mock.calls[0][0];
}

describe('better-footer render', () => {
  it('uses theme userMessageBg as background', async () => {
    const { ctx } = makeCtx();
    const renderCallback = await setupFooter(ctx, 'high');
    const component = renderCallback({} as any, makeTheme('#3a3a4f'), makeFooterData());
    const line = component.render(120)[0];
    expect(line).toContain('\x1b[48;2;58;58;79m');
  });

  it('falls back to surface0 hex when theme lacks userMessageBg', async () => {
    const { ctx } = makeCtx();
    const renderCallback = await setupFooter(ctx, 'high');
    const brokenTheme = {
      getBgAnsi: () => {
        throw new Error('nope');
      },
      fg: (color: string, text: string) => text,
      getThinkingColor: (level: string) => (text: string) => text,
    };
    const component = renderCallback({} as any, brokenTheme, makeFooterData());
    const line = component.render(120)[0];
    expect(line).toContain('\x1b[48;2;49;50;68m');
  });

  it('applies paddingX so content does not touch edges', async () => {
    const { ctx } = makeCtx();
    const renderCallback = await setupFooter(ctx, 'high');
    const component = renderCallback({} as any, makeTheme(), makeFooterData());
    const line = component.render(120)[0];
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI stripper
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
    expect(stripped.startsWith(' \u25c9')).toBe(true); // leading pad + ◉
    expect(stripped.endsWith(' ')).toBe(true); // trailing pad
    expect(visibleWidth(stripped)).toBe(120); // exactly fills width
  });

  it('full render: bg + padding + gradient + distributed', async () => {
    const { ctx } = makeCtx();
    const renderCallback = await setupFooter(ctx, 'high');
    const component = renderCallback({} as any, makeTheme(), makeFooterData());
    const lines = component.render(120);
    expect(lines).toHaveLength(1);
    const line = lines[0];

    expect(line).toContain('\x1b[48;2;49;50;68m'); // bg
    expect(line).toContain('\u26a1'); // ⚡
    expect(line).toContain('\x1b[38;2;203;166;247m'); // thinkingHigh = mauve
    expect(line).toMatch(/ {3,}/); // distributed gaps

    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI stripper
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, '');
    expect(visibleWidth(stripped)).toBe(120);
  });

  it('each thinking level uses its theme slot color', async () => {
    const expected: Record<string, string> = {
      off: '\x1b[38;2;108;112;134m',       // overlay0
      minimal: '\x1b[38;2;88;91;112m',     // overlay2
      low: '\x1b[38;2;137;180;250m',       // blue
      medium: '\x1b[38;2;116;199;236m',    // sapphire
      high: '\x1b[38;2;203;166;247m',      // mauve
      xhigh: '\x1b[38;2;245;194;231m',     // pink
    };
    for (const [level, color] of Object.entries(expected)) {
      const { ctx } = makeCtx();
      const renderCallback = await setupFooter(ctx, level);
      const component = renderCallback({} as any, makeTheme(), makeFooterData());
      const line = component.render(120)[0];
      expect(line).toContain(color);
    }
  });

  it('thinking bar characters grow with level', async () => {
    const expected: Record<string, string> = {
      off: '',
      minimal: '\u2581',
      low: '\u2582',
      medium: '\u2584',
      high: '\u2586',
      xhigh: '\u2588',
    };
    for (const [level, bar] of Object.entries(expected)) {
      const { ctx } = makeCtx();
      const renderCallback = await setupFooter(ctx, level);
      const component = renderCallback({} as any, makeTheme(), makeFooterData());
      const line = component.render(120)[0];
      if (bar) expect(line).toContain(`\u26a1${bar}`);
      else expect(line).toContain('\u26a1 off');
    }
  });

  it('shows combined session metric with turns and uptime', async () => {
    const { ctx } = makeCtx();
    // Set branch to 5 entries so turns show
    ctx.sessionManager.getBranch = () => [1, 2, 3, 4, 5] as any;
    const renderCallback = await setupFooter(ctx, 'low');
    const component = renderCallback({} as any, makeTheme(), makeFooterData());
    const line = component.render(120)[0];
    // Duration hidden in same-tick render (0s), but turns and uptime show
    expect(line).toContain('\uf0997'); // turns icon
    expect(line).toContain('\uf43a'); // uptime icon
    expect(line).toContain('5');
    expect(line).toContain('0.0h');
  });
});
