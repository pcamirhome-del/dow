# SaveBox — Local Video & Audio Downloader PWA

A full-stack Progressive Web Application (PWA) built with Next.js 15 App Router, `ReadableStream` byte-level streaming, WebAssembly FFmpeg (`@ffmpeg/ffmpeg`), IndexedDB local storage, File System Access API folder routing, WebAuthn Touch ID protection, and Cloudflare connection diagnostics.

## Features

- **Multi-Platform Extraction**: Supports YouTube (`youtubei.js` + `@distube/ytdl-core`), TikTok, X (Twitter), Instagram, Facebook, direct video/audio URLs, and optional local `yt-dlp` binary auto-detection.
- **144p to 4K Video + MP3 Audio**: Download progressive/adaptive MP4 streams (with client-side FFmpeg WASM muxing for 1080p/1440p/4K) or transcode audio to genuine MP3 (`64`, `128`, `192`, `256`, `320 kbps`).
- **Local-First Storage & Folder Routing**: Stores files locally in `IndexedDB` and writes directly into device `video/` and `audio/` subfolders via the File System Access API.
- **Concurrent Queue & Real Speed Limiter**: Run `1–10` simultaneous downloads (default `2` with speed advisory above 2) and enforce real `ReadableStream` bandwidth limits (`Unlimited`, `256 KB/s`, `512 KB/s`, `1 MB/s`, `2 MB/s`, `5 MB/s`, `10 MB/s`).
- **12 Languages with Flags**: Arabic (RTL), English, Spanish, French, German, Italian, Portuguese, Turkish, Russian, Japanese, Korean, and Chinese.
- **Security & Privacy**: WebAuthn Touch ID / PIN vault lock and zero server-side tracking.
- **Cloudflare Speed Test**: Real throughput, latency, HTTP/2, TLS 1.3, and HTTP `Range` resume verification via `speed.cloudflare.com`.
- **Excel UTF-8 BOM CSV Export**: Export complete download history cleanly for Microsoft Excel.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repository in [Vercel](https://vercel.com/new).
3. Deploy — `vercel.json` configures extended serverless execution durations for `/api/extract`, `/api/stream`, and `/api/speedtest`.

## Local Development

```bash
npm install
npm run dev
```
