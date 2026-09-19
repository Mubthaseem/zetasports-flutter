import React from 'react';
import { StatItem } from '../types.js';

interface Props {
  stat: StatItem;
}

export const StatBar: React.FC<Props> = ({ stat }) => {
  const parseNum = (val: string | number): number => {
    if (typeof val === 'number') return val;
    const clean = val.replace('%', '').trim();
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const homeVal = parseNum(stat.homeValue);
  const awayVal = parseNum(stat.awayValue);
  const total = homeVal + awayVal;

  const homePercent = total > 0 ? (homeVal / total) * 100 : 50;
  const awayPercent = total > 0 ? (awayVal / total) * 100 : 50;

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
        <span className="font-mono text-sm text-slate-200">{stat.homeValue}</span>
        <span className="text-slate-400 uppercase tracking-wider text-[11px] font-bold text-center px-2">
          {stat.title}
        </span>
        <span className="font-mono text-sm text-slate-200">{stat.awayValue}</span>
      </div>

      {/* Comparison Progress Bar */}
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex gap-1 p-0.5">
        <div
          className="h-full bg-zeta-blue rounded-l-full transition-all duration-500"
          style={{ width: `${homePercent}%` }}
        />
        <div
          className="h-full bg-zeta-neon rounded-r-full transition-all duration-500"
          style={{ width: `${awayPercent}%` }}
        />
      </div>
    </div>
  );
};
