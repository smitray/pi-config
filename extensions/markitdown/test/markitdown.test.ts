import { describe, expect, it } from 'vitest';
import { runCommand } from '../../_shared/spawn';

const markitdownAvailable = (await runCommand('markitdown', ['--version'])).ok;
const markitdownDescribe = markitdownAvailable ? describe : describe.skip;

markitdownDescribe('markitdown CLI', () => {
  it('reports version', async () => {
    const result = await runCommand('markitdown', ['--version']);
    expect(result.ok).toBe(true);
    expect(result.stdout.trim()).toMatch(/^markitdown \d+\.\d+\.\d+/);
  });

  it('converts HTML to markdown', async () => {
    const html = '<html><body><h1>Title</h1><p>Hello <strong>world</strong>.</p></body></html>';
    const result = await runCommand('markitdown', [], { input: html });
    expect(result.ok).toBe(true);
    expect(result.stdout).toContain('# Title');
    expect(result.stdout).toContain('**world**');
  });

  it('converts plain markdown (passthrough)', async () => {
    const md = '# Heading\n\nParagraph with **bold**.\n';
    const result = await runCommand('markitdown', [], { input: md });
    expect(result.ok).toBe(true);
    expect(result.stdout).toContain('# Heading');
    expect(result.stdout).toContain('**bold**');
  });

  it('returns error for nonexistent file', async () => {
    const result = await runCommand('markitdown', ['/nonexistent/file.pdf']);
    expect(result.ok).toBe(false);
  });
});
