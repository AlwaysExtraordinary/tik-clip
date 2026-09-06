import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '@/services/fileSystem/index';

// 记录进入全屏前窗口是否处于最大化状态
let wasMaximizedBeforeFullscreen = false;
// 全屏切换防抖锁，防止快速连击触发竞态异常
let isTogglingFullscreen = false;

// 全局监听全屏退出：若此前处于最大化状态，退出全屏后自动恢复最大化
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', async () => {
    if (!document.fullscreenElement && wasMaximizedBeforeFullscreen) {
      wasMaximizedBeforeFullscreen = false;
      if (isTauri()) {
        try {
          const appWindow = getCurrentWindow();
          await appWindow.maximize();
        } catch (err) {
          console.error('Failed to restore window maximize state after fullscreen:', err);
        }
      }
    }
  });
}

/**
 * 切换指定容器元素的全屏状态
 * 针对 Tauri Windows 桌面环境进行适配：
 * 当窗口处于最大化状态时，由于无边框窗口 (decorations: false) 与 Windows 任务栏工作区限制，
 * 直接调用 HTML5 requestFullscreen 会导致画面下方留有一段与任务栏高度相同的黑色区域。
 * 解决方案：在进入全屏前先调用 unmaximize 还原窗口，退出全屏时再自动恢复最大化。
 *
 * @param container 目标 DOM 容器元素
 */
export async function toggleFullscreen(container: HTMLElement | null): Promise<void> {
  if (!container || isTogglingFullscreen) return;
  isTogglingFullscreen = true;

  try {
    if (!document.fullscreenElement) {
      if (isTauri()) {
        try {
          const appWindow = getCurrentWindow();
          const isMaximized = await appWindow.isMaximized();
          if (isMaximized) {
            wasMaximizedBeforeFullscreen = true;
            await appWindow.unmaximize();
            // 短暂延时确保操作系统窗口状态变更与 WebView 视口尺寸完全同步
            await new Promise((resolve) => setTimeout(resolve, 30));
          }
        } catch (err) {
          console.error('Failed to handle window state before fullscreen:', err);
        }
      }

      try {
        await container.requestFullscreen();
      } catch (err) {
        console.error('Failed to request fullscreen:', err);
        // 若全屏请求失败且此前执行了 unmaximize，则立即还原最大化状态
        if (wasMaximizedBeforeFullscreen) {
          wasMaximizedBeforeFullscreen = false;
          if (isTauri()) {
            try {
              const appWindow = getCurrentWindow();
              await appWindow.maximize();
            } catch (restoreErr) {
              console.error('Failed to re-maximize window:', restoreErr);
            }
          }
        }
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error('Failed to exit fullscreen:', err);
      }
    }
  } finally {
    // 延时解除防抖锁定，避免短时间内连续快速触发
    setTimeout(() => {
      isTogglingFullscreen = false;
    }, 200);
  }
}
