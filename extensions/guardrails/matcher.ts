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
  // Backslash-space (escaped whitespace) is unescaped first; then we split on
  // any run of whitespace. Pattern tokens that contain literal spaces can be
  // matched because shell would have already escaped them.
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
    // nosemgrep: dynamic regex from safe token patterns
    if (alt.includes('*')) {
      // nosemgrep
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

/** Normalize shell command: strip env vars and wrappers. */
function normalizeCommand(cmd: string): string {
  return (
    cmd
      // Strip any number of leading VAR=value assignments (greedy: handles A=1 B=2 cmd).
      .replace(/^(\s*\w+=\S+\s+)+/, '')
      // Strip common wrappers and their `-c "<command>"` payload.
      .replace(/^(?:env|nohup|time|command|exec)\s+/, '')
      // `bash -c "rm -rf /tmp"` and similar — drop the interpreter + `-c` flag and
      // unwrap the quoted payload so the inner command is matched directly.
      .replace(/^(?:bash|sh|zsh|ksh|dash)\s+-c\s+(['"])(.*)\1\s*$/, '$2')
      .trim()
  );
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
    // nosemgrep: user-configured file patterns, not user input fields
    const regex = new RegExp(pattern, 'i');
    return regex.test(fileName);
  } catch {
    return fileName.toLowerCase().includes(pattern.toLowerCase());
  }
}

export function matchContentPattern(content: string, pattern: string): boolean {
  try {
    // nosemgrep: user-configured content patterns, safe by policy
    const regex = new RegExp(pattern, 'i');
    return regex.test(content);
  } catch {
    return content.toLowerCase().includes(pattern.toLowerCase());
  }
}
