/**
 * Markdown-it integration — AST-based parsing for chunking and structure extraction.
 *
 * Uses the markdown-it npm package for accurate heading detection, section extraction,
 * and chunking by token budgets. Safe to use across extensions (web-access, kb, OCR).
 */

import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: false,
  breaks: false,
  typographer: false,
  linkify: false,
});

/**
 * Extract structured sections from markdown using AST.
 * Returns [{ heading, content }[]] ordered by depth.
 */
export function extractSections(markdown: string): Array<{ heading: string; content: string }> {
  const tokens = md.parse(markdown, {});
  const sections: Array<{ heading: string; content: string }> = [];
  let currentHeading: string | null = null;
  let currentContent: string[] = [];

  function flushSection(): void {
    if (currentHeading !== null) {
      sections.push({
        heading: currentHeading,
        content: currentContent.join('\n\n'),
      });
    }
    currentHeading = null;
    currentContent = [];
  }

  let headingTokenIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'heading_open') {
      flushSection();
      headingTokenIndex = i + 1;
      const nextToken = tokens[i + 1];
      if (nextToken && nextToken.type === 'inline') {
        currentHeading = nextToken.content;
      }
    } else if (token.type === 'heading_close') {
      // skip
    } else if (i === headingTokenIndex) {
      // inline token with heading text, skip
    } else if (token.type === 'inline') {
      if (currentHeading === null) {
        sections.push({ heading: '', content: token.content.trim() });
      } else {
        currentContent.push(token.content);
      }
    } else if (token.type === 'fence') {
      const lang = token.info?.trim() ?? '';
      const code = `\`\`\`${lang}\n${token.content}\n\`\`\``;
      if (currentHeading === null) {
        sections.push({ heading: '', content: code });
      } else {
        currentContent.push(code);
      }
    } else if (token.type === 'code_block' || token.type === 'html_block') {
      const code = `\`\`\`\n${token.content}\n\`\`\``;
      if (currentHeading === null) {
        sections.push({ heading: '', content: code });
      } else {
        currentContent.push(code);
      }
    }
  }

  flushSection();
  return sections;
}

function approxTokens(text: string): number {
  return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3);
}

/**
 * Chunk markdown by headings, respecting maxTokens per section.
 * Falls back to paragraph split if section exceeds maxTokens.
 */
export function chunkByHeadings(markdown: string, maxTokens: number): string[] {
  const sections = extractSections(markdown);
  const chunks: string[] = [];

  for (const section of sections) {
    const sectionText = section.heading
      ? `# ${section.heading}\n\n${section.content}`
      : section.content;
    const sectionTokens = approxTokens(sectionText);

    if (sectionTokens <= maxTokens) {
      chunks.push(sectionText);
    } else if (section.heading) {
      let paragraphs = section.content.split(/\n\n+/);

      if (paragraphs.length === 1 && approxTokens(section.content) > maxTokens) {
        const words = section.content.trim().split(/\s+/).filter(Boolean);
        if (words.length === 1) {
          const chunkSize = Math.ceil(maxTokens / 1.3);
          paragraphs = [];
          for (let i = 0; i < section.content.length; i += chunkSize) {
            paragraphs.push(section.content.slice(i, i + chunkSize));
          }
        } else {
          paragraphs = words;
        }
      }

      if (paragraphs.length === 1 && approxTokens(paragraphs[0]) > maxTokens) {
        const chunkSize = Math.ceil(maxTokens / 1.3);
        const finalParas: string[] = [];
        for (let i = 0; i < paragraphs[0].length; i += chunkSize) {
          finalParas.push(paragraphs[0].slice(i, i + chunkSize));
        }
        paragraphs = finalParas;
      }

      let chunk = `# ${section.heading}\n\n`;
      let chunkTokens = approxTokens(chunk);

      for (const para of paragraphs) {
        const paraTokens = approxTokens(para);
        if (chunkTokens + paraTokens > maxTokens && chunk.length > approxTokens(section.heading)) {
          chunks.push(chunk.trim());
          chunk = `# ${section.heading}\n\n${para}`;
          chunkTokens = approxTokens(chunk);
        } else {
          chunk += '\n\n' + para;
          chunkTokens += paraTokens;
        }
      }
      chunks.push(chunk.trim());
    } else {
      const paragraphs = section.content.split(/\n\n+/);
      let chunk = '';
      let chunkTokens = 0;

      for (const para of paragraphs) {
        const paraTokens = approxTokens(para);
        if (chunkTokens + paraTokens > maxTokens) {
          if (chunk) chunks.push(chunk.trim());
          chunk = para;
          chunkTokens = paraTokens;
        } else {
          chunk += '\n\n' + para;
          chunkTokens += paraTokens;
        }
      }
      if (chunk) chunks.push(chunk.trim());
    }
  }

  return chunks;
}

/**
 * Validate markdown syntax and return errors.
 * Returns [] if valid.
 */
export function validateMarkdown(markdown: string): string[] {
  const errors: string[] = [];
  try {
    md.parse(markdown, {});
  } catch (err) {
    errors.push(`Parse error: ${(err as Error).message}`);
  }

  const openBrackets = (markdown.match(/\[/g) || []).length;
  const closeBrackets = (markdown.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    errors.push(`Unmatched brackets: ${openBrackets} open, ${closeBrackets} close`);
  }

  const openParens = (markdown.match(/\(/g) || []).length;
  const closeParens = (markdown.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`Unmatched parens: ${openParens} open, ${closeParens} close`);
  }

  return errors;
}
