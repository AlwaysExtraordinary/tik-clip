import { Video } from '@/types/video';
import { Clip } from '@/types/clip';

/**
 * 文件系统访问 API（File System Access API）服务
 */

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function promptDirectoryPicker(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) {
    throw new Error(
      'Your browser does not support local folder access. Please use Chrome or Edge.'
    );
  }

  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
    });
    return handle;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      // 用户取消了选择器
      return null;
    }
    throw err;
  }
}

export async function verifyDirectoryPermission(
  fileHandle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'read'
): Promise<boolean> {
  const options: FileSystemHandlePermissionDescriptor = { mode };

  try {
    // 检查是否已获得权限
    if ((await fileHandle.queryPermission(options)) === 'granted') {
      return true;
    }
    // 若未获得权限则请求授权
    if ((await fileHandle.requestPermission(options)) === 'granted') {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * 从目录句柄中读取视频文件为标准的 Web File 对象
 */
export async function getVideoFileFromHandle(
  rootHandle: FileSystemDirectoryHandle,
  folderName: string,
  fileName: string
): Promise<File> {
  const folderHandle = await rootHandle.getDirectoryHandle(folderName);
  const fileHandle = await folderHandle.getFileHandle(fileName);
  return await fileHandle.getFile();
}

/**
 * 从目录句柄中读取图片文件为 Blob 对象
 */
export async function getImageBlobFromHandle(
  rootHandle: FileSystemDirectoryHandle,
  folderName: string,
  fileName: string
): Promise<Blob | null> {
  try {
    const folderHandle = await rootHandle.getDirectoryHandle(folderName);
    const fileHandle = await folderHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file;
  } catch {
    return null;
  }
}

/**
 * 从视频文件夹中读取并解析 data.json
 */
export async function getDataJsonFromHandle(
  rootHandle: FileSystemDirectoryHandle,
  folderName: string,
  fileName = 'data.json'
): Promise<Record<string, unknown> | null> {
  try {
    const folderHandle = await rootHandle.getDirectoryHandle(folderName);
    const fileHandle = await folderHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * 将数据写入指定视频子目录的 data.json 文件
 */
export async function saveVideoDataJson(
  rootHandle: FileSystemDirectoryHandle,
  folderName: string,
  data: Record<string, unknown>,
  fileName = 'data.json'
): Promise<void> {
  const folderHandle = await rootHandle.getDirectoryHandle(folderName);
  const fileHandle = await folderHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2) + '\n');
  await writable.close();
}

/**
 * 将最新的 clips 列表和视频信息同步更新至对应视频子目录下的 data.json
 */
export async function syncVideoClipsToDataJson(
  rootHandle: FileSystemDirectoryHandle,
  video: Pick<Video, 'folderName' | 'name' | 'category'>,
  clips: Clip[]
): Promise<void> {
  const existingData = (await getDataJsonFromHandle(rootHandle, video.folderName)) || {};
  const updatedData: Record<string, unknown> = {
    ...existingData,
    name: existingData.name || video.name || video.folderName,
    ...(video.category || existingData.category
      ? { category: video.category || existingData.category }
      : {}),
    clips: clips.map((clip) => ({
      id: clip.id,
      startTime: clip.startTime,
      endTime: clip.endTime,
      tags: clip.tags || [],
      createdAt: clip.createdAt,
      updatedAt: clip.updatedAt,
    })),
  };

  await saveVideoDataJson(rootHandle, video.folderName, updatedData);
}

/**
 * 更新指定视频子目录 data.json 中的视频名称
 */
export async function updateVideoNameInDataJson(
  rootHandle: FileSystemDirectoryHandle,
  folderName: string,
  name: string
): Promise<void> {
  const existingData = (await getDataJsonFromHandle(rootHandle, folderName)) || {};
  const updatedData: Record<string, unknown> = {
    ...existingData,
    name,
  };
  await saveVideoDataJson(rootHandle, folderName, updatedData);
}

/**
 * 在指定视频子目录的 data.json 中设置 hidden: true 隐藏视频
 */
export async function hideVideoInDataJson(
  rootHandle: FileSystemDirectoryHandle,
  folderName: string
): Promise<void> {
  const existingData = (await getDataJsonFromHandle(rootHandle, folderName)) || {};
  const updatedData: Record<string, unknown> = {
    ...existingData,
    hidden: true,
  };
  await saveVideoDataJson(rootHandle, folderName, updatedData);
}
