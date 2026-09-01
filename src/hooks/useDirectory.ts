import { useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { getStoredDirectoryRef, setStoredDirectoryRef, clearStoredDirectory } from '@/db/settings';
import {
  promptDirectoryPicker,
  verifyDirectoryPermission,
  scanVideoDirectory,
  DirectoryRef,
} from '@/services/fileSystem/index';
import { useClipsFeedStore } from '@/stores/clipsFeedStore';

export function useDirectory() {
  const directoryRef = useAppStore((s) => s.directoryRef);
  const directoryHandle = useAppStore((s) => s.directoryHandle);
  const directoryName = useAppStore((s) => s.directoryName);
  const isScanning = useAppStore((s) => s.isScanning);
  const scanProgress = useAppStore((s) => s.scanProgress);
  const isHandleRestoring = useAppStore((s) => s.isHandleRestoring);
  const setDirectoryRef = useAppStore((s) => s.setDirectoryRef);
  const setDirectoryHandle = useAppStore((s) => s.setDirectoryHandle);
  const setIsScanning = useAppStore((s) => s.setIsScanning);
  const setScanProgress = useAppStore((s) => s.setScanProgress);
  const setErrorMessage = useAppStore((s) => s.setErrorMessage);



  // 扫描目录辅助方法
  const performScan = useCallback(
    async (target: DirectoryRef | FileSystemDirectoryHandle) => {
      setIsScanning(true);
      setErrorMessage(null);
      try {
        await scanVideoDirectory(target, (progress) => {
          setScanProgress(progress);
        });
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
      const ref = await promptDirectoryPicker();
      if (!ref) return false;

      // 切换文件夹时完全重置 clips 全局状态
      useClipsFeedStore.getState().resetFeed();

      await setStoredDirectoryRef(ref);
      setDirectoryRef(ref);
      await performScan(ref);
      return true;
    } catch (err: unknown) {
      console.error('Directory selection error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to select directory');
      return false;
    }
  }, [setDirectoryRef, performScan, setErrorMessage]);

  // 重新授权已保存的目录
  const reauthorizeDirectory = useCallback(async () => {
    try {
      const storedRef = await getStoredDirectoryRef();
      if (storedRef) {
        const hasPerm = await verifyDirectoryPermission(storedRef, 'readwrite');
        if (hasPerm) {
          setDirectoryRef(storedRef);
          await performScan(storedRef);
          return true;
        }
      }
      return await selectDirectory();
    } catch (err) {
      console.error('Re-authorization error:', err);
      return await selectDirectory();
    }
  }, [selectDirectory, setDirectoryRef, performScan]);

  const openDirectoryByPath = useCallback(
    async (path: string) => {
      try {
        setErrorMessage(null);
        const normalized = path.replace(/[\\/]+$/, '');
        const parts = normalized.split(/[\\/]/);
        const name = parts[parts.length - 1] || path;
        const ref: DirectoryRef = { name, path };

        useClipsFeedStore.getState().resetFeed();
        await setStoredDirectoryRef(ref);
        setDirectoryRef(ref);
        await performScan(ref);
        return true;
      } catch (err: unknown) {
        console.error('Open directory by path error:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to open directory');
        return false;
      }
    },
    [setDirectoryRef, performScan, setErrorMessage]
  );

  const disconnectDirectory = useCallback(async () => {
    useClipsFeedStore.getState().resetFeed();
    await clearStoredDirectory();
    setDirectoryRef(null);
  }, [setDirectoryRef]);

  return {
    directoryRef,
    directoryHandle,
    directoryName,
    isScanning,
    scanProgress,
    isHandleRestoring,
    selectDirectory,
    openDirectoryByPath,
    reauthorizeDirectory,
    performScan,
    disconnectDirectory,
    setDirectoryHandle,
  };
}
