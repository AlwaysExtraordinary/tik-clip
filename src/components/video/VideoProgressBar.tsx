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
      {/* 进度条背景轨道 (仅高度参与过渡，杜绝任何全局过渡污染) */}
      <div className="relative w-full h-1.5 rounded-full bg-foreground/20 transition-[height] duration-150 ease-out group-hover:h-2">
        {/* 已播放进度填充柱 (零延迟绝对即时响应) */}
        <div
          className="h-full bg-foreground rounded-full transition-none"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* 进度滑块圆点：外层定位容器 + 内层正圆 + GPU 合成层提升，杜绝亚像素椭圆变形 */}
      <div
        className="absolute top-1/2 w-0 h-0 pointer-events-none"
        style={{ left: `${percentage}%` }}
      >
        <div
          className={cn(
            'absolute -left-1.5 -top-1.5',
            'w-3 h-3 rounded-full bg-foreground shadow-sm',
            'transition-[scale] duration-100 ease-out',
            isDragging ? 'scale-125' : 'group-hover:scale-110'
          )}
          style={{ transform: 'translateZ(0)' }}
        />
      </div>

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
