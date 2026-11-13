'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Fingerprint, Lock, Menu, X } from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  addHistoryRecord,
  clearAllHistory,
  deleteFileItem,
  getAllFiles,
  getAllHistory,
  loadSettings,
  saveFileItem,
  saveSettings,
  triggerBrowserDownload,
  writeBlobToDeviceFolder,
} from '@/lib/storage';
import { SUPPORTED_LANGUAGES, TRANSLATIONS } from '@/lib/i18n';
import { downloadWithStreamProgress } from '@/lib/stream-downloader';
import { muxVideoAndAudio, transcodeToMp3 } from '@/lib/ffmpeg-client';
import { playNotificationSound, sendSystemNotification } from '@/lib/sound';
import { hashPin, verifyTouchIdCredential } from '@/lib/biometric';
import {
  extractViaCobaltClient,
  isYouTubeBotError,
  resolveCobaltStreamUrl,
} from '@/lib/cobalt-client';
import type {
  ActiveDownloadTask,
  AppSettings,
  AudioBitratePreset,
  DownloadHistoryRecord,
  ExtractedMediaInfo,
  QualityPreset,
  SidebarSection,
  StoredFileItem,
} from '@/types/media';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { SidebarDrawer } from '@/components/SidebarDrawer';
import { LinksWorkspace } from '@/components/LinksWorkspace';
import { FilesExplorer } from '@/components/FilesExplorer';
import { LocalShare } from '@/components/LocalShare';
import { PwaUpdater } from '@/components/PwaUpdater';
import {
  isBackgroundFetchSupported,
  startBackgroundFetchDownload,
} from '@/lib/background-fetch';
import {
  AboutSection,
  AppearanceSection,
  DownloadsSettingsSection,
  GeneralSection,
  HistorySection,
  NotificationsSection,
  SecuritySection,
  SpeedTestSection,
} from '@/components/SettingsSections';

function qualityPresetToHeight(q: QualityPreset): number {
  return parseInt(q.replace('p', ''), 10) || 720;
}

export const SaveBoxApp: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SidebarSection>('links');

  // Lock screen state
  const [isLocked, setIsLocked] = useState(false);
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Links & Extraction state
  const [urlInput, setUrlInput] = useState('');
  const [extractedInfo, setExtractedInfo] = useState<ExtractedMediaInfo | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Active Downloads Queue & Local Storage Vault
  const [activeTasks, setActiveTasks] = useState<ActiveDownloadTask[]>([]);
  const [files, setFiles] = useState<StoredFileItem[]>([]);
  const [history, setHistory] = useState<DownloadHistoryRecord[]>([]);
  const [toastMsg, setToastMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const runningIdsRef = useRef<Set<string>>(new Set());
  const taskPayloadsRef = useRef<
    Map<
      string,
      {
        info: ExtractedMediaInfo;
        mediaType: 'video' | 'audio';
        quality: QualityPreset;
        bitrate: AudioBitratePreset;
      }
    >
  >(new Map());
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Initial load from IndexedDB
  useEffect(() => {
    (async () => {
      const [loadedSettings, loadedFiles, loadedHistory] = await Promise.all([
        loadSettings(),
        getAllFiles(),
        getAllHistory(),
      ]);
      setSettings(loadedSettings);
      settingsRef.current = loadedSettings;
      setFiles(loadedFiles);
      setHistory(loadedHistory);
      if (loadedSettings.touchIdEnabled) {
        setIsLocked(true);
      }
      setHydrated(true);
    })();
  }, []);

  // Sync UI state when Service Worker Background Fetch completes or fails
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onSwMessage = async (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; id?: string; title?: string; sizeBytes?: number; error?: string }
        | undefined;
      if (!data?.type) return;

      if (data.type === 'BG_FETCH_COMPLETED') {
        const [reloadedFiles, reloadedHistory] = await Promise.all([
          getAllFiles(),
          getAllHistory(),
        ]);
        setFiles(reloadedFiles);
        setHistory(reloadedHistory);
        if (data.id) {
          setActiveTasks((prev) =>
            prev.map((tItem) =>
              tItem.id === data.id
                ? {
                    ...tItem,
                    status: 'completed',
                    progress: 100,
                    downloadedBytes: data.sizeBytes || tItem.downloadedBytes,
                    totalBytes: data.sizeBytes || tItem.totalBytes,
                  }
                : tItem
            )
          );
          runningIdsRef.current.delete(data.id);
        }
        if (data.title) {
          setToastMsg({ text: data.title, kind: 'ok' });
        }
      } else if (data.type === 'BG_FETCH_FAILED') {
        const reloadedHistory = await getAllHistory();
        setHistory(reloadedHistory);
        if (data.id) {
          setActiveTasks((prev) =>
            prev.map((tItem) =>
              tItem.id === data.id
                ? { ...tItem, status: 'failed', error: data.error || 'Background fetch failed' }
                : tItem
            )
          );
          runningIdsRef.current.delete(data.id);
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onSwMessage);
    };
  }, []);

  const langMeta = useMemo(
    () =>
      SUPPORTED_LANGUAGES.find((l) => l.code === settings.language) ||
      SUPPORTED_LANGUAGES[0],
    [settings.language]
  );
  const isRtl = langMeta.dir === 'rtl';
  const t = TRANSLATIONS[settings.language] || TRANSLATIONS.ar;

  // Sync HTML dir, lang, theme, and dynamic colors
  useEffect(() => {
    const root = document.documentElement;
    root.dir = langMeta.dir;
    root.lang = langMeta.code;

    const applyTheme = () => {
      let useDark = true;
      if (settings.theme === 'light') {
        useDark = false;
      } else if (settings.theme === 'auto') {
        useDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } else if (settings.theme === 'dynamic') {
        const hour = new Date().getHours();
        useDark = hour < 6 || hour >= 18;
      }
      root.classList.toggle('dark', useDark);

      if (settings.theme === 'dynamic') {
        let accent = settings.dynamicAccent;
        if (accent === 'auto-time') {
          const hour = new Date().getHours();
          accent = hour >= 6 && hour < 12 ? 'emerald' : hour < 18 ? 'ocean' : 'amber';
        }
        root.setAttribute('data-accent', accent);
      } else {
        root.removeAttribute('data-accent');
      }
    };

    applyTheme();

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onMqChange = () => {
      if (settings.theme === 'auto') applyTheme();
    };
    mq.addEventListener('change', onMqChange);
    return () => mq.removeEventListener('change', onMqChange);
  }, [langMeta.dir, langMeta.code, settings.theme, settings.dynamicAccent]);

  const showToast = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    setToastMsg({ text, kind });
    setTimeout(() => {
      setToastMsg((curr) => (curr?.text === text ? null : curr));
    }, 4000);
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next).catch(() => undefined);
      return next;
    });
  }, []);

  const analyzeUrl = useCallback(
    async (urlOverride?: string): Promise<ExtractedMediaInfo | null> => {
      const targetUrl = (urlOverride ?? urlInput).trim();
      if (!targetUrl) return null;

      setIsExtracting(true);
      setExtractError(null);

      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl }),
        });
        const data = (await res.json()) as ExtractedMediaInfo & {
          error?: string;
          botBlocked?: boolean;
          fallbackRequired?: string;
          oembed?: { title?: string; author?: string; thumbnail?: string };
        };

        if (!res.ok) {
          // Silently intercept YouTube anti-bot / sign-in blockades and pivot
          // immediately to rotating Cobalt instances on the user's residential IP.
          if (
            data.botBlocked ||
            data.fallbackRequired === 'cobalt-client' ||
            isYouTubeBotError(data.error)
          ) {
            const fallbackInfo = await extractViaCobaltClient(targetUrl, data.oembed);
            setExtractedInfo(fallbackInfo);
            return fallbackInfo;
          }
          throw new Error(data.error || 'Could not extract media');
        }

        setExtractedInfo(data);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Extraction failed';
        if (isYouTubeBotError(msg)) {
          try {
            const fallbackInfo = await extractViaCobaltClient(targetUrl);
            setExtractedInfo(fallbackInfo);
            return fallbackInfo;
          } catch (cobaltErr) {
            const fallbackMsg =
              cobaltErr instanceof Error ? cobaltErr.message : msg;
            setExtractError(fallbackMsg);
            return null;
          }
        }
        setExtractError(msg);
        return null;
      } finally {
        setIsExtracting(false);
      }
    },
    [urlInput]
  );

  const updateTask = useCallback(
    (taskId: string, patch: Partial<ActiveDownloadTask>) => {
      setActiveTasks((prev) =>
        prev.map((item) => (item.id === taskId ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const notifyTransferResult = useCallback(
    (title: string, success: boolean, errorText?: string) => {
      const s = settingsRef.current;
      if (!s.notificationsEnabled) return;
      if (success && !s.notifyOnComplete) return;
      if (!success && !s.notifyOnFail) return;

      if (s.soundOrPushEnabled) {
        playNotificationSound(s.notificationSound);
        sendSystemNotification(
          success ? t.notifOnComplete : t.notifOnFail,
          success ? title : `${title} — ${errorText || ''}`
        );
      }
    },
    [t.notifOnComplete, t.notifOnFail]
  );

  const executeTask = useCallback(
    async (taskId: string) => {
      const payload = taskPayloadsRef.current.get(taskId);
      if (!payload) return;

      const controller = new AbortController();
      abortControllersRef.current.set(taskId, controller);

      const { info, mediaType, quality, bitrate } = payload;
      const safeTitle = info.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 80) || 'media';

      try {
        updateTask(taskId, { status: 'downloading', progress: 1 });

        let finalBlob: Blob;
        let finalExt: string;
        let finalMime: string;
        let qualityText: string;

        const isCobaltSource = info.extractorUsed.startsWith('cobalt');

        if (mediaType === 'audio') {
          const audioOption =
            info.audioFormats.find((a) => a.bitrateKbps === bitrate) ||
            info.audioFormats[0];
          if (!audioOption) {
            throw new Error('No audio stream available for this video');
          }

          let targetAudioUrl = audioOption.url;
          let usingCobaltStream = isCobaltSource || targetAudioUrl.startsWith('cobalt://');

          if (targetAudioUrl.startsWith('cobalt://')) {
            const resolved = await resolveCobaltStreamUrl({
              sourceUrl: info.sourceUrl,
              mode: 'audio',
              audioBitrate: bitrate,
            });
            targetAudioUrl = resolved.url;
            usingCobaltStream = true;
          }

          let audioStream: { blob: Blob; mimeType: string; totalBytes: number };
          try {
            audioStream = await downloadWithStreamProgress({
              mediaUrl: targetAudioUrl,
              filename: `${safeTitle}.${audioOption.ext || 'webm'}`,
              speedLimitKBps: settingsRef.current.speedLimitKBps,
              signal: controller.signal,
              tryDirectFirst: usingCobaltStream,
              onProgress: (p) =>
                updateTask(taskId, {
                  progress: Math.min(82, p.percent),
                  downloadedBytes: p.downloadedBytes,
                  totalBytes: p.totalBytes,
                  speedBps: p.speedBps,
                }),
            });
          } catch (streamErr) {
            const streamMsg = streamErr instanceof Error ? streamErr.message : '';
            if (!usingCobaltStream && isYouTubeBotError(streamMsg)) {
              const resolved = await resolveCobaltStreamUrl({
                sourceUrl: info.sourceUrl,
                mode: 'audio',
                audioBitrate: bitrate,
              });
              usingCobaltStream = true;
              audioStream = await downloadWithStreamProgress({
                mediaUrl: resolved.url,
                filename: `${safeTitle}.mp3`,
                speedLimitKBps: settingsRef.current.speedLimitKBps,
                signal: controller.signal,
                tryDirectFirst: true,
                onProgress: (p) =>
                  updateTask(taskId, {
                    progress: Math.min(82, p.percent),
                    downloadedBytes: p.downloadedBytes,
                    totalBytes: p.totalBytes,
                    speedBps: p.speedBps,
                  }),
              });
            } else {
              throw streamErr;
            }
          }

          if (
            usingCobaltStream &&
            (audioOption.acodec === 'mp3' || audioStream.mimeType.includes('mpeg'))
          ) {
            // Cobalt delivers ready-to-play MP3 at the requested bitrate
            finalBlob = audioStream.blob;
            finalExt = 'mp3';
            finalMime = 'audio/mpeg';
          } else {
            updateTask(taskId, { status: 'converting', progress: 85 });

            try {
              const srcExt = audioStream.mimeType.includes('mp4')
                ? 'm4a'
                : audioStream.mimeType.includes('mpeg')
                  ? 'mp3'
                  : 'webm';
              finalBlob = await transcodeToMp3(
                audioStream.blob,
                srcExt,
                bitrate,
                (ratio) =>
                  updateTask(taskId, {
                    progress: Math.min(99, 85 + Math.round(ratio * 14)),
                  })
              );
              finalExt = 'mp3';
              finalMime = 'audio/mpeg';
            } catch {
              // Fallback to native audio container if WebAssembly FFmpeg cannot load offline
              finalBlob = audioStream.blob;
              finalExt = audioStream.mimeType.includes('mp4') ? 'm4a' : 'webm';
              finalMime = audioStream.mimeType;
            }
          }
          qualityText = `${bitrate} kbps`;
        } else {
          const targetHeight = qualityPresetToHeight(quality);
          const sortedVideos = [...info.videoFormats].sort((a, b) => a.height - b.height);
          if (sortedVideos.length === 0) {
            throw new Error('No video stream available');
          }

          // Pick exact or nearest available resolution
          let chosen = sortedVideos.find((v) => v.height === targetHeight);
          if (!chosen) {
            chosen =
              sortedVideos.find((v) => v.height >= targetHeight) ||
              sortedVideos[sortedVideos.length - 1];
          }

          let targetVideoUrl = chosen.url;
          let usingCobaltStream = isCobaltSource || targetVideoUrl.startsWith('cobalt://');

          if (targetVideoUrl.startsWith('cobalt://')) {
            const resolved = await resolveCobaltStreamUrl({
              sourceUrl: info.sourceUrl,
              mode: 'video',
              videoQuality: String(chosen.height),
            });
            targetVideoUrl = resolved.url;
            usingCobaltStream = true;
          }

          // Hand off large progressive server downloads to Background Fetch API in Service Worker
          // when supported and no client-side speed limit / muxing / residential tunnel is required
          if (
            !usingCobaltStream &&
            isBackgroundFetchSupported() &&
            settingsRef.current.speedLimitKBps === 0 &&
            !chosen.needsMux
          ) {
            const bgFilename = `${safeTitle}-${chosen.qualityLabel.replace(/\s+/g, '')}.${chosen.ext}`;
            const bgReg = await startBackgroundFetchDownload({
              job: {
                id: taskId,
                title: info.title,
                sourceUrl: info.sourceUrl,
                platform: info.platform,
                mediaType: 'video',
                qualityLabel: chosen.qualityLabel,
                ext: chosen.ext,
                mimeType: chosen.ext === 'webm' ? 'video/webm' : 'video/mp4',
                durationSeconds: info.durationSeconds,
                thumbnail: info.thumbnail,
                createdAt: Date.now(),
              },
              mediaUrl: targetVideoUrl,
              filename: bgFilename,
              downloadTotalBytes: chosen.sizeBytes,
              onProgress: (downloaded, total) => {
                const pct =
                  total > 0 ? Math.min(99, Math.round((downloaded / total) * 100)) : 50;
                updateTask(taskId, {
                  status: 'downloading',
                  downloadedBytes: downloaded,
                  totalBytes: total,
                  progress: pct,
                });
              },
            });

            if (bgReg) {
              abortControllersRef.current.delete(taskId);
              taskPayloadsRef.current.delete(taskId);
              return;
            }
          }

          let videoStream: { blob: Blob; mimeType: string; totalBytes: number };
          try {
            videoStream = await downloadWithStreamProgress({
              mediaUrl: targetVideoUrl,
              filename: `${safeTitle}.${chosen.ext}`,
              speedLimitKBps: settingsRef.current.speedLimitKBps,
              signal: controller.signal,
              tryDirectFirst: usingCobaltStream,
              onProgress: (p) =>
                updateTask(taskId, {
                  progress: chosen.needsMux ? Math.min(65, Math.round(p.percent * 0.65)) : p.percent,
                  downloadedBytes: p.downloadedBytes,
                  totalBytes: p.totalBytes,
                  speedBps: p.speedBps,
                }),
            });
          } catch (streamErr) {
            const streamMsg = streamErr instanceof Error ? streamErr.message : '';
            if (!usingCobaltStream && isYouTubeBotError(streamMsg)) {
              const resolved = await resolveCobaltStreamUrl({
                sourceUrl: info.sourceUrl,
                mode: 'video',
                videoQuality: String(chosen.height),
              });
              usingCobaltStream = true;
              videoStream = await downloadWithStreamProgress({
                mediaUrl: resolved.url,
                filename: `${safeTitle}.mp4`,
                speedLimitKBps: settingsRef.current.speedLimitKBps,
                signal: controller.signal,
                tryDirectFirst: true,
                onProgress: (p) =>
                  updateTask(taskId, {
                    progress: p.percent,
                    downloadedBytes: p.downloadedBytes,
                    totalBytes: p.totalBytes,
                    speedBps: p.speedBps,
                  }),
              });
            } else {
              throw streamErr;
            }
          }

          if (!usingCobaltStream && chosen.needsMux && chosen.audioUrl) {
            const audioStream = await downloadWithStreamProgress({
              mediaUrl: chosen.audioUrl,
              filename: `${safeTitle}-audio.m4a`,
              speedLimitKBps: settingsRef.current.speedLimitKBps,
              signal: controller.signal,
              onProgress: (p) =>
                updateTask(taskId, {
                  progress: Math.min(88, 65 + Math.round(p.percent * 0.23)),
                  speedBps: p.speedBps,
                }),
            });

            updateTask(taskId, { status: 'converting', progress: 90 });

            try {
              const aExt = audioStream.mimeType.includes('webm') ? 'webm' : 'm4a';
              finalBlob = await muxVideoAndAudio(
                videoStream.blob,
                audioStream.blob,
                chosen.ext,
                aExt,
                (ratio) =>
                  updateTask(taskId, {
                    progress: Math.min(99, 90 + Math.round(ratio * 9)),
                  })
              );
              finalExt = 'mp4';
              finalMime = 'video/mp4';
            } catch {
              finalBlob = videoStream.blob;
              finalExt = chosen.ext;
              finalMime = videoStream.mimeType;
            }
          } else {
            finalBlob = videoStream.blob;
            finalExt = usingCobaltStream ? 'mp4' : chosen.ext;
            finalMime = videoStream.mimeType;
          }
          qualityText = chosen.qualityLabel;
        }

        // Route automatically to chosen folder's video/ or audio/ subfolder if configured
        const fullFilename = `${safeTitle}-${qualityText.replace(/\s+/g, '')}.${finalExt}`;
        const diskPath = await writeBlobToDeviceFolder(mediaType, fullFilename, finalBlob);
        if (!diskPath) {
          triggerBrowserDownload(finalBlob, fullFilename);
        }

        // Persist in IndexedDB local vault
        const fileItem: StoredFileItem = {
          id: taskId,
          name: `${safeTitle} (${qualityText})`,
          mediaType,
          folder: mediaType,
          ext: finalExt,
          mimeType: finalMime,
          qualityLabel: qualityText,
          platform: info.platform,
          sourceUrl: info.sourceUrl,
          sizeBytes: finalBlob.size,
          durationSeconds: info.durationSeconds,
          tags: [info.platform, qualityText],
          hidden: false,
          createdAt: Date.now(),
          blob: finalBlob,
          thumbnail: info.thumbnail || undefined,
          savedToDiskPath: diskPath || undefined,
        };
        await saveFileItem(fileItem);
        setFiles((prev) => [fileItem, ...prev]);

        const historyRec: DownloadHistoryRecord = {
          id: taskId,
          title: info.title,
          sourceUrl: info.sourceUrl,
          platform: info.platform,
          mediaType,
          qualityLabel: qualityText,
          ext: finalExt,
          sizeBytes: finalBlob.size,
          status: 'completed',
          createdAt: Date.now(),
        };
        await addHistoryRecord(historyRec);
        setHistory((prev) => [historyRec, ...prev]);

        updateTask(taskId, {
          status: 'completed',
          progress: 100,
          downloadedBytes: finalBlob.size,
          totalBytes: finalBlob.size,
        });
        notifyTransferResult(info.title, true);
        showToast(
          diskPath
            ? `${t.notifOnComplete}: ${diskPath}`
            : `${t.notifOnComplete}: ${fullFilename}`,
          'ok'
        );
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        const message = isAbort
          ? t.cancel
          : err instanceof Error
            ? err.message
            : 'Download failed';

        updateTask(taskId, {
          status: isAbort ? 'cancelled' : 'failed',
          error: message,
        });

        if (!isAbort) {
          const failRec: DownloadHistoryRecord = {
            id: taskId,
            title: info.title,
            sourceUrl: info.sourceUrl,
            platform: info.platform,
            mediaType,
            qualityLabel:
              mediaType === 'audio' ? `${bitrate} kbps` : quality,
            ext: mediaType === 'audio' ? 'mp3' : 'mp4',
            sizeBytes: 0,
            status: 'failed',
            createdAt: Date.now(),
          };
          await addHistoryRecord(failRec);
          setHistory((prev) => [failRec, ...prev]);
          notifyTransferResult(info.title, false, message);
          showToast(message, 'err');
        }
      } finally {
        abortControllersRef.current.delete(taskId);
        runningIdsRef.current.delete(taskId);
        taskPayloadsRef.current.delete(taskId);
      }
    },
    [notifyTransferResult, showToast, t.cancel, t.notifOnComplete, updateTask]
  );

  // Queue Scheduler enforcing user's concurrentLimit (1..10, default 2)
  useEffect(() => {
    const queued = activeTasks.filter((task) => task.status === 'queued');
    if (queued.length === 0) return;

    const runningCount = runningIdsRef.current.size;
    const availableSlots = Math.max(0, settings.concurrentLimit - runningCount);
    if (availableSlots <= 0) return;

    queued.slice(0, availableSlots).forEach((task) => {
      if (!runningIdsRef.current.has(task.id)) {
        runningIdsRef.current.add(task.id);
        executeTask(task.id);
      }
    });
  }, [activeTasks, settings.concurrentLimit, executeTask]);

  const handleStartDownload = useCallback(
    async (infoOverride?: ExtractedMediaInfo | null, overrideUrl?: string) => {
      const targetUrl = (overrideUrl ?? urlInput).trim();
      let mediaInfo = infoOverride ?? extractedInfo;

      if (!mediaInfo || mediaInfo.sourceUrl !== targetUrl) {
        mediaInfo = await analyzeUrl(targetUrl);
      }
      if (!mediaInfo) return;

      const taskId = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newTask: ActiveDownloadTask = {
        id: taskId,
        title: mediaInfo.title,
        sourceUrl: mediaInfo.sourceUrl,
        platform: mediaInfo.platform,
        mediaType: settings.defaultMediaType,
        qualityLabel:
          settings.defaultMediaType === 'audio'
            ? `${settings.defaultAudioBitrate} kbps`
            : settings.defaultVideoQuality === '2160p'
              ? '4K'
              : settings.defaultVideoQuality,
        ext: settings.defaultMediaType === 'audio' ? 'mp3' : 'mp4',
        thumbnail: mediaInfo.thumbnail,
        status: 'queued',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speedBps: 0,
        createdAt: Date.now(),
      };

      taskPayloadsRef.current.set(taskId, {
        info: mediaInfo,
        mediaType: settings.defaultMediaType,
        quality: settings.defaultVideoQuality,
        bitrate: settings.defaultAudioBitrate,
      });

      setActiveTasks((prev) => [newTask, ...prev]);
    },
    [
      analyzeUrl,
      extractedInfo,
      settings.defaultAudioBitrate,
      settings.defaultMediaType,
      settings.defaultVideoQuality,
      urlInput,
    ]
  );

  const handleCancelTask = (taskId: string) => {
    const controller = abortControllersRef.current.get(taskId);
    if (controller) {
      controller.abort();
    } else {
      updateTask(taskId, { status: 'cancelled' });
    }
  };

  const handleUnlock = async () => {
    setUnlockError(null);
    if (settings.touchIdCredentialId) {
      const ok = await verifyTouchIdCredential(settings.touchIdCredentialId);
      if (ok) {
        setIsLocked(false);
        return;
      }
    }
    if (settings.pinHash && unlockPin.trim()) {
      const digest = await hashPin(unlockPin.trim());
      if (digest === settings.pinHash) {
        setUnlockPin('');
        setIsLocked(false);
        return;
      }
    }
    setUnlockError(
      isRtl ? 'تعذر التحقق — حاول مرة أخرى' : 'Verification failed — try again'
    );
  };

  const handleDeleteFile = async (id: string) => {
    await deleteFileItem(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleToggleHidden = async (id: string) => {
    const target = files.find((f) => f.id === id);
    if (!target) return;
    const updated: StoredFileItem = { ...target, hidden: !target.hidden };
    await saveFileItem(updated);
    setFiles((prev) => prev.map((f) => (f.id === id ? updated : f)));
  };

  const handleAddTag = async (id: string, tag: string) => {
    const target = files.find((f) => f.id === id);
    if (!target) return;
    const tags = Array.from(new Set([...target.tags, tag]));
    const updated: StoredFileItem = { ...target, tags };
    await saveFileItem(updated);
    setFiles((prev) => prev.map((f) => (f.id === id ? updated : f)));
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090D16]" />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-[#090D16] dark:text-slate-100">
      {/* Touch ID Lock Screen Overlay */}
      {isLocked && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-6">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-7 text-center shadow-2xl space-y-5">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              <Fingerprint className="h-9 w-9" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t.lockedTitle}</h2>
              <p className="mt-1.5 text-sm text-slate-400">{t.lockedSubtitle}</p>
            </div>

            {settings.pinHash && (
              <input
                type="password"
                inputMode="numeric"
                value={unlockPin}
                onChange={(e) => setUnlockPin(e.target.value)}
                placeholder="PIN"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center font-mono text-base tracking-widest text-white"
              />
            )}

            {unlockError && (
              <p className="text-xs font-medium text-red-400">{unlockError}</p>
            )}

            <button
              type="button"
              onClick={handleUnlock}
              className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white cursor-pointer"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              <Fingerprint className="h-5 w-5" />
              <span>{t.unlockBtn}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#090D16]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 py-3">
          {/* Zone 1: Menu Trigger + Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Open sidebar menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('links')}
              className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.appName}
            </button>
          </div>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            {(
              [
                { id: 'links', label: t.navLinks },
                { id: 'files', label: t.navFiles },
                {
                  id: 'localshare',
                  label: isRtl ? 'مشاركة P2P' : 'Local Share',
                },
                { id: 'speedtest', label: t.navSpeedTest },
                { id: 'history', label: t.navHistory },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                  activeSection === item.id
                    ? 'font-semibold text-slate-950 dark:text-white underline underline-offset-8 decoration-2'
                    : 'hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single Primary Action (Install PWA or Lock if Touch ID enabled) */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton label={t.installApp} isRtl={isRtl} />
            {settings.touchIdEnabled && (
              <button
                type="button"
                onClick={() => setIsLocked(true)}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title={t.lockBtn}
                aria-label={t.lockBtn}
              >
                <Lock className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 py-6 sm:py-8">
        {activeSection === 'links' && (
          <LinksWorkspace
            t={t}
            isRtl={isRtl}
            urlInput={urlInput}
            onUrlChange={setUrlInput}
            mediaType={settings.defaultMediaType}
            onMediaTypeChange={(mediaType) => updateSettings({ defaultMediaType: mediaType })}
            selectedQuality={settings.defaultVideoQuality}
            onSelectQuality={(defaultVideoQuality) =>
              updateSettings({ defaultVideoQuality })
            }
            selectedBitrate={settings.defaultAudioBitrate}
            onSelectBitrate={(defaultAudioBitrate) =>
              updateSettings({ defaultAudioBitrate })
            }
            extractedInfo={extractedInfo}
            isExtracting={isExtracting}
            extractError={extractError}
            onAnalyze={analyzeUrl}
            onStartDownload={handleStartDownload}
            activeTasks={activeTasks}
            onCancelTask={handleCancelTask}
            directDownloadEnabled={settings.directDownload}
          />
        )}

        {activeSection === 'files' && (
          <FilesExplorer
            t={t}
            isRtl={isRtl}
            files={files}
            onDeleteFile={handleDeleteFile}
            onToggleHidden={handleToggleHidden}
            onAddTag={handleAddTag}
          />
        )}

        {activeSection === 'localshare' && (
          <LocalShare
            files={files}
            isRtl={isRtl}
            onFileReceived={(newItem) => {
              setFiles((prev) => [newItem, ...prev]);
            }}
          />
        )}

        {activeSection === 'security' && (
          <SecuritySection
            t={t}
            isRtl={isRtl}
            settings={settings}
            onUpdateSettings={updateSettings}
            onLockApp={() => setIsLocked(true)}
          />
        )}

        {activeSection === 'general' && (
          <GeneralSection
            t={t}
            language={settings.language}
            onChangeLanguage={(language) => updateSettings({ language })}
          />
        )}

        {activeSection === 'downloads' && (
          <DownloadsSettingsSection
            t={t}
            isRtl={isRtl}
            settings={settings}
            onUpdateSettings={updateSettings}
          />
        )}

        {activeSection === 'notifications' && (
          <NotificationsSection
            t={t}
            settings={settings}
            onUpdateSettings={updateSettings}
          />
        )}

        {activeSection === 'appearance' && (
          <AppearanceSection
            t={t}
            isRtl={isRtl}
            settings={settings}
            onUpdateSettings={updateSettings}
          />
        )}

        {activeSection === 'speedtest' && <SpeedTestSection t={t} />}

        {activeSection === 'history' && (
          <HistorySection
            t={t}
            history={history}
            onClearHistory={async () => {
              await clearAllHistory();
              setHistory([]);
            }}
          />
        )}

        {activeSection === 'about' && <AboutSection t={t} isRtl={isRtl} />}
      </main>

      {/* Sidebar Drawer */}
      <SidebarDrawer
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        t={t}
        isRtl={isRtl}
        touchIdEnabled={settings.touchIdEnabled}
        onEnableTouchId={() => {
          setSidebarOpen(false);
          setActiveSection('security');
        }}
        onLockApp={() => setIsLocked(true)}
      />

      {/* Toast Feedback */}
      {toastMsg && (
        <div
          className={`fixed bottom-4 end-4 z-50 flex max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-xl ${
            toastMsg.kind === 'err' ? 'bg-red-600' : 'bg-slate-900 dark:bg-slate-800 border border-slate-700'
          }`}
        >
          <span className="flex-1">{toastMsg.text}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-white/70 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <PwaUpdater isRtl={isRtl} />
      <OfflineIndicator message={t.offlineBanner} />
    </div>
  );
};
