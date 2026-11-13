'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

interface PwaUpdaterProps {
  isRtl?: boolean;
}

export const PwaUpdater: React.FC<PwaUpdaterProps> = ({ isRtl = false }) => {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let registrationRef: ServiceWorkerRegistration | null = null;
    let mounted = true;

    const handleControllerChange = () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    const watchInstallingWorker = (worker: ServiceWorker) => {
      worker.addEventListener('statechange', () => {
        if (
          worker.state === 'installed' &&
          navigator.serviceWorker.controller &&
          mounted
        ) {
          setWaitingWorker(worker);
          setDismissed(false);
        }
      });
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        if (!mounted) return;
        registrationRef = reg;

        if (reg.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(reg.waiting);
        }

        if (reg.installing) {
          watchInstallingWorker(reg.installing);
        }

        reg.addEventListener('updatefound', () => {
          if (reg.installing) {
            watchInstallingWorker(reg.installing);
          }
        });
      })
      .catch(() => undefined);

    const checkForUpdates = () => {
      if (document.visibilityState === 'visible') {
        registrationRef?.update().catch(() => undefined);
      }
    };

    document.addEventListener('visibilitychange', checkForUpdates);
    const intervalId = window.setInterval(() => {
      registrationRef?.update().catch(() => undefined);
    }, 15 * 60 * 1000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', checkForUpdates);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const handleApplyUpdate = async () => {
    if (!waitingWorker) return;
    setUpdating(true);

    // Clear stale caches prior to activation
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => !k.endsWith('v2'))
            .map((k) => caches.delete(k))
        );
      } catch {
        // ignore cache delete failures
      }
    }

    waitingWorker.postMessage({ type: 'SKIP_WAITING' });

    // Safety reload fallback in case controllerchange doesn't fire within 1.5s
    setTimeout(() => {
      if (!reloadingRef.current) {
        reloadingRef.current = true;
        window.location.reload();
      }
    }, 1500);
  };

  if (!waitingWorker || dismissed) return null;

  return (
    <div className="fixed bottom-5 start-1/2 z-[60] -translate-x-1/2 w-[calc(100%-2rem)] max-w-md">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-slate-900/80 px-4 py-3 text-white shadow-2xl backdrop-blur-xl">
        <button
          type="button"
          onClick={handleApplyUpdate}
          disabled={updating}
          className="flex flex-1 items-center gap-3 text-start cursor-pointer"
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <RefreshCw className={`h-4.5 w-4.5 ${updating ? 'animate-spin' : ''}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-white">
              Update Available - Click to Refresh
            </p>
            {isRtl && (
              <p className="text-[11px] text-slate-300">
                يتوفر تحديث جديد للتطبيق — اضغط للتحديث الفوري
              </p>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
          aria-label="Dismiss update notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
