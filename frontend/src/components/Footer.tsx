import React from 'react';
import { Github, Database, Cpu, Activity, Clock } from 'lucide-react';
import { SyncMeta } from '../types.js';

interface Props {
  meta: SyncMeta | null;
}

export const Footer: React.FC<Props> = ({ meta }) => {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-white text-slate-600 text-sm shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Col 1: System info */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-900 text-base">ZETA SPORTS</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono font-semibold">
                GITHUB FREE ARCHITECTURE
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md">
              A 100% serverless, zero-cost football data platform powered by GitHub Actions automated workflows, version-controlled JSON data feeds, and GitHub Pages static hosting.
            </p>
            <div className="flex items-center gap-4 pt-2 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-600" />
                <span>Source: {meta?.provider || 'FotMob Public'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pipeline: GitHub Actions</span>
              </div>
            </div>
          </div>

          {/* Col 2: Sync Status */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Sync Health</h4>
            <ul className="text-xs space-y-1.5 text-slate-600">
              <li className="flex items-center justify-between">
                <span>Active Matches:</span>
                <span className="font-mono text-blue-600 font-bold">{meta?.activeMatchesCount ?? 0}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Tracked Leagues:</span>
                <span className="font-mono text-slate-900 font-bold">{meta?.totalCompetitions ?? 24}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Last Refresh:</span>
                <span className="font-mono text-slate-700 font-semibold">
                  {meta?.lastSuccessfulSync ? new Date(meta.lastSuccessfulSync).toLocaleTimeString() : 'Recently'}
                </span>
              </li>
            </ul>
          </div>

          {/* Col 3: Links */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Repository</h4>
            <div className="space-y-2">
              <a
                href="https://github.com/Mubthaseem/zetasports-flutter"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs text-slate-800 border border-slate-200 transition-colors shadow-sm font-medium"
              >
                <Github className="w-4 h-4 text-blue-600" />
                <span>GitHub Repository</span>
              </a>
              <div className="text-[11px] text-slate-400">
                Public JSON feeds accessible via <code>/data/</code>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div>
            &copy; {new Date().getFullYear()} ZETA SPORTS. All match data synchronized for informational purposes.
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <span>White Modern Mode</span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> System Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
