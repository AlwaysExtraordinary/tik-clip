import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ShuffleItem } from '@/types/clip';
import { VideoPlayer } from '@/components/video/VideoPlayer';

export interface FeedSlotData {
  item: ShuffleItem;
  file?: File | null;
  src?: string | null;
}

interface InternalSlot extends FeedSlotData {
  key: string;
}

interface ClipFeedContainerProps {
  currentSlot: FeedSlotData;
  onRequestNext: () => Promise<FeedSlotData | null>;
  onRequestPrevious: () => Promise<FeedSlotData | null>;
  /** 预获取下一个片段数据供备用槽位后台预载 */
  onPeekNext?: () => Promise<FeedSlotData | null>;
  onCommitItemChange: (item: ShuffleItem, file: File | null, src?: string | null) => void;
  onCurrentTimeChange?: (time: number) => void;
  initialTime?: number;
  hasPrevious?: boolean;
  hasNext?: boolean;
  /** 在文件管理器中打开视频所在目录（仅 Tauri 环境） */
  onRevealInExplorer?: (item: ShuffleItem) => void;
  /** 跳转到视频详情页编辑当前片段 */
  onGoToVideoDetail?: (item: ShuffleItem, currentTime: number) => void;
}

type TransitionState = 'idle' | 'preparing' | 'sliding';
type SlideDirection = 'next' | 'prev' | null;

export const ClipFeedContainer: React.FC<ClipFeedContainerProps> = ({
  currentSlot,
  onRequestNext,
  onRequestPrevious,
  onPeekNext,
  onCommitItemChange,
  onCurrentTimeChange,
  initialTime,
  hasPrevious = true,
  hasNext = true,
  onRevealInExplorer,
  onGoToVideoDetail,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 双槽位机制 (Ping-Pong Buffer)：切换完成后保留目标槽位 DOM，绝不重新挂载，实现 0 闪烁
  const [slotA, setSlotA] = useState<InternalSlot | null>(() => ({
    item: currentSlot.item,
    file: currentSlot.file,
    src: currentSlot.src,
    key: currentSlot.item.clip.id,
  }));
  const [slotB, setSlotB] = useState<InternalSlot | null>(null);
  const [activeSlotId, setActiveSlotId] = useState<'A' | 'B'>('A');

  const [transitionState, setTransitionState] = useState<TransitionState>('idle');
  const [direction, setDirection] = useState<SlideDirection>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isTransitioningRef = useRef(false);
  const lastWheelTimeRef = useRef(0);
  const wheelAccumulatorRef = useRef(0);
  const wheelResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const transitionFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 外部强制更新 currentSlot（仅在 idle 状态生效，支持同步 file / src 与 item 变更）
  useEffect(() => {
    if (transitionState === 'idle') {
      const activeData = activeSlotId === 'A' ? slotA : slotB;
      if (
        !activeData ||
        activeData.item.clip.id !== currentSlot.item.clip.id ||
        activeData.file !== currentSlot.file ||
        activeData.src !== currentSlot.src
      ) {
        const isReady = Boolean(currentSlot.file || currentSlot.src);
        const newSlot: InternalSlot = {
          item: currentSlot.item,
          file: currentSlot.file,
          src: currentSlot.src,
          key: `${currentSlot.item.clip.id}-${isReady ? 'ready' : 'empty'}`,
        };
        if (activeSlotId === 'A') {
          setSlotA(newSlot);
          setSlotB(null);
        } else {
          setSlotB(newSlot);
          setSlotA(null);
        }
      }
    }
  }, [currentSlot, activeSlotId, transitionState, slotA, slotB]);

  // 后台自动预加载：当处于空闲状态时，在备用槽位提前预载下一个片段
  useEffect(() => {
    if (transitionState !== 'idle' || !hasNext || !onPeekNext) return;
    let cancelled = false;

    const inactiveSlotId = activeSlotId === 'A' ? 'B' : 'A';
    const inactiveSlot = inactiveSlotId === 'A' ? slotA : slotB;

    const runPreload = async () => {
      try {
        const nextData = await onPeekNext();
        if (cancelled || !nextData) return;

        // 如果非活跃槽位已经挂载了该预加载片段，则无需重复设置
        if (
          inactiveSlot &&
          inactiveSlot.item.clip.id === nextData.item.clip.id &&
          (inactiveSlot.src === nextData.src || inactiveSlot.file === nextData.file)
        ) {
          return;
        }

        const newSlot: InternalSlot = {
          ...nextData,
          key: `preload-${nextData.item.clip.id}`,
        };

        if (inactiveSlotId === 'A') {
          setSlotA(newSlot);
        } else {
          setSlotB(newSlot);
        }
      } catch (err) {
        console.warn('Background preload failed:', err);
      }
    };

    // 延迟 80ms 启动后台预载，优先保证活跃视频播放平稳
    const timer = setTimeout(runPreload, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeSlotId, hasNext, onPeekNext, slotA, slotB, transitionState]);

  // 完成过渡，Ping-Pong 切换槽位
  const finalizeTransition = useCallback(
    (targetSlotId: 'A' | 'B') => {
      if (transitionFallbackTimerRef.current) {
        clearTimeout(transitionFallbackTimerRef.current);
        transitionFallbackTimerRef.current = null;
      }

      const targetData = targetSlotId === 'A' ? slotA : slotB;
      if (targetData) {
        onCommitItemChange(targetData.item, targetData.file || null, targetData.src || null);
      }

      setActiveSlotId(targetSlotId);
      if (targetSlotId === 'A') {
        setSlotB(null);
      } else {
        setSlotA(null);
      }
      setTransitionState('idle');
      setDirection(null);
      isTransitioningRef.current = false;
    },
    [onCommitItemChange, slotA, slotB]
  );

  // 下一个片段切换（秒切已预加载槽位）
  const triggerNext = useCallback(async () => {
    if (isTransitioningRef.current || !hasNext) return;

    isTransitioningRef.current = true;
    const targetSlotId = activeSlotId === 'A' ? 'B' : 'A';
    const targetSlot = targetSlotId === 'A' ? slotA : slotB;

    const nextSlotData = await onRequestNext();
    if (!nextSlotData) {
      isTransitioningRef.current = false;
      return;
    }

    // 检查目标槽位是否已经预加载了该片段
    const isAlreadyPreloaded =
      targetSlot &&
      targetSlot.item.clip.id === nextSlotData.item.clip.id &&
      (targetSlot.src === nextSlotData.src || targetSlot.file === nextSlotData.file);

    if (!isAlreadyPreloaded) {
      const newInternalSlot: InternalSlot = {
        ...nextSlotData,
        key: `${nextSlotData.item.clip.id}-${Date.now()}`,
      };

      if (targetSlotId === 'A') {
        setSlotA(newInternalSlot);
      } else {
        setSlotB(newInternalSlot);
      }
    }

    setDirection('next');
    setTransitionState('preparing');

    // 双 requestAnimationFrame 确保 DOM 挂载和初始 translate 确立后再启动过渡动画
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionState('sliding');
        // 安全备用定时器：防止 CSS transitionend 事件被浏览器意外丢弃
        transitionFallbackTimerRef.current = setTimeout(() => {
          finalizeTransition(targetSlotId);
        }, 420);
      });
    });
  }, [activeSlotId, finalizeTransition, hasNext, onRequestNext, slotA, slotB]);

  // 上一个片段切换
  const triggerPrevious = useCallback(async () => {
    if (isTransitioningRef.current || !hasPrevious) return;

    isTransitioningRef.current = true;
    const prevSlotData = await onRequestPrevious();
    if (!prevSlotData) {
      isTransitioningRef.current = false;
      return;
    }

    const targetSlotId = activeSlotId === 'A' ? 'B' : 'A';
    const newInternalSlot: InternalSlot = {
      ...prevSlotData,
      key: `${prevSlotData.item.clip.id}-${Date.now()}`,
    };

    if (targetSlotId === 'A') {
      setSlotA(newInternalSlot);
    } else {
      setSlotB(newInternalSlot);
    }

    setDirection('prev');
    setTransitionState('preparing');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionState('sliding');
        transitionFallbackTimerRef.current = setTimeout(() => {
          finalizeTransition(targetSlotId);
        }, 420);
      });
    });
  }, [activeSlotId, finalizeTransition, hasPrevious, onRequestPrevious]);

  // 动画结束事件处理
  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>, slotId: 'A' | 'B') => {
      if (e.target !== e.currentTarget || transitionState !== 'sliding') return;
      const targetSlotId = activeSlotId === 'A' ? 'B' : 'A';
      if (slotId === targetSlotId) {
        finalizeTransition(targetSlotId);
      }
    },
    [activeSlotId, finalizeTransition, transitionState]
  );

  // 滚轮监听与防抖
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (isTransitioningRef.current) {
        e.preventDefault();
        return;
      }

      const now = Date.now();
      if (now - lastWheelTimeRef.current < 420) {
        e.preventDefault();
        return;
      }

      wheelAccumulatorRef.current += e.deltaY;

      if (wheelResetTimerRef.current) {
        clearTimeout(wheelResetTimerRef.current);
      }
      wheelResetTimerRef.current = setTimeout(() => {
        wheelAccumulatorRef.current = 0;
      }, 160);

      const THRESHOLD = 35;
      if (wheelAccumulatorRef.current >= THRESHOLD) {
        e.preventDefault();
        lastWheelTimeRef.current = now;
        wheelAccumulatorRef.current = 0;
        triggerNext();
      } else if (wheelAccumulatorRef.current <= -THRESHOLD) {
        e.preventDefault();
        lastWheelTimeRef.current = now;
        wheelAccumulatorRef.current = 0;
        triggerPrevious();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (wheelResetTimerRef.current) {
        clearTimeout(wheelResetTimerRef.current);
      }
      if (transitionFallbackTimerRef.current) {
        clearTimeout(transitionFallbackTimerRef.current);
      }
    };
  }, [triggerNext, triggerPrevious]);

  // 触控手势
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null || isTransitioningRef.current) return;
    const endY = e.changedTouches[0].clientY;
    const diff = touchStartYRef.current - endY;
    touchStartYRef.current = null;

    if (diff > 45) {
      triggerNext();
    } else if (diff < -45) {
      triggerPrevious();
    }
  };

  // 获取槽位 Transform
  const getSlotTransform = (slotId: 'A' | 'B') => {
    const isActive = activeSlotId === slotId;

    if (transitionState === 'idle') {
      return isActive ? 'translate3d(0, 0, 0)' : 'translate3d(0, 100%, 0)';
    }

    if (transitionState === 'preparing') {
      if (isActive) {
        return 'translate3d(0, 0, 0)';
      }
      return direction === 'next' ? 'translate3d(0, 100%, 0)' : 'translate3d(0, -100%, 0)';
    }

    // sliding 状态
    if (isActive) {
      return direction === 'next' ? 'translate3d(0, -100%, 0)' : 'translate3d(0, 100%, 0)';
    } else {
      return 'translate3d(0, 0, 0)';
    }
  };

  const getSlotTransition = () => {
    return transitionState === 'sliding'
      ? 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)'
      : 'none';
  };

  const [initialClipId] = useState(() => currentSlot.item.clip.id);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full h-full overflow-hidden select-none bg-surface ${
        isFullscreen ? 'rounded-none' : 'rounded-3xl'
      }`}
    >
      {/* 槽位 A */}
      {slotA && (
        <div
          onTransitionEnd={(e) => handleTransitionEnd(e, 'A')}
          style={{
            transform: getSlotTransform('A'),
            transition: getSlotTransition(),
            willChange: transitionState !== 'idle' ? 'transform' : 'auto',
          }}
          className={`absolute inset-0 w-full h-full overflow-hidden ${
            isFullscreen ? 'rounded-none' : 'rounded-3xl'
          }`}
        >
          <VideoPlayer
            key={slotA.key}
            file={slotA.file}
            src={slotA.src}
            startTime={slotA.item.clip.startTime}
            endTime={slotA.item.clip.endTime}
            initialTime={slotA.item.clip.id === initialClipId ? initialTime : undefined}
            onCurrentTimeChange={activeSlotId === 'A' ? onCurrentTimeChange : undefined}
            onNext={triggerNext}
            onPrevious={triggerPrevious}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            showScissorsButton={false}
            enableKeyboardShortcuts={activeSlotId === 'A' && transitionState === 'idle'}
            isExiting={activeSlotId === 'A' && transitionState === 'sliding'}
            isPreloading={activeSlotId !== 'A' && transitionState === 'idle'}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            onRevealInExplorer={
              onRevealInExplorer ? () => onRevealInExplorer(slotA.item) : undefined
            }
            onGoToVideoDetail={
              onGoToVideoDetail
                ? (currentTime) =>
                    onGoToVideoDetail(slotA.item, currentTime ?? slotA.item.clip.startTime)
                : undefined
            }
          />
        </div>
      )}

      {/* 槽位 B */}
      {slotB && (
        <div
          onTransitionEnd={(e) => handleTransitionEnd(e, 'B')}
          style={{
            transform: getSlotTransform('B'),
            transition: getSlotTransition(),
            willChange: transitionState !== 'idle' ? 'transform' : 'auto',
          }}
          className={`absolute inset-0 w-full h-full overflow-hidden ${
            isFullscreen ? 'rounded-none' : 'rounded-3xl'
          }`}
        >
          <VideoPlayer
            key={slotB.key}
            file={slotB.file}
            src={slotB.src}
            startTime={slotB.item.clip.startTime}
            endTime={slotB.item.clip.endTime}
            initialTime={slotB.item.clip.id === initialClipId ? initialTime : undefined}
            onCurrentTimeChange={activeSlotId === 'B' ? onCurrentTimeChange : undefined}
            onNext={triggerNext}
            onPrevious={triggerPrevious}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            showScissorsButton={false}
            enableKeyboardShortcuts={activeSlotId === 'B' && transitionState === 'idle'}
            isExiting={activeSlotId === 'B' && transitionState === 'sliding'}
            isPreloading={activeSlotId !== 'B' && transitionState === 'idle'}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            onRevealInExplorer={
              onRevealInExplorer ? () => onRevealInExplorer(slotB.item) : undefined
            }
            onGoToVideoDetail={
              onGoToVideoDetail
                ? (currentTime) =>
                    onGoToVideoDetail(slotB.item, currentTime ?? slotB.item.clip.startTime)
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
};
