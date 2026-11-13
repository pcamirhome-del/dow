'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  ClipboardPaste,
  Download,
  Film,
  Loader2,
  Music,
  Search,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type {
  ActiveDownloadTask,
  AudioBitratePreset,
  ExtractedMediaInfo,
  QualityPreset,
} from '@/types/media';
import type { TranslationStrings } from '@/lib/i18n';
import { formatBytes } from '@/lib/storage';

const ALL_VIDEO_QUALITIES: QualityPreset[] = [
  '144p',
  '240p',
  '360p',
  '480p',
  '720p',
  '1080p',
  '1440p',
  '2160p',
];

const ALL_AUDIO_BITRATES: AudioBitratePreset[] = [64, 128, 192, 256, 320];

interface LinksWorkspaceProps {
  t: TranslationStrings;
  isRtl: boolean;
  urlInput: string;
  onUrlChange: (val: string) => void;
  mediaType: 'video' | 'audio';
  onMediaTypeChange: (type: 'video' | 'audio') => void;
  selectedQuality: QualityPreset;
  onSelectQuality: (q: QualityPreset) => void;
  selectedBitrate: AudioBitratePreset;
  onSelectBitrate: (b: AudioBitratePreset) => void;
  extractedInfo: ExtractedMediaInfo | null;
  isExtracting: boolean;
  extractError: string | null;
  onAnalyze: (urlOverride?: string) => Promise<ExtractedMediaInfo | null>;
  onStartDownload: (
    info?: ExtractedMediaInfo | null,
    overrideUrl?: string
  ) => Promise<void>;
  activeTasks: ActiveDownloadTask[];
  onCancelTask: (taskId: string) => void;
  directDownloadEnabled: boolean;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const LinksWorkspace: React.FC<LinksWorkspaceProps> = ({
  t,
  isRtl,
  urlInput,
  onUrlChange,
  mediaType,
  onMediaTypeChange,
  selectedQuality,
  onSelectQuality,
  selectedBitrate,
  onSelectBitrate,
  extractedInfo,
  isExtracting,
  extractError,
  onAnalyze,
  onStartDownload,
  activeTasks,
  onCancelTask,
  directDownloadEnabled,
}) => {
  const [pasteFeedback, setPasteFeedback] = useState<string | null>(null);
  const [thumbError, setThumbError] = useState(false);

  const handlePasteLink = async () => {
    setPasteFeedback(null);
    try {
      if (navigator.clipboard?.readText) {
        const clip = await navigator.clipboard.readText();
        if (clip && clip.trim()) {
          const clean = clip.trim();
          onUrlChange(clean);
          setThumbError(false);
          if (directDownloadEnabled) {
            await onStartDownload(null, clean);
          } else {
            await onAnalyze(clean);
          }
          return;
        }
      }
      setPasteFeedback(
        isRtl
          ? 'الحافظة فارغة — يرجى نسخ رابط فيديو أولاً'
          : 'Clipboard is empty — copy a video link first'
      );
    } catch {
      setPasteFeedback(
        isRtl
          ? 'يرجى الضغط مطولاً داخل المربع ولصق الرابط يدوياً (Ctrl+V)'
          : 'Clipboard access blocked — paste manually in the box (Ctrl+V)'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setThumbError(false);
    if (directDownloadEnabled) {
      await onStartDownload(null, urlInput.trim());
    } else {
      await onAnalyze(urlInput.trim());
    }
  };

  const availableHeights = new Set(
    (extractedInfo?.videoFormats || []).map((f) => {
      if (f.height >= 2160) return '2160p';
      if (f.height >= 1440) return '1440p';
      if (f.height >= 1080) return '1080p';
      if (f.height >= 720) return '720p';
      if (f.height >= 480) return '480p';
      if (f.height >= 360) return '360p';
      if (f.height >= 240) return '240p';
      return '144p';
    })
  );

  return (
    <div className="space-y-6">
      {/* Main Hero & URL Input Card */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-7">
        <div className="max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            {t.linksTitle}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
            {t.linksSubtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Rectangular Link Input Box */}
          <div>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => {
                onUrlChange(e.target.value);
                setPasteFeedback(null);
              }}
              placeholder={t.urlPlaceholder}
              dir="ltr"
              className="w-full min-h-[52px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 px-4 py-3 text-sm sm:text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>

          {/* Paste Link Button + Download Button right next to it */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePasteLink}
              className="inline-flex min-h-[46px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              <ClipboardPaste className="h-4.5 w-4.5 shrink-0" />
              <span>{t.pasteLink}</span>
            </button>

            <button
              type="button"
              disabled={!urlInput.trim() || isExtracting}
              onClick={() => onStartDownload(extractedInfo, urlInput.trim())}
              className="inline-flex min-h-[46px] flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-45 whitespace-nowrap cursor-pointer"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {isExtracting ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin shrink-0" />
              ) : (
                <Download className="h-4.5 w-4.5 shrink-0" />
              )}
              <span>{t.downloadNow}</span>
            </button>

            <button
              type="submit"
              disabled={!urlInput.trim() || isExtracting}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-45 whitespace-nowrap cursor-pointer"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span>{isExtracting ? t.analyzing : t.analyzeLink}</span>
            </button>
          </div>

          {pasteFeedback && (
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {pasteFeedback}
            </p>
          )}
          {extractError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {extractError}
            </div>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.supportedPlatforms}
          </p>
        </form>

        {/* Format Type Switch (Video 144p-4K vs Audio Only MP3) */}
        <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t.selectQuality}
            </span>

            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onMediaTypeChange('video')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  mediaType === 'video'
                    ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Film className="h-3.5 w-3.5" />
                <span>{t.videoMode}</span>
              </button>

              <button
                type="button"
                onClick={() => onMediaTypeChange('audio')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  mediaType === 'audio'
                    ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Music className="h-3.5 w-3.5" />
                <span>{t.audioMode}</span>
              </button>
            </div>
          </div>

          {/* Quality Grid */}
          {mediaType === 'video' ? (
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {ALL_VIDEO_QUALITIES.map((q) => {
                const isSelected = selectedQuality === q;
                const isExtractedMatch =
                  !extractedInfo || availableHeights.has(q) || extractedInfo.videoFormats.length > 0;
                const matchedFormat = extractedInfo?.videoFormats.find(
                  (f) =>
                    (q === '2160p' && f.height >= 2160) ||
                    f.qualityLabel.startsWith(q)
                );
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onSelectQuality(q)}
                    className={`flex flex-col items-center justify-center rounded-xl border px-2 py-2.5 text-center transition-colors cursor-pointer ${
                      isSelected
                        ? 'text-white border-transparent'
                        : isExtractedMatch
                          ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                          : 'border-slate-200/60 dark:border-slate-800/50 bg-slate-50/40 dark:bg-slate-900/30 text-slate-400 dark:text-slate-500'
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: 'var(--accent-primary)' }
                        : undefined
                    }
                  >
                    <span className="font-mono text-xs font-bold tabular-nums">
                      {q === '2160p' ? '4K' : q}
                    </span>
                    <span
                      className={`mt-0.5 text-[10px] tabular-nums ${
                        isSelected ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {matchedFormat?.sizeBytes
                        ? formatBytes(matchedFormat.sizeBytes)
                        : q === '2160p'
                          ? '2160p'
                          : 'MP4'}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {ALL_AUDIO_BITRATES.map((kbps) => {
                const isSelected = selectedBitrate === kbps;
                const matchedAudio = extractedInfo?.audioFormats.find(
                  (a) => a.bitrateKbps === kbps
                );
                return (
                  <button
                    key={kbps}
                    type="button"
                    onClick={() => onSelectBitrate(kbps)}
                    className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-center transition-colors cursor-pointer ${
                      isSelected
                        ? 'text-white border-transparent'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: 'var(--accent-primary)' }
                        : undefined
                    }
                  >
                    <span className="font-mono text-xs font-bold tabular-nums">
                      MP3 · {kbps} kbps
                    </span>
                    <span
                      className={`mt-0.5 text-[10px] tabular-nums ${
                        isSelected ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {matchedAudio?.sizeBytes
                        ? formatBytes(matchedAudio.sizeBytes)
                        : kbps >= 256
                          ? isRtl
                            ? 'جودة استوديو'
                            : 'Studio'
                          : isRtl
                            ? 'قياسي'
                            : 'Standard'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Extracted Media Preview Card */}
        {extractedInfo && (
          <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4">
            <div className="relative h-36 sm:min-h-[120px] sm:w-52 shrink-0 overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
              {extractedInfo.thumbnail && !thumbError ? (
                <Image
                  src={extractedInfo.thumbnail}
                  alt={extractedInfo.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 208px"
                  referrerPolicy="no-referrer"
                  onError={() => setThumbError(true)}
                  className="object-cover"
                />
              ) : (
                <Film className="h-9 w-9 text-slate-400" />
              )}
            </div>

            <div className="flex flex-1 flex-col justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">
                  {extractedInfo.title}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{extractedInfo.author}</span>
                  <span aria-hidden="true">·</span>
                  <span className="uppercase font-mono">{extractedInfo.platform}</span>
                  {extractedInfo.durationSeconds > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatDuration(extractedInfo.durationSeconds)}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{extractedInfo.extractorUsed}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span>
                  {extractedInfo.videoFormats.length > 0
                    ? `${extractedInfo.videoFormats[0].qualityLabel} → ${
                        extractedInfo.videoFormats[extractedInfo.videoFormats.length - 1]
                          .qualityLabel
                      }`
                    : 'Audio'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Primary Bottom Download CTA */}
        <div className="mt-6">
          <button
            type="button"
            disabled={!urlInput.trim() || isExtracting}
            onClick={() => onStartDownload(extractedInfo, urlInput.trim())}
            className="flex w-full min-h-[52px] items-center justify-center gap-2.5 rounded-xl px-6 py-3 text-base font-bold text-white shadow-sm transition-opacity disabled:opacity-45 cursor-pointer"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            {isExtracting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : mediaType === 'video' ? (
              <Download className="h-5 w-5" />
            ) : (
              <Music className="h-5 w-5" />
            )}
            <span>
              {mediaType === 'video'
                ? `${t.downloadVideoBtn} (${
                    selectedQuality === '2160p' ? '4K' : selectedQuality
                  })`
                : `${t.downloadAudioBtn} (${selectedBitrate} kbps)`}
            </span>
          </button>
        </div>
      </section>

      {/* Active Downloads Queue */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t.activeQueue}
          </h2>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {activeTasks.length}
          </span>
        </div>

        {activeTasks.length === 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
            <Sparkles className="h-4.5 w-4.5 shrink-0" />
            <span>{t.noActiveDownloads}</span>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {activeTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {task.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span className="uppercase font-mono">{task.ext}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{task.qualityLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {formatBytes(task.downloadedBytes)}
                        {task.totalBytes > 0 ? ` / ${formatBytes(task.totalBytes)}` : ''}
                      </span>
                      {task.speedBps > 0 && task.status === 'downloading' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">
                            {formatBytes(task.speedBps)}/s
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {(task.status === 'downloading' ||
                    task.status === 'queued' ||
                    task.status === 'converting') && (
                    <button
                      type="button"
                      onClick={() => onCancelTask(task.id)}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-red-500/10 hover:text-red-500 cursor-pointer"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>{t.cancel}</span>
                    </button>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={`h-full transition-all duration-150 ${
                        task.status === 'failed'
                          ? 'bg-red-500'
                          : task.status === 'completed'
                            ? 'bg-emerald-500'
                            : ''
                      }`}
                      style={{
                        width: `${Math.max(4, task.progress)}%`,
                        backgroundColor:
                          task.status === 'downloading' ||
                          task.status === 'converting' ||
                          task.status === 'queued'
                            ? 'var(--accent-primary)'
                            : undefined,
                      }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {task.status === 'converting'
                        ? task.mediaType === 'audio'
                          ? t.convertingMp3
                          : t.muxingVideo
                        : task.status === 'failed'
                          ? task.error || 'Error'
                          : task.status}
                    </span>
                    <span className="font-mono tabular-nums">{task.progress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
