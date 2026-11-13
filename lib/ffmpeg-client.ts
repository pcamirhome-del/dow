'use client';

import type { FFmpeg } from '@ffmpeg/ffmpeg';
import type { AudioBitratePreset } from '@/types/media';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadingPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }
  if (ffmpegLoadingPromise) {
    return ffmpegLoadingPromise;
  }

  ffmpegLoadingPromise = (async () => {
    const { FFmpeg: FFmpegClass } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');
    const instance = new FFmpegClass();

    const cdnBases = [
      'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
    ];

    let lastError: unknown;
    for (const baseURL of cdnBases) {
      try {
        await instance.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegInstance = instance;
        return instance;
      } catch (err) {
        lastError = err;
      }
    }
    ffmpegLoadingPromise = null;
    throw lastError || new Error('Failed to load FFmpeg WebAssembly core');
  })();

  return ffmpegLoadingPromise;
}

export async function transcodeToMp3(
  inputBlob: Blob,
  inputExt: string,
  bitrateKbps: AudioBitratePreset,
  onProgress?: (ratio: number) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import('@ffmpeg/util');

  const safeExt = inputExt.replace(/[^a-z0-9]/gi, '') || 'webm';
  const inputName = `input_${Date.now()}.${safeExt}`;
  const outputName = `output_${Date.now()}.mp3`;

  const progressHandler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(Math.max(0, Math.min(1, progress)));
  };

  ffmpeg.on('progress', progressHandler);
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(inputBlob));
    await ffmpeg.exec([
      '-i',
      inputName,
      '-vn',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-b:a',
      `${bitrateKbps}k`,
      '-f',
      'mp3',
      outputName,
    ]);
    const data = await ffmpeg.readFile(outputName);
    const bytes = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array();
    return new Blob([bytes.buffer], { type: 'audio/mpeg' });
  } finally {
    ffmpeg.off('progress', progressHandler);
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
  }
}

export async function muxVideoAndAudio(
  videoBlob: Blob,
  audioBlob: Blob,
  videoExt: string,
  audioExt: string,
  onProgress?: (ratio: number) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import('@ffmpeg/util');

  const vExt = videoExt.replace(/[^a-z0-9]/gi, '') || 'mp4';
  const aExt = audioExt.replace(/[^a-z0-9]/gi, '') || 'm4a';
  const ts = Date.now();
  const videoName = `video_${ts}.${vExt}`;
  const audioName = `audio_${ts}.${aExt}`;
  const outputName = `muxed_${ts}.mp4`;

  const progressHandler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(Math.max(0, Math.min(1, progress)));
  };

  ffmpeg.on('progress', progressHandler);
  try {
    await ffmpeg.writeFile(videoName, await fetchFile(videoBlob));
    await ffmpeg.writeFile(audioName, await fetchFile(audioBlob));
    // Attempt lossless container copy first; fallback to AAC audio encode if container rejects opus/webm audio in mp4
    try {
      await ffmpeg.exec([
        '-i',
        videoName,
        '-i',
        audioName,
        '-c:v',
        'copy',
        '-c:a',
        'copy',
        '-shortest',
        outputName,
      ]);
    } catch {
      await ffmpeg.exec([
        '-i',
        videoName,
        '-i',
        audioName,
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-shortest',
        outputName,
      ]);
    }

    const data = await ffmpeg.readFile(outputName);
    const bytes = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array();
    return new Blob([bytes.buffer], { type: 'video/mp4' });
  } finally {
    ffmpeg.off('progress', progressHandler);
    await ffmpeg.deleteFile(videoName).catch(() => undefined);
    await ffmpeg.deleteFile(audioName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
  }
}
