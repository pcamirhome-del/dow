'use client';

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import {
  Maximize2,
  Minimize2,
  Music,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { StoredFileItem } from '@/types/media';
import { formatBytes } from '@/lib/storage';

interface MediaPlayerProps {
  item: StoredFileItem;
  isRtl: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({
  item,
  isRtl,
  onClose,
  onNext,
  onPrevious,
}) => {
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const objectUrl = useMemo(() => URL.createObjectURL(item.blob), [item.blob]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(item.durationSeconds || 0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPiP, setIsPiP] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  const pipSupported = useSyncExternalStore(
    () => () => {},
    () =>
      typeof document !== 'undefined' &&
      'pictureInPictureEnabled' in document &&
      document.pictureInPictureEnabled,
    () => false
  );

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  // Wire Media Session API for Lock Screen & OS Notification Center controls
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const artworkUrl =
      item.thumbnail && item.thumbnail.startsWith('http')
        ? item.thumbnail
        : `${window.location.origin}/pwa-512x512.png`;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.name,
        artist: `${item.platform.toUpperCase()} · ${item.qualityLabel}`,
        album: 'SaveBox Local Vault',
        artwork: [
          { src: artworkUrl, sizes: '512x512', type: 'image/png' },
          { src: `${window.location.origin}/pwa-192x192.png`, sizes: '192x192', type: 'image/png' },
        ],
      });
    } catch {
      // ignore if browser restricts artwork URL format
    }

    const el = mediaRef.current;
    const setHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null
    ) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // unsupported action in this browser
      }
    };

    setHandler('play', () => {
      el?.play().catch(() => undefined);
    });
    setHandler('pause', () => {
      el?.pause();
    });
    setHandler('stop', () => {
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    });
    setHandler('seekbackward', (details) => {
      if (el) {
        el.currentTime = Math.max(0, el.currentTime - (details.seekOffset || 10));
      }
    });
    setHandler('seekforward', (details) => {
      if (el) {
        el.currentTime = Math.min(
          el.duration || Infinity,
          el.currentTime + (details.seekOffset || 10)
        );
      }
    });
    setHandler('seekto', (details) => {
      if (el && typeof details.seekTime === 'number') {
        el.currentTime = details.seekTime;
      }
    });
    setHandler('previoustrack', onPrevious ? () => onPrevious() : null);
    setHandler('nexttrack', onNext ? () => onNext() : null);

    return () => {
      setHandler('play', null);
      setHandler('pause', null);
      setHandler('stop', null);
      setHandler('seekbackward', null);
      setHandler('seekforward', null);
      setHandler('seekto', null);
      setHandler('previoustrack', null);
      setHandler('nexttrack', null);
    };
  }, [item, onNext, onPrevious]);

  // Update OS lock-screen playback position state
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    if (duration > 0 && 'setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate,
          position: Math.min(duration, Math.max(0, currentTime)),
        });
      } catch {
        // ignore invalid state
      }
    }
  }, [isPlaying, currentTime, duration, playbackRate]);

  // Listen to PiP & Fullscreen events
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;

    const onEnterPiP = () => setIsPiP(true);
    const onLeavePiP = () => setIsPiP(false);
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    el.addEventListener('enterpictureinpicture', onEnterPiP);
    el.addEventListener('leavepictureinpicture', onLeavePiP);
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      el.removeEventListener('enterpictureinpicture', onEnterPiP);
      el.removeEventListener('leavepictureinpicture', onLeavePiP);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, []);

  const togglePlay = async () => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) {
      await el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  };

  const skipBy = (delta: number) => {
    const el = mediaRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || duration, el.currentTime + delta));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(e.target.value);
    if (mediaRef.current) {
      mediaRef.current.currentTime = nextTime;
    }
    setCurrentTime(nextTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    setMuted(v === 0);
    if (mediaRef.current) {
      mediaRef.current.volume = v;
      mediaRef.current.muted = v === 0;
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (mediaRef.current) {
      mediaRef.current.muted = next;
    }
  };

  const cycleSpeed = () => {
    const rates = [0.5, 1, 1.25, 1.5, 2];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (mediaRef.current) {
      mediaRef.current.playbackRate = next;
    }
  };

  const togglePiP = async () => {
    const el = mediaRef.current as HTMLVideoElement | null;
    if (!el || item.mediaType !== 'video') return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (el.requestPictureInPicture) {
        await el.requestPictureInPicture();
      }
    } catch {
      // ignore if user/browser denies PiP
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6">
      <div
        ref={containerRef}
        className="w-full max-w-3xl overflow-hidden rounded-3xl border border-white/15 bg-slate-900/85 text-white shadow-2xl backdrop-blur-xl"
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm sm:text-base font-bold text-white">
              {item.name}
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400 tabular-nums">
              {item.ext.toUpperCase()} · {item.qualityLabel} · {formatBytes(item.sizeBytes)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/15 hover:text-white cursor-pointer"
            aria-label="Close media player"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Media Viewport */}
        {item.mediaType === 'video' ? (
          <div className="relative bg-black">
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={objectUrl}
              playsInline
              autoPlay
              onClick={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && d > 0) setDuration(d);
              }}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              className="max-h-[60vh] w-full cursor-pointer object-contain"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 px-6 py-8 bg-gradient-to-b from-slate-900/90 to-slate-950/90">
            <div className="relative flex h-44 w-44 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-slate-800/80 shadow-xl">
              {item.thumbnail && !thumbFailed ? (
                <Image
                  src={item.thumbnail}
                  alt={item.name}
                  fill
                  sizes="176px"
                  referrerPolicy="no-referrer"
                  onError={() => setThumbFailed(true)}
                  className="object-cover"
                />
              ) : (
                <Music className="h-16 w-16 text-sky-400" />
              )}
            </div>

            <div className="text-center max-w-md">
              <p className="text-base font-bold text-white line-clamp-2">{item.name}</p>
              <p className="mt-1 text-xs text-slate-400">
                {isRtl
                  ? 'التحكم من شاشة القفل وإشعارات النظام مفعل عبر Media Session'
                  : 'Lock Screen & OS Notification controls active via Media Session API'}
              </p>
            </div>

            <audio
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={objectUrl}
              autoPlay
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (Number.isFinite(d) && d > 0) setDuration(d);
              }}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onEnded={() => onNext?.()}
            />
          </div>
        )}

        {/* Glassmorphism Controls Deck */}
        <div className="space-y-3.5 border-t border-white/10 bg-slate-950/75 px-5 py-4 backdrop-blur-md">
          {/* Seek Bar */}
          <div className="flex items-center gap-3">
            <span className="w-12 font-mono text-xs text-slate-300 tabular-nums">
              {formatClock(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="h-1.5 flex-1 cursor-pointer accent-sky-400"
              aria-label="Seek position"
            />
            <span className="w-12 text-end font-mono text-xs text-slate-400 tabular-nums">
              {formatClock(duration)}
            </span>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Transport */}
            <div className="flex items-center gap-1.5">
              {onPrevious && (
                <button
                  type="button"
                  onClick={onPrevious}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
                  aria-label="Previous track"
                >
                  <SkipBack className="h-4.5 w-4.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => skipBy(-10)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
                title="-10s"
                aria-label="Rewind 10 seconds"
              >
                <RotateCcw className="h-4.5 w-4.5" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)' }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => skipBy(10)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
                title="+10s"
                aria-label="Forward 10 seconds"
              >
                <RotateCw className="h-4.5 w-4.5" />
              </button>

              {onNext && (
                <button
                  type="button"
                  onClick={onNext}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
                  aria-label="Next track"
                >
                  <SkipForward className="h-4.5 w-4.5" />
                </button>
              )}
            </div>

            {/* Volume, Speed, PiP, Fullscreen */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="text-slate-300 hover:text-white cursor-pointer"
                  aria-label="Toggle mute"
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 cursor-pointer accent-sky-400"
                  aria-label="Volume"
                />
              </div>

              <button
                type="button"
                onClick={cycleSpeed}
                className="min-h-[38px] rounded-xl border border-white/10 bg-white/5 px-3 font-mono text-xs font-semibold text-slate-200 hover:bg-white/15 tabular-nums cursor-pointer"
              >
                {playbackRate}x
              </button>

              {item.mediaType === 'video' && pipSupported && (
                <button
                  type="button"
                  onClick={togglePiP}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors cursor-pointer ${
                    isPiP
                      ? 'border-sky-400/60 bg-sky-500/20 text-sky-300'
                      : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/15'
                  }`}
                  title="Picture-in-Picture"
                >
                  <PictureInPicture2 className="h-4 w-4" />
                  <span className="hidden sm:inline">PiP</span>
                </button>
              )}

              {item.mediaType === 'video' && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:bg-white/15 cursor-pointer"
                  aria-label="Toggle fullscreen"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
