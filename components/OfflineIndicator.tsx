'use client';

import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  message: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ message }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 start-4 z-50 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/95 px-3.5 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-xs">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
};
