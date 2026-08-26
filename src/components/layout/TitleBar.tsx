import React, { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Icon } from '@iconify/react';
import { isTauri } from '@/services/fileSystem/index';

/**
 * 桌面端自定义标题栏组件
 * 兼容 macOS 原生红绿灯与 Windows 自定义窗口控制按钮，保证窗口背景色统一沉浸
 */
export const TitleBar: React.FC = () => {
  const [isMac, setIsMac] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    // 判断是否为 macOS 平台
    setIsMac(navigator.userAgent.toLowerCase().includes('mac'));

    const appWindow = getCurrentWindow();

    /**
     * 检查当前窗口是否最大化
     */
    const checkMaximized = async () => {
      try {
        const maximized = await appWindow.isMaximized();
        setIsMaximized(maximized);
      } catch (err) {
        console.error('Failed to check window maximized state:', err);
      }
    };

    checkMaximized();

    // 监听窗口大小变动更新最大化状态
    const unlistenResize = appWindow.onResized(() => {
      checkMaximized();
    });

    return () => {
      unlistenResize.then((unlisten) => unlisten());
    };
  }, []);

  // 非 Tauri 桌面环境不渲染标题栏
  if (!isTauri()) {
    return null;
  }

  const appWindow = getCurrentWindow();

  /**
   * 鼠标按下拖拽窗口
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    // 仅响应鼠标左键点击，且排除点击到按钮的情况
    if (e.button === 0 && (e.target as HTMLElement).closest('button') === null) {
      appWindow.startDragging();
    }
  };

  /**
   * 最小化窗口
   */
  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await appWindow.minimize();
    } catch (err) {
      console.error('Failed to minimize window:', err);
    }
  };

  /**
   * 切换最大化 / 还原窗口
   */
  const handleToggleMaximize = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await appWindow.toggleMaximize();
    } catch (err) {
      console.error('Failed to toggle maximize window:', err);
    }
  };

  /**
   * 关闭窗口
   */
  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await appWindow.close();
    } catch (err) {
      console.error('Failed to close window:', err);
    }
  };

  return (
    <header
      onMouseDown={handleMouseDown}
      onDoubleClick={() => handleToggleMaximize()}
      className="h-8 w-full select-none flex items-center justify-between bg-background text-foreground shrink-0 z-50 relative border-b border-border/20"
    >
      {/* macOS 预留左侧红绿灯区域 */}
      {isMac ? <div data-tauri-drag-region className="w-20 h-full shrink-0" /> : <div></div>}

      {/* 中间主要拖拽区域 */}
      <div
        data-tauri-drag-region
        className="flex-1 h-full flex items-center justify-center text-xs text-foreground-muted cursor-default"
      >
        {isMac && <span className="font-semibold text-xs tracking-wide">TikClip</span>}
      </div>

      {/* Windows 窗口控制按钮组 */}
      {!isMac && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="flex items-center h-full shrink-0 z-10"
        >
          <button
            onClick={handleMinimize}
            aria-label="Minimize"
            title="Minimize"
            className="h-full px-3.5 inline-flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover active:bg-surface-active transition-colors cursor-pointer"
          >
            <Icon icon="lucide:minus" className="size-3.5" />
          </button>

          <button
            onClick={handleToggleMaximize}
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
            title={isMaximized ? 'Restore' : 'Maximize'}
            className="h-full px-3.5 inline-flex items-center justify-center text-foreground-muted hover:text-foreground hover:bg-surface-hover active:bg-surface-active transition-colors cursor-pointer"
          >
            <Icon icon={isMaximized ? 'lucide:copy' : 'lucide:square'} className="size-3.5" />
          </button>

          <button
            onClick={handleClose}
            aria-label="Close"
            title="Close"
            className="h-full px-3.5 inline-flex items-center justify-center text-foreground-muted hover:text-white hover:bg-danger active:bg-danger-hover transition-colors cursor-pointer"
          >
            <Icon icon="lucide:x" className="size-3.5" />
          </button>
        </div>
      )}
    </header>
  );
};
