import React, { useRef, useState, useCallback } from 'react';
import { formatTime } from '@/utils/time';
import { cn } from '@/utils/cn';
import { VideoProgressThumbnail } from '@/components/video/VideoProgressThumbnail';

interface VideoProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (targetTime: number) => void;
  // 片段模式的可选偏移量（用于显示相对时间）
  startTimeOffset?: number;
  clipDuration?: number;
  /** 视频源 URL，传入后启用悬停缩略图预览 */
  videoUrl?: string | null;
}

export const VideoProgressBar: React.FC<VideoProgressBarProps> = ({
  currentTime,
  duration,
  onSeek,
  startTimeOffset = 0,
  clipDuration,
  videoUrl,
}) => {
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragRelativeTime, setDragRelativeTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // 有效边界计算
  const totalLength = clipDuration !== undefined && clipDuration > 0 ? clipDuration : duration;
  const relativeTime =
    clipDuration !== undefined
      ? Math.max(0, Math.min(currentTime - startTimeOffset, totalLength))
      : currentTime;

  // 拖拽时即时使用内部 dragRelativeTime，确保滑块圆点与进度填充柱 100% 毫无延迟完全同步
  const rawTime = isDragging && dragRelativeTime !== null ? dragRelativeTime : relativeTime;
  const activeRelativeTime = Math.max(0, Math.min(totalLength, rawTime));

  // 滑块圆点与进度填充柱百分比 (0% ~ 100%)
  const percentage = totalLength > 0 ? (activeRelativeTime / totalLength) * 100 : 0;

  const calculateTargetTime = useCallback(
    (e: React.MouseEvent | MouseEvent): { relativeTime: number; absoluteTime: number } => {
      if (!barRef.current || totalLength <= 0) {
        return { relativeTime: 0, absoluteTime: startTimeOffset };
      }
      const rect = barRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const ratio = rect.width > 0 ? clickX / rect.width : 0;
      const calcRelativeTime = Math.max(0, Math.min(totalLength, ratio * totalLength));
      return {
        relativeTime: calcRelativeTime,
        absoluteTime: startTimeOffset + calcRelativeTime,
      };
    },
    [totalLength, startTimeOffset]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const target = calculateTargetTime(e);
    setDragRelativeTime(target.relativeTime);
    onSeek(target.absoluteTime);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const moveTarget = calculateTargetTime(moveEvent);
      setDragRelativeTime(moveTarget.relativeTime);
      onSeek(moveTarget.absoluteTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragRelativeTime(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMoveOver = (e: React.MouseEvent) => {
    if (!barRef.current || totalLength <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = rect.width > 0 ? x / rect.width : 0;
    setHoverPosition(x);
    setHoverTime(ratio * totalLength);
    setContainerWidth(rect.width);
  };

  const handleMouseLeave = () => {
    if (!isDragging) {
      setHoverPosition(null);
      setHoverTime(null);
    }
  };

  // 是否展示缩略图预览（需要 videoUrl 存在且鼠标在进度条上）
  const showThumbnail = !!videoUrl && hoverPosition !== null && hoverTime !== null;
  // 缩略图使用的绝对时间 = startTimeOffset + 相对 hoverTime
  const thumbnailAbsoluteTime = hoverTime !== null ? startTimeOffset + hoverTime : 0;

  return (
    <div
      ref={barRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMoveOver}
      onMouseLeave={handleMouseLeave}
      className="relative flex items-center h-8 flex-1 cursor-pointer group py-2"
    >
      {/* 进度条背景轨道 */}
      <div className="w-full h-1.5 rounded-full bg-foreground/20 overflow-hidden relative transition-all duration-150 group-hover:h-2">
        {/* 已播放进度填充 (无过渡延迟，绝对与圆点同步) */}
        <div className="h-full bg-foreground rounded-full" style={{ width: `${percentage}%` }} />
      </div>

      {/* 进度滑块圆点 (中心严格位于 percentage 处，左右不出界) */}
      <div
        className={cn(
          'absolute size-3.5 bg-foreground rounded-full shadow-subtle -translate-x-1/2 pointer-events-none transition-transform duration-100',
          isDragging ? 'scale-125' : 'group-hover:scale-110'
        )}
        style={{ left: `${percentage}%` }}
      />

      {/* 悬停缩略图预览（带时间标签） */}
      {showThumbnail && (
        <VideoProgressThumbnail
          videoUrl={videoUrl!}
          hoverTime={thumbnailAbsoluteTime}
          position={hoverPosition!}
          containerWidth={containerWidth}
        />
      )}

      {/* 无 videoUrl 时降级为纯文字时间提示 */}
      {!videoUrl && hoverPosition !== null && hoverTime !== null && (
        <div
          className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-surface border border-border shadow-card text-[11px] font-semibold text-foreground pointer-events-none select-none"
          style={{ left: `${hoverPosition}px` }}
        >
          {formatTime(hoverTime)}
        </div>
      )}
    </div>
  );
};
