'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ClipboardPaste,
  Copy,
  Download,
  Film,
  Music,
  Radio,
  Send,
  Wifi,
  XCircle,
} from 'lucide-react';
import type { PlatformId, StoredFileItem } from '@/types/media';
import { formatBytes, saveFileItem, triggerBrowserDownload } from '@/lib/storage';

interface LocalShareProps {
  files: StoredFileItem[];
  isRtl: boolean;
  onFileReceived: (item: StoredFileItem) => void;
}

type ShareRole = 'send' | 'receive';
type ConnectionPhase =
  | 'idle'
  | 'gathering'
  | 'awaiting-answer'
  | 'answer-ready'
  | 'connected'
  | 'transferring'
  | 'completed'
  | 'error';

interface FileMetaPacket {
  type: 'meta';
  id: string;
  name: string;
  mediaType: 'video' | 'audio';
  ext: string;
  mimeType: string;
  qualityLabel: string;
  platform: PlatformId;
  sourceUrl: string;
  sizeBytes: number;
  durationSeconds: number;
  thumbnail?: string;
}

interface TransferDonePacket {
  type: 'done';
  totalBytes: number;
}

const CHUNK_SIZE = 64 * 1024; // 64 KB chunks over RTCDataChannel
const BUFFER_HIGH_WATERMARK = 4 * 1024 * 1024; // 4 MB backpressure limit

function encodeSignalPayload(desc: RTCSessionDescriptionInit): string {
  const json = JSON.stringify(desc);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeSignalPayload(token: string): RTCSessionDescriptionInit {
  const clean = token.trim();
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as RTCSessionDescriptionInit;
}

function waitForIceGatheringComplete(
  pc: RTCPeerConnection,
  timeoutMs = 2800
): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    }, timeoutMs);

    const onChange = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

export const LocalShare: React.FC<LocalShareProps> = ({
  files,
  isRtl,
  onFileReceived,
}) => {
  const [role, setRole] = useState<ShareRole>('send');
  const [selectedFileId, setSelectedFileId] = useState<string>(files[0]?.id || '');
  const [phase, setPhase] = useState<ConnectionPhase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [localSignalToken, setLocalSignalToken] = useState('');
  const [remoteSignalInput, setRemoteSignalInput] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  const [transferredBytes, setTransferredBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [speedBps, setSpeedBps] = useState(0);
  const [incomingMeta, setIncomingMeta] = useState<FileMetaPacket | null>(null);
  const [receivedItem, setReceivedItem] = useState<StoredFileItem | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const receiveChunksRef = useRef<ArrayBuffer[]>([]);
  const receivedBytesRef = useRef<number>(0);
  const incomingMetaRef = useRef<FileMetaPacket | null>(null);
  const transferStartRef = useRef<number>(0);
  const transferCancelRef = useRef<boolean>(false);

  const effectiveSelectedId = selectedFileId || files[0]?.id || '';

  const cleanupPeer = () => {
    transferCancelRef.current = true;
    try {
      dcRef.current?.close();
    } catch {
      // ignore
    }
    try {
      pcRef.current?.close();
    } catch {
      // ignore
    }
    dcRef.current = null;
    pcRef.current = null;
  };

  useEffect(() => {
    return () => {
      cleanupPeer();
    };
  }, []);

  const resetSession = () => {
    cleanupPeer();
    transferCancelRef.current = false;
    setPhase('idle');
    setErrorMsg(null);
    setLocalSignalToken('');
    setRemoteSignalInput('');
    setTransferredBytes(0);
    setTotalBytes(0);
    setSpeedBps(0);
    setIncomingMeta(null);
    setReceivedItem(null);
    receiveChunksRef.current = [];
    receivedBytesRef.current = 0;
    incomingMetaRef.current = null;
  };

  const attachReceiverChannel = (channel: RTCDataChannel) => {
    channel.binaryType = 'arraybuffer';
    dcRef.current = channel;

    channel.onopen = () => {
      setPhase('connected');
      setErrorMsg(null);
    };

    channel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        const packet = JSON.parse(event.data) as FileMetaPacket | TransferDonePacket;
        if (packet.type === 'meta') {
          receiveChunksRef.current = [];
          receivedBytesRef.current = 0;
          incomingMetaRef.current = packet;
          transferStartRef.current = performance.now();
          setIncomingMeta(packet);
          setTotalBytes(packet.sizeBytes);
          setTransferredBytes(0);
          setPhase('transferring');
        } else if (packet.type === 'done') {
          const meta = incomingMetaRef.current;
          if (!meta) return;
          const fullBlob = new Blob(receiveChunksRef.current, {
            type: meta.mimeType || 'application/octet-stream',
          });
          const item: StoredFileItem = {
            id: `p2p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: meta.name,
            mediaType: meta.mediaType,
            folder: meta.mediaType,
            ext: meta.ext,
            mimeType: meta.mimeType,
            qualityLabel: meta.qualityLabel,
            platform: meta.platform,
            sourceUrl: meta.sourceUrl,
            sizeBytes: fullBlob.size,
            durationSeconds: meta.durationSeconds,
            tags: ['local-share', meta.qualityLabel],
            hidden: false,
            createdAt: Date.now(),
            blob: fullBlob,
            thumbnail: meta.thumbnail,
          };
          await saveFileItem(item);
          onFileReceived(item);
          setReceivedItem(item);
          setTransferredBytes(fullBlob.size);
          setPhase('completed');
          receiveChunksRef.current = [];
        }
      } else if (event.data instanceof ArrayBuffer) {
        receiveChunksRef.current.push(event.data);
        receivedBytesRef.current += event.data.byteLength;
        const elapsedSec = Math.max(
          0.05,
          (performance.now() - transferStartRef.current) / 1000
        );
        setTransferredBytes(receivedBytesRef.current);
        setSpeedBps(receivedBytesRef.current / elapsedSec);
      }
    };

    channel.onerror = () => {
      setErrorMsg(
        isRtl ? 'حدث خطأ في قناة النقل المحلية' : 'Local P2P DataChannel error'
      );
      setPhase('error');
    };
  };

  const sendFileOverDataChannel = async (
    channel: RTCDataChannel,
    fileItem: StoredFileItem
  ) => {
    transferCancelRef.current = false;
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = 512 * 1024;

    setPhase('transferring');
    setTotalBytes(fileItem.blob.size);
    setTransferredBytes(0);
    transferStartRef.current = performance.now();

    const metaPacket: FileMetaPacket = {
      type: 'meta',
      id: fileItem.id,
      name: fileItem.name,
      mediaType: fileItem.mediaType,
      ext: fileItem.ext,
      mimeType: fileItem.mimeType,
      qualityLabel: fileItem.qualityLabel,
      platform: fileItem.platform,
      sourceUrl: fileItem.sourceUrl,
      sizeBytes: fileItem.blob.size,
      durationSeconds: fileItem.durationSeconds,
      thumbnail: fileItem.thumbnail,
    };

    channel.send(JSON.stringify(metaPacket));

    let offset = 0;
    const blobSize = fileItem.blob.size;

    while (offset < blobSize) {
      if (transferCancelRef.current || channel.readyState !== 'open') {
        throw new Error('Transfer aborted');
      }

      if (channel.bufferedAmount > BUFFER_HIGH_WATERMARK) {
        await new Promise<void>((resolve) => {
          const onLow = () => {
            channel.removeEventListener('bufferedamountlow', onLow);
            resolve();
          };
          channel.addEventListener('bufferedamountlow', onLow);
        });
      }

      const end = Math.min(offset + CHUNK_SIZE, blobSize);
      const buffer = await fileItem.blob.slice(offset, end).arrayBuffer();
      channel.send(buffer);
      offset = end;

      const elapsedSec = Math.max(
        0.05,
        (performance.now() - transferStartRef.current) / 1000
      );
      setTransferredBytes(offset);
      setSpeedBps(offset / elapsedSec);
    }

    const donePacket: TransferDonePacket = {
      type: 'done',
      totalBytes: blobSize,
    };
    channel.send(JSON.stringify(donePacket));
    setPhase('completed');
  };

  // Sender Step 1: Create offline WebRTC Offer (iceServers: [] => LAN-only host candidates)
  const handleCreateSenderOffer = async () => {
    const fileItem = files.find((f) => f.id === effectiveSelectedId);
    if (!fileItem) {
      setErrorMsg(
        isRtl ? 'يرجى اختيار ملف من التخزين المحلي أولاً' : 'Select a local file first'
      );
      return;
    }

    resetSession();
    setPhase('gathering');

    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pcRef.current = pc;

      const channel = pc.createDataChannel('savebox-lan-p2p', { ordered: true });
      dcRef.current = channel;

      channel.onopen = () => {
        setPhase('connected');
        sendFileOverDataChannel(channel, fileItem).catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : 'Send failed');
          setPhase('error');
        });
      };

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === 'failed' ||
          pc.iceConnectionState === 'disconnected'
        ) {
          setErrorMsg(
            isRtl
              ? 'انقطع الاتصال المحلي — تأكد أن الجهازين على نفس شبكة Wi-Fi'
              : 'LAN connection lost — verify both devices share the same Wi-Fi'
          );
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGatheringComplete(pc);

      if (!pc.localDescription) throw new Error('Failed to generate local SDP');
      setLocalSignalToken(encodeSignalPayload(pc.localDescription));
      setPhase('awaiting-answer');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'WebRTC setup failed');
      setPhase('error');
    }
  };

  // Sender Step 2: Accept Receiver Answer Token -> opens LAN DataChannel & streams immediately
  const handleSenderAcceptAnswer = async () => {
    if (!pcRef.current || !remoteSignalInput.trim()) return;
    setErrorMsg(null);
    try {
      const answerDesc = decodeSignalPayload(remoteSignalInput);
      await pcRef.current.setRemoteDescription(answerDesc);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isRtl
            ? 'رمز الاستجابة غير صالح'
            : 'Invalid answer token'
      );
    }
  };

  // Receiver Step 1: Paste Sender Offer -> Generate Local LAN Answer
  const handleReceiverAcceptOffer = async () => {
    if (!remoteSignalInput.trim()) return;
    setErrorMsg(null);
    setPhase('gathering');

    try {
      const offerDesc = decodeSignalPayload(remoteSignalInput);
      const pc = new RTCPeerConnection({ iceServers: [] });
      pcRef.current = pc;

      pc.ondatachannel = (event) => {
        attachReceiverChannel(event.channel);
      };

      await pc.setRemoteDescription(offerDesc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGatheringComplete(pc);

      if (!pc.localDescription) throw new Error('Failed to build answer SDP');
      setLocalSignalToken(encodeSignalPayload(pc.localDescription));
      setPhase('answer-ready');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isRtl
            ? 'تعذر قراءة رمز الإرسال'
            : 'Invalid sender offer token'
      );
      setPhase('error');
    }
  };

  const handleCopyToken = async () => {
    if (!localSignalToken) return;
    await navigator.clipboard.writeText(localSignalToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 1800);
  };

  const handlePasteToken = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setRemoteSignalInput(text.trim());
    } catch {
      // ignore if denied
    }
  };

  const progressPct =
    totalBytes > 0 ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : 0;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/75 p-5 sm:p-7 text-slate-100 shadow-2xl backdrop-blur-xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-start gap-3.5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <Wifi className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white">
              {isRtl
                ? 'المشاركة المحلية المباشرة (WebRTC P2P بدون إنترنت)'
                : 'Local P2P Offline Share (Wi-Fi Direct via WebRTC)'}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              {isRtl
                ? 'انقل الفيديوهات والملفات الصوتية مباشرة من IndexedDB إلى جهاز قريب على نفس شبكة Wi-Fi دون استهلاك إنترنت'
                : 'Transfer large videos and audio directly from IndexedDB to a nearby device on the same local Wi-Fi — zero internet servers'}
            </p>
          </div>
        </div>

        {/* Role Switcher */}
        <div className="inline-flex rounded-xl border border-white/10 bg-slate-950/60 p-1">
          <button
            type="button"
            onClick={() => {
              resetSession();
              setRole('send');
            }}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              role === 'send'
                ? 'bg-white/15 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            <span>{isRtl ? 'إرسال ملف' : 'Send File'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              resetSession();
              setRole('receive');
            }}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              role === 'receive'
                ? 'bg-white/15 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isRtl ? 'استقبال ملف' : 'Receive File'}</span>
          </button>
        </div>
      </div>

      {/* Role Body */}
      {role === 'send' ? (
        <div className="space-y-5">
          {/* File Selector from IndexedDB */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-slate-300">
              {isRtl
                ? '1. اختر الملف المراد إرساله من التخزين المحلي (IndexedDB)'
                : '1. Select Media from Local IndexedDB Vault'}
            </label>

            {files.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
                {isRtl
                  ? 'لا توجد ملفات محملة محلياً بعد — قم بتحميل فيديو أو ملف صوتي أولاً'
                  : 'No local files found in IndexedDB yet — download a video or audio first'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pe-1">
                {files.map((item) => {
                  const selected = effectiveSelectedId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedFileId(item.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-start transition-colors cursor-pointer ${
                        selected
                          ? 'border-sky-400/60 bg-sky-500/15 text-white'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950/60">
                        {item.mediaType === 'video' ? (
                          <Film className="h-4.5 w-4.5 text-sky-400" />
                        ) : (
                          <Music className="h-4.5 w-4.5 text-emerald-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-white">
                          {item.name}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400 tabular-nums">
                          {item.ext.toUpperCase()} · {formatBytes(item.sizeBytes)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Create Offline LAN Offer */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={files.length === 0 || phase === 'gathering' || phase === 'transferring'}
              onClick={handleCreateSenderOffer}
              className="inline-flex min-h-[46px] items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-45 cursor-pointer"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              <Radio className="h-4.5 w-4.5" />
              <span>
                {phase === 'gathering'
                  ? isRtl
                    ? 'جاري تجهيز اتصال LAN المحلي...'
                    : 'Gathering LAN ICE Candidates...'
                  : isRtl
                    ? 'إنشاء جلسة إرسال محلية'
                    : 'Create Local Transfer Session'}
              </span>
            </button>

            {phase !== 'idle' && (
              <button
                type="button"
                onClick={resetSession}
                className="inline-flex min-h-[46px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer"
              >
                <XCircle className="h-4 w-4" />
                <span>{isRtl ? 'إعادة ضبط' : 'Reset'}</span>
              </button>
            )}
          </div>

          {/* Offer Token Display + Answer Input */}
          {localSignalToken && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-sky-300">
                    {isRtl
                      ? '2. انسخ رمز الإرسال وأرسله للجهاز المستقبل (أوفلاين)'
                      : '2. Copy Offer Token to Receiving Device'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 cursor-pointer"
                  >
                    {copiedToken ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedToken ? (isRtl ? 'تم النسخ' : 'Copied') : isRtl ? 'نسخ' : 'Copy'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  value={localSignalToken}
                  rows={3}
                  dir="ltr"
                  className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 font-mono text-[11px] text-slate-300 focus:outline-none"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-300">
                    {isRtl
                      ? '3. الصق رمز القبول من الجهاز المستقبل لبدء النقل'
                      : '3. Paste Answer Token from Receiver'}
                  </span>
                  <button
                    type="button"
                    onClick={handlePasteToken}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 cursor-pointer"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    <span>{isRtl ? 'لصق' : 'Paste'}</span>
                  </button>
                </div>
                <textarea
                  value={remoteSignalInput}
                  onChange={(e) => setRemoteSignalInput(e.target.value)}
                  rows={3}
                  dir="ltr"
                  placeholder={isRtl ? 'الصق رمز الاستجابة هنا...' : 'Paste answer token here...'}
                  className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 font-mono text-[11px] text-white placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!remoteSignalInput.trim() || phase === 'transferring'}
                  onClick={handleSenderAcceptAnswer}
                  className="w-full min-h-[42px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white disabled:opacity-45 cursor-pointer"
                >
                  {isRtl ? 'اتصال وبدء النقل الفوري' : 'Connect & Start LAN Transfer'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Receiver Mode */
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-sky-300">
                  {isRtl
                    ? '1. الصق رمز الإرسال القادم من الجهاز المرسل'
                    : '1. Paste Offer Token from Sender Device'}
                </span>
                <button
                  type="button"
                  onClick={handlePasteToken}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 cursor-pointer"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  <span>{isRtl ? 'لصق' : 'Paste'}</span>
                </button>
              </div>
              <textarea
                value={remoteSignalInput}
                onChange={(e) => setRemoteSignalInput(e.target.value)}
                rows={3}
                dir="ltr"
                placeholder={isRtl ? 'الصق رمز الإرسال هنا...' : 'Paste offer token here...'}
                className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 font-mono text-[11px] text-white placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={!remoteSignalInput.trim() || phase === 'gathering'}
                onClick={handleReceiverAcceptOffer}
                className="w-full min-h-[42px] rounded-xl text-xs font-bold text-white disabled:opacity-45 cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                {phase === 'gathering'
                  ? isRtl
                    ? 'جاري توليد رمز القبول...'
                    : 'Generating LAN Answer...'
                  : isRtl
                    ? 'توليد رمز القبول المحلي'
                    : 'Generate Local Answer Token'}
              </button>
            </div>

            {localSignalToken && (
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-300">
                    {isRtl
                      ? '2. انسخ هذا الرمز وأعطه للجهاز المرسل'
                      : '2. Copy Answer Token Back to Sender'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 cursor-pointer"
                  >
                    {copiedToken ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedToken ? (isRtl ? 'تم النسخ' : 'Copied') : isRtl ? 'نسخ' : 'Copy'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  value={localSignalToken}
                  rows={4}
                  dir="ltr"
                  className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 font-mono text-[11px] text-slate-300 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-3 text-xs font-medium text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Live P2P Transfer Progress Card */}
      {(phase === 'transferring' || phase === 'completed' || phase === 'connected') && (
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-5 space-y-3 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {incomingMeta?.name ||
                  files.find((f) => f.id === effectiveSelectedId)?.name ||
                  'LAN P2P Transfer'}
              </p>
              <p className="mt-0.5 font-mono text-xs text-slate-300 tabular-nums">
                {formatBytes(transferredBytes)} / {formatBytes(totalBytes)}
                {speedBps > 0 ? ` · ${formatBytes(speedBps)}/s` : ''}
              </p>
            </div>
            <span className="font-mono text-sm font-bold text-sky-400 tabular-nums">
              {progressPct}%
            </span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/40">
            <div
              className={`h-full transition-all duration-150 ${
                phase === 'completed' ? 'bg-emerald-500' : ''
              }`}
              style={{
                width: `${Math.max(3, progressPct)}%`,
                backgroundColor:
                  phase === 'completed' ? undefined : 'var(--accent-primary)',
              }}
            />
          </div>

          {phase === 'completed' && receivedItem && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs font-semibold text-emerald-400">
                {isRtl
                  ? 'تم استلام الملف وحفظه بنجاح في IndexedDB!'
                  : 'File received and saved directly into IndexedDB!'}
              </p>
              <button
                type="button"
                onClick={() =>
                  triggerBrowserDownload(
                    receivedItem.blob,
                    `${receivedItem.name}.${receivedItem.ext}`
                  )
                }
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-xs font-bold text-white cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isRtl ? 'حفظ نسخة على الجهاز' : 'Save Copy to Device'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
