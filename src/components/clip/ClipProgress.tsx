import React from 'react';
import { formatSecondsShort } from '@/utils/time';
import { cn } from '@/utils/cn';

interface ClipProgressProps {
  currentTime: number;
  startTime: number;
  endTime: number;
}

/**
 * 根据剩余时间（时 / 分 / 秒区间）获取轨道与文本的固定宽度类名
 * 避免播放过程中因数字位数与字符宽度变化导致进度条容器伸缩抖动
 */
function getTimeIntervalConfig(remaining: number) {
  if (remaining >= 3600) {
    // 小时区间 (如 "1h 12min 30s")
    return {
      trackWidth: 'w-24',
      textWidth: 'w-18',
    };
  }
  if (remaining >= 60) {
    // 分钟区间 (如 "12min 30s")
    return {
      trackWidth: 'w-24',
      textWidth: 'w-14',
    };
  }
  // 秒区间 (如 "45s", "9.4s")
  return {
    trackWidth: 'w-24',
    textWidth: 'w-7',
  };
}

export const ClipProgress: React.FC<ClipProgressProps> = ({ currentTime, startTime, endTime }) => {
  const clipDuration = Math.max(0.1, endTime - startTime);
  const elapsed = Math.max(0, Math.min(currentTime - startTime, clipDuration));
  const remaining = Math.max(0, endTime - currentTime);
  const percentage = Math.min(100, Math.max(0, (elapsed / clipDuration) * 100));

  const { trackWidth, textWidth } = getTimeIntervalConfig(remaining);

  return (
    <div
      className="absolute bottom-6 right-6 z-20 flex items-center gap-2 bg-surface/80 
      backdrop-blur-md px-4 py-2 rounded-2xl border border-border/40 shadow-card animate-in 
      fade-in duration-300 pointer-events-none"
    >
      {/* 迷你进度条轨道 */}
      <div
        className={cn(
          'h-1.5 bg-foreground/20 rounded-full overflow-hidden transition-[width] duration-200',
          trackWidth
        )}
      >
        <div
          className="h-full bg-foreground rounded-full transition-all duration-75"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* 剩余时间文本 */}
      <span
        className={cn(
          'text-xs font-medium text-foreground-muted whitespace-nowrap text-right tabular-nums',
          textWidth
        )}
      >
        {formatSecondsShort(remaining)}
      </span>
    </div>
  );
};
