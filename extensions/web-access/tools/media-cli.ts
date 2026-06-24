import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { runCommand } from '../../_shared/spawn';
import type { AccessConfig } from '../lib/config';
import { err, ok } from '../lib/result';
import type { ToolResult } from '../lib/types';

type MediaMode = 'metadata' | 'subtitles' | 'audio' | 'video';

function ensureDownloadDir(config: AccessConfig): void {
  mkdirSync(config.downloadDir, { recursive: true });
}

export function validateMediaUrl(url: string): Error | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return new Error('only http/https URLs are allowed');
    }
    return null;
  } catch {
    return new Error('invalid URL');
  }
}

function runYtDlp(
  url: string,
  args: string[],
  config: AccessConfig,
  cwd?: string
): ReturnType<typeof runCommand> {
  return runCommand(config.ytdlpBin, [...args, '--no-playlist', url], {
    timeoutMs: config.timeout,
    cwd,
  });
}

export function findFileByIdPrefix(dir: string, id: string, extensions?: string[]): string | null {
  const files = readdirSync(dir);
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped}\\.`);
  const candidates = files.filter((f) => regex.test(f));
  if (!extensions || extensions.length === 0) {
    return candidates[0] ? join(dir, candidates[0]) : null;
  }
  const extSet = new Set(extensions.map((e) => (e.startsWith('.') ? e : `.${e}`)));
  const match = candidates.find((f) => extSet.has(extname(f).toLowerCase()));
  return match ? join(dir, match) : null;
}

export function cleanSrt(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/^\d+\s*$/gm, '')
    .replace(/^\d{1,2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2},\d{3}\s*$/gm, '')
    .replace(/\s*\[Music\]\s*/gi, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function extractJsonLine(stdout: string): unknown {
  const line = stdout.split('\n').find((l) => l.trim().startsWith('{'));
  if (!line) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function fetchMetadata(url: string, config: AccessConfig): Promise<ToolResult> {
  const result = await runYtDlp(url, ['--dump-json', '--no-download'], config);
  if (result.exitCode !== 0) {
    return err('YTDLP_FAILED', result.stderr || result.stdout, { url });
  }
  const data = extractJsonLine(result.stdout) as Record<string, unknown> | null;
  if (!data) return err('YTDLP_PARSE_ERROR', 'Could not parse metadata', { url });

  const payload = {
    id: data.id,
    title: data.title,
    uploader: data.uploader,
    duration: data.duration,
    description: data.description,
    webpage_url: data.webpage_url || url,
  };

  return ok(JSON.stringify(payload, null, 2), payload);
}

async function fetchSubtitles(url: string, config: AccessConfig): Promise<ToolResult> {
  ensureDownloadDir(config);
  const idResult = await runYtDlp(url, ['--no-download', '--print', '%(id)s'], config);
  if (idResult.exitCode !== 0 || !idResult.stdout.trim()) {
    return err('YTDLP_FAILED', idResult.stderr || idResult.stdout, { url });
  }
  const id = idResult.stdout.trim();

  const result = await runYtDlp(
    url,
    [
      '--write-auto-sub',
      '--sub-langs',
      'en,-live_chat',
      '--convert-subs',
      'srt',
      '--skip-download',
      '-o',
      '%(id)s',
    ],
    config,
    config.downloadDir
  );

  if (result.exitCode !== 0) {
    return err('YTDLP_FAILED', result.stderr || result.stdout, { url });
  }

  const srtPath = findFileByIdPrefix(config.downloadDir, id, ['srt']);
  if (!srtPath) {
    return err('NO_SUBTITLES', 'No English subtitles available', { url, id });
  }

  const raw = readFileSync(srtPath, 'utf8');
  rmSync(srtPath, { force: true });
  const transcript = cleanSrt(raw);

  if (!transcript) {
    return err('NO_SUBTITLES', 'Subtitle file was empty after cleaning', { url, id });
  }

  return ok(transcript, { url, id, source: 'auto-subs', chars: transcript.length });
}

async function fetchAudio(url: string, config: AccessConfig): Promise<ToolResult> {
  ensureDownloadDir(config);
  const idResult = await runYtDlp(url, ['--no-download', '--print', '%(id)s'], config);
  if (idResult.exitCode !== 0 || !idResult.stdout.trim()) {
    return err('YTDLP_FAILED', idResult.stderr || idResult.stdout, { url });
  }
  const id = idResult.stdout.trim();

  const result = await runYtDlp(
    url,
    ['-x', '--audio-format', 'opus', '--audio-quality', '0', '-o', '%(id)s'],
    config,
    config.downloadDir
  );

  if (result.exitCode !== 0) {
    return err('YTDLP_FAILED', result.stderr || result.stdout, { url, id });
  }

  const filePath = findFileByIdPrefix(config.downloadDir, id, ['opus', 'm4a', 'mp3']);
  if (!filePath) {
    return err('AUDIO_NOT_FOUND', 'Audio file not found after download', { url, id });
  }

  return ok(filePath, { url, id, filePath, format: extname(filePath).slice(1) });
}

async function fetchVideo(url: string, config: AccessConfig): Promise<ToolResult> {
  ensureDownloadDir(config);
  const idResult = await runYtDlp(url, ['--no-download', '--print', '%(id)s'], config);
  if (idResult.exitCode !== 0 || !idResult.stdout.trim()) {
    return err('YTDLP_FAILED', idResult.stderr || idResult.stdout, { url });
  }
  const id = idResult.stdout.trim();

  const maxBytes = config.mediaMaxMb * 1024 * 1024;
  // Attempt a pre-download size guard with yt-dlp format selector.
  const selectorResult = await runYtDlp(
    url,
    ['-f', `best[filesize<${maxBytes}]`, '--no-download', '--print', '%(filesize)s'],
    config
  );
  if (selectorResult.exitCode !== 0 || selectorResult.stdout.trim() === 'NA') {
    return err(
      'SIZE_LIMIT',
      `No format under ${config.mediaMaxMb} MB (or filesize unavailable). Use audio mode or raise PI_ACCESS_MEDIA_MAX_MB.`,
      { url, id, maxMb: config.mediaMaxMb }
    );
  }

  const result = await runYtDlp(
    url,
    ['-f', 'best', '-o', '%(id)s.%(ext)s'],
    config,
    config.downloadDir
  );
  if (result.exitCode !== 0) {
    return err('YTDLP_FAILED', result.stderr || result.stdout, { url, id });
  }

  const filePath = findFileByIdPrefix(config.downloadDir, id, ['mp4', 'webm', 'mkv']);
  if (!filePath) {
    return err('VIDEO_NOT_FOUND', 'Video file not found after download', { url, id });
  }

  const size = statSync(filePath).size;
  if (size > maxBytes) {
    rmSync(filePath, { force: true });
    return err('SIZE_LIMIT', `Downloaded file exceeded ${config.mediaMaxMb} MB`, {
      url,
      id,
      sizeBytes: size,
      maxMb: config.mediaMaxMb,
    });
  }

  return ok(filePath, { url, id, filePath, format: extname(filePath).slice(1), sizeBytes: size });
}

async function transcribeWithWhisper(url: string, config: AccessConfig): Promise<ToolResult> {
  if (!config.whisperBin || !config.whisperModel) {
    return err('WHISPER_CONFIG_MISSING', 'Set PI_ACCESS_WHISPER_BIN and PI_ACCESS_WHISPER_MODEL', {
      url,
    });
  }

  ensureDownloadDir(config);
  const idResult = await runYtDlp(url, ['--no-download', '--print', '%(id)s'], config);
  if (idResult.exitCode !== 0 || !idResult.stdout.trim()) {
    return err('YTDLP_FAILED', idResult.stderr || idResult.stdout, { url });
  }
  const id = idResult.stdout.trim();

  const audioResult = await runYtDlp(
    url,
    ['-x', '--audio-format', 'opus', '--audio-quality', '0', '-o', '%(id)s'],
    config,
    config.downloadDir
  );
  if (audioResult.exitCode !== 0) {
    return err('AUDIO_DOWNLOAD_FAILED', audioResult.stderr || audioResult.stdout, { url, id });
  }

  const audioPath = findFileByIdPrefix(config.downloadDir, id, ['opus', 'm4a', 'mp3']);
  if (!audioPath) {
    return err('AUDIO_NOT_FOUND', 'Audio file not found for transcription', { url, id });
  }

  const device = config.whisperCuda ? 'cuda' : 'cpu';
  const whisperResult = await runCommand(
    config.whisperBin,
    [
      '--model',
      config.whisperModel,
      '--device',
      device,
      '--compute_type',
      'int8',
      '--output_dir',
      config.downloadDir,
      audioPath,
    ],
    { timeoutMs: config.timeout }
  );

  rmSync(audioPath, { force: true });

  if (whisperResult.exitCode !== 0) {
    return err('WHISPER_FAILED', whisperResult.stderr || whisperResult.stdout, { url, id });
  }

  const base = audioPath.replace(/\.[^.]+$/, '');
  const txtPath = findFileByIdPrefix(config.downloadDir, id, ['txt']);
  if (!txtPath) {
    return err('WHISPER_OUTPUT_MISSING', `Expected transcript text file near ${base}`, { url, id });
  }

  const transcript = readFileSync(txtPath, 'utf8').trim();
  rmSync(txtPath, { force: true });

  return ok(transcript, {
    url,
    id,
    source: config.whisperCuda ? 'faster-whisper-cuda' : 'faster-whisper-cpu',
    chars: transcript.length,
  });
}

export function registerMediaTools(pi: ExtensionAPI, config: AccessConfig): void {
  pi.registerTool({
    name: 'media-fetch',
    label: 'Media Fetch',
    description:
      'Fetch metadata, subtitles, audio, or video via yt-dlp. Files persist under PI_ACCESS_DOWNLOAD_DIR.',
    parameters: Type.Object({
      url: Type.String({ description: 'Media URL' }),
      mode: Type.Optional(
        Type.String({ description: 'metadata | subtitles | audio | video', default: 'metadata' })
      ),
    }),
    async execute(_id, params) {
      const { url, mode } = params as { url: string; mode?: string };
      const validation = validateMediaUrl(url);
      if (validation) return err('INVALID_URL', validation.message, { url });

      const m = (mode || 'metadata') as MediaMode;
      switch (m) {
        case 'metadata':
          return fetchMetadata(url, config);
        case 'subtitles':
          return fetchSubtitles(url, config);
        case 'audio':
          return fetchAudio(url, config);
        case 'video':
          return fetchVideo(url, config);
        default:
          return err('INVALID_MODE', `Unknown mode: ${m}`, { mode: m });
      }
    },
  });

  pi.registerTool({
    name: 'media-transcribe',
    label: 'Media Transcribe',
    description: 'Transcribe a media URL: subtitles first, faster-whisper fallback',
    parameters: Type.Object({
      url: Type.String({ description: 'Media URL' }),
      lang: Type.Optional(
        Type.String({ description: 'Subtitle language (default: en)', default: 'en' })
      ),
    }),
    async execute(_id, params) {
      const { url } = params as { url: string; lang?: string };
      const validation = validateMediaUrl(url);
      if (validation) return err('INVALID_URL', validation.message, { url });

      const subs = await fetchSubtitles(url, config);
      if (!subs.isError && subs.content[0]?.text) {
        return ok(subs.content[0].text, { ...(subs.details || {}), fallback: false });
      }

      if (!config.whisperBin || !config.whisperModel) {
        return err(
          'NO_TRANSCRIPT_AVAILABLE',
          'No subtitles and faster-whisper fallback is not configured. Set PI_ACCESS_WHISPER_BIN and PI_ACCESS_WHISPER_MODEL.',
          { url }
        );
      }

      return transcribeWithWhisper(url, config);
    },
  });
}
