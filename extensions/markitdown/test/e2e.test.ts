import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { runCommand } from '../../_shared/spawn';

const fixturesDir = join(import.meta.dirname ?? __dirname, 'fixtures');

let markitdownAvailable = false;

beforeAll(async () => {
  const result = await runCommand('markitdown', ['--version']);
  markitdownAvailable = result.ok;
});

async function markitdownConvert(filePath: string): Promise<string> {
  const result = await runCommand('markitdown', [filePath], { timeoutMs: 30000 });
  if (!result.ok) throw new Error(`markitdown failed: ${result.stderr}`);
  return result.stdout;
}

describe('markitdown e2e', { skipIf: () => !markitdownAvailable }, () => {
  describe('HTML conversion', () => {
    it('preserves document structure', async () => {
      const md = await markitdownConvert(join(fixturesDir, 'sample.html'));

      // Headings
      expect(md).toContain('# Architecture Overview');
      expect(md).toContain('## Components');
      expect(md).toContain('## Configuration');
      expect(md).toContain('## API Endpoints');
      expect(md).toContain('## Notes');

      // Bold text
      expect(md).toContain('**sample document**');
      expect(md).toContain('**API Gateway**');

      // Lists (markitdown uses * for unordered lists)
      expect(md).toContain('* **API Gateway**');
      expect(md).toContain('* **Auth Service**');
      expect(md).toContain('* **Data Layer**');

      // Ordered list
      expect(md).toMatch(/1\.\s+Authentication/);
      expect(md).toMatch(/2\.\s+Rate limiting/);
      expect(md).toMatch(/3\.\s+CORS/);

      // Code block
      expect(md).toContain('server:');
      expect(md).toContain('port: 8080');
    });

    it('converts table to markdown table', async () => {
      const md = await markitdownConvert(join(fixturesDir, 'sample.html'));

      // Tables should become markdown tables with pipes
      expect(md).toContain('| Method');
      expect(md).toContain('| Path');
      expect(md).toContain('| Description');
      expect(md).toContain('GET');
      expect(md).toContain('/api/users');
    });
  });

  describe('JSON conversion', () => {
    it('converts JSON to readable markdown', async () => {
      const md = await markitdownConvert(join(fixturesDir, 'sample.json'));

      // Should preserve structure
      expect(md).toContain('pi-config');
      expect(md).toContain('0.80.3');
      expect(md).toContain('gh');
      expect(md).toContain('kb');
      expect(md).toContain('93');
    });
  });

  describe('CSV conversion', () => {
    it('converts CSV to markdown table', async () => {
      const md = await markitdownConvert(join(fixturesDir, 'sample.csv'));

      // Should become a table
      expect(md).toContain('name');
      expect(md).toContain('type');
      expect(md).toContain('tests');
      expect(md).toContain('gh');
      expect(md).toContain('kb');
      expect(md).toContain('48'); // web-access tests count
    });
  });

  describe('stdin piping', () => {
    it('converts piped HTML to markdown', async () => {
      // markitdown stdin requires a temp file for HTML — stdin alone
      // doesn't trigger format detection. Write to temp, convert, clean up.
      const { writeFile, unlink } = await import('node:fs/promises');
      const tmp = `/tmp/markitdown-e2e-${Date.now()}.html`;
      const html = '<html><body><h1>Title</h1><p>Content with <em>emphasis</em>.</p></body></html>';
      await writeFile(tmp, html, 'utf8');
      try {
        const result = await runCommand('markitdown', [tmp]);
        expect(result.ok).toBe(true);
        expect(result.stdout).toContain('# Title');
        expect(result.stdout).toContain('*emphasis*');
      } finally {
        await unlink(tmp).catch(() => {});
      }
    });

    it('handles large input', async () => {
      // Generate a large HTML document
      const sections = Array.from(
        { length: 50 },
        (_, i) => `<h2>Section ${i + 1}</h2><p>${'Lorem ipsum dolor sit amet. '.repeat(10)}</p>`
      ).join('\n');
      const html = `<html><body><h1>Large Document</h1>${sections}</body></html>`;

      const result = await runCommand('markitdown', [], { input: html, timeoutMs: 15000 });

      expect(result.ok).toBe(true);
      expect(result.stdout).toContain('# Large Document');
      expect(result.stdout).toContain('## Section 1');
      expect(result.stdout).toContain('## Section 50');
      expect(result.stdout.length).toBeGreaterThan(5000);
    });
  });

  describe('error handling', () => {
    it('returns empty for /dev/null', async () => {
      const result = await runCommand('markitdown', ['/dev/null'], { timeoutMs: 10000 });

      // markitdown handles /dev/null gracefully — returns empty
      expect(result.stdout.trim()).toBe('');
    });

    it('returns error for nonexistent path', async () => {
      const result = await runCommand('markitdown', ['/tmp/nonexistent-file-12345.pdf']);
      expect(result.ok).toBe(false);
    });
  });
});
