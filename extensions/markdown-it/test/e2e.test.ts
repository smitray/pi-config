import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chunkByHeadings, extractSections, validateMarkdown } from '../lib/markdown-it';

const fixturesDir = join(import.meta.dirname ?? __dirname, 'fixtures');

async function loadFixture(name: string): Promise<string> {
  return readFile(join(fixturesDir, name), 'utf8');
}

describe('markdown-it e2e', () => {
  describe('real-world API documentation', () => {
    it('extracts all major sections', async () => {
      const doc = await loadFixture('real-world-doc.md');
      const sections = extractSections(doc);

      const headings = sections.map((s) => s.heading);

      // All top-level and nested sections
      expect(headings).toContain('API Reference');
      expect(headings).toContain('Authentication');
      expect(headings).toContain('Token Refresh');
      expect(headings).toContain('Users');
      expect(headings).toContain('List Users');
      expect(headings).toContain('Create User');
      expect(headings).toContain('Organizations');
      expect(headings).toContain('Rate Limiting');
      expect(headings).toContain('Error Handling');
      expect(headings).toContain('Webhooks');
      expect(headings).toContain('Register Webhook');
      expect(headings).toContain('Verify Webhook Signatures');
    });

    it('preserves code blocks in sections', async () => {
      const doc = await loadFixture('real-world-doc.md');
      const sections = extractSections(doc);

      // Authentication section should contain the curl example
      const auth = sections.find((s) => s.heading === 'Authentication');
      expect(auth).toBeDefined();
      expect(auth?.content).toContain('curl');
      expect(auth?.content).toContain('Bearer');

      // Verify Webhook Signatures should contain Python code
      const webhook = sections.find((s) => s.heading === 'Verify Webhook Signatures');
      expect(webhook).toBeDefined();
      expect(webhook?.content).toContain('import hmac');
      expect(webhook?.content).toContain('hmac.compare_digest');
    });

    it('preserves lists in sections', async () => {
      const doc = await loadFixture('real-world-doc.md');
      const sections = extractSections(doc);

      const listUsers = sections.find((s) => s.heading === 'List Users');
      expect(listUsers).toBeDefined();
      expect(listUsers?.content).toContain('limit');
      expect(listUsers?.content).toContain('offset');
      expect(listUsers?.content).toContain('sort');
      expect(listUsers?.content).toContain('order');

      const rateLimit = sections.find((s) => s.heading === 'Rate Limiting');
      expect(rateLimit).toBeDefined();
      expect(rateLimit?.content).toContain('Free tier');
      expect(rateLimit?.content).toContain('Pro tier');
      expect(rateLimit?.content).toContain('Enterprise');
    });
  });

  describe('chunking real document', () => {
    it('produces chunks within token budget', async () => {
      const doc = await loadFixture('real-world-doc.md');
      const maxTokens = 300;
      const chunks = chunkByHeadings(doc, maxTokens);

      for (const chunk of chunks) {
        const approxTokens = Math.ceil(chunk.trim().split(/\s+/).filter(Boolean).length * 1.3);
        // Allow some tolerance for heading-included chunks
        expect(approxTokens).toBeLessThanOrEqual(maxTokens + 100);
      }
    });

    it('preserves section headings in chunks', async () => {
      const doc = await loadFixture('real-world-doc.md');
      const chunks = chunkByHeadings(doc, 500);

      // Every chunk should start with a heading
      for (const chunk of chunks) {
        expect(chunk.trim().charAt(0)).toBe('#');
      }
    });

    it('produces multiple chunks for large document', async () => {
      const doc = await loadFixture('real-world-doc.md');
      const chunks = chunkByHeadings(doc, 200);

      // A ~4KB document should produce multiple chunks at 200 tokens
      expect(chunks.length).toBeGreaterThan(3);
    });

    it('preserves all content across chunks', async () => {
      const doc = await loadFixture('real-world-doc.md');
      const chunks = chunkByHeadings(doc, 500);

      // Reconstruct should contain key content
      const reconstructed = chunks.join('\n\n');
      expect(reconstructed).toContain('Authentication');
      expect(reconstructed).toContain('Users');
      expect(reconstructed).toContain('Rate Limiting');
      expect(reconstructed).toContain('Webhooks');
      expect(reconstructed).toContain('import hmac');
      expect(reconstructed).toContain('Bearer');
    });
  });

  describe('validation on real document', () => {
    it('validates clean document', async () => {
      const doc = await loadFixture('real-world-doc.md');
      const errors = validateMarkdown(doc);

      // The document should be valid (no unmatched brackets/parens)
      expect(errors).toEqual([]);
    });

    it('detects broken markdown', () => {
      const broken = '# Title\n\n[unclosed link\n\nMore text (with unclosed paren';
      const errors = validateMarkdown(broken);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('Unmatched'))).toBe(true);
    });
  });

  describe('edge cases with real content', () => {
    it('handles document with only headings', () => {
      const doc = '# A\n\n## B\n\n### C\n\n';
      const sections = extractSections(doc);
      expect(sections.length).toBeGreaterThanOrEqual(3);
    });

    it('handles document with no headings', () => {
      const doc = 'Just a paragraph.\n\nAnother paragraph.\n';
      const sections = extractSections(doc);
      expect(sections.length).toBeGreaterThanOrEqual(1);
      expect(sections[0].heading).toBe('');
    });

    it('handles deeply nested headings', () => {
      const doc = '# L1\n\n## L2\n\n### L3\n\n#### L4\n\n##### L5\n\nContent.';
      const sections = extractSections(doc);
      const headings = sections.map((s) => s.heading);
      expect(headings).toContain('L1');
      expect(headings).toContain('L2');
      expect(headings).toContain('L3');
      expect(headings).toContain('L4');
      expect(headings).toContain('L5');
    });

    it('handles mixed content types', () => {
      const doc = [
        '# Mixed',
        '',
        'Regular paragraph.',
        '',
        '```python',
        'def hello():',
        '    print("hello")',
        '```',
        '',
        '| Col1 | Col2 |',
        '|------|------|',
        '| A    | B    |',
        '',
        '- List item 1',
        '- List item 2',
        '',
        '> Blockquote text',
      ].join('\n');

      const sections = extractSections(doc);
      const mixed = sections.find((s) => s.heading === 'Mixed');
      expect(mixed).toBeDefined();
      expect(mixed?.content).toContain('```python');
      expect(mixed?.content).toContain('def hello');
      expect(mixed?.content).toContain('List item');
    });
  });
});
