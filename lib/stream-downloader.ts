import type { SpeedLimitKBps } from '@/types/media';

export interface StreamProgressPayload {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
  speedBps: number;
}

/**
 * Downloads a media stream via `/api/stream` using a real ReadableStream reader,
 * enforcing client-side byte-rate throttling when `speedLimitKBps > 0`.
 */
export async function downloadWithStreamProgress(params: {
  mediaUrl: string;
  filename: string;
  speedLimitKBps: SpeedLimitKBps;
  signal?: AbortSignal;
  tryDirectFirst?: boolean;
  onProgress: (info: StreamProgressPayload) => void;
}): Promise<{ blob: Blob; mimeType: string; totalBytes: number }> {
  const {
    mediaUrl,
    filename,
    speedLimitKBps,
    signal,
    tryDirectFirst = false,
    onProgress,
  } = params;

  const streamEndpoint = `/api/stream?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(
    filename
  )}&limitKbps=${speedLimitKBps}`;

  let response: Response | null = null;
  if (tryDirectFirst && mediaUrl.startsWith('http')) {
    try {
      const directRes = await fetch(mediaUrl, { signal, mode: 'cors' });
      if (directRes.ok) {
        response = directRes;
      }
    } catch {
      // CORS or network mismatch: fall back cleanly to /api/stream proxy
    }
  }

  if (!response) {
    response = await fetch(streamEndpoint, { signal });
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(errText || `Stream failed with status ${response.status}`);
  }

  const contentLengthHeader = response.headers.get('Content-Length');
  const expectedTotal = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
  const mimeType = response.headers.get('Content-Type') || 'application/octet-stream';

  if (!response.body) {
    const blob = await response.blob();
    onProgress({
      downloadedBytes: blob.size,
      totalBytes: blob.size,
      percent: 100,
      speedBps: 0,
    });
    return { blob, mimeType, totalBytes: blob.size };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let downloadedBytes = 0;

  const startTime = performance.now();
  let windowStart = startTime;
  let windowBytes = 0;
  let currentSpeedBps = 0;

  // Token-bucket speed limiter in bytes/sec
  const maxBytesPerSec = speedLimitKBps > 0 ? speedLimitKBps * 1024 : 0;
  let throttleWindowStart = performance.now();
  let throttleWindowBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      const copy = new Uint8Array(value.byteLength);
      copy.set(value);
      chunks.push(copy);
      downloadedBytes += value.byteLength;
      windowBytes += value.byteLength;
      throttleWindowBytes += value.byteLength;

      const now = performance.now();
      const elapsedWindowMs = now - windowStart;
      if (elapsedWindowMs >= 300) {
        currentSpeedBps = (windowBytes / elapsedWindowMs) * 1000;
        windowStart = now;
        windowBytes = 0;
      }

      const total = expectedTotal > 0 ? Math.max(expectedTotal, downloadedBytes) : downloadedBytes;
      const percent = expectedTotal > 0 ? Math.min(99, Math.round((downloadedBytes / total) * 100)) : 50;

      onProgress({
        downloadedBytes,
        totalBytes: total,
        percent,
        speedBps: currentSpeedBps || (downloadedBytes / Math.max(1, now - startTime)) * 1000,
      });

      // Enforce real speed throttle if configured
      if (maxBytesPerSec > 0) {
        const expectedTimeMs = (throttleWindowBytes / maxBytesPerSec) * 1000;
        const actualTimeMs = performance.now() - throttleWindowStart;
        if (expectedTimeMs > actualTimeMs) {
          const delayMs = Math.min(2000, expectedTimeMs - actualTimeMs);
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, delayMs);
            if (signal) {
              signal.addEventListener(
                'abort',
                () => {
                  clearTimeout(timer);
                  reject(new DOMException('Aborted', 'AbortError'));
                },
                { once: true }
              );
            }
          });
        }
        if (performance.now() - throttleWindowStart >= 1000) {
          throttleWindowStart = performance.now();
          throttleWindowBytes = 0;
        }
      }
    }
  }

  const blob = new Blob(chunks, { type: mimeType });
  onProgress({
    downloadedBytes: blob.size,
    totalBytes: blob.size,
    percent: 100,
    speedBps: currentSpeedBps,
  });

  return { blob, mimeType, totalBytes: blob.size };
}
