'use client';

import type { BackgroundFetchJobMeta } from '@/types/media';
import { deleteBgJobMeta, saveBgJobMeta } from '@/lib/storage';

export interface BackgroundFetchRegistrationLike extends EventTarget {
  readonly id: string;
  readonly uploadTotal: number;
  readonly uploaded: number;
  readonly downloadTotal: number;
  readonly downloaded: number;
  readonly result: '' | 'success' | 'failure';
  readonly failureReason: string;
  abort(): Promise<boolean>;
}

interface BackgroundFetchManagerLike {
  fetch(
    id: string,
    requests: RequestInfo | RequestInfo[],
    options?: {
      title?: string;
      icons?: Array<{ src: string; sizes?: string; type?: string }>;
      downloadTotal?: number;
    }
  ): Promise<BackgroundFetchRegistrationLike>;
  get(id: string): Promise<BackgroundFetchRegistrationLike | undefined>;
  getIds(): Promise<string[]>;
}

export function isBackgroundFetchSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'BackgroundFetchManager' in window
  );
}

export async function startBackgroundFetchDownload(params: {
  job: BackgroundFetchJobMeta;
  mediaUrl: string;
  filename: string;
  downloadTotalBytes?: number;
  onProgress?: (downloaded: number, total: number) => void;
}): Promise<BackgroundFetchRegistrationLike | null> {
  if (!isBackgroundFetchSupported()) return null;

  const registration = await navigator.serviceWorker.ready;
  const bgFetch = (
    registration as ServiceWorkerRegistration & {
      backgroundFetch?: BackgroundFetchManagerLike;
    }
  ).backgroundFetch;

  if (!bgFetch) return null;

  await saveBgJobMeta(params.job);

  const streamUrl = `/api/stream?url=${encodeURIComponent(
    params.mediaUrl
  )}&filename=${encodeURIComponent(params.filename)}&limitKbps=0`;

  try {
    const bgReg = await bgFetch.fetch(params.job.id, [streamUrl], {
      title: params.job.title,
      icons: [
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
      ],
      downloadTotal: params.downloadTotalBytes || 0,
    });

    if (params.onProgress) {
      bgReg.addEventListener('progress', () => {
        params.onProgress?.(bgReg.downloaded, bgReg.downloadTotal);
      });
    }

    return bgReg;
  } catch {
    await deleteBgJobMeta(params.job.id);
    return null;
  }
}

export async function getActiveBackgroundFetchIds(): Promise<string[]> {
  if (!isBackgroundFetchSupported()) return [];
  try {
    const registration = await navigator.serviceWorker.ready;
    const bgFetch = (
      registration as ServiceWorkerRegistration & {
        backgroundFetch?: BackgroundFetchManagerLike;
      }
    ).backgroundFetch;
    if (!bgFetch) return [];
    return await bgFetch.getIds();
  } catch {
    return [];
  }
}
