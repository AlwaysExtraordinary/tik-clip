import { isTauri as checkTauri } from '@tauri-apps/api/core';
import { IFileSystemAdapter, DirectoryRef, VideoMediaSource, ScanProgress } from './types';
import { WebFileSystemAdapter } from './webAdapter';
import { TauriFileSystemAdapter } from './tauriAdapter';
import { Video } from '@/types/video';
import { Clip } from '@/types/clip';

export * from './types';
export { WebFileSystemAdapter } from './webAdapter';
export { TauriFileSystemAdapter } from './tauriAdapter';

export function isTauri(): boolean {
  try {
    return checkTauri();
  } catch {
    return (
      typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
    );
  }
}

const webAdapter = new WebFileSystemAdapter();
const tauriAdapter = new TauriFileSystemAdapter();

/**
 * 根据当前运行环境返回对应的文件系统适配器单例
 */
export function getFileSystemAdapter(): IFileSystemAdapter {
  return isTauri() ? tauriAdapter : webAdapter;
}

export const fileSystemAdapter: IFileSystemAdapter = new Proxy({} as IFileSystemAdapter, {
  get(_target, prop: keyof IFileSystemAdapter) {
    const adapter = getFileSystemAdapter();
    const val = adapter[prop];
    if (typeof val === 'function') {
      return val.bind(adapter);
    }
    return val;
  },
});

// ==================== 向下兼容与通用便捷方法 ====================

/**
 * 在系统文件资源管理器/访达中定位并选中文件或目录（桌面端支持）
 */
export async function revealInFileManager(targetPath: string): Promise<boolean> {
  if (!isTauri() || !targetPath) return false;
  try {
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
    await revealItemInDir(targetPath);
    return true;
  } catch (err) {
    console.warn('Failed to reveal item in file manager:', err);
    return false;
  }
}

/**
 * 在操作系统中直接打开文件或目录
 */
export async function openPathInOs(targetPath: string): Promise<boolean> {
  if (!isTauri() || !targetPath) return false;
  try {
    const { openPath } = await import('@tauri-apps/plugin-opener');
    await openPath(targetPath);
    return true;
  } catch (err) {
    console.warn('Failed to open path in OS:', err);
    return false;
  }
}

export function isFileSystemAccessSupported(): boolean {
  return fileSystemAdapter.isSupported();
}

export async function promptDirectoryPicker(): Promise<DirectoryRef | null> {
  return fileSystemAdapter.selectDirectory();
}

function toDirectoryRef(target: DirectoryRef | FileSystemDirectoryHandle): DirectoryRef {
  return typeof (target as FileSystemDirectoryHandle).getFileHandle === 'function'
    ? {
        name: (target as FileSystemDirectoryHandle).name,
        handle: target as FileSystemDirectoryHandle,
      }
    : (target as DirectoryRef);
}

/**
 * 静默查询目录权限状态（无需用户手势，适合初始化检查）
 */
export async function queryDirectoryPermission(
  target: DirectoryRef | FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'read'
): Promise<boolean> {
  const ref = toDirectoryRef(target);
  return fileSystemAdapter.queryPermission(ref, mode);
}

/**
 * 请求目录读写权限（需由用户点击手势触发，调出浏览器授权弹窗）
 */
export async function requestDirectoryPermission(
  target: DirectoryRef | FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  const ref = toDirectoryRef(target);
  return fileSystemAdapter.requestPermission(ref, mode);
}

/**
 * 验证目录权限（兼容方法）
 */
export async function verifyDirectoryPermission(
  target: DirectoryRef | FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'read',
  interactive = false
): Promise<boolean> {
  const ref = toDirectoryRef(target);
  return fileSystemAdapter.verifyPermission(ref, mode, interactive);
}

export async function getVideoMediaSource(
  target: DirectoryRef | FileSystemDirectoryHandle,
  folderName: string,
  fileName: string
): Promise<VideoMediaSource> {
  const ref: DirectoryRef =
    typeof (target as FileSystemDirectoryHandle).getFileHandle === 'function'
      ? {
          name: (target as FileSystemDirectoryHandle).name,
          handle: target as FileSystemDirectoryHandle,
        }
      : (target as DirectoryRef);

  return fileSystemAdapter.getVideoSource(ref, folderName, fileName);
}

export async function getVideoFileFromHandle(
  target: DirectoryRef | FileSystemDirectoryHandle,
  folderName: string,
  fileName: string
): Promise<File> {
  const source = await getVideoMediaSource(target, folderName, fileName);
  if (source.file) {
    return source.file;
  }
  // 在 Tauri 模式下，直接获取 Blob 并构建 File 对象（若某些旧代码强制需要 File）
  const blob = await getImageBlobFromHandle(target, folderName, fileName);
  return new File([blob || new Blob([])], fileName, { type: 'video/mp4' });
}

export async function getImageBlobFromHandle(
  target: DirectoryRef | FileSystemDirectoryHandle,
  folderName: string,
  fileName: string
): Promise<Blob | null> {
  const ref: DirectoryRef =
    typeof (target as FileSystemDirectoryHandle).getFileHandle === 'function'
      ? {
          name: (target as FileSystemDirectoryHandle).name,
          handle: target as FileSystemDirectoryHandle,
        }
      : (target as DirectoryRef);

  return fileSystemAdapter.getImageBlob(ref, folderName, fileName);
}

export async function getDataJsonFromHandle(
  target: DirectoryRef | FileSystemDirectoryHandle,
  folderName: string,
  fileName = 'data.json'
): Promise<Record<string, unknown> | null> {
  const ref: DirectoryRef =
    typeof (target as FileSystemDirectoryHandle).getFileHandle === 'function'
      ? {
          name: (target as FileSystemDirectoryHandle).name,
          handle: target as FileSystemDirectoryHandle,
        }
      : (target as DirectoryRef);

  return fileSystemAdapter.getDataJson(ref, folderName, fileName);
}

export async function saveVideoDataJson(
  target: DirectoryRef | FileSystemDirectoryHandle,
  folderName: string,
  data: Record<string, unknown>,
  fileName = 'data.json'
): Promise<void> {
  const ref: DirectoryRef =
    typeof (target as FileSystemDirectoryHandle).getFileHandle === 'function'
      ? {
          name: (target as FileSystemDirectoryHandle).name,
          handle: target as FileSystemDirectoryHandle,
        }
      : (target as DirectoryRef);

  return fileSystemAdapter.saveDataJson(ref, folderName, data, fileName);
}

export async function syncVideoClipsToDataJson(
  target: DirectoryRef | FileSystemDirectoryHandle,
  video: Pick<Video, 'folderName' | 'name' | 'category'>,
  clips: Clip[]
): Promise<void> {
  const ref: DirectoryRef =
    typeof (target as FileSystemDirectoryHandle).getFileHandle === 'function'
      ? {
          name: (target as FileSystemDirectoryHandle).name,
          handle: target as FileSystemDirectoryHandle,
        }
      : (target as DirectoryRef);

  return fileSystemAdapter.syncVideoClipsToDataJson(ref, video, clips);
}

export async function updateVideoNameInDataJson(
  target: DirectoryRef | FileSystemDirectoryHandle,
  folderName: string,
  name: string
): Promise<void> {
  const ref: DirectoryRef =
    typeof (target as FileSystemDirectoryHandle).getFileHandle === 'function'
      ? {
          name: (target as FileSystemDirectoryHandle).name,
          handle: target as FileSystemDirectoryHandle,
        }
      : (target as DirectoryRef);

  return fileSystemAdapter.updateVideoNameInDataJson(ref, folderName, name);
}

export async function hideVideoInDataJson(
  target: DirectoryRef | FileSystemDirectoryHandle,
  folderName: string
): Promise<void> {
  const ref: DirectoryRef =
    typeof (target as FileSystemDirectoryHandle).getFileHandle === 'function'
      ? {
          name: (target as FileSystemDirectoryHandle).name,
          handle: target as FileSystemDirectoryHandle,
        }
      : (target as DirectoryRef);

  return fileSystemAdapter.hideVideoInDataJson(ref, folderName);
}

export async function scanVideoDirectory(
  target: DirectoryRef | FileSystemDirectoryHandle,
  onProgress?: (progress: ScanProgress) => void
): Promise<Video[]> {
  const ref: DirectoryRef =
    typeof (target as FileSystemDirectoryHandle).getFileHandle === 'function'
      ? {
          name: (target as FileSystemDirectoryHandle).name,
          handle: target as FileSystemDirectoryHandle,
        }
      : (target as DirectoryRef);

  return fileSystemAdapter.scanVideos(ref, onProgress);
}
