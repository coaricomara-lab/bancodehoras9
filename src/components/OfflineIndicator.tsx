import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff, AlertTriangle } from 'lucide-react';

interface OfflineIndicatorProps {
  theme?: 'dark' | 'light';
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ theme = 'dark' }) => {
  const isOnline = useOnlineStatus();
  const isDark = theme === 'dark';

  if (isOnline) {
    return null;
  }

  return (
    <div 
      className={`fixed bottom-4 left-4 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-2xl border transition-all animate-in slide-in-from-bottom-4 duration-300 ${
        isDark 
          ? 'bg-amber-950/90 text-amber-200 border-amber-700/60 backdrop-blur-md shadow-amber-950/50' 
          : 'bg-amber-500 text-white border-amber-600 shadow-amber-900/20'
      }`}
      role="alert"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
      </span>
      <div className="flex items-center gap-1.5">
        <WifiOff className="w-3.5 h-3.5" />
        <span>Modo Offline • Operando com dados em cache local</span>
      </div>
    </div>
  );
};
