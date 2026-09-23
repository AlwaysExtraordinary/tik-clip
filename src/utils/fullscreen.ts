import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/services/fileSystem/index';

// 全屏切换防抖锁，防止快速连击触发竞态异常
let isTogglingFullscreen = false;

// 全局监听全屏退出：当用户按 Esc 或通过系统原生行为退出 DOM 全屏时，同步退出 Tauri 原生窗口全屏并恢复原状态
if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', async () => {
    if (!document.fullscreenElement && isTauri()) {
      try {
        await invoke('set_app_fullscreen', { fullscreen: false });
      } catch (err) {
        console.error('Failed to exit window fullscreen on fullscreenchange:', err);
      }
    }
  });
}

/**
 * 切换指定容器元素的全屏状态
 * - Web 端：使用标准 HTML5 Fullscreen API
 * - Tauri 桌面端：调用自定义原生 set_app_fullscreen 命令。Windows 下若窗口已最大化，
 *   会先隐藏窗口再执行 unmaximize → fullscreen → show，既消除跳变又确保全屏覆盖任务栏。
 *
 * @param container 目标 DOM 容器元素
 */
export async function toggleFullscreen(container: HTMLElement | null): Promise<void> {
  if (!container || isTogglingFullscreen) return;
  isTogglingFullscreen = true;

  try {
    if (!document.fullscreenElement) {
      // 1. Tauri 桌面端：调用原生全屏控制命令，彻底无感平滑展开并覆盖任务栏
      if (isTauri()) {
        try {
          await invoke('set_app_fullscreen', { fullscreen: true });
        } catch (err) {
          console.error('Failed to set Tauri window fullscreen:', err);
        }
      }

      // 2. 将目标 DOM 容器提升至全屏顶层展示
      try {
        await container.requestFullscreen();
      } catch (err) {
        console.error('Failed to request DOM fullscreen:', err);
        // 若 DOM 全屏请求失败，回滚 Tauri 窗口全屏状态
        if (isTauri()) {
          try {
            await invoke('set_app_fullscreen', { fullscreen: false });
          } catch (restoreErr) {
            console.error('Failed to rollback window fullscreen:', restoreErr);
          }
        }
      }
    } else {
      // 退出全屏流程
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error('Failed to exit DOM fullscreen:', err);
      }

      if (isTauri()) {
        try {
          await invoke('set_app_fullscreen', { fullscreen: false });
        } catch (err) {
          console.error('Failed to restore Tauri window fullscreen:', err);
        }
      }
    }
  } finally {
    // 延时解除防抖锁定，避免短时间内连续快速触发
    setTimeout(() => {
      isTogglingFullscreen = false;
    }, 200);
  }
}
