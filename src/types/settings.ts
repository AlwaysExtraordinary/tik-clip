export type ThemeMode = 'light' | 'dark' | 'system';
export type SupportedLanguage = 'zh' | 'en' | 'ja';
export type StartupPage = '/clips' | '/videos' | '/coverflow';

export interface AppSettings {
  videoDirectoryName?: string;
  theme: ThemeMode;
  language: SupportedLanguage;
  startupPage?: StartupPage;
}

export interface StoredSettingsEntry {
  key: string;
  value: unknown;
}

