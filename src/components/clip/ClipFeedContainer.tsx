import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { ShuffleItem } from '@/types/clip';
import { ShuffleQueue } from '@/services/shuffle';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { usePlayerStore } from '@/stores/playerStore';

/** -------------------------------------------------------------
 *  手势、阈值与动画相关配置常量（便于后续微调）
 * ------------------------------------------------------------*/

/** 鼠标滚轮单格防抖冷却时长（ms），防止滚轮连续滚动过快跳过多集 */
const MOUSE_WHEEL_THROTTLE_MS = 380;

/** 滚动吸附结算兜底防抖延时（ms，针对不支持 scrollend 的浏览器环境） */
const SCROLL_SETTLE_FALLBACK_DELAY_MS = 100;

/** 传统物理鼠标滚轮判定：标准物理步长（100 或 120 像素刻度） */
const MOUSE_WHEEL_STANDARD_STEPS = [100, 120] as const;

/** 传统物理鼠标滚轮判定：首帧大步长整数位移阈值（px） */
const MOUSE_WHEEL_INITIAL_STEP_THRESHOLD = 60;

export interface MediaSourceData {
  file?: File | null;
  src?: string | null;
}

interface ClipFeedContainerProps {
  shuffleQueue: ShuffleQueue;
  loadMediaSource: (item: ShuffleItem) => Promise<MediaSourceData | null>;
  initialIndex?: number;
  initialTime?: number;
  onCurrentTimeChange?: (time: number) => void;
  onCurrentClipChange?: (item: ShuffleItem) => void;
  /** 在文件管理器中打开视频所在目录（仅 Tauri 环境） */
  onRevealInExplorer?: (item: ShuffleItem) => void;
  /** 跳转到视频详情页编辑当前片段 */
  onGoToVideoDetail?: (item: ShuffleItem, currentTime: number) => void;
}

/**
 * 识别是否为物理鼠标滚轮单格滚动（区别于触控板连续手势）。
 */
function isPhysicalMouseWheel(e: WheelEvent): boolean {
  if (e.deltaMode !== 0) return true;

  const anyEvent = e as WheelEvent & { wheelDeltaY?: number; wheelDelta?: number };
  const wheelDelta = anyEvent.wheelDeltaY ?? anyEvent.wheelDelta;
  if (typeof wheelDelta === 'number' && wheelDelta !== 0 && Math.abs(wheelDelta) % 120 === 0) {
    return true;
  }

  const absY = Math.abs(e.deltaY);
  for (const step of MOUSE_WHEEL_STANDARD_STEPS) {
    if (absY % step === 0) return true;
  }

  if (Number.isInteger(e.deltaY) && absY >= MOUSE_WHEEL_INITIAL_STEP_THRESHOLD) {
    return true;
  }

  return false;
}

/**
 * TikClip 虚拟流式视频容器组件。
 * 架构重构亮点：
 * 1. 确定性序列平铺 + CSS Scroll Snap：彻底取消对 scrollTop 的手动强制回拉，根除自动回滚与画面闪烁；
 * 2. 稳定的 DOM 实例映射：每个视频项保持自身独立的 Key，首帧渲染与实际播放画面 100% 保持一致；
 * 3. 触控板与鼠标滚轮双通道分流：触控板原生硬件级跟手，鼠标滚轮防抖平滑切页；
 * 4. 轻量级视口虚拟化：仅渲染当前及前后相邻视频实例，保持内存轻盈；
 * 5. 纯 React 状态驱动渲染，严格避免在 render 阶段访问或修改 Ref。
 */
export const ClipFeedContainer: React.FC<ClipFeedContainerProps> = ({
  shuffleQueue,
  loadMediaSource,
  initialIndex = 0,
  initialTime,
  onCurrentTimeChange,
  onCurrentClipChange,
  onRevealInExplorer,
  onGoToVideoDetail,
}) => {
  const { clipsFitMode, toggleClipsFitMode } = usePlayerStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentIndexRef = useRef(currentIndex);

  const [maxRenderedIndex, setMaxRenderedIndex] = useState(() => Math.max(initialIndex + 2, 2));
  const [containerHeight, setContainerHeight] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 媒体源状态映射：clipId -> MediaSourceData
  const [mediaMap, setMediaMap] = useState<Record<string, MediaSourceData>>({});

  // 鼠标滚轮防抖与滚动结算标记
  const isWheelThrottledRef = useRef(false);
  const wheelThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 同步当前索引到 Ref 供事件监听读取
   */
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  /**
   * 视口尺寸监听与同步
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncHeight = () => {
      const h = container.clientHeight || 1;
      setContainerHeight(h);
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  /**
   * 初始化挂载时的滚动位置定位
   */
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || initialIndex === 0) return;
    container.scrollTop = initialIndex * containerHeight;
  }, [containerHeight, initialIndex]);

  /**
   * 后台异步预加载当前项及前后相邻项的视频媒体源
   */
  useEffect(() => {
    let cancelled = false;

    const preloadIndices = [currentIndex, currentIndex + 1, currentIndex - 1].filter(
      (idx) => idx >= 0
    );

    for (const idx of preloadIndices) {
      const item = shuffleQueue.getItemAt(idx);
      if (!item) continue;

      const clipId = item.clip.id;
      if (mediaMap[clipId]) continue;

      void (async () => {
        try {
          const source = await loadMediaSource(item);
          if (cancelled || !source) return;

          setMediaMap((prev) => {
            if (prev[clipId]) return prev;
            return {
              ...prev,
              [clipId]: source,
            };
          });
        } catch (err) {
          console.warn(`Failed to preload media for clip ${clipId}:`, err);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [currentIndex, loadMediaSource, mediaMap, shuffleQueue]);

  /**
   * 滚动吸附完成结算
   */
  const handleScrollSettle = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const h = container.clientHeight || containerHeight || 1;
    const targetIdx = Math.max(0, Math.round(container.scrollTop / h));

    if (targetIdx !== currentIndexRef.current) {
      currentIndexRef.current = targetIdx;
      setCurrentIndex(targetIdx);
      shuffleQueue.setIndex(targetIdx);
      setMaxRenderedIndex((prev) => Math.max(prev, targetIdx + 2));

      const activeItem = shuffleQueue.getItemAt(targetIdx);
      if (activeItem) {
        onCurrentClipChange?.(activeItem);
      }
    }
  }, [containerHeight, onCurrentClipChange, shuffleQueue]);

  /**
   * 程序化切换至下一个片段
   */
  const triggerNext = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const nextIdx = currentIndexRef.current + 1;
    setMaxRenderedIndex((prev) => Math.max(prev, nextIdx + 2));
    const h = container.clientHeight || containerHeight;
    container.scrollTo({ top: nextIdx * h, behavior: 'smooth' });
  }, [containerHeight]);

  /**
   * 程序化切换至上一个片段
   */
  const triggerPrevious = useCallback(() => {
    const container = containerRef.current;
    if (!container || currentIndexRef.current <= 0) return;

    const prevIdx = currentIndexRef.current - 1;
    const h = container.clientHeight || containerHeight;
    container.scrollTo({ top: Math.max(0, prevIdx * h), behavior: 'smooth' });
  }, [containerHeight]);

  /**
   * 传统鼠标滚轮独立分流拦截处理
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.deltaY === 0 || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) {
        return;
      }

      if (isPhysicalMouseWheel(e)) {
        e.preventDefault();

        if (isWheelThrottledRef.current) return;

        isWheelThrottledRef.current = true;
        if (wheelThrottleTimerRef.current) {
          clearTimeout(wheelThrottleTimerRef.current);
        }
        wheelThrottleTimerRef.current = setTimeout(() => {
          isWheelThrottledRef.current = false;
        }, MOUSE_WHEEL_THROTTLE_MS);

        if (e.deltaY > 0) {
          triggerNext();
        } else {
          triggerPrevious();
        }
      }
      // 触控板手势放行至原生 CSS Scroll Snap 处理
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (wheelThrottleTimerRef.current) {
        clearTimeout(wheelThrottleTimerRef.current);
      }
    };
  }, [triggerNext, triggerPrevious]);

  /**
   * 监听原生 scroll 与 scrollend 事件
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScrollEnd = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      handleScrollSettle();
    };

    const onScroll = () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        handleScrollSettle();
      }, SCROLL_SETTLE_FALLBACK_DELAY_MS);
    };

    container.addEventListener('scrollend', onScrollEnd);
    container.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      container.removeEventListener('scrollend', onScrollEnd);
      container.removeEventListener('scroll', onScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [handleScrollSettle]);

  // 全屏切换与监听
  const handleToggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(console.error);
    } else {
      document.exitFullscreen?.().catch(console.error);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 生成要渲染的项目索引列表
  const renderedIndices: number[] = [];
  for (let i = 0; i <= maxRenderedIndex; i++) {
    renderedIndices.push(i);
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-y-scroll overflow-x-hidden select-none snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        isFullscreen ? 'rounded-none' : 'rounded-3xl'
      }`}
      style={{
        scrollSnapType: 'y mandatory',
        overscrollBehaviorY: 'contain',
      }}
    >
      {renderedIndices.map((index) => {
        const item = shuffleQueue.getItemAt(index);
        if (!item) return null;

        const isNearCurrent = Math.abs(index - currentIndex) <= 1;
        const mediaSource = mediaMap[item.clip.id];
        const isActive = index === currentIndex;

        return (
          <div
            key={`${item.clip.id}-${index}`}
            style={{
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
            }}
            className="relative w-full h-full shrink-0 pb-2"
          >
            {isNearCurrent ? (
              <VideoPlayer
                key={item.clip.id}
                file={mediaSource?.file}
                src={mediaSource?.src}
                startTime={item.clip.startTime}
                endTime={item.clip.endTime}
                initialTime={index === initialIndex ? initialTime : undefined}
                onCurrentTimeChange={isActive ? onCurrentTimeChange : undefined}
                onNext={triggerNext}
                onPrevious={triggerPrevious}
                hasPrevious={currentIndex > 0}
                hasNext={true}
                showScissorsButton={false}
                enableKeyboardShortcuts={isActive}
                isPreloading={!isActive}
                fitMode={clipsFitMode}
                onToggleFitMode={toggleClipsFitMode}
                isFullscreen={isFullscreen}
                onToggleFullscreen={handleToggleFullscreen}
                onRevealInExplorer={
                  onRevealInExplorer ? () => onRevealInExplorer(item) : undefined
                }
                onGoToVideoDetail={
                  onGoToVideoDetail
                    ? (currentTime) =>
                        onGoToVideoDetail(item, currentTime ?? item.clip.startTime)
                    : undefined
                }
              />
            ) : (
              <div className="w-full h-full bg-surface" />
            )}
          </div>
        );
      })}
    </div>
  );
};
