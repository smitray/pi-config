/**
 * Token-based command pattern matching.
 *
 * Syntax:
 *   ?     = match exactly one token
 *   *     = match zero or more tokens
 *   {a,b} = match one of multiple literals
 *   literal = exact match (supports * inside token)
 */

function tokenize(cmd: string): string[] {
  return cmd.replace(/\\\s+/g, ' ').split(/\s+/).filter(Boolean);
}

function expandAlternatives(token: string): string[] {
  const m = token.match(/^\{(.+)\}$/);
  if (!m) return [token];
  return m[1].split(',').map((s) => s.trim());
}

function matchToken(pattern: string, value: string): boolean {
  if (pattern === '*') return true;
  if (pattern === '?') return value.length > 0;

  const alts = expandAlternatives(pattern);
  for (const alt of alts) {
    if (alt === value) return true;
    if (alt.includes('*')) {
      const regex = new RegExp(
        `^${alt.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`
      );
      if (regex.test(value)) return true;
    }
  }
  return false;
}

function matchSequence(patternTokens: string[], valueTokens: string[]): boolean {
  let pi = 0;
  let vi = 0;

  while (pi < patternTokens.length && vi < valueTokens.length) {
    if (patternTokens[pi] === '*') {
      pi++;
      if (pi === patternTokens.length) return true;
      while (vi < valueTokens.length) {
        if (matchSequence(patternTokens.slice(pi), valueTokens.slice(vi))) return true;
        vi++;
      }
      return false;
    }
    if (!matchToken(patternTokens[pi], valueTokens[vi])) return false;
    pi++;
    vi++;
  }

  while (pi < patternTokens.length && patternTokens[pi] === '*') pi++;
  return pi === patternTokens.length && vi === valueTokens.length;
}

/** Normalize shell command: strip env vars, wrappers (env, nohup, time) */
function normalizeCommand(cmd: string): string {
  return cmd
    .replace(/^(\w+=\S+\s+)+/, '')
    .replace(/^(env|nohup|time|command|exec)\s+/, '')
    .trim();
}

/** Split command into segments by shell operators */
function splitSegments(cmd: string): string[] {
  return cmd
    .split(/\s*(?:&&|\|\||;|\|)\s*/)
    .map((s) => normalizeCommand(s.trim()))
    .filter(Boolean);
}

export function matchCommandPattern(command: string, pattern: string): boolean {
  const segments = splitSegments(command);
  const patternTokens = tokenize(pattern);

  return segments.some((seg) => {
    const valueTokens = tokenize(seg);
    return matchSequence(patternTokens, valueTokens);
  });
}

export function matchFileNamePattern(fileName: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(fileName);
  } catch {
    return fileName.toLowerCase().includes(pattern.toLowerCase());
  }
}

export function matchContentPattern(content: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(content);
  } catch {
    return content.toLowerCase().includes(pattern.toLowerCase());
  }
}
