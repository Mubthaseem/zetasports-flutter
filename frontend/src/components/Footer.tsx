import React from 'react';
import { Github, Database, Cpu, Activity, Clock } from 'lucide-react';
import { SyncMeta } from '../types.js';

interface Props {
  meta: SyncMeta | null;
}

export const Footer: React.FC<Props> = ({ meta }) => {
  return (
    <footer className="mt-20 border-t border-zeta-border bg-zeta-dark/80 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Col 1: System info */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-white text-base">ZETA SPORTS</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-zeta-blue/10 text-zeta-blue border border-zeta-blue/30 font-mono">
                GITHUB FREE ARCHITECTURE
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              A 100% serverless, zero-cost football data platform powered by GitHub Actions automated workflows, version-controlled JSON data feeds, and GitHub Pages static hosting.
            </p>
            <div className="flex items-center gap-4 pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-zeta-blue" />
                <span>Source: {meta?.provider || 'FotMob Public'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-zeta-green" />
                <span>Pipeline: GitHub Actions</span>
              </div>
            </div>
          </div>

          {/* Col 2: Sync Status */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Sync Health</h4>
            <ul className="text-xs space-y-1.5 text-slate-400">
              <li className="flex items-center justify-between">
                <span>Active Matches:</span>
                <span className="font-mono text-zeta-blue font-bold">{meta?.activeMatchesCount ?? 0}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Tracked Leagues:</span>
                <span className="font-mono text-slate-200 font-bold">{meta?.totalCompetitions ?? 24}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Last Refresh:</span>
                <span className="font-mono text-slate-300">
                  {meta?.lastSuccessfulSync ? new Date(meta.lastSuccessfulSync).toLocaleTimeString() : 'Recently'}
                </span>
              </li>
            </ul>
          </div>

          {/* Col 3: Links */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Repository</h4>
            <div className="space-y-2">
              <a
                href="https://github.com/Mubthaseem/zetasports-flutter"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zeta-card hover:bg-zeta-cardHover text-xs text-slate-200 border border-zeta-border transition-colors"
              >
                <Github className="w-4 h-4 text-zeta-blue" />
                <span>GitHub Repository</span>
              </a>
              <div className="text-[11px] text-slate-500">
                Public JSON feeds accessible via <code>/data/</code>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-zeta-border/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <div>
            &copy; {new Date().getFullYear()} ZETA SPORTS. All match data synchronized for informational purposes.
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Dark Broadcast Mode</span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zeta-green"></span> System Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
