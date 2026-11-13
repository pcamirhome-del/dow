export type PlatformId =
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'x'
  | 'generic';

export type QualityPreset =
  | '144p'
  | '240p'
  | '360p'
  | '480p'
  | '720p'
  | '1080p'
  | '1440p'
  | '2160p';

export type AudioBitratePreset = 64 | 128 | 192 | 256 | 320;

export interface VideoFormatOption {
  id: string;
  qualityLabel: string;
  height: number;
  ext: string;
  url: string;
  audioUrl?: string;
  hasAudio: boolean;
  needsMux: boolean;
  sizeBytes?: number;
  fps?: number;
  vcodec?: string;
}

export interface AudioFormatOption {
  id: string;
  bitrateKbps: AudioBitratePreset;
  label: string;
  ext: 'mp3' | 'm4a';
  url: string;
  sizeBytes?: number;
  acodec?: string;
}

export interface ExtractedMediaInfo {
  title: string;
  author: string;
  platform: PlatformId;
  durationSeconds: number;
  thumbnail: string;
  sourceUrl: string;
  extractorUsed: string;
  videoFormats: VideoFormatOption[];
  audioFormats: AudioFormatOption[];
}

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'converting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ActiveDownloadTask {
  id: string;
  title: string;
  sourceUrl: string;
  platform: PlatformId;
  mediaType: 'video' | 'audio';
  qualityLabel: string;
  ext: string;
  thumbnail: string;
  status: DownloadStatus;
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  speedBps: number;
  error?: string;
  createdAt: number;
}

export interface StoredFileItem {
  id: string;
  name: string;
  mediaType: 'video' | 'audio';
  folder: 'video' | 'audio';
  ext: string;
  mimeType: string;
  qualityLabel: string;
  platform: PlatformId;
  sourceUrl: string;
  sizeBytes: number;
  durationSeconds: number;
  tags: string[];
  hidden: boolean;
  createdAt: number;
  blob: Blob;
  thumbnail?: string;
  savedToDiskPath?: string;
}

export interface BackgroundFetchJobMeta {
  id: string;
  title: string;
  sourceUrl: string;
  platform: PlatformId;
  mediaType: 'video' | 'audio';
  qualityLabel: string;
  ext: string;
  mimeType: string;
  durationSeconds: number;
  thumbnail?: string;
  createdAt: number;
}

export interface DownloadHistoryRecord {
  id: string;
  title: string;
  sourceUrl: string;
  platform: PlatformId;
  mediaType: 'video' | 'audio';
  qualityLabel: string;
  ext: string;
  sizeBytes: number;
  status: 'completed' | 'failed';
  createdAt: number;
}

export type ThemeMode = 'dark' | 'light' | 'auto' | 'dynamic';
export type DynamicAccent = 'ocean' | 'emerald' | 'amber' | 'crimson' | 'auto-time';
export type NotificationSoundId = 'chime' | 'pulse' | 'cascade';

export type LanguageCode =
  | 'ar'
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'tr'
  | 'ru'
  | 'ja'
  | 'ko'
  | 'zh';

export type SpeedLimitKBps = 0 | 256 | 512 | 1024 | 2048 | 5120 | 10240;

export interface AppSettings {
  language: LanguageCode;
  theme: ThemeMode;
  dynamicAccent: DynamicAccent;
  directDownload: boolean;
  concurrentLimit: number; // 1 to 10, default 2
  speedLimitKBps: SpeedLimitKBps; // 0 = Unlimited
  saveFolderName: string | null;
  touchIdEnabled: boolean;
  touchIdCredentialId: string | null;
  pinHash: string | null;
  notificationsEnabled: boolean;
  soundOrPushEnabled: boolean;
  notifyOnComplete: boolean;
  notifyOnFail: boolean;
  notificationSound: NotificationSoundId;
  defaultMediaType: 'video' | 'audio';
  defaultVideoQuality: QualityPreset;
  defaultAudioBitrate: AudioBitratePreset;
}

export interface SpeedTestResult {
  downloadMbps: number;
  latencyMs: number;
  jitterMs: number;
  protocol: string;
  tlsSecurity: string;
  resumeSupported: boolean;
  serverLabel: string;
  testedAt: number;
}

export type SidebarSection =
  | 'links'
  | 'files'
  | 'localshare'
  | 'security'
  | 'general'
  | 'downloads'
  | 'notifications'
  | 'appearance'
  | 'speedtest'
  | 'history'
  | 'about';

export type FileViewMode = 'files' | 'folders' | 'list';
export type FileSortField = 'name' | 'type' | 'date' | 'size' | 'tags';
