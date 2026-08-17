export type ThemeMode = 'light' | 'dark' | 'system';
export type SupportedLanguage = 'zh' | 'en' | 'ja';

export interface AppSettings {
  videoDirectoryName?: string;
  theme: ThemeMode;
  language: SupportedLanguage;
}

export interface StoredSettingsEntry {
  key: string;
  value: unknown;
}
