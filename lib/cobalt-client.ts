'use client';

import type {
  AudioBitratePreset,
  AudioFormatOption,
  ExtractedMediaInfo,
  PlatformId,
  VideoFormatOption,
} from '@/types/media';

/**
 * Rotating list of public Cobalt API endpoints called directly from the user's
 * residential browser IP to bypass datacenter IP anti-bot blocks (e.g., Vercel).
 */
export const PUBLIC_COBALT_INSTANCES: readonly string[] = [
  'https://api.cobalt.tools',
  'https://cobalt-api.kwiatekmiki.com',
  'https://cobalt.canine.tools',
  'https://cobalt-backend.canine.tools',
  'https://capi.3kh0.net',
  'https://cobalt.alpha.wolfy.love',
  'https://api.succoon.com',
  'https://dl.khub.ky',
];

const BOT_ERROR_REGEX =
  /sign in to confirm|not a bot|confirm you.?re not a bot|login_required|botguard|could not play|403|forbidden|status code 403|429/i;

export function isYouTubeBotError(message: string | undefined | null): boolean {
  if (!message) return false;
  return BOT_ERROR_REGEX.test(message);
}

export function detectClientPlatform(rawUrl: string): PlatformId {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('tiktok.com')) return 'tiktok';
    if (host.includes('instagram.com')) return 'instagram';
    if (host.includes('facebook.com') || host.includes('fb.watch') || host.includes('fb.com'))
      return 'facebook';
    if (host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com')) return 'x';
  } catch {
    // ignore
  }
  return 'generic';
}

export function extractYouTubeVideoId(rawUrl: string): string | null {
  const match = rawUrl.match(
    /(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/
  );
  return match?.[1] || null;
}

export async function fetchPublicOEmbedMeta(url: string): Promise<{
  title: string;
  author: string;
  thumbnail: string;
}> {
  const videoId = extractYouTubeVideoId(url);
  const fallbackThumb = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';

  const endpoints = [
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(endpoint, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      if (data.title) {
        return {
          title: data.title,
          author: data.author_name || 'YouTube',
          thumbnail: data.thumbnail_url || fallbackThumb,
        };
      }
    } catch {
      continue;
    }
  }

  return {
    title: videoId ? `YouTube Video (${videoId})` : 'Media Download',
    author: 'YouTube',
    thumbnail: fallbackThumb,
  };
}

interface CobaltApiResponse {
  status?: 'tunnel' | 'redirect' | 'stream' | 'picker' | 'error' | 'rate-limit' | 'local-processing';
  url?: string;
  filename?: string;
  picker?: Array<{
    type?: 'video' | 'photo' | 'gif';
    url: string;
    thumb?: string;
  }>;
  audio?: string;
  error?: { code?: string; context?: unknown } | string;
  text?: string;
}

async function queryCobaltEndpoint(
  baseUrl: string,
  payload: Record<string, unknown>
): Promise<{ ok: true; url: string; filename?: string; audioUrl?: string } | { ok: false }> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  // Cobalt v10 uses POST / ; legacy Cobalt v7 uses POST /api/json
  const paths = ['/', '/api/json'];

  for (const path of paths) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6500);
      const res = await fetch(`${cleanBase}${path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const data = (await res.json()) as CobaltApiResponse;

      if (
        (data.status === 'tunnel' || data.status === 'redirect' || data.status === 'stream') &&
        data.url
      ) {
        return {
          ok: true,
          url: data.url,
          filename: data.filename,
          audioUrl: data.audio,
        };
      }

      if (data.status === 'picker' && data.picker && data.picker.length > 0) {
        const videoPick = data.picker.find((p) => p.type === 'video') || data.picker[0];
        if (videoPick?.url) {
          return {
            ok: true,
            url: videoPick.url,
            filename: data.filename,
            audioUrl: data.audio,
          };
        }
      }
    } catch {
      continue;
    }
  }

  return { ok: false };
}

/**
 * Resolves a single direct stream URL from a rotating pool of public Cobalt API
 * instances directly from the user's residential browser IP.
 */
export async function resolveCobaltStreamUrl(params: {
  sourceUrl: string;
  mode: 'video' | 'audio';
  videoQuality?: string; // '144' | '240' | '360' | '480' | '720' | '1080' | '1440' | '2160' | 'max'
  audioBitrate?: AudioBitratePreset;
}): Promise<{ url: string; instance: string; filename?: string }> {
  const qualityNum = (params.videoQuality || '720').replace(/[^0-9]/g, '') || '720';
  const payload =
    params.mode === 'audio'
      ? {
          url: params.sourceUrl,
          downloadMode: 'audio',
          audioFormat: 'mp3',
          audioBitrate: String(params.audioBitrate || 192),
          // Cobalt v7 fallback fields
          isAudioOnly: true,
          aFormat: 'mp3',
        }
      : {
          url: params.sourceUrl,
          downloadMode: 'auto',
          videoQuality: qualityNum === '2160' ? '2160' : qualityNum,
          youtubeVideoCodec: 'h264',
          // Cobalt v7 fallback fields
          vQuality: qualityNum,
          vCodec: 'h264',
        };

  // Rotate starting offset so no single public instance gets hammered
  const startIdx = Math.floor(Math.random() * PUBLIC_COBALT_INSTANCES.length);
  const rotated = [
    ...PUBLIC_COBALT_INSTANCES.slice(startIdx),
    ...PUBLIC_COBALT_INSTANCES.slice(0, startIdx),
  ];

  for (const instance of rotated) {
    const result = await queryCobaltEndpoint(instance, payload);
    if (result.ok) {
      return {
        url: result.url,
        instance: new URL(instance).hostname,
        filename: result.filename,
      };
    }
  }

  throw new Error('All public Cobalt instances are currently busy; please retry');
}

/**
 * Full client-side extraction bypass using rotating Cobalt instances + oEmbed metadata.
 * Called silently whenever server extraction hits YouTube's bot/sign-in blockade.
 */
export async function extractViaCobaltClient(
  sourceUrl: string,
  prefetchedMeta?: { title?: string; author?: string; thumbnail?: string }
): Promise<ExtractedMediaInfo> {
  const platform = detectClientPlatform(sourceUrl);
  const oembed =
    prefetchedMeta?.title
      ? {
          title: prefetchedMeta.title,
          author: prefetchedMeta.author || platform,
          thumbnail: prefetchedMeta.thumbnail || '',
        }
      : await fetchPublicOEmbedMeta(sourceUrl);

  // Resolve primary 720p video stream & MP3 audio stream in parallel from residential IP
  const [video720, audio192] = await Promise.all([
    resolveCobaltStreamUrl({ sourceUrl, mode: 'video', videoQuality: '720' }).catch(() => null),
    resolveCobaltStreamUrl({ sourceUrl, mode: 'audio', audioBitrate: 192 }).catch(() => null),
  ]);

  if (!video720 && !audio192) {
    throw new Error('Could not bypass anti-bot blockade via public Cobalt pool');
  }

  const heights = [144, 240, 360, 480, 720, 1080, 1440, 2160];
  const videoFormats: VideoFormatOption[] = video720
    ? heights.map((h) => ({
        id: `cobalt-${h}`,
        qualityLabel: h >= 2160 ? '2160p (4K)' : `${h}p`,
        height: h,
        // Mark 720p with resolved URL and others with lazy cobalt:// marker resolved on demand
        url: h === 720 ? video720.url : `cobalt://video/${h}?url=${encodeURIComponent(sourceUrl)}`,
        ext: 'mp4',
        hasAudio: true,
        needsMux: false,
      }))
    : [];

  const bitrates: AudioBitratePreset[] = [64, 128, 192, 256, 320];
  const audioFormats: AudioFormatOption[] = audio192
    ? bitrates.map((kbps) => ({
        id: `cobalt-mp3-${kbps}`,
        bitrateKbps: kbps,
        label: `MP3 · ${kbps} kbps`,
        ext: 'mp3',
        url:
          kbps === 192
            ? audio192.url
            : `cobalt://audio/${kbps}?url=${encodeURIComponent(sourceUrl)}`,
        acodec: 'mp3',
      }))
    : [];

  const hostLabel = video720?.instance || audio192?.instance || 'cobalt';

  return {
    title: oembed.title,
    author: oembed.author,
    platform,
    durationSeconds: 0,
    thumbnail: oembed.thumbnail,
    sourceUrl,
    extractorUsed: `cobalt-residential (${hostLabel})`,
    videoFormats,
    audioFormats,
  };
}
