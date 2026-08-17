import { db } from '@/db/database';
import { ThemeMode, SupportedLanguage } from '@/types/settings';

const KEY_THEME = 'theme';
const KEY_LANGUAGE = 'language';
const KEY_DIR_HANDLE = 'videoDirectoryHandle';
const KEY_DIR_NAME = 'videoDirectoryName';

export async function getStoredTheme(): Promise<ThemeMode> {
  const entry = await db.settings.get(KEY_THEME);
  return (entry?.value as ThemeMode) || 'system';
}

export async function setStoredTheme(theme: ThemeMode): Promise<void> {
  await db.settings.put({ key: KEY_THEME, value: theme });
}

export async function getStoredLanguage(): Promise<SupportedLanguage> {
  const entry = await db.settings.get(KEY_LANGUAGE);
  return (entry?.value as SupportedLanguage) || 'zh';
}

export async function setStoredLanguage(language: SupportedLanguage): Promise<void> {
  await db.settings.put({ key: KEY_LANGUAGE, value: language });
}

export async function getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const entry = await db.settings.get(KEY_DIR_HANDLE);
  return (entry?.value as FileSystemDirectoryHandle) || null;
}

export async function setStoredDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await db.settings.put({ key: KEY_DIR_HANDLE, value: handle });
  await db.settings.put({ key: KEY_DIR_NAME, value: handle.name });
}

export async function getStoredDirectoryName(): Promise<string> {
  const entry = await db.settings.get(KEY_DIR_NAME);
  return (entry?.value as string) || '';
}

export async function clearStoredDirectory(): Promise<void> {
  await db.settings.delete(KEY_DIR_HANDLE);
  await db.settings.delete(KEY_DIR_NAME);
}
