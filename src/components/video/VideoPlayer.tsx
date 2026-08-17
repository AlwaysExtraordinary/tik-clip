import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { VideoControls } from '@/components/video/VideoControls';
import { ClipProgress } from '@/components/clip/ClipProgress';
import { usePlayerStore, VideoFitMode } from '@/stores/playerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';

interface VideoPlayerProps {
  file: File | null;
  startTime?: number;
  endTime?: number;
  initialTime?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onClipEnded?: () => void;
  showScissorsButton?: boolean;
  onCurrentTimeChange?: (time: number) => void;
  className?: string;
  hasPrevious?: boolean;
  hasNext?: boolean;
  enableKeyboardShortcuts?: boolean;
  isExiting?: boolean;
  fitMode?: VideoFitMode;
  onToggleFitMode?: () => void;
  showCountdown?: boolean;
  onToggleCountdown?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  file,
  startTime,
  endTime,
  initialTime,
  onPrevious,
  onNext,
  onClipEnded,
  showScissorsButton = false,
  onCurrentTimeChange,
  className = '',
  hasPrevious = true,
  hasNext = true,
  enableKeyboardShortcuts = true,
  isExiting = false,
  fitMode: fitModeProp,
  onToggleFitMode,
  showCountdown: showCountdownProp,
  onToggleCountdown,
  isFullscreen: isFullscreenProp,
  onToggleFullscreen: onToggleFullscreenProp,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(() =>
    file ? URL.createObjectURL(file) : null
  );
  const activeUrlRef = useRef<string | null>(videoUrl);
  const isFirstMountRef = useRef(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const isFullscreen = isFullscreenProp !== undefined ? isFullscreenProp : internalFullscreen;

  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    toggleClipPanel,
    seekTargetTime,
    requestSeek,
    fitMode: storeFitMode,
    toggleFitMode: storeToggleFitMode,
    showCountdown: storeShowCountdown,
    toggleShowCountdown: storeToggleShowCountdown,
    volume,
    isMuted,
    setVolume,
    toggleMute,
  } = usePlayerStore();

  const { showThumbnailPreview } = useSettingsStore();

  const activeFitMode = fitModeProp ?? storeFitMode;
  const handleToggleFitMode = onToggleFitMode ?? storeToggleFitMode;

  const activeShowCountdown = showCountdownProp ?? storeShowCountdown;
  const handleToggleCountdown = onToggleCountdown ?? storeToggleShowCountdown;

  // 同步音量和静音状态到视频元素
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const isClipMode = startTime !== undefined && endTime !== undefined;
  const clipDuration = isClipMode ? Math.max(0.1, (endTime || 0) - (startTime || 0)) : undefined;

  // 管理视频 Object URL 生命周期
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      const initialUrl = activeUrlRef.current;
      return () => {
        if (initialUrl) {
          URL.revokeObjectURL(initialUrl);
        }
      };
    }

    if (!file) {
      setVideoUrl(null);
      activeUrlRef.current = null;
      return;
    }

    const url = URL.createObjectURL(file);
    activeUrlRef.current = url;
    setVideoUrl(url);

    return () => {
      URL.revokeObjectURL(url);
      activeUrlRef.current = null;
    };
  }, [file]);

  // 处理来自外部状态的跳转请求（例如编辑片段或点击时间标签）
  useEffect(() => {
    if (seekTargetTime !== null && videoRef.current) {
      videoRef.current.currentTime = seekTargetTime;
      setCurrentTime(seekTargetTime);
      requestSeek(null);
    }
  }, [seekTargetTime, requestSeek]);

  // 管理控制器自动隐藏的无操作定时器
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    if (isPlaying) {
      hideControlsTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [isPlaying, resetHideTimer]);

  const handleMouseMove = () => {
    resetHideTimer();
  };

  // 播放控制处理函数
  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      // 若已到达片段末尾，播放前先跳回片段开头
      if (isClipMode && endTime !== undefined && video.currentTime >= endTime - 0.05) {
        video.currentTime = startTime || 0;
      }
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  }, [isClipMode, startTime, endTime]);

  const handleSeek = useCallback(
    (target: number) => {
      const video = videoRef.current;
      if (!video) return;

      const clamped = Math.max(0, Math.min(target, duration || 999999));
      video.currentTime = clamped;
      setCurrentTime(clamped);
      onCurrentTimeChange?.(clamped);
    },
    [duration, onCurrentTimeChange]
  );

  const handleSeekOffset = useCallback(
    (offset: number) => {
      if (!videoRef.current) return;
      handleSeek(videoRef.current.currentTime + offset);
    },
    [handleSeek]
  );

  const handleToggleFullscreen = useCallback(() => {
    if (onToggleFullscreenProp) {
      onToggleFullscreenProp();
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(console.error);
    } else {
      document.exitFullscreen?.().catch(console.error);
    }
  }, [onToggleFullscreenProp]);

  // 监听全屏状态变更（仅在未传入外部 isFullscreenProp 时监听）
  useEffect(() => {
    if (isFullscreenProp !== undefined) return;

    const handleFullscreenChange = () => {
      setInternalFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isFullscreenProp]);

  // 键盘快捷键
  useKeyboardShortcuts(
    {
      onTogglePlay: handleTogglePlay,
      onSeekBackward: (sec) => handleSeekOffset(-(sec || 3)),
      onSeekForward: (sec) => handleSeekOffset(sec || 3),
      onPrevious,
      onNext,
      onToggleFullscreen: handleToggleFullscreen,
      onToggleMute: toggleMute,
    },
    enableKeyboardShortcuts
  );

  // 当处于退出动画阶段时立即暂停并静音
  useEffect(() => {
    if (isExiting && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isExiting]);

  // Video 原生事件处理
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    setDuration(video.duration || 0);
    video.volume = volume;
    video.muted = isMuted;

    if (isClipMode && startTime !== undefined) {
      const targetTime =
        initialTime !== undefined &&
        initialTime >= startTime &&
        (endTime === undefined || initialTime < endTime)
          ? initialTime
          : startTime;
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
      onCurrentTimeChange?.(targetTime);
    } else if (initialTime !== undefined && initialTime > 0) {
      video.currentTime = initialTime;
      setCurrentTime(initialTime);
      onCurrentTimeChange?.(initialTime);
    }

    // 片段模式下切换片段时自动播放
    video.play().catch(() => {
      // 带音频的自动播放可能需要用户手势交互，受阻时由用户手动点击播放
    });
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const time = video.currentTime;
    setCurrentTime(time);
    onCurrentTimeChange?.(time);

    // 片段边界控制与限制
    if (isClipMode && endTime !== undefined && time >= endTime) {
      video.pause();
      setIsPlaying(false);
      onClipEnded?.();
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onClick={resetHideTimer}
      className={`relative w-full h-full bg-surface ${
        isFullscreen ? 'rounded-none border-0' : 'rounded-3xl border border-border/40'
      } overflow-hidden shadow-card select-none  ${className}`}
    >
      {/* 视频播放器元素（独占全屏容器） */}
      <div
        className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden"
        onClick={handleTogglePlay}
      >
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            playsInline
            style={{ objectFit: activeFitMode }}
            className={`block w-full h-full min-w-full min-h-full ${
              activeFitMode === 'cover' ? 'object-cover' : 'object-contain'
            }`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-foreground-muted gap-2">
            <Icon icon="lucide:video" className="w-12 h-12 opacity-30" />
            <p className="text-xs font-medium">{t('player.loading')}</p>
          </div>
        )}

        {/* 右上角剪刀 / 添加片段按钮 */}
        {showScissorsButton && (
          <div
            className={`absolute top-5 right-5 z-20 transition-opacity duration-300 ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={toggleClipPanel}
              aria-label={t('player.addOrEditClips')}
              title={t('player.addOrEditClips')}
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-200 shadow-card',
                ' bg-surface/80 text-foreground border-border/60 hover:bg-surface-hover hover:scale-105 cursor-pointer'
              )}
            >
              <Icon icon="lucide:scissors" className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* 底部悬浮控制栏 */}
      <div
        className={`absolute bottom-0 inset-x-0 p-3 sm:p-4 z-20 transition-all duration-300 ${
          controlsVisible
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <VideoControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onTogglePlay={handleTogglePlay}
          onPrevious={onPrevious}
          onNext={onNext}
          onSeek={handleSeek}
          onToggleFullscreen={handleToggleFullscreen}
          isFullscreen={isFullscreen}
          startTimeOffset={isClipMode ? startTime : 0}
          clipDuration={clipDuration}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
          fitMode={activeFitMode}
          onToggleFitMode={handleToggleFitMode}
          showCountdownToggle={isClipMode}
          showCountdown={activeShowCountdown}
          onToggleCountdown={handleToggleCountdown}
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={setVolume}
          onToggleMute={toggleMute}
          videoUrl={showThumbnailPreview ? videoUrl : null}
        />
      </div>

      {/* 控制栏隐藏状态：右下角极简片段进度 / 倒计时 */}
      {isClipMode &&
        startTime !== undefined &&
        endTime !== undefined &&
        activeShowCountdown &&
        !controlsVisible && (
          <ClipProgress currentTime={currentTime} startTime={startTime} endTime={endTime} />
        )}
    </div>
  );
};
