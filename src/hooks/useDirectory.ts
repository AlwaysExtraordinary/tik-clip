import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import {
  getStoredDirectoryHandle,
  getStoredDirectoryName,
  setStoredDirectoryHandle,
  clearStoredDirectory,
} from '@/db/settings';
import { promptDirectoryPicker, verifyDirectoryPermission } from '@/services/fileSystem';
import { scanVideoDirectory } from '@/services/videoScanner';
import { useClipsFeedStore } from '@/stores/clipsFeedStore';

export function useDirectory() {
  const directoryHandle = useAppStore((s) => s.directoryHandle);
  const directoryName = useAppStore((s) => s.directoryName);
  const isScanning = useAppStore((s) => s.isScanning);
  const scanProgress = useAppStore((s) => s.scanProgress);
  const isHandleRestoring = useAppStore((s) => s.isHandleRestoring);
  const setDirectoryHandle = useAppStore((s) => s.setDirectoryHandle);
  const setIsScanning = useAppStore((s) => s.setIsScanning);
  const setScanProgress = useAppStore((s) => s.setScanProgress);
  const setIsHandleRestoring = useAppStore((s) => s.setIsHandleRestoring);
  const setErrorMessage = useAppStore((s) => s.setErrorMessage);

  // 启动时尝试恢复目录句柄
  useEffect(() => {
    let mounted = true;

    async function restore() {
      setIsHandleRestoring(true);
      try {
        const storedHandle = await getStoredDirectoryHandle();
        const storedName = await getStoredDirectoryName();

        if (storedHandle && mounted) {
          const hasPerm = await verifyDirectoryPermission(storedHandle, 'read');
          if (hasPerm && mounted) {
            setDirectoryHandle(storedHandle, storedName || storedHandle.name);
          } else if (mounted) {
            // 权限尚未激活，仅保存目录名以便界面提示
            setDirectoryHandle(null, storedName || storedHandle.name);
          }
        }
      } catch (err) {
        console.warn('Error restoring directory handle:', err);
      } finally {
        if (mounted) {
          setIsHandleRestoring(false);
        }
      }
    }

    restore();
    return () => {
      mounted = false;
    };
  }, [setDirectoryHandle, setIsHandleRestoring]);

  // 扫描目录辅助方法
  const performScan = useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      setIsScanning(true);
      setErrorMessage(null);
      try {
        await scanVideoDirectory(handle);
      } catch (err: unknown) {
        console.error('Scan error:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Error scanning directory');
      } finally {
        setIsScanning(false);
        setScanProgress(null);
      }
    },
    [setIsScanning, setScanProgress, setErrorMessage]
  );

  // 请求选择新目录
  const selectDirectory = useCallback(async () => {
    try {
      setErrorMessage(null);
      const handle = await promptDirectoryPicker();
      if (!handle) return false;

      // 切换文件夹时完全重置 clips 全局状态
      useClipsFeedStore.getState().resetFeed();

      await setStoredDirectoryHandle(handle);
      setDirectoryHandle(handle, handle.name);
      await performScan(handle);
      return true;
    } catch (err: unknown) {
      console.error('Directory selection error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to select directory');
      return false;
    }
  }, [setDirectoryHandle, performScan, setErrorMessage]);

  // 重新授权已保存的目录
  const reauthorizeDirectory = useCallback(async () => {
    try {
      const storedHandle = await getStoredDirectoryHandle();
      if (storedHandle) {
        const hasPerm = await verifyDirectoryPermission(storedHandle, 'readwrite');
        if (hasPerm) {
          setDirectoryHandle(storedHandle, storedHandle.name);
          await performScan(storedHandle);
          return true;
        }
      }
      return await selectDirectory();
    } catch (err) {
      console.error('Re-authorization error:', err);
      return await selectDirectory();
    }
  }, [selectDirectory, setDirectoryHandle, performScan]);

  const disconnectDirectory = useCallback(async () => {
    useClipsFeedStore.getState().resetFeed();
    await clearStoredDirectory();
    setDirectoryHandle(null, '');
  }, [setDirectoryHandle]);

  return {
    directoryHandle,
    directoryName,
    isScanning,
    scanProgress,
    isHandleRestoring,
    selectDirectory,
    reauthorizeDirectory,
    performScan,
    disconnectDirectory,
  };
}
