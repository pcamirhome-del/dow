import type { NotificationSoundId } from '@/types/media';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = 'sine',
  peakGain = 0.16
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + startOffset;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playNotificationSound(soundId: NotificationSoundId): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (soundId === 'chime') {
    // Sound 1: Warm 2-note soft chime
    playTone(ctx, 587.33, 0, 0.22, 'sine', 0.18);
    playTone(ctx, 880.0, 0.14, 0.34, 'sine', 0.16);
  } else if (soundId === 'pulse') {
    // Sound 2: Crisp digital dual pulse
    playTone(ctx, 740.0, 0, 0.11, 'triangle', 0.16);
    playTone(ctx, 987.77, 0.13, 0.16, 'triangle', 0.18);
  } else {
    // Sound 3: 3-note harmonic cascade
    playTone(ctx, 523.25, 0, 0.14, 'sine', 0.14);
    playTone(ctx, 659.25, 0.11, 0.14, 'sine', 0.15);
    playTone(ctx, 783.99, 0.22, 0.3, 'sine', 0.17);
  }
}

export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

export function sendSystemNotification(title: string, body: string): void {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    });
  } catch {
    // Ignore if blocked in embedded context
  }
}
