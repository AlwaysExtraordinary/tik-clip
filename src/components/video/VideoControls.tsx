import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTranslation } from 'react-i18next';
import { VideoProgressBar } from '@/components/video/VideoProgressBar';
import { VolumeControl } from '@/components/video/VolumeControl';
import { formatTime } from '@/utils/time';
import { cn } from '@/utils/cn';
import { VideoFitMode } from '@/stores/playerStore';

interface VideoControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSeek: (time: number) => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  // 片段模式下的专属偏移量
  startTimeOffset?: number;
  clipDuration?: number;
  hasPrevious?: boolean;
  hasNext?: boolean;
  // 画面比例切换
  fitMode?: VideoFitMode;
  onToggleFitMode?: () => void;
  // 倒计时显示开关（仅片段模式支持）
  showCountdownToggle?: boolean;
  showCountdown?: boolean;
  onToggleCountdown?: () => void;
  // 音量与静音控制
  volume?: number;
  isMuted?: boolean;
  onVolumeChange?: (volume: number) => void;
  onToggleMute?: () => void;
  /** 视频源 URL，传入后在进度条悬停时显示缩略图预览 */
  videoUrl?: string | null;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onPrevious,
  onNext,
  onSeek,
  onToggleFullscreen,
  isFullscreen,
  startTimeOffset = 0,
  clipDuration,
  hasPrevious = true,
  hasNext = true,
  fitMode = 'contain',
  onToggleFitMode,
  showCountdownToggle = false,
  showCountdown = true,
  onToggleCountdown,
  volume = 1,
  isMuted = false,
  onVolumeChange,
  onToggleMute,
  videoUrl,
}) => {
  const { t } = useTranslation();
  // 更多操作菜单状态
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // 点击菜单外部自动关闭移动端悬浮菜单
  useEffect(() => {
    if (!isMoreOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isMoreOpen]);

  const displayCurrentTime =
    clipDuration !== undefined
      ? Math.max(0, Math.min(currentTime - startTimeOffset, clipDuration))
      : currentTime;

  const displayTotalDuration = clipDuration !== undefined ? clipDuration : duration;

  return (
    <div
      className={cn(
        'flex w-full items-center gap-1.5 px-2.5 py-1.5 sm:gap-2 sm:px-3.5 sm:py-2 md:gap-3 md:px-5 md:py-2.5',
        'bg-surface/85 border-border/40 rounded-full border backdrop-blur-md',
        'shadow-floating transition-all duration-200 select-none'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 上一个按钮 */}
      <VideoControlButton
        onClick={onPrevious}
        disabled={!onPrevious || !hasPrevious}
        aria-label={t('player.previous')}
        title={t('player.previous')}
        icon="lucide:skip-back"
      />

      {/* 播放/暂停按钮 */}
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={isPlaying ? t('player.pause') : t('player.play')}
        title={isPlaying ? t('player.pause') : t('player.play')}
        className={cn(
          'border-foreground/80 h-8 w-8 cursor-pointer rounded-full border-[1.5px] sm:h-9 sm:w-9 md:h-10 md:w-10',
          'text-foreground/80 hover:border-foreground flex items-center justify-center',
          'shadow-subtle shrink-0 transition-all hover:scale-105 active:scale-95'
        )}
      >
        <Icon
          icon={isPlaying ? 'lucide:pause' : 'lucide:play'}
          className="h-4 w-4 sm:h-4.5 sm:w-4.5 md:h-5 md:w-5"
        />
      </button>

      {/* 下一个按钮 */}
      <VideoControlButton
        onClick={onNext}
        disabled={!onNext || !hasNext}
        aria-label={t('player.next')}
        title={t('player.next')}
        icon="lucide:skip-forward"
      />

      {/* 进度条调节器 */}
      <div className="mx-0.5 flex min-w-0 flex-1 items-center sm:mx-1 md:mx-2">
        <VideoProgressBar
          currentTime={currentTime}
          duration={duration}
          onSeek={onSeek}
          startTimeOffset={startTimeOffset}
          clipDuration={clipDuration}
          videoUrl={videoUrl}
        />
      </div>

      {/* 时间显示 */}
      <div className="text-foreground shrink-0 text-xs font-semibold whitespace-nowrap">
        {formatTime(displayCurrentTime)} / {formatTime(displayTotalDuration)}
      </div>

      {/* 画面比例模式切换 (Contain / Cover) - 桌面端 */}
      {onToggleFitMode && (
        <VideoControlButton
          className="hidden sm:inline-flex"
          onClick={onToggleFitMode}
          aria-label={fitMode === 'cover' ? t('player.switchToContain') : t('player.switchToCover')}
          title={fitMode === 'cover' ? t('player.containMode') : t('player.coverMode')}
          icon={fitMode === 'cover' ? 'lucide:crop' : 'lucide:rectangle-horizontal'}
        />
      )}

      {/* 倒计时显示开关（仅片段模式展示） - 桌面端 */}
      {showCountdownToggle && onToggleCountdown && (
        <VideoControlButton
          className="hidden sm:inline-flex"
          onClick={onToggleCountdown}
          aria-label={showCountdown ? t('player.hideTimerAria') : t('player.showTimerAria')}
          title={showCountdown ? t('player.hideTimer') : t('player.showTimer')}
          icon={showCountdown ? 'lucide:timer' : 'lucide:timer-off'}
          isActive={showCountdown}
        />
      )}

      {/* 音量控制按钮（所有尺寸常驻显示） */}
      {onVolumeChange && onToggleMute && (
        <VolumeControl
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={onVolumeChange}
          onToggleMute={onToggleMute}
        />
      )}

      {/* 全屏按钮 - 桌面端 */}
      <VideoControlButton
        className="hidden sm:inline-flex"
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
        title={isFullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
        icon={isFullscreen ? 'lucide:minimize' : 'lucide:maximize'}
      />

      {/* 移动端更多操作悬浮菜单 (< sm) */}
      <div ref={moreMenuRef} className="relative flex items-center justify-center sm:hidden">
        {/* 垂直悬浮菜单面板 */}
        <div
          className={cn(
            'absolute bottom-full left-1/2 z-30 mb-3 -translate-x-1/2',
            'flex w-9 flex-col items-center gap-1.5 rounded-full p-1.5',
            'bg-surface/95 border-border/50 shadow-floating border backdrop-blur-md select-none',
            'origin-bottom transition-all duration-200',
            isMoreOpen
              ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none translate-y-2 scale-95 opacity-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 画面比例模式切换 */}
          {onToggleFitMode && (
            <VideoControlButton
              onClick={() => {
                onToggleFitMode();
                setIsMoreOpen(false);
              }}
              aria-label={
                fitMode === 'cover' ? t('player.switchToContain') : t('player.switchToCover')
              }
              title={fitMode === 'cover' ? t('player.containMode') : t('player.coverMode')}
              icon={fitMode === 'cover' ? 'lucide:crop' : 'lucide:rectangle-horizontal'}
            />
          )}

          {/* 倒计时显示开关 */}
          {showCountdownToggle && onToggleCountdown && (
            <VideoControlButton
              onClick={() => {
                onToggleCountdown();
                setIsMoreOpen(false);
              }}
              aria-label={showCountdown ? t('player.hideTimerAria') : t('player.showTimerAria')}
              title={showCountdown ? t('player.hideTimer') : t('player.showTimer')}
              icon={showCountdown ? 'lucide:timer' : 'lucide:timer-off'}
              isActive={showCountdown}
            />
          )}

          {/* 全屏按钮 */}
          <VideoControlButton
            onClick={() => {
              onToggleFullscreen();
              setIsMoreOpen(false);
            }}
            aria-label={isFullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
            title={isFullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
            icon={isFullscreen ? 'lucide:minimize' : 'lucide:maximize'}
          />
        </div>

        {/* 更多按钮 */}
        <VideoControlButton
          onClick={() => setIsMoreOpen((prev) => !prev)}
          aria-label={t('common.more')}
          title={t('common.more')}
          icon="lucide:ellipsis"
          aria-expanded={isMoreOpen}
          aria-haspopup="menu"
        />
      </div>
    </div>
  );
};

interface VideoControlButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: string;
  iconClassName?: string;
  isActive?: boolean;
}

export const VideoControlButton: React.FC<VideoControlButtonProps> = ({
  icon,
  iconClassName = 'w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5',
  isActive = true,
  className,
  children,
  ...props
}) => {
  return (
    <button
      type="button"
      className={cn(
        'hover:bg-foreground/10 shrink-0 cursor-pointer rounded-full p-1 transition-colors sm:p-1.5',
        'disabled:pointer-events-none disabled:opacity-30',
        isActive
          ? 'text-foreground/80 hover:text-foreground'
          : 'text-foreground/40 hover:text-foreground/70',
        className
      )}
      {...props}
    >
      {icon ? <Icon icon={icon} className={iconClassName} /> : children}
    </button>
  );
};
