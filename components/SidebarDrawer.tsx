'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Bell,
  Download,
  FolderOpen,
  Globe,
  History,
  Info,
  Link2,
  Lock,
  Palette,
  ShieldCheck,
  Wifi,
  X,
} from 'lucide-react';
import type { SidebarSection } from '@/types/media';
import type { TranslationStrings } from '@/lib/i18n';

interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  activeSection: SidebarSection;
  onSelectSection: (section: SidebarSection) => void;
  t: TranslationStrings;
  isRtl: boolean;
  touchIdEnabled: boolean;
  onEnableTouchId: () => void;
  onLockApp: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  open,
  onClose,
  activeSection,
  onSelectSection,
  t,
  isRtl,
  touchIdEnabled,
  onEnableTouchId,
  onLockApp,
}) => {
  const navItems: Array<{
    id: SidebarSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'links', label: t.navLinks, icon: Link2 },
    { id: 'files', label: t.navFiles, icon: FolderOpen },
    {
      id: 'localshare',
      label: isRtl ? 'مشاركة محلية (P2P)' : 'Local Share (P2P)',
      icon: Wifi,
    },
    { id: 'security', label: t.navSecurity, icon: ShieldCheck },
    { id: 'general', label: t.navGeneral, icon: Globe },
    { id: 'downloads', label: t.navDownloads, icon: Download },
    { id: 'notifications', label: t.navNotifications, icon: Bell },
    { id: 'appearance', label: t.navAppearance, icon: Palette },
    { id: 'speedtest', label: t.navSpeedTest, icon: Activity },
    { id: 'history', label: t.navHistory, icon: History },
    { id: 'about', label: t.navAbout, icon: Info },
  ];

  const handleSelect = (id: SidebarSection) => {
    onSelectSection(id);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Full-screen click-outside backdrop that closes sidebar on tap/click anywhere */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs cursor-pointer"
            aria-label="Close sidebar overlay"
          />

          <motion.aside
            initial={{ x: isRtl ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: isRtl ? '100%' : '-100%' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`relative z-10 flex h-full w-80 max-w-[85vw] flex-col border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1322] shadow-2xl ${
              isRtl ? 'ms-auto border-s' : 'me-auto border-e'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {t.appName}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Touch ID Quick Enable / Close Actions shown in sidebar when Touch ID is activated */}
            {touchIdEnabled && (
              <div className="mx-4 mt-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-3">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" style={{ color: 'var(--accent-text)' }} />
                    <span>Touch ID</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={onEnableTouchId}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                      style={{ backgroundColor: 'var(--accent-primary)' }}
                    >
                      {t.enableBtn}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onLockApp();
                      }}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                    >
                      {t.lockBtn}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Links */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={`flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? 'text-slate-950 dark:text-white font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: 'var(--accent-soft)',
                            color: 'var(--accent-text)',
                          }
                        : undefined
                    }
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Bottom Developer Greeting */}
            <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-3.5 text-center">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {t.developerGreeting}
              </p>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
