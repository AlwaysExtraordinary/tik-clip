import { useEffect, useRef } from 'react';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

interface NavigatorWithWakeLock {
  wakeLock?: {
    request: (type: string) => Promise<WakeLockSentinelLike>;
  };
}

/**
 * 跨平台屏幕常亮 Hook（视频播放时阻止屏幕变暗或系统休眠）
 * 支持现代浏览器及 Webview 环境的 Screen Wake Lock API
 */
export function useWakeLock(isActive: boolean) {
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    let released = false;

    async function requestLock() {
      if (typeof navigator === 'undefined') {
        return;
      }

      const nav = navigator as unknown as NavigatorWithWakeLock;
      if (!nav.wakeLock?.request) {
        return;
      }

      try {
        wakeLockRef.current = await nav.wakeLock.request('screen');
        if (released && wakeLockRef.current) {
          wakeLockRef.current.release().catch(() => {});
          wakeLockRef.current = null;
        }
      } catch {
        // 唤醒锁请求失败或用户切换了应用，静默捕获
      }
    }

    async function releaseLock() {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
        } catch {
          // 静默捕获
        } finally {
          wakeLockRef.current = null;
        }
      }
    }

    if (isActive) {
      requestLock();
    } else {
      releaseLock();
    }

    // 页面可见性改变时重新获取锁
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive) {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseLock();
    };
  }, [isActive]);
}
