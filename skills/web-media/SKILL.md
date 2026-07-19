---
name: web-media
description: >
  Get metadata, subtitles, transcripts, or download audio/video from YouTube and other
  video platforms via yt-dlp. Use when the user says "transcribe this video", "get subtitles",
  "download audio from this URL", "what's this video about", or shares a YouTube/social media
  video link.
compatibility: >
  Requires the access-web pi extension with yt-dlp in $PATH (configurable via
  PI_ACCESS_YTDLP_BIN). Optional: local Whisper API at PI_ACCESS_WHISPER_API
  (default http://localhost:7861) for fallback when no subtitles available.
---

# web-media

## Quick start

```text
# See what a video is about
media-fetch url="https://www.youtube.com/watch?v=..." mode=metadata

# Get transcript (subtitles first, Whisper API fallback)
media-transcribe url="https://www.youtube.com/watch?v=..."

# Download audio
media-fetch url="..." mode=audio

# Download video (under 100MB)
media-fetch url="..." mode=video
```

## Workflow: transcribe a video

```
1. media-transcribe(url)  → tries YouTube auto-captions first
2. No captions?           → downloads audio → POST to local Whisper API
3. Returns clean text
```

Subtitles come from YouTube's auto-generated captions (~12 duplicate lines cleaned to one). Whisper API runs on your local GPU at `localhost:7861`.

## Parameters

| Param | Tool | Notes |
|-------|------|-------|
| `url` | both | YouTube, Vimeo, any yt-dlp-supported site |
| `mode` | `media-fetch` | `metadata` \| `subtitles` \| `audio` \| `video` |
| `lang` | `media-transcribe` | Subtitle language (default `en`) |

## Patterns

### Quick overview
```text
media-fetch url="https://youtu.be/..." mode=metadata
```
Returns title, uploader, duration, description.

### Full transcript
```text
media-transcribe url="https://youtu.be/..."
```
Clean single-pass text. For videos with auto-captions → yt-dlp. For videos without → local Whisper API.

### Download for offline
```text
media-fetch url="..." mode=audio
media-fetch url="..." mode=video
```
Files persist under `PI_ACCESS_DOWNLOAD_DIR`.

## Error handling

`NO_SUBTITLES` → No YouTube captions. Whisper API fallback kicks in automatically if configured.

`NO_TRANSCRIPT_AVAILABLE` → No subs AND no Whisper API. Start the server: `~/.local/bin/hypr-stt start-server`.

`SIZE_LIMIT` → Video too large. Use `mode=audio` or raise `PI_ACCESS_MEDIA_MAX_MB`.
