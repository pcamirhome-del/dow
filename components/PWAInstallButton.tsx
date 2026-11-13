'use client';

import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

interface PWAInstallButtonProps {
  label: string;
  isRtl: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  label,
  isRtl,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        style={{ backgroundColor: 'var(--accent-primary)' }}
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Share className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isRtl ? 'التثبيت على iPhone / iPad' : 'Install on iPhone / iPad'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {isRtl
                  ? '1. اضغط على زر المشاركة (Share) في شريط Safari بالأسفل.\n2. مرر للأسفل واختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                  : '1. Tap the Share button in the Safari toolbar.\n2. Scroll down and tap "Add to Home Screen".'}
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold cursor-pointer"
              >
                {isRtl ? 'حسناً' : 'Got it'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
