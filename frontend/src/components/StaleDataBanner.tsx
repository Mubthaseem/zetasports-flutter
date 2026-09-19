import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { SyncMeta } from '../types.js';

interface Props {
  meta: SyncMeta | null;
}

export const StaleDataBanner: React.FC<Props> = ({ meta }) => {
  if (!meta || !meta.lastSuccessfulSync) return null;

  const lastSyncTime = new Date(meta.lastSuccessfulSync).getTime();
  const now = Date.now();
  const diffMinutes = Math.floor((now - lastSyncTime) / (1000 * 60));

  // If sync is older than 60 minutes, alert the user
  const isStale = diffMinutes > 60;

  if (!isStale) return null;

  return (
    <div className="bg-amber-950/70 border border-amber-600/50 text-amber-200 px-4 py-2.5 rounded-lg flex items-center justify-between gap-3 text-sm shadow-md mb-4 backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong>Data freshness notice:</strong> Match data was last synchronized <strong>{diffMinutes} minutes ago</strong>. Scheduled GitHub Actions workflow may be awaiting run window.
        </span>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-300/80 font-mono">
        <Clock className="w-3.5 h-3.5" />
        <span>{new Date(meta.lastSuccessfulSync).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};
