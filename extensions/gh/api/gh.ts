import { execSync } from 'node:child_process';

export interface GhResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function gh(args: string[], stdin?: string): GhResult {
  try {
    const stdout = execSync(`gh ${args.join(' ')}`, {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 10,
      timeout: 30_000,
      input: stdin,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    };
  }
}

export function ghJson<T>(args: string[]): T {
  const result = gh([...args, '--json', 'id']);
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout) as T;
}
