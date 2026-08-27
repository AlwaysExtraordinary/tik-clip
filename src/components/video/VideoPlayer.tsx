import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { VideoControls } from '@/components/video/VideoControls';
import { ClipProgress } from '@/components/clip/ClipProgress';
import { usePlayerStore, VideoFitMode } from '@/stores/playerStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';

import { useWakeLock } from '@/hooks/useWakeLock';

interface VideoPlayerProps {
  file?: File | null;
  src?: string | null;
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
  /** 是否处于后台预加载模式（仅预解码首帧并 seek 到起始点，不自动播放声音） */
  isPreloading?: boolean;
  fitMode?: VideoFitMode;
  onToggleFitMode?: () => void;
  showCountdown?: boolean;
  onToggleCountdown?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  /** 在文件管理器中打开视频所在目录（仅 Tauri 下可用） */
  onRevealInExplorer?: () => void;
  /** 跳转到视频详情页编辑当前片段（仅片段流页面可用） */
  onGoToVideoDetail?: (currentTime?: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  file,
  src,
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
  isPreloading = false,
  fitMode: fitModeProp,
  onToggleFitMode,
  showCountdown: showCountdownProp,
  onToggleCountdown,
  isFullscreen: isFullscreenProp,
  onToggleFullscreen: onToggleFullscreenProp,
  onRevealInExplorer,
  onGoToVideoDetail,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(() => {
    if (src) return src;
    if (file) return URL.createObjectURL(file);
    return null;
  });
  const activeUrlRef = useRef<string | null>(videoUrl);
  const isCreatedBlobUrlRef = useRef<boolean>(!src && Boolean(file));
  const isFirstMountRef = useRef(true);

  const [isPlaying, setIsPlaying] = useState(false);
  // 播放时阻止系统休眠 / 屏幕常亮（预加载时不阻止休眠）
  useWakeLock(isPlaying && !isPreloading);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const wasPausedBeforeFastForwardRef = useRef(false);

  const isFullscreen = isFullscreenProp !== undefined ? isFullscreenProp : internalFullscreen;

  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 鼠标是否正悬浮在控制条上
  const isHoveringControlsRef = useRef(false);

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

  // 管理视频 URL 生命周期
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      const initialUrl = activeUrlRef.current;
      const isBlob = isCreatedBlobUrlRef.current;
      return () => {
        if (initialUrl && isBlob) {
          URL.revokeObjectURL(initialUrl);
        }
      };
    }

    if (src) {
      if (activeUrlRef.current && isCreatedBlobUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
      }
      activeUrlRef.current = src;
      isCreatedBlobUrlRef.current = false;
      setVideoUrl(src);
      return;
    }

    if (file) {
      if (activeUrlRef.current && isCreatedBlobUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
      }
      const url = URL.createObjectURL(file);
      activeUrlRef.current = url;
      isCreatedBlobUrlRef.current = true;
      setVideoUrl(url);

      return () => {
        URL.revokeObjectURL(url);
        activeUrlRef.current = null;
        isCreatedBlobUrlRef.current = false;
      };
    }

    if (activeUrlRef.current && isCreatedBlobUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
    }
    setVideoUrl(null);
    activeUrlRef.current = null;
    isCreatedBlobUrlRef.current = false;
  }, [src, file]);

  // 处理来自外部状态的跳转请求（例如编辑片段或点击时间标签）
  useEffect(() => {
    if (seekTargetTime !== null && videoRef.current) {
      videoRef.current.currentTime = seekTargetTime;
      setCurrentTime(seekTargetTime);
      requestSeek(null);
    }
  }, [seekTargetTime, requestSeek]);

  // 清除自动隐藏定时器
  const clearHideTimer = useCallback(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  }, []);

  // 显示控制栏并在 1 秒无操作后自动隐藏（悬浮在控制栏或剪辑按钮上时保持显示）
  const showControlsWithTimeout = useCallback(() => {
    setControlsVisible(true);
    clearHideTimer();
    hideControlsTimerRef.current = setTimeout(() => {
      if (!isHoveringControlsRef.current) {
        setControlsVisible(false);
      }
    }, 1000);
  }, [clearHideTimer]);

  // 控制栏及剪辑按钮的悬浮进入事件
  const handleControlsMouseEnter = useCallback(() => {
    isHoveringControlsRef.current = true;
    clearHideTimer();
    setControlsVisible(true);
  }, [clearHideTimer]);

  // 控制栏及剪辑按钮的悬浮离开事件
  const handleControlsMouseLeave = useCallback(() => {
    isHoveringControlsRef.current = false;
    showControlsWithTimeout();
  }, [showControlsWithTimeout]);

  // 鼠标在播放容器内移动
  const handleMouseMove = useCallback(() => {
    if (isHoveringControlsRef.current) return;
    showControlsWithTimeout();
  }, [showControlsWithTimeout]);

  // 鼠标移出播放区域立即隐藏
  const handleMouseLeave = useCallback(() => {
    isHoveringControlsRef.current = false;
    clearHideTimer();
    setControlsVisible(false);
  }, [clearHideTimer]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, [clearHideTimer]);

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

  // 点击视频区域切换播放状态并唤出控制栏（1秒无操作自动隐藏）
  const handleVideoClick = useCallback(() => {
    handleTogglePlay();
    showControlsWithTimeout();
  }, [handleTogglePlay, showControlsWithTimeout]);

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

  // 长按右方向键 3 倍速播放处理
  const handleFastForwardStart = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    wasPausedBeforeFastForwardRef.current = video.paused;
    video.playbackRate = 3;
    if (video.paused) {
      if (isClipMode && endTime !== undefined && video.currentTime >= endTime - 0.05) {
        video.currentTime = startTime || 0;
      }
      video.play().catch(console.error);
    }
    setIsFastForwarding(true);
  }, [isClipMode, startTime, endTime]);

  const handleFastForwardEnd = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = 1;
    if (wasPausedBeforeFastForwardRef.current) {
      video.pause();
    }
    setIsFastForwarding(false);
  }, []);

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
      onFastForwardStart: handleFastForwardStart,
      onFastForwardEnd: handleFastForwardEnd,
      onPrevious,
      onNext,
      onToggleFullscreen: handleToggleFullscreen,
      onToggleMute: toggleMute,
    },
    enableKeyboardShortcuts
  );

  // 当处于退出动画阶段时立即暂停、重置倍速并静音
  const prevPreloadingRef = useRef(isPreloading);
  useEffect(() => {
    if (prevPreloadingRef.current && !isPreloading && !isExiting) {
      const video = videoRef.current;
      if (video) {
        if (
          isClipMode &&
          startTime !== undefined &&
          (video.currentTime < startTime || (endTime !== undefined && video.currentTime >= endTime))
        ) {
          const target = initialTime !== undefined && initialTime >= startTime ? initialTime : startTime;
          video.currentTime = target;
        }
        video.play().catch(() => {});
      }
    }
    prevPreloadingRef.current = isPreloading;
  }, [isPreloading, isExiting, isClipMode, startTime, endTime, initialTime]);

  useEffect(() => {
    if (isExiting && videoRef.current) {
      videoRef.current.playbackRate = 1;
      videoRef.current.pause();
      setIsFastForwarding(false);
    }
  }, [isExiting]);

  // Video 原生事件处理
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;

    setDuration(video.duration || 0);
    video.volume = volume;
    video.muted = isMuted;
    video.playbackRate = isFastForwarding ? 3 : 1;

    // WebKit / Safari 下处理多音轨及确保音频轨道激活
    const mediaWithTracks = video as HTMLVideoElement & {
      audioTracks?: {
        length: number;
        [index: number]: { enabled: boolean; label?: string; language?: string };
      };
    };
    if (mediaWithTracks.audioTracks && mediaWithTracks.audioTracks.length > 0) {
      let anyEnabled = false;
      for (let i = 0; i < mediaWithTracks.audioTracks.length; i++) {
        if (mediaWithTracks.audioTracks[i].enabled) {
          anyEnabled = true;
          break;
        }
      }
      if (!anyEnabled) {
        mediaWithTracks.audioTracks[0].enabled = true;
      }
    }

    if (isClipMode && startTime !== undefined) {
      const targetTime =
        initialTime !== undefined &&
        initialTime >= startTime &&
        (endTime === undefined || initialTime < endTime)
          ? initialTime
          : startTime;
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
      if (!isPreloading) {
        onCurrentTimeChange?.(targetTime);
      }
    } else if (initialTime !== undefined && initialTime > 0) {
      video.currentTime = initialTime;
      setCurrentTime(initialTime);
      if (!isPreloading) {
        onCurrentTimeChange?.(initialTime);
      }
    }

    // 非预加载状态下自动播放
    if (!isPreloading && !isExiting) {
      video.play().catch(() => {
        // 带音频的自动播放可能需要用户手势交互，受阻时由用户手动点击播放
      });
    }
  };

  const handleTimeUpdate = () => {
    if (isPreloading) return;
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

  /** 右上角操作按钮列表（通过 map 渲染） */
  const topRightButtons = useMemo(() => {
    const buttons: { key: string; icon: string; label: string; onClick: () => void }[] = [];

    // 在文件管理器中打开（仅 Tauri 环境）
    if (onRevealInExplorer) {
      buttons.push({
        key: 'reveal',
        icon: 'lucide:folder-symlink',
        label: t('videos.revealInExplorer'),
        onClick: onRevealInExplorer,
      });
    }

    // 跳转到视频详情页编辑当前片段（仅片段流页面）
    if (onGoToVideoDetail) {
      buttons.push({
        key: 'go-to-detail',
        icon: 'lucide:arrow-down-to-dot',
        label: t('player.goToVideoDetail'),
        onClick: () => onGoToVideoDetail(currentTime),
      });
    }

    // 剪刀 / 添加片段按钮
    if (showScissorsButton) {
      buttons.push({
        key: 'scissors',
        icon: 'lucide:scissors',
        label: t('player.addOrEditClips'),
        onClick: toggleClipPanel,
      });
    }

    return buttons;
  }, [onRevealInExplorer, onGoToVideoDetail, showScissorsButton, toggleClipPanel, t, currentTime]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`bg-surface relative h-full w-full ${
        isFullscreen ? 'rounded-none border-0' : 'border-border/40 rounded-3xl border'
      } overflow-hidden select-none ${className}`}
    >
      {/* 视频播放器元素（独占全屏容器） */}
      <div
        className="absolute inset-0 flex h-full w-full items-center justify-center overflow-hidden"
        onClick={handleVideoClick}
      >
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            preload="auto"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            playsInline
            style={{ objectFit: activeFitMode }}
            className={`block h-full min-h-full w-full min-w-full ${
              activeFitMode === 'cover' ? 'object-cover' : 'object-contain'
            }`}
          />
        ) : (
          <div className="text-foreground-muted flex flex-col items-center justify-center gap-2">
            <Icon icon="lucide:video" className="size-12 opacity-30" />
            <p className="text-xs font-medium">{t('player.loading')}</p>
          </div>
        )}

        {/* 长按 3 倍速播放提示徽章 */}
        {isFastForwarding && (
          <div
            className="pointer-events-none absolute top-6 left-1/2 z-30 flex -translate-x-1/2 select-none items-center 
            gap-1.5 rounded-full border border-white/15 bg-black/70 px-4 py-1.5 text-xs font-medium text-white 
            shadow-xl backdrop-blur-md sm:text-sm"
          >
            <Icon icon="lucide:fast-forward" className="text-primary size-4 animate-pulse" />
            <span>{t('player.xTimes', { x: 3 }) + t('player.fastForwarding')}</span>
          </div>
        )}

        {/* 右上角操作按钮列表 */}
        {topRightButtons.length > 0 && (
          <div
            className={`absolute top-5 right-5 z-20 flex items-center gap-2 transition-opacity duration-300 ${
              controlsVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={handleControlsMouseEnter}
            onMouseLeave={handleControlsMouseLeave}
          >
            {topRightButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={btn.onClick}
                aria-label={btn.label}
                title={btn.label}
                className={cn(
                  'shadow-card flex size-8 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200 sm:size-9 md:size-10',
                  'bg-surface/80 text-foreground border-border hover:bg-surface-hover cursor-pointer'
                )}
              >
                <Icon icon={btn.icon} className="size-4 sm:size-4.5 md:size-5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 底部悬浮控制栏 */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 p-3 transition-all duration-300 sm:p-4 ${
          controlsVisible
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-3 opacity-0'
        }`}
        onMouseEnter={handleControlsMouseEnter}
        onMouseLeave={handleControlsMouseLeave}
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
