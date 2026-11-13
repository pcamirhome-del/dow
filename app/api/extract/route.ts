import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ClientType, Innertube, UniversalCache } from 'youtubei.js';
import {
  Client,
  Ytdl,
  createPoTokenProvider,
  type PoTokenProvider,
  type PoTokenRequest,
} from '@distube/ytdl-core';
import { validatePublicHttpUrl } from '@/lib/url-safety';
import type {
  AudioBitratePreset,
  AudioFormatOption,
  ExtractedMediaInfo,
  PlatformId,
  VideoFormatOption,
} from '@/types/media';

const execFileAsync = promisify(execFile);

let cachedPoProviderPromise: Promise<PoTokenProvider | null> | null = null;

function getSharedPoTokenProvider(): Promise<PoTokenProvider | null> {
  if (!cachedPoProviderPromise) {
    cachedPoProviderPromise = createPoTokenProvider({ timeoutMs: 12000 }).catch(
      () => null
    );
  }
  return cachedPoProviderPromise;
}

const BOT_ERROR_REGEX =
  /sign in to confirm|not a bot|confirm you.?re not a bot|login_required|botguard|could not play|403|forbidden|429/i;

function isBotBlockError(msg: string): boolean {
  return BOT_ERROR_REGEX.test(msg);
}

class YouTubeBotBlockedError extends Error {
  botBlocked = true;
  oembed?: { title?: string; author?: string; thumbnail?: string };
  constructor(
    message: string,
    oembed?: { title?: string; author?: string; thumbnail?: string }
  ) {
    super(message);
    this.oembed = oembed;
  }
}

async function fetchYouTubeOEmbed(url: string, videoId?: string) {
  const fallbackThumb = videoId
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : '';
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      return {
        title: data.title || (videoId ? `YouTube Video (${videoId})` : 'YouTube Video'),
        author: data.author_name || 'YouTube',
        thumbnail: data.thumbnail_url || fallbackThumb,
      };
    }
  } catch {
    // ignore oembed failure
  }
  return {
    title: videoId ? `YouTube Video (${videoId})` : 'YouTube Video',
    author: 'YouTube',
    thumbnail: fallbackThumb,
  };
}

const AUDIO_BITRATES: AudioBitratePreset[] = [64, 128, 192, 256, 320];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function detectPlatform(url: URL): PlatformId {
  const host = url.hostname.toLowerCase();
  if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
  if (host.includes('tiktok.com')) return 'tiktok';
  if (host.includes('instagram.com')) return 'instagram';
  if (host.includes('facebook.com') || host.includes('fb.watch') || host.includes('fb.com'))
    return 'facebook';
  if (host === 'x.com' || host.endsWith('.x.com') || host.includes('twitter.com')) return 'x';
  return 'generic';
}

function buildAudioOptions(
  sourceAudioUrl: string,
  durationSeconds: number,
  acodec = 'aac'
): AudioFormatOption[] {
  return AUDIO_BITRATES.map((bitrateKbps) => ({
    id: `mp3-${bitrateKbps}`,
    bitrateKbps,
    label: `MP3 · ${bitrateKbps} kbps`,
    ext: 'mp3',
    url: sourceAudioUrl,
    sizeBytes:
      durationSeconds > 0
        ? Math.round((bitrateKbps * 1000 * durationSeconds) / 8)
        : undefined,
    acodec,
  }));
}

async function tryYtDlp(
  url: string,
  platform: PlatformId
): Promise<ExtractedMediaInfo | null> {
  const candidates = ['yt-dlp', '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp', '/tmp/yt-dlp'];
  for (const bin of candidates) {
    try {
      const ytDlpArgs = [
        '-J',
        '--no-warnings',
        '--no-playlist',
        '--skip-download',
        '--extractor-args',
        'youtube:player_client=tv_embedded,mweb,android_vr',
        url,
      ];
      const { stdout } = await execFileAsync(bin, ytDlpArgs, {
        timeout: 18000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const data = JSON.parse(stdout) as {
        title?: string;
        uploader?: string;
        channel?: string;
        duration?: number;
        thumbnail?: string;
        formats?: Array<{
          format_id?: string;
          url?: string;
          ext?: string;
          height?: number;
          fps?: number;
          vcodec?: string;
          acodec?: string;
          filesize?: number;
          filesize_approx?: number;
          abr?: number;
          protocol?: string;
        }>;
      };

      const formats = (data.formats || []).filter(
        (f) => f.url && f.url.startsWith('http') && f.protocol !== 'm3u8_native'
      );

      const audioOnly = formats
        .filter((f) => (!f.vcodec || f.vcodec === 'none') && f.acodec && f.acodec !== 'none')
        .sort((a, b) => (b.abr || 0) - (a.abr || 0));

      const bestAudioUrl = audioOnly[0]?.url || '';
      const durationSeconds = Math.round(data.duration || 0);

      const videoByHeight = new Map<number, VideoFormatOption>();
      for (const f of formats) {
        if (!f.vcodec || f.vcodec === 'none' || !f.height || f.height < 140) continue;
        const hasAudio = !!f.acodec && f.acodec !== 'none';
        const existing = videoByHeight.get(f.height);
        // Prefer progressive mp4 with audio, or mp4 video
        const isBetter =
          !existing ||
          (hasAudio && !existing.hasAudio) ||
          (f.ext === 'mp4' && existing.ext !== 'mp4');
        if (isBetter && (hasAudio || bestAudioUrl)) {
          videoByHeight.set(f.height, {
            id: `ytdlp-${f.format_id || f.height}`,
            qualityLabel: f.height >= 2160 ? '2160p (4K)' : `${f.height}p`,
            height: f.height,
            ext: f.ext || 'mp4',
            url: f.url!,
            audioUrl: hasAudio ? undefined : bestAudioUrl,
            hasAudio,
            needsMux: !hasAudio && !!bestAudioUrl,
            sizeBytes: f.filesize || f.filesize_approx,
            fps: f.fps,
            vcodec: f.vcodec,
          });
        }
      }

      const videoFormats = Array.from(videoByHeight.values()).sort(
        (a, b) => a.height - b.height
      );

      if (videoFormats.length === 0 && !bestAudioUrl) return null;

      const audioSource = bestAudioUrl || videoFormats[0]?.url || '';
      return {
        title: data.title || 'Downloaded Video',
        author: data.uploader || data.channel || platform,
        platform,
        durationSeconds,
        thumbnail: data.thumbnail || '',
        sourceUrl: url,
        extractorUsed: 'yt-dlp',
        videoFormats,
        audioFormats: audioSource
          ? buildAudioOptions(audioSource, durationSeconds, audioOnly[0]?.acodec)
          : [],
      };
    } catch {
      continue;
    }
  }
  return null;
}

async function extractYouTube(url: string): Promise<ExtractedMediaInfo> {
  const videoIdMatch = url.match(
    /(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/
  );
  const videoId = videoIdMatch?.[1];
  const envCookie = process.env.YOUTUBE_COOKIE?.trim() || undefined;
  const envPoToken = process.env.YOUTUBE_PO_TOKEN?.trim() || undefined;
  const envVisitorData = process.env.YOUTUBE_VISITOR_DATA?.trim() || undefined;
  const oauthAccessToken = process.env.YOUTUBE_OAUTH_ACCESS_TOKEN?.trim();
  const oauthRefreshToken = process.env.YOUTUBE_OAUTH_REFRESH_TOKEN?.trim();
  const oauthExpiryRaw = process.env.YOUTUBE_OAUTH_EXPIRY_DATE?.trim();

  // Mint dynamic BotGuard PO Token when available
  const poProvider = await getSharedPoTokenProvider();
  let mintedPoToken = envPoToken;
  if (!mintedPoToken && poProvider && videoId) {
    try {
      mintedPoToken = await poProvider({
        contentBinding: videoId,
        client: Client.Mweb,
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // BotGuard minting may fail in restricted sandboxes; continue to client rotation
    }
  }

  let lastErrorMessage = '';

  // 1. Try YouTubei.js Innertube across anti-bot resilient clients + PO Token + OAuth2
  if (videoId) {
    const clientOrder: ClientType[] = [
      ClientType.TV,
      ClientType.ANDROID_VR,
      ClientType.WEB_EMBEDDED,
      ClientType.IOS,
      ClientType.MWEB,
    ];

    for (const clientType of clientOrder) {
      try {
        const yt = await Innertube.create({
          cache: new UniversalCache(false),
          generate_session_locally: !envVisitorData,
          client_type: clientType,
          cookie: envCookie,
          visitor_data: envVisitorData,
          po_token: mintedPoToken,
        });

        // Optional OAuth2 session credential binding
        if (oauthAccessToken && oauthRefreshToken) {
          await yt.session
            .signIn({
              access_token: oauthAccessToken,
              refresh_token: oauthRefreshToken,
              expiry_date: oauthExpiryRaw
                ? new Date(oauthExpiryRaw).toISOString()
                : new Date(Date.now() + 3600_000).toISOString(),
            })
            .catch(() => undefined);
        }

        const info = await yt.getBasicInfo(videoId);
        const playStatus = info.playability_status?.status;
        const playReason = info.playability_status?.reason || '';

        if (playStatus && playStatus !== 'OK' && isBotBlockError(playReason)) {
          lastErrorMessage = playReason;
          continue;
        }

        const sd = info.streaming_data;
        if (sd) {
          const allFormats = [...(sd.formats || []), ...(sd.adaptive_formats || [])];
          const audioCandidates = allFormats
            .filter((f) => f.has_audio && !f.has_video)
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

          let bestAudioUrl = '';
          for (const af of audioCandidates) {
            const decoded = await af.decipher(yt.session.player);
            if (decoded) {
              bestAudioUrl = decoded;
              break;
            }
          }

          const byHeight = new Map<number, VideoFormatOption>();
          for (const vf of allFormats) {
            if (!vf.has_video || !vf.height || vf.height < 140) continue;
            const decodedUrl = await vf.decipher(yt.session.player);
            if (!decodedUrl) continue;

            const hasAudio = !!vf.has_audio;
            const ext = vf.mime_type?.includes('webm') ? 'webm' : 'mp4';
            const existing = byHeight.get(vf.height);

            const isPreferred =
              !existing ||
              (hasAudio && !existing.hasAudio) ||
              (ext === 'mp4' && existing.ext !== 'mp4');

            if (isPreferred && (hasAudio || bestAudioUrl)) {
              byHeight.set(vf.height, {
                id: `yt-${vf.itag}`,
                qualityLabel: vf.height >= 2160 ? '2160p (4K)' : `${vf.height}p`,
                height: vf.height,
                ext: hasAudio ? ext : 'mp4',
                url: decodedUrl,
                audioUrl: hasAudio ? undefined : bestAudioUrl,
                hasAudio,
                needsMux: !hasAudio && !!bestAudioUrl,
                sizeBytes: vf.content_length ? Number(vf.content_length) : undefined,
                fps: vf.fps,
                vcodec: vf.mime_type?.split(';')[0],
              });
            }
          }

          const videoFormats = Array.from(byHeight.values()).sort(
            (a, b) => a.height - b.height
          );
          const durationSeconds = info.basic_info.duration || 0;
          const thumb = info.basic_info.thumbnail?.[0]?.url || '';
          const fallbackAudio = bestAudioUrl || videoFormats[0]?.url || '';

          if (videoFormats.length > 0 || fallbackAudio) {
            return {
              title: info.basic_info.title || 'YouTube Video',
              author: info.basic_info.author || 'YouTube',
              platform: 'youtube',
              durationSeconds,
              thumbnail: thumb,
              sourceUrl: url,
              extractorUsed: `innertube (${clientType})`,
              videoFormats,
              audioFormats: fallbackAudio
                ? buildAudioOptions(fallbackAudio, durationSeconds, 'opus')
                : [],
            };
          }
        }
      } catch (err) {
        lastErrorMessage = err instanceof Error ? err.message : String(err);
      }
    }
  }

  // 2. Fallback to @distube/ytdl-core v5 with BotGuard PO Token Provider & multi-client rotation
  try {
    const customGetPoToken = envPoToken
      ? async (_req: PoTokenRequest) => envPoToken
      : poProvider || undefined;

    const ytdlClient = new Ytdl({
      cookie: envCookie,
      getPoToken: customGetPoToken,
      clients: [Client.Tv, Client.VisionOS, Client.WebEmbedded, Client.Mweb],
      timeoutMs: 15000,
    });

    const info = await ytdlClient.getInfo(url);
    const durationSeconds = info.videoDetails.lengthSeconds || 0;
    const audioFormatsRaw = info.formats
      .filter((f) => f.hasAudio && !f.hasVideo && !!f.url)
      .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
    const bestAudioUrl = audioFormatsRaw[0]?.url || '';

    const byHeight = new Map<number, VideoFormatOption>();
    for (const f of info.formats) {
      if (!f.hasVideo || !f.height || f.height < 140 || !f.url) continue;
      const hasAudio = !!f.hasAudio;
      const ext = f.container || 'mp4';
      const existing = byHeight.get(f.height);
      const isPreferred =
        !existing ||
        (hasAudio && !existing.hasAudio) ||
        (ext === 'mp4' && existing.ext !== 'mp4');

      if (isPreferred && (hasAudio || bestAudioUrl)) {
        byHeight.set(f.height, {
          id: `ytdl-${f.itag}`,
          qualityLabel: f.height >= 2160 ? '2160p (4K)' : `${f.height}p`,
          height: f.height,
          ext: hasAudio ? ext : 'mp4',
          url: f.url,
          audioUrl: hasAudio ? undefined : bestAudioUrl,
          hasAudio,
          needsMux: !hasAudio && !!bestAudioUrl,
          sizeBytes: f.contentLength,
          fps: f.fps,
          vcodec: f.videoCodec,
        });
      }
    }

    const videoFormats = Array.from(byHeight.values()).sort((a, b) => a.height - b.height);
    const thumbs = info.videoDetails.thumbnails || [];
    const thumbnail = thumbs[thumbs.length - 1]?.url || '';
    const fallbackAudio = bestAudioUrl || videoFormats[0]?.url || '';

    if (videoFormats.length > 0 || fallbackAudio) {
      return {
        title: info.videoDetails.title || 'YouTube Video',
        author: info.videoDetails.author?.name || 'YouTube',
        platform: 'youtube',
        durationSeconds,
        thumbnail,
        sourceUrl: url,
        extractorUsed: 'ytdl-core-potoken',
        videoFormats,
        audioFormats: fallbackAudio
          ? buildAudioOptions(fallbackAudio, durationSeconds, 'aac')
          : [],
      };
    }
  } catch (err) {
    lastErrorMessage = err instanceof Error ? err.message : String(err);
  }

  // 3. Smart Bot-Blockade Interception: fetch guaranteed oEmbed metadata & hand off to Client Cobalt
  const oembed = await fetchYouTubeOEmbed(url, videoId);
  if (isBotBlockError(lastErrorMessage) || !lastErrorMessage) {
    throw new YouTubeBotBlockedError(
      lastErrorMessage || 'Sign in to confirm you’re not a bot',
      oembed
    );
  }
  throw new Error(lastErrorMessage);
}

async function extractTikTok(url: string): Promise<ExtractedMediaInfo> {
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('TikTok extraction service returned an error');
  const json = (await res.json()) as {
    code: number;
    msg?: string;
    data?: {
      title?: string;
      cover?: string;
      duration?: number;
      play?: string;
      hdplay?: string;
      wmplay?: string;
      music?: string;
      size?: number;
      hd_size?: number;
      author?: { nickname?: string; unique_id?: string };
    };
  };

  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg || 'Could not extract TikTok video');
  }

  const d = json.data;
  const durationSeconds = d.duration || 0;
  const videoFormats: VideoFormatOption[] = [];

  if (d.play) {
    videoFormats.push({
      id: 'tt-sd',
      qualityLabel: '540p',
      height: 540,
      ext: 'mp4',
      url: d.play,
      hasAudio: true,
      needsMux: false,
      sizeBytes: d.size,
    });
  }
  if (d.hdplay && d.hdplay !== d.play) {
    videoFormats.push({
      id: 'tt-hd',
      qualityLabel: '1080p',
      height: 1080,
      ext: 'mp4',
      url: d.hdplay,
      hasAudio: true,
      needsMux: false,
      sizeBytes: d.hd_size,
    });
  }

  const audioSource = d.music || d.play || d.hdplay || '';
  return {
    title: d.title || 'TikTok Video',
    author: d.author?.nickname || d.author?.unique_id || 'TikTok',
    platform: 'tiktok',
    durationSeconds,
    thumbnail: d.cover || '',
    sourceUrl: url,
    extractorUsed: 'tikwm',
    videoFormats,
    audioFormats: audioSource ? buildAudioOptions(audioSource, durationSeconds, 'mp3') : [],
  };
}

async function extractXTwitter(url: string): Promise<ExtractedMediaInfo> {
  const parsed = new URL(url);
  const pathParts = parsed.pathname.split('/').filter(Boolean);
  const statusIdx = pathParts.findIndex((p) => p === 'status');
  const tweetId = statusIdx >= 0 ? pathParts[statusIdx + 1] : '';
  const username = statusIdx >= 1 ? pathParts[statusIdx - 1] : 'i';

  // Try FxTwitter JSON API (returns direct MP4 variants)
  if (tweetId) {
    try {
      const fxRes = await fetch(`https://api.fxtwitter.com/${username}/status/${tweetId}`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      if (fxRes.ok) {
        const fxJson = (await fxRes.json()) as {
          tweet?: {
            text?: string;
            author?: { name?: string; screen_name?: string };
            media?: {
              videos?: Array<{
                url?: string;
                thumbnail_url?: string;
                duration?: number;
                width?: number;
                height?: number;
                variants?: Array<{ url?: string; content_type?: string; bitrate?: number }>;
              }>;
            };
          };
        };
        const video = fxJson.tweet?.media?.videos?.[0];
        if (video) {
          const durationSeconds = Math.round(video.duration || 0);
          const variants = (video.variants || [])
            .filter((v) => v.url && (!v.content_type || v.content_type.includes('mp4')))
            .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));

          const videoFormats: VideoFormatOption[] = [];
          if (variants.length > 0) {
            variants.forEach((v, idx) => {
              const resMatch = v.url!.match(/\/(\d+)x(\d+)\//);
              const height = resMatch
                ? Math.min(Number(resMatch[1]), Number(resMatch[2])) || 480
                : idx === variants.length - 1
                  ? video.height || 720
                  : 360 + idx * 120;
              videoFormats.push({
                id: `x-${idx}`,
                qualityLabel: height >= 2160 ? '2160p (4K)' : `${height}p`,
                height,
                ext: 'mp4',
                url: v.url!,
                hasAudio: true,
                needsMux: false,
              });
            });
          } else if (video.url) {
            const h = video.height || 720;
            videoFormats.push({
              id: 'x-main',
              qualityLabel: `${h}p`,
              height: h,
              ext: 'mp4',
              url: video.url,
              hasAudio: true,
              needsMux: false,
            });
          }

          if (videoFormats.length > 0) {
            const audioSource = videoFormats[videoFormats.length - 1].url;
            return {
              title: (fxJson.tweet?.text || 'X Video').slice(0, 120),
              author: fxJson.tweet?.author?.name || fxJson.tweet?.author?.screen_name || 'X',
              platform: 'x',
              durationSeconds,
              thumbnail: video.thumbnail_url || '',
              sourceUrl: url,
              extractorUsed: 'fxtwitter',
              videoFormats,
              audioFormats: buildAudioOptions(audioSource, durationSeconds, 'aac'),
            };
          }
        }
      }
    } catch {
      // Fallback to syndication
    }

    // Try Twitter syndication API
    const synRes = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=a`,
      { headers: { 'User-Agent': USER_AGENT } }
    );
    if (synRes.ok) {
      const syn = (await synRes.json()) as {
        text?: string;
        user?: { name?: string };
        mediaDetails?: Array<{
          type?: string;
          media_url_https?: string;
          video_info?: {
            duration_millis?: number;
            variants?: Array<{ url?: string; content_type?: string; bitrate?: number }>;
          };
        }>;
      };
      const media = syn.mediaDetails?.find((m) => m.video_info?.variants?.length);
      if (media?.video_info?.variants) {
        const durationSeconds = Math.round((media.video_info.duration_millis || 0) / 1000);
        const mp4s = media.video_info.variants
          .filter((v) => v.url && v.content_type === 'video/mp4')
          .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));

        const videoFormats: VideoFormatOption[] = mp4s.map((v, idx) => {
          const match = v.url!.match(/\/(\d+)x(\d+)\//);
          const height = match ? Number(match[2]) : 360 + idx * 180;
          return {
            id: `xsyn-${idx}`,
            qualityLabel: `${height}p`,
            height,
            ext: 'mp4',
            url: v.url!,
            hasAudio: true,
            needsMux: false,
          };
        });

        if (videoFormats.length > 0) {
          return {
            title: (syn.text || 'X Video').slice(0, 120),
            author: syn.user?.name || 'X',
            platform: 'x',
            durationSeconds,
            thumbnail: media.media_url_https || '',
            sourceUrl: url,
            extractorUsed: 'twitter-syndication',
            videoFormats,
            audioFormats: buildAudioOptions(
              videoFormats[videoFormats.length - 1].url,
              durationSeconds,
              'aac'
            ),
          };
        }
      }
    }
  }

  throw new Error('Could not find a public video in this X/Twitter post');
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/');
}

async function extractFromHtmlOrDirect(
  url: string,
  platform: PlatformId
): Promise<ExtractedMediaInfo> {
  // 1. Check if URL itself is a direct video/audio resource
  try {
    const headRes = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
    const contentType = (headRes.headers.get('content-type') || '').toLowerCase();
    const contentLength = parseInt(headRes.headers.get('content-length') || '0', 10) || undefined;
    if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
      const isAudio = contentType.startsWith('audio/');
      const ext = contentType.includes('webm')
        ? 'webm'
        : contentType.includes('mpeg')
          ? 'mp3'
          : 'mp4';
      const titleFromUrl = decodeURIComponent(
        new URL(headRes.url || url).pathname.split('/').pop() || 'Direct Media'
      );
      return {
        title: titleFromUrl,
        author: new URL(url).hostname,
        platform,
        durationSeconds: 0,
        thumbnail: '',
        sourceUrl: url,
        extractorUsed: 'direct-stream',
        videoFormats: isAudio
          ? []
          : [
              {
                id: 'direct-video',
                qualityLabel: 'Original',
                height: 720,
                ext,
                url: headRes.url || url,
                hasAudio: true,
                needsMux: false,
                sizeBytes: contentLength,
              },
            ],
        audioFormats: buildAudioOptions(headRes.url || url, 0, ext),
      };
    }
  } catch {
    // Continue to HTML fetch
  }

  // 2. Fetch page HTML and extract video URLs from OpenGraph / JSON-LD / video tags
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        platform === 'facebook' || platform === 'instagram'
          ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
          : USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`Target page returned HTTP ${res.status}`);
  }

  const html = await res.text();
  const titleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const thumbMatch = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  );

  const candidates = new Set<string>();
  const patterns = [
    /<meta[^>]+property=["']og:video(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)["']/gi,
    /"(?:playable_url_quality_hd|playable_url|browser_native_hd_url|browser_native_sd_url|video_url|contentUrl)"\s*:\s*"([^"]+)"/gi,
    /<(?:video|source)[^>]+src=["']([^"']+\.(?:mp4|webm|m4v)[^"']*)["']/gi,
  ];

  for (const regex of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      const cleaned = decodeHtmlEntities(match[1]);
      if (cleaned.startsWith('http')) {
        candidates.add(cleaned);
      }
    }
  }

  const urls = Array.from(candidates);
  if (urls.length === 0) {
    throw new Error(
      platform === 'instagram' || platform === 'facebook'
        ? 'No public video stream found (post may be private or require authentication)'
        : 'No downloadable public video stream detected on this page'
    );
  }

  const videoFormats: VideoFormatOption[] = urls.slice(0, 4).map((streamUrl, i) => ({
    id: `html-${i}`,
    qualityLabel: i === 0 && urls.length > 1 ? '720p' : i === 1 ? '1080p' : '480p',
    height: i === 0 && urls.length > 1 ? 720 : i === 1 ? 1080 : 480,
    ext: streamUrl.includes('.webm') ? 'webm' : 'mp4',
    url: streamUrl,
    hasAudio: true,
    needsMux: false,
  }));

  videoFormats.sort((a, b) => a.height - b.height);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : `${platform} Video`;
  const thumbnail = thumbMatch ? decodeHtmlEntities(thumbMatch[1]) : '';

  return {
    title,
    author: new URL(url).hostname,
    platform,
    durationSeconds: 0,
    thumbnail,
    sourceUrl: url,
    extractorUsed: 'html-og',
    videoFormats,
    audioFormats: buildAudioOptions(videoFormats[videoFormats.length - 1].url, 0, 'aac'),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string };
    if (!body?.url || typeof body.url !== 'string') {
      return NextResponse.json({ error: 'Please provide a valid URL' }, { status: 400 });
    }

    const parsedUrl = validatePublicHttpUrl(body.url);
    const normalizedUrl = parsedUrl.toString();
    const platform = detectPlatform(parsedUrl);

    // 1. Try yt-dlp binary first when installed on the host (supports 1000+ sites)
    const ytDlpResult = await tryYtDlp(normalizedUrl, platform);
    if (ytDlpResult) {
      return NextResponse.json(ytDlpResult);
    }

    // 2. Pure JS/TS platform-specific & generic extractors (100% Vercel compatible)
    let result: ExtractedMediaInfo;
    if (platform === 'youtube') {
      result = await extractYouTube(normalizedUrl);
    } else if (platform === 'tiktok') {
      result = await extractTikTok(normalizedUrl);
    } else if (platform === 'x') {
      result = await extractXTwitter(normalizedUrl);
    } else {
      result = await extractFromHtmlOrDirect(normalizedUrl, platform);
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof YouTubeBotBlockedError) {
      return NextResponse.json(
        {
          error: err.message,
          botBlocked: true,
          fallbackRequired: 'cobalt-client',
          oembed: err.oembed,
        },
        { status: 422 }
      );
    }
    const message = err instanceof Error ? err.message : 'Media extraction failed';
    return NextResponse.json(
      {
        error: message,
        botBlocked: isBotBlockError(message),
      },
      { status: 422 }
    );
  }
}
