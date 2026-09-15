import { isTauri as checkTauri } from '@tauri-apps/api/core';
import { IFileSystemAdapter, DirectoryRef, VideoMediaSource, ScanProgress } from './types';
import { WebFileSystemAdapter } from './webAdapter';
import { TauriFileSystemAdapter } from './tauriAdapter';
import { Video, VideoLink } from '@/types/video';
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
 * @param targetPath 目标文件或目录绝对路径
 */
export async function openPathInOs(targetPath: string): Promise<boolean> {
  if (!isTauri() || !targetPath) return false;
  const isWindows = targetPath.includes('\\') || /^[a-zA-Z]:/.test(targetPath);
  const normalizedPath = isWindows ? targetPath.replace(/\//g, '\\') : targetPath;

  // 1. 优先调用 Tauri 原生 open_folder 命令（直接启动系统 Explorer/Finder 进入对应目录）
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_folder', { path: normalizedPath });
    return true;
  } catch (invokeErr) {
    console.warn('Native open_folder command failed, trying plugin-opener:', invokeErr);
  }

  // 2. 备选使用 @tauri-apps/plugin-opener 的 openPath
  try {
    const { openPath } = await import('@tauri-apps/plugin-opener');
    await openPath(normalizedPath);
    return true;
  } catch (err) {
    console.error('Failed to open path in OS:', err);
    return false;
  }
}

/**
 * 在操作系统默认浏览器中打开外部网页链接
 * @param url 外部网页链接地址
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!url) return false;
  let targetUrl = url.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }
  if (isTauri()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(targetUrl);
      return true;
    } catch (err) {
      console.warn('Failed to openUrl with plugin-opener, fallback to window.open:', err);
    }
  }
  window.open(targetUrl, '_blank', 'noopener,noreferrer');
  return true;
}

export function isFileSystemAccessSupported(): boolean {
  return fileSystemAdapter.isSupported();
}

/**
 * 弹出目录选择对话框
 * @param defaultRef 上次选择的目录引用（可选）
 */
export async function promptDirectoryPicker(
  defaultRef?: DirectoryRef | null
): Promise<DirectoryRef | null> {
  return fileSystemAdapter.selectDirectory(defaultRef);
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

/**
 * 更新视频元数据（名称、类别、演员、描述、链接）至 data.json
 * @param target 目录引用或目录句柄
 * @param folderName 视频所属子文件夹名称
 * @param metadata 视频元数据
 */
export async function updateVideoMetadataInDataJson(
  target: DirectoryRef | FileSystemDirectoryHandle,
  folderName: string,
  metadata: {
    name: string;
    category?: string;
    actor?: string;
    description?: string;
    links?: VideoLink[];
  }
): Promise<void> {
  const ref: DirectoryRef =
    typeof (target as FileSystemDirectoryHandle).getFileHandle === 'function'
      ? {
          name: (target as FileSystemDirectoryHandle).name,
          handle: target as FileSystemDirectoryHandle,
        }
      : (target as DirectoryRef);

  return fileSystemAdapter.updateVideoMetadataInDataJson(ref, folderName, metadata);
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
