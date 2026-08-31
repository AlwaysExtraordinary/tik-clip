import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { VideoControlButton } from '@/components/video/VideoControls';
import { cn } from '@/utils/cn';

export interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  className?: string;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  className,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragVolume, setDragVolume] = useState<number | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 拖拽时即时使用内部 dragVolume，确保滑块与音量填充柱 100% 毫无延迟同步
  const rawVol = isDragging && dragVolume !== null ? dragVolume : isMuted ? 0 : volume;
  const activeVol = Math.max(0, Math.min(1, rawVol));
  const displayPercent = Math.round(activeVol * 100);

  const getVolumeIcon = () => {
    if (isMuted || activeVol === 0) {
      return 'lucide:volume-x';
    }
    if (activeVol < 0.5) {
      return 'lucide:volume-1';
    }
    return 'lucide:volume-2';
  };

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (isDragging) return;
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const calculateVolumeFromY = useCallback((clientY: number): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    if (rect.height <= 0) return 0;
    const clampedY = Math.max(rect.top, Math.min(rect.bottom, clientY));
    const ratio = (rect.bottom - clampedY) / rect.height;
    return Math.max(0, Math.min(1, ratio));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);

    const initialVol = calculateVolumeFromY(e.clientY);
    setDragVolume(initialVol);
    onVolumeChange(initialVol);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const movedVol = calculateVolumeFromY(moveEvent.clientY);
      setDragVolume(movedVol);
      onVolumeChange(movedVol);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);
      setDragVolume(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (containerRef.current && !containerRef.current.contains(upEvent.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const currentVolRef = useRef(activeVol);
  const onVolumeChangeRef = useRef(onVolumeChange);

  useEffect(() => {
    currentVolRef.current = activeVol;
  }, [activeVol]);

  useEffect(() => {
    onVolumeChangeRef.current = onVolumeChange;
  }, [onVolumeChange]);

  // 使用原生 wheel 事件监听阻止事件向外冒泡至父容器（避免触发视频切换），并平滑低灵敏度调节音量
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();

      let deltaY = e.deltaY;
      if (e.deltaMode === 1) deltaY *= 20;
      else if (e.deltaMode === 2) deltaY *= 100;

      // 降低灵敏度：鼠标滚轮单格约 3%，触控板平滑渐变
      const step = -deltaY * 0.0003;
      if (step === 0) return;

      const nextVol = Math.max(0, Math.min(1, Number((currentVolRef.current + step).toFixed(4))));
      currentVolRef.current = nextVol;
      onVolumeChangeRef.current(nextVol);
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn('relative flex items-center justify-center', className)}
    >
      {/* 垂直悬浮音量调节面板 */}
      <div
        className={cn(
          'absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-30',
          'flex flex-col items-center pt-2.5 pb-3 w-9 rounded-full',
          'bg-surface/95 backdrop-blur-md border border-border/50 shadow-floating select-none',
          'transition-all duration-200 origin-bottom',
          isOpen || isDragging
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 音量百分比文本 */}
        <span className="text-[11px] font-semibold text-foreground/80 mb-2 select-none tracking-tight">
          {displayPercent}
        </span>

        {/* 垂直滑块轨道 (精确匹配滑轨物理范围，圆点中心绝对约束在 0% ~ 100%) */}
        <div
          ref={trackRef}
          onMouseDown={handleMouseDown}
          className="relative w-6 h-28 flex items-center justify-center cursor-pointer group/track"
        >
          {/* 背景轨道 */}
          <div className="w-1.5 h-full rounded-full bg-foreground/20 relative overflow-hidden group-hover/track:w-2 transition-[width] ease-in-out duration-100">
            {/* 已填充音量柱 (无过渡延迟，绝对与圆点同步) */}
            <div
              className="absolute bottom-0 inset-x-0 bg-foreground rounded-full"
              style={{ height: `${activeVol * 100}%` }}
            />
          </div>

          {/* 滑块圆点 (中心严格位于 activeVol * 100% 处，从底到顶不出界) */}
          <div
            className={cn(
              'absolute w-3.5 h-3.5 bg-foreground rounded-full shadow-subtle pointer-events-none translate-y-1/2 transition-transform duration-100',
              isDragging ? 'scale-125' : 'group-hover/track:scale-110'
            )}
            style={{
              bottom: `${activeVol * 100}%`,
            }}
          />
        </div>
      </div>

      {/* 控制栏主音量按钮 */}
      <VideoControlButton
        onClick={onToggleMute}
        aria-label={isMuted ? t('player.unmute') : t('player.mute')}
        title={isMuted ? t('player.unmute') : `${t('player.volume')} (${displayPercent}%)`}
        icon={getVolumeIcon()}
      />
    </div>
  );
};
