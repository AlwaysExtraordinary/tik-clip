import { useEffect, useRef } from 'react';

export interface KeyboardShortcutHandlers {
  onTogglePlay?: () => void;
  onSeekBackward?: (seconds?: number) => void;
  onSeekForward?: (seconds?: number) => void;
  onFastForwardStart?: () => void;
  onFastForwardEnd?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onToggleFullscreen?: () => void;
  onToggleMute?: () => void;
}

const LONG_PRESS_DELAY = 200;

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers, enabled = true) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;

    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let isHoldingArrowRight = false;
    let isFastForwarding = false;
    let lastShiftKey = false;

    const clearTimer = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    const stopFastForward = () => {
      clearTimer();
      if (isFastForwarding) {
        isFastForwarding = false;
        handlersRef.current.onFastForwardEnd?.();
      }
      isHoldingArrowRight = false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 当用户正在与可编辑元素交互时不触发快捷键
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlersRef.current.onTogglePlay?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlersRef.current.onSeekBackward?.(e.shiftKey ? 1 : 3);
          break;
        case 'ArrowRight':
          e.preventDefault();
          lastShiftKey = e.shiftKey;

          if (!handlersRef.current.onFastForwardStart) {
            handlersRef.current.onSeekForward?.(e.shiftKey ? 1 : 3);
            break;
          }

          if (!e.repeat && !isHoldingArrowRight) {
            isHoldingArrowRight = true;
            isFastForwarding = false;
            clearTimer();
            longPressTimer = setTimeout(() => {
              isFastForwarding = true;
              handlersRef.current.onFastForwardStart?.();
            }, LONG_PRESS_DELAY);
          } else if (e.repeat && isHoldingArrowRight && !isFastForwarding) {
            clearTimer();
            isFastForwarding = true;
            handlersRef.current.onFastForwardStart?.();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          handlersRef.current.onPrevious?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          handlersRef.current.onNext?.();
          break;
        case 'KeyF':
          e.preventDefault();
          handlersRef.current.onToggleFullscreen?.();
          break;
        case 'KeyM':
          e.preventDefault();
          handlersRef.current.onToggleMute?.();
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowRight') {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
        ) {
          return;
        }

        if (isHoldingArrowRight) {
          clearTimer();
          if (isFastForwarding) {
            isFastForwarding = false;
            handlersRef.current.onFastForwardEnd?.();
          } else {
            // 短按：快进 3 秒（按住 Shift 时为 1 秒）
            handlersRef.current.onSeekForward?.(e.shiftKey || lastShiftKey ? 1 : 3);
          }
          isHoldingArrowRight = false;
        }
      }
    };

    const handleBlur = () => {
      stopFastForward();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      stopFastForward();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled]);
}
