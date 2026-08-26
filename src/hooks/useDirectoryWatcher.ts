import { useEffect } from 'react';
import { isTauri } from '@/services/fileSystem/index';
import { useAppStore } from '@/stores/appStore';
import { scanVideoDirectory } from '@/services/fileSystem/index';
import { useDirectory } from '@/hooks/useDirectory';

/**
 * 桌面端原生文件系统变动监听与文件夹拖拽导入 Hook
 * 1. 当视频库外部发生文件增删改时，后台自动静默重新扫描同步，无需用户手动刷新；
 * 2. 支持将系统文件夹直接拖入应用窗口无缝切换视频库。
 */
export function useDirectoryWatcher() {
  const directoryRef = useAppStore((s) => s.directoryRef);
  const directoryPath = directoryRef?.path;
  const { openDirectoryByPath } = useDirectory();

  // 1. 监听当前选定目录的文件变动
  useEffect(() => {
    if (!isTauri() || !directoryPath) {
      return;
    }

    let unlistenFn: (() => void) | null = null;
    let isMounted = true;

    async function initWatcher() {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const { listen } = await import('@tauri-apps/api/event');

        // 启动 Rust 目录监听
        await invoke('start_watching_directory', { path: directoryPath });

        if (!isMounted) return;

        // 监听 Rust 发送的文件变动事件
        unlistenFn = await listen('app://fs-changed', async () => {
          const isScanningNow = useAppStore.getState().isScanning;
          if (isScanningNow) return;

          console.info('[Watcher] File system change detected, refreshing library...');
          try {
            const currentDir = useAppStore.getState().directoryRef;
            if (currentDir) {
              await scanVideoDirectory(currentDir);
            }
          } catch (err) {
            console.warn('[Watcher] Background rescan failed:', err);
          }
        });
      } catch (err) {
        console.warn('[Watcher] Failed to start native directory watcher:', err);
      }
    }

    initWatcher();

    return () => {
      isMounted = false;
      if (unlistenFn) {
        unlistenFn();
      }
      if (isTauri()) {
        import('@tauri-apps/api/core')
          .then(({ invoke }) => invoke('stop_watching_directory'))
          .catch(() => {});
      }
    };
  }, [directoryPath]);

  // 2. 监听系统文件/文件夹拖拽入窗口事件
  useEffect(() => {
    if (!isTauri()) return;

    let unlistenDragDrop: (() => void) | null = null;

    async function initDragDrop() {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        unlistenDragDrop = await listen<any>('tauri://drag-drop', async (event) => {
          const paths: string[] = event.payload?.paths || [];
          if (paths.length > 0 && paths[0]) {
            console.info('[DragDrop] Dropped path detected:', paths[0]);
            await openDirectoryByPath(paths[0]);
          }
        });
      } catch (err) {
        console.warn('[DragDrop] Failed to listen to drag-drop event:', err);
      }
    }

    initDragDrop();

    return () => {
      if (unlistenDragDrop) {
        unlistenDragDrop();
      }
    };
  }, [openDirectoryByPath]);
}
