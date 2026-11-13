'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CloudOff,
  Download,
  EyeOff,
  FileSpreadsheet,
  Fingerprint,
  Folder,
  FolderOpen,
  Gauge,
  HardDrive,
  Laptop,
  Lock,
  Moon,
  Palette,
  Play,
  Shield,
  Sun,
  Trash2,
  Volume2,
} from 'lucide-react';
import type {
  AppSettings,
  DownloadHistoryRecord,
  DynamicAccent,
  LanguageCode,
  NotificationSoundId,
  SpeedLimitKBps,
  SpeedTestResult,
  ThemeMode,
} from '@/types/media';
import {
  APP_RELEASE_DATE,
  CHANGELOG_ENTRIES,
  SUPPORTED_LANGUAGES,
  type TranslationStrings,
} from '@/lib/i18n';
import {
  exportHistoryToCsv,
  formatBytes,
  getStorageEstimateInfo,
  pickDeviceSaveFolder,
  type StorageEstimateInfo,
} from '@/lib/storage';
import {
  playNotificationSound,
  requestBrowserNotificationPermission,
} from '@/lib/sound';
import { hashPin, registerTouchIdCredential } from '@/lib/biometric';

/* -------------------------------------------------------------------------- */
/* 1. Security Section                                                        */
/* -------------------------------------------------------------------------- */
export const SecuritySection: React.FC<{
  t: TranslationStrings;
  isRtl: boolean;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  onLockApp: () => void;
}> = ({ t, isRtl, settings, onUpdateSettings, onLockApp }) => {
  const [pinDraft, setPinDraft] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [showPinPrompt, setShowPinPrompt] = useState(false);

  const handleEnableTouchId = async () => {
    setStatusMsg(null);
    const res = await registerTouchIdCredential();
    if (res.ok && res.credentialId) {
      await onUpdateSettings({
        touchIdEnabled: true,
        touchIdCredentialId: res.credentialId,
      });
      setStatusMsg(
        isRtl
          ? 'تم تفعيل حماية Touch ID بنجاح'
          : 'Touch ID protection enabled successfully'
      );
    } else {
      setShowPinPrompt(true);
    }
  };

  const handleDisableTouchId = async () => {
    await onUpdateSettings({
      touchIdEnabled: false,
      touchIdCredentialId: null,
      pinHash: null,
    });
    setStatusMsg(isRtl ? 'تم إيقاف قفل الأمان' : 'Security lock disabled');
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinDraft.trim().length < 4) return;
    const digest = await hashPin(pinDraft.trim());
    await onUpdateSettings({
      touchIdEnabled: true,
      pinHash: digest,
    });
    setPinDraft('');
    setShowPinPrompt(false);
    setStatusMsg(
      isRtl
        ? 'تم تفعيل قفل الأمان برمز الحماية (Touch ID / PIN)'
        : 'Biometric / PIN lock activated'
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              <Fingerprint className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                {t.securityTitle}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {t.touchIdDesc}
              </p>
            </div>
          </div>
        </div>

        {/* Touch ID Enable & Close Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {t.touchIdLabel}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {settings.touchIdEnabled
                  ? isRtl
                    ? 'مفعل'
                    : 'Active'
                  : isRtl
                    ? 'غير مفعل'
                    : 'Inactive'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!settings.touchIdEnabled ? (
              <button
                type="button"
                onClick={handleEnableTouchId}
                className="min-h-[42px] rounded-xl px-5 py-2 text-sm font-semibold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                {t.enableBtn}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleEnableTouchId}
                  className="min-h-[42px] rounded-xl px-4 py-2 text-sm font-semibold text-white cursor-pointer"
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                >
                  {t.enableBtn}
                </button>
                <button
                  type="button"
                  onClick={onLockApp}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <Lock className="h-4 w-4" />
                  <span>{t.lockBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisableTouchId}
                  className="min-h-[42px] rounded-xl border border-red-300 dark:border-red-900/50 px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
                >
                  {isRtl ? 'إلغاء التفعيل' : 'Disable'}
                </button>
              </>
            )}
          </div>
        </div>

        {showPinPrompt && (
          <form
            onSubmit={handleSavePin}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 space-y-3"
          >
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {isRtl
                ? 'مستشعر Touch ID غير متاح في هذه النافذة — أدخل رمز حماية محلي (4 أرقام على الأقل) لتفعيل القفل:'
                : 'Touch ID unavailable in this browser frame — set a local 4+ digit PIN to enable lock:'}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="password"
                inputMode="numeric"
                minLength={4}
                value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value)}
                placeholder="****"
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                className="min-h-[40px] rounded-xl px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                {t.enableBtn}
              </button>
            </div>
          </form>
        )}

        {statusMsg && (
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {statusMsg}
          </p>
        )}

        {/* Blue Privacy Box at Bottom */}
        <div className="rounded-2xl border border-blue-500/40 bg-blue-600 px-5 py-5 text-white shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <CloudOff className="h-5 w-5 text-white" />
            </div>
            <p className="text-sm font-semibold leading-snug">
              {t.privacyNoPersonalData}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Folder className="h-5 w-5 text-white" />
            </div>
            <p className="text-sm font-semibold leading-snug">
              {t.privacyLocalOnly}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <EyeOff className="h-5 w-5 text-white" />
            </div>
            <p className="text-sm font-semibold leading-snug">
              {t.privacyNoTracking}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. General (12 Languages with Flags)                                       */
/* -------------------------------------------------------------------------- */
export const GeneralSection: React.FC<{
  t: TranslationStrings;
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => Promise<void>;
}> = ({ t, language, onChangeLanguage }) => {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t.generalTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t.appLanguage}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const active = language === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => onChangeLanguage(lang.code)}
              className={`flex min-h-[54px] items-center justify-between rounded-xl border px-4 py-3 text-start transition-colors cursor-pointer ${
                active
                  ? 'border-sky-500 bg-sky-500/10 text-slate-950 dark:text-white'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="text-2xl leading-none" role="img" aria-label={lang.name}>
                  {lang.flag}
                </span>
                <span className="truncate text-sm font-semibold">
                  {lang.nativeName}
                </span>
              </span>
              {active && (
                <Check className="h-4 w-4 shrink-0" style={{ color: 'var(--accent-text)' }} />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. Downloads Settings + Separate Storage Info Box                          */
/* -------------------------------------------------------------------------- */
const SPEED_OPTIONS: Array<{ value: SpeedLimitKBps; labelAr: string; labelEn: string }> = [
  { value: 0, labelAr: 'غير محدود', labelEn: 'Unlimited' },
  { value: 256, labelAr: '256 كيلوبايت / ث', labelEn: '256 KB/s' },
  { value: 512, labelAr: '512 كيلوبايت / ث', labelEn: '512 KB/s' },
  { value: 1024, labelAr: '1 ميجابايت / ث', labelEn: '1 MB/s' },
  { value: 2048, labelAr: '2 ميجابايت / ث', labelEn: '2 MB/s' },
  { value: 5120, labelAr: '5 ميجابايت / ث', labelEn: '5 MB/s' },
  { value: 10240, labelAr: '10 ميجابايت / ث', labelEn: '10 MB/s' },
];

export const DownloadsSettingsSection: React.FC<{
  t: TranslationStrings;
  isRtl: boolean;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;
}> = ({ t, isRtl, settings, onUpdateSettings }) => {
  const [storageInfo, setStorageInfo] = useState<StorageEstimateInfo | null>(null);
  const [folderMessage, setFolderMessage] = useState<string | null>(null);
  const [pendingConcurrency, setPendingConcurrency] = useState<number | null>(null);

  useEffect(() => {
    getStorageEstimateInfo().then(setStorageInfo).catch(() => undefined);
  }, []);

  const handleChooseFolder = async () => {
    setFolderMessage(null);
    try {
      const picked = await pickDeviceSaveFolder();
      if (!picked.supported) {
        setFolderMessage(
          isRtl
            ? 'متصفحك يحفظ تلقائياً في مجلد التنزيلات والمخزن المحلي (video / audio)'
            : 'Folder picker not supported in this browser — using local vault + Downloads'
        );
        return;
      }
      if (picked.folderName) {
        await onUpdateSettings({ saveFolderName: picked.folderName });
        setFolderMessage(
          isRtl
            ? `تم تحديد المجلد "${picked.folderName}" (video للفيديو · audio للصوت)`
            : `Selected folder "${picked.folderName}" (auto-routes video/ & audio/)`
        );
      }
    } catch {
      // User cancelled picker
    }
  };

  const handleSelectConcurrency = async (num: number) => {
    if (num > 2 && settings.concurrentLimit <= 2) {
      setPendingConcurrency(num);
      return;
    }
    if (num > 2) {
      setPendingConcurrency(num);
      return;
    }
    await onUpdateSettings({ concurrentLimit: num });
  };

  const confirmConcurrency = async () => {
    if (pendingConcurrency !== null) {
      await onUpdateSettings({ concurrentLimit: pendingConcurrency });
      setPendingConcurrency(null);
    }
  };

  const usedPercent =
    storageInfo && storageInfo.quotaBytes > 0
      ? Math.min(100, Math.round((storageInfo.usedBytes / storageInfo.quotaBytes) * 100))
      : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-6">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t.downloadsTitle}
        </h1>

        {/* Save Folder Picker */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-slate-600 dark:text-slate-300" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t.saveFolder}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {settings.saveFolderName
                    ? `${settings.saveFolderName} · ${t.folderAutoRoute}`
                    : t.folderDefaultNote}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleChooseFolder}
              className="min-h-[42px] rounded-xl px-4 py-2 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            >
              {t.chooseFolder}
            </button>
          </div>
          {folderMessage && (
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {folderMessage}
            </p>
          )}
        </div>

        {/* Direct Download Toggle (with Arrow / Lock control) */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4">
          <div className="flex items-start gap-3">
            <ArrowRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-600 dark:text-slate-300" />
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {t.directDownload}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t.directDownloadDesc}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({ directDownload: !settings.directDownload })
            }
            className={`min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              settings.directDownload
                ? 'text-white'
                : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
            style={
              settings.directDownload
                ? { backgroundColor: 'var(--accent-primary)' }
                : undefined
            }
          >
            {settings.directDownload
              ? isRtl
                ? 'مفعل ←'
                : 'Enabled →'
              : isRtl
                ? 'مقفل'
                : 'Locked'}
          </button>
        </div>

        {/* Concurrent Downloads (1 to 10, default 2) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {t.concurrentDownloads}:{' '}
                <span className="font-mono tabular-nums">
                  {settings.concurrentLimit}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t.concurrentDefaultNote}
              </p>
            </div>
            {settings.concurrentLimit !== 2 && (
              <button
                type="button"
                onClick={() => onUpdateSettings({ concurrentLimit: 2 })}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t.resetToNormal}
              </button>
            )}
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              const active = settings.concurrentLimit === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleSelectConcurrency(num)}
                  className={`min-h-[42px] rounded-xl border font-mono text-sm font-bold tabular-nums transition-colors cursor-pointer ${
                    active
                      ? 'text-white border-transparent'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  style={
                    active ? { backgroundColor: 'var(--accent-primary)' } : undefined
                  }
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>

        {/* Speed Limit Selector */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {t.speedLimit}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SPEED_OPTIONS.map((opt) => {
              const active = settings.speedLimitKBps === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdateSettings({ speedLimitKBps: opt.value })}
                  className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                    active
                      ? 'text-white border-transparent'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  style={
                    active ? { backgroundColor: 'var(--accent-primary)' } : undefined
                  }
                >
                  {isRtl ? opt.labelAr : opt.labelEn}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Separate Storage Information Panel */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <HardDrive className="h-5 w-5" style={{ color: 'var(--accent-text)' }} />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t.storageInfoTitle}
          </h2>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${Math.max(2, usedPercent)}%`,
              backgroundColor: 'var(--accent-primary)',
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.storageUsed}
            </p>
            <p className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {storageInfo ? formatBytes(storageInfo.usedBytes) : '...'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.storageAvailable}
            </p>
            <p className="mt-1 font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {storageInfo ? formatBytes(storageInfo.availableBytes) : '...'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.storageTotal}
            </p>
            <p className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {storageInfo ? formatBytes(storageInfo.quotaBytes) : '...'}
            </p>
          </div>
        </div>
      </section>

      {/* Concurrent > 2 Advisory Modal */}
      {pendingConcurrency !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.concurrentWarningTitle}
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t.concurrentWarningBody}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingConcurrency(null)}
                className="min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={confirmConcurrency}
                className="min-h-[42px] rounded-xl px-5 py-2 text-sm font-bold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)' }}
              >
                {t.confirmOk}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. Notifications Section (with 3 Real Audio Tones)                         */
/* -------------------------------------------------------------------------- */
export const NotificationsSection: React.FC<{
  t: TranslationStrings;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;
}> = ({ t, settings, onUpdateSettings }) => {
  const toggleNotificationMaster = async () => {
    const next = !settings.notificationsEnabled;
    if (next) {
      await requestBrowserNotificationPermission();
    }
    await onUpdateSettings({ notificationsEnabled: next });
  };

  const toggles: Array<{
    key: 'notificationsEnabled' | 'soundOrPushEnabled' | 'notifyOnComplete' | 'notifyOnFail';
    label: string;
    value: boolean;
    onToggle: () => void;
  }> = [
    {
      key: 'notificationsEnabled',
      label: t.notifMaster,
      value: settings.notificationsEnabled,
      onToggle: toggleNotificationMaster,
    },
    {
      key: 'soundOrPushEnabled',
      label: t.notifSoundOrPhone,
      value: settings.soundOrPushEnabled,
      onToggle: () =>
        onUpdateSettings({ soundOrPushEnabled: !settings.soundOrPushEnabled }),
    },
    {
      key: 'notifyOnComplete',
      label: t.notifOnComplete,
      value: settings.notifyOnComplete,
      onToggle: () =>
        onUpdateSettings({ notifyOnComplete: !settings.notifyOnComplete }),
    },
    {
      key: 'notifyOnFail',
      label: t.notifOnFail,
      value: settings.notifyOnFail,
      onToggle: () => onUpdateSettings({ notifyOnFail: !settings.notifyOnFail }),
    },
  ];

  const sounds: Array<{ id: NotificationSoundId; label: string }> = [
    { id: 'chime', label: t.soundChime },
    { id: 'pulse', label: t.soundPulse },
    { id: 'cascade', label: t.soundCascade },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-6">
      <div className="flex items-center gap-2.5">
        <Bell className="h-5 w-5" style={{ color: 'var(--accent-text)' }} />
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t.notificationsTitle}
        </h1>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        {toggles.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-4 px-4 py-3.5"
          >
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {row.label}
            </span>
            <button
              type="button"
              onClick={row.onToggle}
              className={`min-h-[36px] min-w-[76px] rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                row.value
                  ? 'text-white'
                  : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
              style={
                row.value ? { backgroundColor: 'var(--accent-primary)' } : undefined
              }
            >
              {row.value ? t.enableBtn : t.cancel}
            </button>
          </div>
        ))}
      </div>

      {/* 3 Notification Alert Sounds */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Volume2 className="h-4.5 w-4.5" />
          <span>{t.notifSoundChoice}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sounds.map((s) => {
            const active = settings.notificationSound === s.id;
            return (
              <div
                key={s.id}
                className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${
                  active
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onUpdateSettings({ notificationSound: s.id });
                    playNotificationSound(s.id);
                  }}
                  className="flex-1 text-start text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  {s.label}
                </button>
                <button
                  type="button"
                  onClick={() => playNotificationSound(s.id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                  aria-label={t.previewSound}
                  title={t.previewSound}
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/* 5. Appearance Section (Dark / Light / Auto / Dynamic Colors)               */
/* -------------------------------------------------------------------------- */
export const AppearanceSection: React.FC<{
  t: TranslationStrings;
  isRtl: boolean;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => Promise<void>;
}> = ({ t, isRtl, settings, onUpdateSettings }) => {
  const modes: Array<{
    id: ThemeMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'dark', label: t.themeDark, icon: Moon },
    { id: 'light', label: t.themeLight, icon: Sun },
    { id: 'auto', label: t.themeAuto, icon: Laptop },
    { id: 'dynamic', label: t.themeDynamic, icon: Palette },
  ];

  const dynamicPalettes: Array<{
    id: DynamicAccent;
    labelAr: string;
    labelEn: string;
    swatch: string;
  }> = [
    { id: 'ocean', labelAr: 'أزرق محيطي', labelEn: 'Ocean Blue', swatch: '#2563EB' },
    { id: 'emerald', labelAr: 'أخضر زمردي', labelEn: 'Emerald Pulse', swatch: '#059669' },
    { id: 'amber', labelAr: 'كهرماني دافئ', labelEn: 'Amber Studio', swatch: '#D97706' },
    { id: 'crimson', labelAr: 'قرمزي سينمائي', labelEn: 'Crimson Cinema', swatch: '#DC2626' },
    {
      id: 'auto-time',
      labelAr: 'ديناميكي حسب الوقت',
      labelEn: 'Time-Adaptive',
      swatch: '#0EA5E9',
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-6">
      <div className="flex items-center gap-2.5">
        <Palette className="h-5 w-5" style={{ color: 'var(--accent-text)' }} />
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t.appearanceTitle}
        </h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {modes.map((m) => {
          const Icon = m.icon;
          const active = settings.theme === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onUpdateSettings({ theme: m.id })}
              className={`flex min-h-[72px] flex-col items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-colors cursor-pointer ${
                active
                  ? 'text-white border-transparent'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              style={active ? { backgroundColor: 'var(--accent-primary)' } : undefined}
            >
              <Icon className="h-5 w-5" />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {settings.theme === 'dynamic' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t.dynamicPaletteLabel}
          </p>
          <div className="flex flex-wrap gap-2.5">
            {dynamicPalettes.map((pal) => {
              const active = settings.dynamicAccent === pal.id;
              return (
                <button
                  key={pal.id}
                  type="button"
                  onClick={() => onUpdateSettings({ dynamicAccent: pal.id })}
                  className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold cursor-pointer ${
                    active
                      ? 'border-slate-900 dark:border-white bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: pal.swatch }}
                  />
                  <span>{isRtl ? pal.labelAr : pal.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/* 6. Connection Test Section (speed.cloudflare.com)                          */
/* -------------------------------------------------------------------------- */
export const SpeedTestSection: React.FC<{
  t: TranslationStrings;
}> = ({ t }) => {
  const [testing, setTesting] = useState(false);
  const [liveMbps, setLiveMbps] = useState<number>(0);
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSpeedTest = async () => {
    setTesting(true);
    setError(null);
    setLiveMbps(0);

    try {
      // 1. Probe latency, protocol, TLS, and HTTP Range resume against speed.cloudflare.com
      const probeRes = await fetch('/api/speedtest?mode=probe', { cache: 'no-store' });
      if (!probeRes.ok) throw new Error('Speed probe failed');
      const probe = (await probeRes.json()) as {
        latencyMs: number;
        jitterMs: number;
        protocol: string;
        tlsSecurity: string;
        resumeSupported: boolean;
        serverLabel: string;
      };

      // 2. Stream a real 6MB payload from speed.cloudflare.com/__down?bytes=6000000
      const targetBytes = 6_000_000;
      const tStart = performance.now();
      const streamRes = await fetch(`/api/speedtest?mode=stream&bytes=${targetBytes}`, {
        cache: 'no-store',
      });
      if (!streamRes.ok || !streamRes.body) {
        throw new Error('Could not stream Cloudflare test payload');
      }

      const reader = streamRes.body.getReader();
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          const elapsedSec = Math.max(0.05, (performance.now() - tStart) / 1000);
          const currentMbps = (received * 8) / (elapsedSec * 1_000_000);
          setLiveMbps(Math.round(currentMbps * 10) / 10);
        }
      }

      const totalSec = Math.max(0.05, (performance.now() - tStart) / 1000);
      const finalMbps = Math.round(((received * 8) / (totalSec * 1_000_000)) * 10) / 10;
      setLiveMbps(finalMbps);
      setResult({
        downloadMbps: finalMbps,
        latencyMs: probe.latencyMs,
        jitterMs: probe.jitterMs,
        protocol: probe.protocol,
        tlsSecurity: probe.tlsSecurity,
        resumeSupported: probe.resumeSupported,
        serverLabel: probe.serverLabel,
        testedAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speed test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Activity className="h-5 w-5" style={{ color: 'var(--accent-text)' }} />
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {t.speedTestTitle}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.speedTestProvider}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={runSpeedTest}
          disabled={testing}
          className="min-h-[44px] rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50 cursor-pointer"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          {testing ? t.testingNow : t.startTest}
        </button>
      </div>

      {/* Responsive Mobile/Desktop Speed Gauge Display */}
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 py-8 px-4">
        <span className="font-mono text-5xl sm:text-6xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
          {(testing ? liveMbps : result?.downloadMbps ?? 0).toFixed(1)}
        </span>
        <span className="mt-1 font-mono text-sm font-semibold text-slate-500 dark:text-slate-400">
          Mbps
        </span>
        {result?.serverLabel && (
          <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
            {result.serverLabel}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Telemetry Metrics Below Gauge */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.metricDownloadSpeed}
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
            {result ? `${result.downloadMbps.toFixed(1)} Mbps` : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.metricLatency}
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
            {result ? `${result.latencyMs} ms` : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.metricProtocol}
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
            {result ? result.protocol : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.metricTls}
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {result ? result.tlsSecurity : '—'}
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.metricResume}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
            {result
              ? result.resumeSupported
                ? t.supported
                : t.notSupported
              : '—'}
          </p>
        </div>
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/* 7. Download History & Excel UTF-8 BOM CSV Export                           */
/* -------------------------------------------------------------------------- */
export const HistorySection: React.FC<{
  t: TranslationStrings;
  history: DownloadHistoryRecord[];
  onClearHistory: () => Promise<void>;
}> = ({ t, history, onClearHistory }) => {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t.historyTitle}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={history.length === 0}
            onClick={() => exportHistoryToCsv(history)}
            className="inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0" />
            <span>{t.exportCsv}</span>
          </button>

          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>{t.clearHistory}</span>
            </button>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
          {t.emptyHistory}
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
          {history.map((rec) => (
            <div
              key={rec.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {rec.title}
                </p>
                <p className="mt-0.5 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                  {rec.sourceUrl}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span className="uppercase font-mono">{rec.ext}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{rec.qualityLabel}</span>
                <span aria-hidden="true">·</span>
                <span>{formatBytes(rec.sizeBytes)}</span>
                <span aria-hidden="true">·</span>
                <span>{new Date(rec.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/* 8. About Section (Changelog, Made in Egypt, Developer Amir Lamay)          */
/* -------------------------------------------------------------------------- */
export const AboutSection: React.FC<{
  t: TranslationStrings;
  isRtl: boolean;
}> = ({ t, isRtl }) => {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {t.aboutTitle}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            <span>
              {t.releaseDateLabel}: {APP_RELEASE_DATE}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              🇪🇬 {t.madeInEgypt}
            </span>
          </div>
        </div>
        <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
          v{CHANGELOG_ENTRIES[0].version}
        </span>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {t.updatesHistory}
        </h2>

        <div className="space-y-4">
          {CHANGELOG_ENTRIES.map((entry) => (
            <div
              key={entry.version}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  v{entry.version}
                </span>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {entry.date}
                </span>
              </div>
              <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300 list-disc ps-5">
                {(isRtl ? entry.changesAr : entry.changesEn).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 pt-4 text-center">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {t.developerGreeting}
        </p>
      </div>
    </section>
  );
};
