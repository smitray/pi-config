/**
 * Markdown-it integration for web-access.
 * Provides AST-based parsing for better chunking and structure extraction.
 */
import MarkdownIt from 'markdown-it';

/**
 * Tokenizer that preserves headings as chunk boundaries.
 * Uses markdown-it AST for accurate #, ##, ### detection.
 */
const md = new MarkdownIt({
  html: false,
  breaks: false,
  typographer: false,
  linkify: false,
});

/**
 * Extract structured sections from markdown using AST.
 * Returns [{ heading: string, content: string }[]] ordered by depth.
 */
export function extractSections(markdown: string): Array<{ heading: string; content: string }> {
  const tokens = md.parse(markdown, {});
  const sections: Array<{ heading: string; content: string }> = [];
  let currentHeading: string | null = null;
  let currentContent: string[] = [];

  function flushSection(): void {
    if (currentHeading !== null) {
      sections.push({ heading: currentHeading, content: currentContent.join('\n\n') });
    }
    currentHeading = null;
    currentContent = [];
  }

  let headingTokenIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'heading_open') {
      // Save previous section
      flushSection();

      // Get heading text from next token
      headingTokenIndex = i + 1;
      const nextToken = tokens[i + 1];
      if (nextToken && nextToken.type === 'inline') {
        currentHeading = nextToken.content;
      }
    } else if (token.type === 'heading_close') {
      // Just a closing tag, skip
    } else if (i === headingTokenIndex) {
      // This is the inline token with the heading text, skip it
    } else if (token.type === 'inline') {
      // Content belongs to current section or preamble
      if (currentHeading === null) {
        // Preamble before first heading
        sections.push({ heading: '', content: token.content.trim() });
      } else {
        currentContent.push(token.content);
      }
    } else if (token.type === 'fence' || token.type === 'html_block') {
      // Code blocks, HTML blocks
      if (currentHeading === null) {
        sections.push({ heading: '', content: token.content.trim() });
      } else {
        currentContent.push(token.content);
      }
    }
  }

  flushSection();
  return sections;
}

/**
 * Chunk markdown by headings, respecting maxTokens per section.
 * Falls back to paragraph split if section exceeds maxTokens.
 */
export function chunkByHeadings(markdown: string, maxTokens: number): string[] {
  const sections = extractSections(markdown);
  const chunks: string[] = [];
  const approxTokens = (text: string) => Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3);

  function needsChunking(text: string): boolean {
    return approxTokens(text) > maxTokens;
  }

  for (const section of sections) {
    const sectionText = section.heading ? `# ${section.heading}\n\n${section.content}` : section.content;
    const sectionTokens = approxTokens(sectionText);

    if (sectionTokens <= maxTokens) {
      chunks.push(sectionText);
    } else if (section.heading) {
      // Section with heading is too large — split by paragraphs
      let paragraphs = section.content.split(/\n\n+/);
      
      // If only one "paragraph" (no newlines), split by word blocks or chars
      if (paragraphs.length === 1 && approxTokens(section.content) > maxTokens) {
        const words = section.content.trim().split(/\s+/).filter(Boolean);
        if (words.length === 1) {
          // No spaces — split into fixed-size chunks
          const chunkSize = Math.ceil(maxTokens / 1.3); // chars per chunk
          paragraphs = [];
          for (let i = 0; i < section.content.length; i += chunkSize) {
            paragraphs.push(section.content.slice(i, i + chunkSize));
          }
        } else {
          paragraphs = words;
        }
      }
      
      let chunk = `# ${section.heading}\n\n`;
      let chunkTokens = approxTokens(chunk);

      for (const para of paragraphs) {
        const paraTokens = approxTokens(para);
        if (chunkTokens + paraTokens > maxTokens && chunk.length > approxTokens(section.heading)) {
          // Flush current chunk
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
      // No heading, content-only section — paragraph split
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
    // Try to parse — throws on severe syntax errors
    md.parse(markdown, {});
  } catch (err) {
    errors.push(`Parse error: ${(err as Error).message}`);
  }

  // Check for unmatched brackets
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
