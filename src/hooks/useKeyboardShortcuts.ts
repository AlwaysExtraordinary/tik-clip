import { useEffect } from 'react';

interface KeyboardShortcutHandlers {
  onTogglePlay?: () => void;
  onSeekBackward?: (seconds?: number) => void;
  onSeekForward?: (seconds?: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onToggleFullscreen?: () => void;
  onToggleMute?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

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
          handlers.onTogglePlay?.();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlers.onSeekBackward?.(e.shiftKey ? 1 : 3);
          break;
        case 'ArrowRight':
          e.preventDefault();
          handlers.onSeekForward?.(e.shiftKey ? 1 : 3);
          break;
        case 'ArrowUp':
          e.preventDefault();
          handlers.onPrevious?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          handlers.onNext?.();
          break;
        case 'KeyF':
          e.preventDefault();
          handlers.onToggleFullscreen?.();
          break;
        case 'KeyM':
          e.preventDefault();
          handlers.onToggleMute?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, enabled]);
}
