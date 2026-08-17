import React from 'react';
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

  const displayCurrentTime =
    clipDuration !== undefined
      ? Math.max(0, Math.min(currentTime - startTimeOffset, clipDuration))
      : currentTime;

  const displayTotalDuration = clipDuration !== undefined ? clipDuration : duration;

  return (
    <div
      className={cn(
        'w-full flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-3',
        'bg-surface/85 backdrop-blur-md border border-border/40 rounded-2xl',
        'shadow-floating select-none transition-all duration-200'
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
          'w-9 h-9 sm:w-10 sm:h-10 rounded-full border-[1.5px] border-foreground/80 cursor-pointer',
          'flex items-center justify-center text-foreground/80 hover:border-foreground',
          'hover:scale-105 active:scale-95 transition-all shadow-subtle shrink-0'
        )}
      >
        <Icon icon={isPlaying ? 'lucide:pause' : 'lucide:play'} className="w-4 h-4 sm:w-5 sm:h-5" />
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
      <div className="flex-1 flex items-center mx-1 sm:mx-2 min-w-0">
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
      <div className="text-xs font-semibold text-foreground whitespace-nowrap hidden sm:block shrink-0">
        {formatTime(displayCurrentTime)} / {formatTime(displayTotalDuration)}
      </div>

      {/* 画面比例模式切换 (Contain / Cover) */}
      {onToggleFitMode && (
        <VideoControlButton
          onClick={onToggleFitMode}
          aria-label={fitMode === 'cover' ? t('player.switchToContain') : t('player.switchToCover')}
          title={fitMode === 'cover' ? t('player.containMode') : t('player.coverMode')}
          icon={fitMode === 'cover' ? 'lucide:crop' : 'lucide:rectangle-horizontal'}
        />
      )}

      {/* 倒计时显示开关（仅片段模式展示） */}
      {showCountdownToggle && onToggleCountdown && (
        <VideoControlButton
          onClick={onToggleCountdown}
          aria-label={showCountdown ? t('player.hideTimerAria') : t('player.showTimerAria')}
          title={showCountdown ? t('player.hideTimer') : t('player.showTimer')}
          icon={showCountdown ? 'lucide:timer' : 'lucide:timer-off'}
          isActive={showCountdown}
        />
      )}

      {/* 音量控制按钮 */}
      {onVolumeChange && onToggleMute && (
        <VolumeControl
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={onVolumeChange}
          onToggleMute={onToggleMute}
        />
      )}

      {/* 全屏按钮 */}
      <VideoControlButton
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
        title={isFullscreen ? t('player.exitFullscreen') : t('player.fullscreen')}
        icon={isFullscreen ? 'lucide:minimize' : 'lucide:maximize'}
      />
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
  iconClassName = 'w-5 h-5',
  isActive = true,
  className,
  children,
  ...props
}) => {
  return (
    <button
      type="button"
      className={cn(
        'p-1.5 rounded-full hover:bg-foreground/10 transition-colors shrink-0 cursor-pointer',
        ' disabled:opacity-30 disabled:pointer-events-none',
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
