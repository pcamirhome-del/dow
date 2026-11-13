'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Eye,
  EyeOff,
  Film,
  Folder,
  LayoutGrid,
  List,
  Menu,
  Music,
  Play,
  Share2,
  Tag,
  Trash2,
} from 'lucide-react';
import type { FileSortField, FileViewMode, StoredFileItem } from '@/types/media';
import type { TranslationStrings } from '@/lib/i18n';
import { formatBytes, triggerBrowserDownload } from '@/lib/storage';
import { MediaPlayer } from '@/components/MediaPlayer';

interface FilesExplorerProps {
  t: TranslationStrings;
  isRtl: boolean;
  files: StoredFileItem[];
  onDeleteFile: (id: string) => Promise<void>;
  onToggleHidden: (id: string) => Promise<void>;
  onAddTag: (id: string, tag: string) => Promise<void>;
}

export const FilesExplorer: React.FC<FilesExplorerProps> = ({
  t,
  isRtl,
  files,
  onDeleteFile,
  onToggleHidden,
  onAddTag,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<FileViewMode>('files');
  const [showHidden, setShowHidden] = useState(false);
  const [sortField, setSortField] = useState<FileSortField>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [activeFolder, setActiveFolder] = useState<'all' | 'video' | 'audio'>('all');
  const [playingItem, setPlayingItem] = useState<StoredFileItem | null>(null);
  const [taggingId, setTaggingId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');

  const filteredAndSorted = useMemo(() => {
    const visible = files.filter((item) => {
      if (!showHidden && item.hidden) return false;
      if (viewMode === 'folders' && activeFolder !== 'all' && item.folder !== activeFolder) {
        return false;
      }
      return true;
    });

    const sorted = [...visible].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'type') {
        cmp = a.ext.localeCompare(b.ext) || a.mediaType.localeCompare(b.mediaType);
      } else if (sortField === 'date') {
        cmp = a.createdAt - b.createdAt;
      } else if (sortField === 'size') {
        cmp = a.sizeBytes - b.sizeBytes;
      } else if (sortField === 'tags') {
        cmp = (a.tags[0] || '').localeCompare(b.tags[0] || '');
      }
      return sortAsc ? cmp : -cmp;
    });

    return sorted;
  }, [files, showHidden, viewMode, activeFolder, sortField, sortAsc]);

  const videoCount = files.filter((f) => f.folder === 'video' && (showHidden || !f.hidden)).length;
  const audioCount = files.filter((f) => f.folder === 'audio' && (showHidden || !f.hidden)).length;

  const openPlayer = (item: StoredFileItem) => {
    setPlayingItem(item);
  };

  const closePlayer = () => {
    setPlayingItem(null);
  };

  const playingIndex = playingItem
    ? filteredAndSorted.findIndex((f) => f.id === playingItem.id)
    : -1;

  const handleNextTrack =
    playingIndex >= 0 && filteredAndSorted.length > 1
      ? () => {
          const next = filteredAndSorted[(playingIndex + 1) % filteredAndSorted.length];
          setPlayingItem(next);
        }
      : undefined;

  const handlePrevTrack =
    playingIndex >= 0 && filteredAndSorted.length > 1
      ? () => {
          const prevIdx =
            (playingIndex - 1 + filteredAndSorted.length) % filteredAndSorted.length;
          setPlayingItem(filteredAndSorted[prevIdx]);
        }
      : undefined;

  const handleShare = async (item: StoredFileItem) => {
    try {
      const file = new File([item.blob], `${item.name}.${item.ext}`, {
        type: item.mimeType || (item.mediaType === 'video' ? 'video/mp4' : 'audio/mpeg'),
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: item.name,
          files: [file],
        });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: item.name, url: item.sourceUrl });
        return;
      }
    } catch {
      // User cancelled share or unsupported
    }
    triggerBrowserDownload(item.blob, `${item.name}.${item.ext}`);
  };

  return (
    <div className="space-y-5">
      {/* Header with 3-bar (3 شرط) Menu Dropdown */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-5 py-4">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">
            {t.filesTitle}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {filteredAndSorted.length} {isRtl ? 'عنصر' : 'items'}
          </p>
        </div>

        {/* 3-line Menu Dropdown Trigger */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Files view and sort menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className={`absolute top-12 z-40 w-64 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shadow-xl ${
                  isRtl ? 'left-0' : 'right-0'
                }`}
              >
                {/* View modes: Files / Folders / List */}
                <div className="space-y-0.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                  {(
                    [
                      { id: 'files', label: t.viewFiles, icon: LayoutGrid },
                      { id: 'folders', label: t.viewFolders, icon: Folder },
                      { id: 'list', label: t.viewList, icon: List },
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setViewMode(opt.id);
                          if (opt.id !== 'folders') setActiveFolder('all');
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4" />
                          <span>{opt.label}</span>
                        </span>
                        {viewMode === opt.id && (
                          <Check className="h-4 w-4" style={{ color: 'var(--accent-text)' }} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Show Hidden Items */}
                <div className="border-b border-slate-200 dark:border-slate-800 py-2">
                  <button
                    type="button"
                    onClick={() => setShowHidden((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      {showHidden ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                      <span>{t.showHidden}</span>
                    </span>
                    {showHidden && (
                      <Check className="h-4 w-4" style={{ color: 'var(--accent-text)' }} />
                    )}
                  </button>
                </div>

                {/* Sort Fields: Name, Type, Date, Size, Tags */}
                <div className="space-y-0.5 border-b border-slate-200 dark:border-slate-800 py-2">
                  {(
                    [
                      { id: 'name', label: t.sortByName },
                      { id: 'type', label: t.sortByType },
                      { id: 'date', label: t.sortByDate },
                      { id: 'size', label: t.sortBySize },
                      { id: 'tags', label: t.sortByTags },
                    ] as const
                  ).map((sf) => (
                    <button
                      key={sf.id}
                      type="button"
                      onClick={() => setSortField(sf.id)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <span>{sf.label}</span>
                      {sortField === sf.id && (
                        <Check className="h-4 w-4" style={{ color: 'var(--accent-text)' }} />
                      )}
                    </button>
                  ))}
                </div>

                {/* Ascending / Descending Toggle */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setSortAsc((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      {sortAsc ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4" />
                      )}
                      <span>{sortAsc ? t.sortAscending : t.sortDescending}</span>
                    </span>
                    <Check
                      className={`h-4 w-4 ${sortAsc ? 'opacity-100' : 'opacity-25'}`}
                      style={{ color: 'var(--accent-text)' }}
                    />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Folder Cards when Folders view is active */}
      {viewMode === 'folders' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setActiveFolder('all')}
            className={`flex items-center justify-between rounded-2xl border p-4 text-start transition-colors cursor-pointer ${
              activeFolder === 'all'
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Folder className="h-6 w-6 text-sky-500" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {t.viewFiles}
                </p>
                <p className="text-xs text-slate-500 tabular-nums">
                  {videoCount + audioCount}
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveFolder('video')}
            className={`flex items-center justify-between rounded-2xl border p-4 text-start transition-colors cursor-pointer ${
              activeFolder === 'video'
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Film className="h-6 w-6 text-indigo-500" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {t.videoFolder}
                </p>
                <p className="text-xs text-slate-500 tabular-nums">{videoCount}</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveFolder('audio')}
            className={`flex items-center justify-between rounded-2xl border p-4 text-start transition-colors cursor-pointer ${
              activeFolder === 'audio'
                ? 'border-sky-500 bg-sky-500/10'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Music className="h-6 w-6 text-emerald-500" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {t.audioFolder}
                </p>
                <p className="text-xs text-slate-500 tabular-nums">{audioCount}</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Files Content */}
      {filteredAndSorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-[#111827] px-6 py-14 text-center text-sm text-slate-500 dark:text-slate-400">
          {t.emptyFiles}
        </div>
      ) : (
        <div
          className={
            viewMode === 'list'
              ? 'divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]'
              : 'grid grid-cols-1 md:grid-cols-2 gap-4'
          }
        >
          {filteredAndSorted.map((item) => (
            <div
              key={item.id}
              className={
                viewMode === 'list'
                  ? 'flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                  : 'flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4'
              }
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  {item.mediaType === 'video' ? (
                    <Film className="h-5 w-5" />
                  ) : (
                    <Music className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {item.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span className="font-mono uppercase">{item.ext}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{item.qualityLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatBytes(item.sizeBytes)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    {item.hidden && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{isRtl ? 'مخفي' : 'Hidden'}</span>
                      </>
                    )}
                  </div>
                  {item.tags.length > 0 && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {item.tags.map((tg) => `#${tg}`).join(' · ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openPlayer(item)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>{t.playMedia}</span>
                </button>

                <button
                  type="button"
                  onClick={() => triggerBrowserDownload(item.blob, `${item.name}.${item.ext}`)}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title={t.saveToDevice}
                >
                  <Download className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleShare(item)}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title={t.shareMedia}
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTaggingId(taggingId === item.id ? null : item.id);
                    setTagDraft('');
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title={t.addTag}
                >
                  <Tag className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onToggleHidden(item.id)}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title={t.toggleHide}
                >
                  {item.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteFile(item.id)}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/50 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
                  title={t.deleteMedia}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {taggingId === item.id && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!tagDraft.trim()) return;
                    await onAddTag(item.id, tagDraft.trim());
                    setTagDraft('');
                    setTaggingId(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2"
                >
                  <input
                    type="text"
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    placeholder={t.addTag}
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                  >
                    {t.confirmOk}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Built-in Media Player (PiP + Media Session API) */}
      {playingItem && (
        <MediaPlayer
          key={playingItem.id}
          item={playingItem}
          isRtl={isRtl}
          onClose={closePlayer}
          onNext={handleNextTrack}
          onPrevious={handlePrevTrack}
        />
      )}
    </div>
  );
};
