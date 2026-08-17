import React from 'react';
import { formatSecondsShort } from '@/utils/time';

interface ClipProgressProps {
  currentTime: number;
  startTime: number;
  endTime: number;
}

export const ClipProgress: React.FC<ClipProgressProps> = ({ currentTime, startTime, endTime }) => {
  const clipDuration = Math.max(0.1, endTime - startTime);
  const elapsed = Math.max(0, Math.min(currentTime - startTime, clipDuration));
  const remaining = Math.max(0, endTime - currentTime);
  const percentage = Math.min(100, Math.max(0, (elapsed / clipDuration) * 100));

  return (
    <div
      className="absolute bottom-6 right-6 z-20 flex items-center gap-3 bg-surface/80 
      backdrop-blur-md px-4 py-2 rounded-2xl border border-border/40 shadow-card animate-in 
      fade-in duration-300 pointer-events-none"
    >
      {/* 迷你进度条轨道 */}
      <div className="w-24 h-1.5 bg-foreground/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-foreground rounded-full transition-all duration-75"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* 剩余时间文本 */}
      <span className="text-xs font-medium text-foreground-muted whitespace-nowrap">
        {formatSecondsShort(remaining)}
      </span>
    </div>
  );
};
