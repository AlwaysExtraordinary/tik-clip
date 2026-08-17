import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/utils/cn';
import { formatTime } from '@/utils/time';

interface VideoProgressThumbnailProps {
  /** 视频源 URL（与主播放器共享同一 Object URL） */
  videoUrl: string;
  /** 要预览的绝对时间（秒） */
  hoverTime: number;
  /** 悬浮框水平像素位置（相对于进度条容器） */
  position: number;
  /** 进度条容器宽度，用于边界限制 */
  containerWidth: number;
}

/** 缩略图基准宽度（像素），高度根据视频宽高比动态计算 */
const THUMB_BASE_WIDTH = 200;
/** 缩略图最大高度限制，防止竖屏视频缩略图过高 */
const THUMB_MAX_HEIGHT = 250;

/** LRU 缓存最大容量 */
const MAX_CACHE_SIZE = 60;

/** 时间量化精度（秒），将 hover 时间向下取整到此精度 */
const TIME_QUANTUM = 1;

/** seek 节流间隔（毫秒） */
const THROTTLE_MS = 100;

/**
 * 视频进度条缩略图预览组件
 *
 * 使用离屏 <video> + <canvas> 按需捕获视频帧，
 * 并通过 LRU 缓存 + 节流 seek 保持流畅性。
 */
export const VideoProgressThumbnail: React.FC<VideoProgressThumbnailProps> = ({
  videoUrl,
  hoverTime,
  position,
  containerWidth,
}) => {
  const offscreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cacheRef = useRef<Map<number, string>>(new Map());
  const lastSeekTimeRef = useRef<number>(-1);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSeeking = useRef(false);
  const pendingTimeRef = useRef<number | null>(null);

  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [thumbSize, setThumbSize] = useState({ width: THUMB_BASE_WIDTH, height: 90 });

  // 初始化离屏 video 和 canvas
  useEffect(() => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    // 隐藏在 DOM 外，不可见不可交互
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.src = videoUrl;
    document.body.appendChild(video);
    offscreenVideoRef.current = video;

    const canvas = document.createElement('canvas');
    canvas.width = THUMB_BASE_WIDTH;
    canvas.height = 90; // 初始值，loadeddata 后按实际比例更新
    canvasRef.current = canvas;

    const handleLoaded = () => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw > 0 && vh > 0) {
        const aspect = vh / vw;
        const computedHeight = Math.round(THUMB_BASE_WIDTH * aspect);
        const finalHeight = Math.min(computedHeight, THUMB_MAX_HEIGHT);
        const finalWidth =
          finalHeight < computedHeight ? Math.round(finalHeight / aspect) : THUMB_BASE_WIDTH;
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        setThumbSize({ width: finalWidth, height: finalHeight });
      }
      setIsReady(true);
    };

    video.addEventListener('loadeddata', handleLoaded);

    return () => {
      video.removeEventListener('loadeddata', handleLoaded);
      video.pause();
      video.removeAttribute('src');
      video.load();
      document.body.removeChild(video);
      offscreenVideoRef.current = null;
      canvasRef.current = null;

      // 清理节流定时器
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [videoUrl]);

  /** 将当前 video 帧绘制到 canvas 并返回 data URL */
  const captureFrame = useCallback((): string | null => {
    const video = offscreenVideoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  }, []);

  /** LRU 淘汰：删除最早插入的 key */
  const evictCache = useCallback(() => {
    const cache = cacheRef.current;
    if (cache.size > MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }
  }, []);

  const doSeekRef = useRef<(time: number) => void>(() => {});

  /** 实际执行 seek 并在完成后捕获帧 */
  const doSeek = useCallback(
    (quantizedTime: number) => {
      const video = offscreenVideoRef.current;
      if (!video || !isReady) return;

      // 已缓存则直接使用
      const cached = cacheRef.current.get(quantizedTime);
      if (cached) {
        setThumbnailSrc(cached);
        return;
      }

      // 标记正在 seek
      isSeeking.current = true;
      lastSeekTimeRef.current = quantizedTime;

      const handleSeeked = () => {
        video.removeEventListener('seeked', handleSeeked);
        const frame = captureFrame();
        if (frame) {
          cacheRef.current.set(quantizedTime, frame);
          evictCache();
          setThumbnailSrc(frame);
        }
        isSeeking.current = false;

        // 处理排队中的下一次 seek
        if (pendingTimeRef.current !== null && pendingTimeRef.current !== quantizedTime) {
          const next = pendingTimeRef.current;
          pendingTimeRef.current = null;
          doSeekRef.current(next);
        }
      };

      video.addEventListener('seeked', handleSeeked);
      video.currentTime = quantizedTime;
    },
    [isReady, captureFrame, evictCache]
  );

  useEffect(() => {
    doSeekRef.current = doSeek;
  }, [doSeek]);

  // 响应 hoverTime 变化，节流后调用 doSeek
  useEffect(() => {
    const quantized = Math.floor(hoverTime / TIME_QUANTUM) * TIME_QUANTUM;

    // 缓存命中：立即展示，无需 seek
    const cached = cacheRef.current.get(quantized);
    if (cached) {
      setThumbnailSrc(cached);
      return;
    }

    // 与上次 seek 目标相同，无需重复
    if (quantized === lastSeekTimeRef.current && isSeeking.current) {
      return;
    }

    // 正在 seek 中，排队等待
    if (isSeeking.current) {
      pendingTimeRef.current = quantized;
      return;
    }

    // 节流：取消上一个定时器，延迟执行
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
    }

    throttleTimerRef.current = setTimeout(() => {
      doSeek(quantized);
    }, THROTTLE_MS);

    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [hoverTime, doSeek]);

  // 计算缩略图位置（居中于悬浮位置，并限制不超出容器边界）
  // const halfThumb = thumbSize.width / 2;
  const clampedLeft = Math.max(0, Math.min(position, containerWidth));

  // 量化时间用于显示
  const displayTime = Math.floor(hoverTime / TIME_QUANTUM) * TIME_QUANTUM;

  return (
    <div
      className="absolute -translate-x-1/2 pointer-events-none select-none z-50"
      style={{
        left: `${clampedLeft}px`,
        bottom: '22px',
      }}
    >
      {/* 缩略图容器 */}
      <div
        className={cn(
          'rounded-lg overflow-hidden',
          'bg-surface shadow-card backdrop-blur-sm',
          'transition-opacity duration-150',
          thumbnailSrc ? 'opacity-100' : 'opacity-60'
        )}
        style={{ width: thumbSize.width, height: thumbSize.height }}
      >
        {thumbnailSrc ? (
          <img src={thumbnailSrc} alt="" className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface">
            <div className="w-4 h-4 rounded-full border-2 border-foreground/30 border-t-foreground/80 animate-spin" />
          </div>
        )}
      </div>

      {/* 时间标签 */}
      <div className="mt-1 flex justify-center">
        <span
          className={cn(
            'px-2 py-0.5 rounded-md text-[11px] font-semibold',
            'bg-surface border border-border shadow-card text-foreground/80'
          )}
        >
          {formatTime(displayTime)}
        </span>
      </div>
    </div>
  );
};
