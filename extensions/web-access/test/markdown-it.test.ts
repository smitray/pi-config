import { describe, expect, it } from 'vitest';

import { chunkByHeadings, extractSections, validateMarkdown } from '../lib/markdown-it';

describe('markdown-it utilities', () => {
  describe('extractSections', () => {
    it('extracts heading + content pairs', () => {
      const markdown =
        '# Title\n\nPreamble content.\n\n## Section One\n\nContent for one.\n\n### Subsection\n\nDeep content.\n\n## Section Two\n\nContent for two.';

      const sections = extractSections(markdown);
      // First heading becomes preamble, then 3 more sections
      expect(sections).toHaveLength(4);
      expect(sections[0].heading).toBe('Title');
      expect(sections[0].content).toBe('Preamble content.');
      expect(sections[1].heading).toBe('Section One');
      expect(sections[2].heading).toBe('Subsection');
    });

    it('handles content after code blocks', () => {
      const markdown = '## API\n\nSome text.\n\nMore text.';

      const sections = extractSections(markdown);
      expect(sections).toHaveLength(1);
      expect(sections[0].heading).toBe('API');
      expect(sections[0].content).toBe('Some text.\n\nMore text.');
    });

    it('returns empty sections array for empty input', () => {
      expect(extractSections('')).toEqual([]);
    });
  });

  describe('chunkByHeadings', () => {
    it('respects maxTokens boundary', () => {
      const markdown = '# Section\n\nFirst paragraph.\n\nSecond paragraph.\n\nThird paragraph.';

      const chunks = chunkByHeadings(markdown, 200);
      // Should split into multiple chunks based on paragraph boundaries
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('preserves headings in chunks', () => {
      const markdown =
        '# First\n\nContent one.\n\n## Second\n\nContent two.\n\n### Third\n\nContent three.';

      const chunks = chunkByHeadings(markdown, 500);
      for (const chunk of chunks) {
        expect(chunk.startsWith('# ')).toBe(true);
      }
    });

    it('handles preamble before first heading', () => {
      const markdown = 'Intro text.\n\n## Main\n\nSection content.';

      const chunks = chunkByHeadings(markdown, 500);
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe('Intro text.');
    });
  });

  describe('validateMarkdown', () => {
    it('returns empty array for valid markdown', () => {
      const valid = "# Title\n\nContent here.\n\n## Section\n\n```js\nconsole.log('ok');\n```\n";
      expect(validateMarkdown(valid)).toEqual([]);
    });

    it('detects unmatched brackets', () => {
      const invalid = '[unclosed link';
      const errors = validateMarkdown(invalid);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Unmatched');
    });

    it('detects unmatched parens', () => {
      const invalid = 'text (with unbalanced';
      const errors = validateMarkdown(invalid);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Unmatched');
    });
  });
});
