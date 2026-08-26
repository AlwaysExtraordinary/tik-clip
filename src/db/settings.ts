import { db } from '@/db/database';
import { ThemeMode, SupportedLanguage } from '@/types/settings';
import { DirectoryRef, isTauri } from '@/services/fileSystem/index';

// 存储键常量定义
const KEY_THEME = 'theme';
const KEY_LANGUAGE = 'language';
const KEY_DIR_HANDLE = 'videoDirectoryHandle';
const KEY_DIR_PATH = 'videoDirectoryPath';
const KEY_DIR_NAME = 'videoDirectoryName';

/**
 * 获取本地存储的主题设置
 * @returns 主题模式 ('light' | 'dark' | 'system')，默认为 'system'
 */
export async function getStoredTheme(): Promise<ThemeMode> {
  const entry = await db.settings.get(KEY_THEME);
  return (entry?.value as ThemeMode) || 'system';
}

/**
 * 保存主题设置到本地数据库
 * @param theme 主题模式 ('light' | 'dark' | 'system')
 */
export async function setStoredTheme(theme: ThemeMode): Promise<void> {
  await db.settings.put({ key: KEY_THEME, value: theme });
}

/**
 * 获取本地存储的语言设置
 * @returns 语言类型 ('zh' | 'en')，默认为 'zh'
 */
export async function getStoredLanguage(): Promise<SupportedLanguage> {
  const entry = await db.settings.get(KEY_LANGUAGE);
  return (entry?.value as SupportedLanguage) || 'zh';
}

/**
 * 保存语言设置到本地数据库
 * @param language 语言类型 ('zh' | 'en')
 */
export async function setStoredLanguage(language: SupportedLanguage): Promise<void> {
  await db.settings.put({ key: KEY_LANGUAGE, value: language });
}

/**
 * 获取 Web 端存储的视频目录句柄（FileSystemDirectoryHandle）
 * @returns 目录句柄或 null
 */
export async function getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const entry = await db.settings.get(KEY_DIR_HANDLE);
  return (entry?.value as FileSystemDirectoryHandle) || null;
}

/**
 * 保存 Web 端视频目录句柄及其名称
 * @param handle 目录句柄
 */
export async function setStoredDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await db.settings.put({ key: KEY_DIR_HANDLE, value: handle });
  await db.settings.put({ key: KEY_DIR_NAME, value: handle.name });
}

/**
 * 获取 Tauri 桌面端存储的视频目录路径
 * @returns 目录绝对路径或 null
 */
export async function getStoredDirectoryPath(): Promise<string | null> {
  const entry = await db.settings.get(KEY_DIR_PATH);
  return (entry?.value as string) || null;
}

/**
 * 保存 Tauri 桌面端视频目录路径及名称
 * @param path 视频目录绝对路径
 * @param name 视频目录名称（可选）
 */
export async function setStoredDirectoryPath(path: string, name?: string): Promise<void> {
  await db.settings.put({ key: KEY_DIR_PATH, value: path });
  if (name) {
    await db.settings.put({ key: KEY_DIR_NAME, value: name });
  }
}

/**
 * 获取存储的视频目录显示名称
 * @returns 目录名称字符串，未设置时返回空字符串
 */
export async function getStoredDirectoryName(): Promise<string> {
  const entry = await db.settings.get(KEY_DIR_NAME);
  return (entry?.value as string) || '';
}

/**
 * 根据当前运行环境（Tauri 桌面端或 Web 浏览器端）获取通用的视频目录引用信息
 * @returns 目录引用对象（包含名称与对应环境的 path 或 handle），未配置时返回 null
 */
export async function getStoredDirectoryRef(): Promise<DirectoryRef | null> {
  const name = await getStoredDirectoryName();
  if (isTauri()) {
    const path = await getStoredDirectoryPath();
    if (!path) return null;
    return { name: name || path, path };
  } else {
    const handle = await getStoredDirectoryHandle();
    if (!handle) return null;
    return { name: name || handle.name, handle };
  }
}

/**
 * 保存视频目录引用信息，根据引用对象内容自动适配保存路径或句柄
 * @param ref 目录引用对象
 */
export async function setStoredDirectoryRef(ref: DirectoryRef): Promise<void> {
  await db.settings.put({ key: KEY_DIR_NAME, value: ref.name });
  if (ref.path) {
    await db.settings.put({ key: KEY_DIR_PATH, value: ref.path });
  }
  if (ref.handle) {
    await db.settings.put({ key: KEY_DIR_HANDLE, value: ref.handle });
  }
}

/**
 * 清除本地存储的视频目录全部信息（句柄、路径以及目录名称）
 */
export async function clearStoredDirectory(): Promise<void> {
  await db.settings.delete(KEY_DIR_HANDLE);
  await db.settings.delete(KEY_DIR_PATH);
  await db.settings.delete(KEY_DIR_NAME);
}
