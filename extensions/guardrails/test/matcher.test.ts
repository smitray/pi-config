import { describe, expect, it } from 'vitest';
import { matchCommandPattern, matchContentPattern, matchFileNamePattern } from '../matcher';

describe('matchCommandPattern', () => {
  it('matches exact commands', () => {
    expect(matchCommandPattern('npm install', 'npm install')).toBe(true);
    expect(matchCommandPattern('npm install', 'npm test')).toBe(false);
  });

  it('matches wildcard *', () => {
    expect(matchCommandPattern('npm install --save', 'npm *')).toBe(true);
    expect(matchCommandPattern('npm test', 'npm *')).toBe(true);
    expect(matchCommandPattern('bun install', 'npm *')).toBe(false);
  });

  it('matches single token ?', () => {
    expect(matchCommandPattern('npm test', '? test')).toBe(true);
    expect(matchCommandPattern('bun test', '? test')).toBe(true);
    expect(matchCommandPattern('test', '? test')).toBe(false);
  });

  it('matches alternatives {a,b}', () => {
    expect(matchCommandPattern('npm test', '{npm,bun} test')).toBe(true);
    expect(matchCommandPattern('bun test', '{npm,bun} test')).toBe(true);
    expect(matchCommandPattern('yarn test', '{npm,bun} test')).toBe(false);
  });

  it('matches multi-token wildcards', () => {
    expect(matchCommandPattern('rm -rf /tmp/foo', 'rm -rf *')).toBe(true);
    expect(matchCommandPattern('rm -f /tmp/foo', 'rm -rf *')).toBe(false);
  });

  it('matches after shell operators', () => {
    expect(matchCommandPattern('cd dir && npm install', 'npm *')).toBe(true);
    expect(matchCommandPattern('echo hi || npm test', 'npm *')).toBe(true);
  });

  it('normalizes env vars and wrappers', () => {
    expect(matchCommandPattern('NODE_ENV=production npm build', 'npm *')).toBe(true);
    expect(matchCommandPattern('env npm install', 'npm *')).toBe(true);
    expect(matchCommandPattern('nohup npm start', 'npm *')).toBe(true);
  });
});

describe('matchFileNamePattern', () => {
  it('matches by regex', () => {
    expect(matchFileNamePattern('.env', '\\.env$')).toBe(true);
    expect(matchFileNamePattern('.env.local', '\\.env\\.')).toBe(true);
    expect(matchFileNamePattern('config.json', '\\.env$')).toBe(false);
  });

  it('matches by substring fallback', () => {
    expect(matchFileNamePattern('my-secret.txt', 'secret')).toBe(true);
    expect(matchFileNamePattern('public.txt', 'secret')).toBe(false);
  });
});

describe('matchContentPattern', () => {
  it('matches content by regex', () => {
    expect(matchContentPattern('API_KEY=abc123', 'API_KEY')).toBe(true);
    expect(matchContentPattern('normal content', 'API_KEY')).toBe(false);
  });
});
